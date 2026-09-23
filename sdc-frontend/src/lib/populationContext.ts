/**
 * SDC itemPopulationContext + initialExpression resolution
 *
 * Walks a Questionnaire's items for the sdc-questionnaire-itemPopulationContext
 * extension (group-level, application/x-fhir-query — mirrors the
 * extractionContextOf() pattern in extractor.ts), resolves each named context
 * to a FHIR resource via a plain REST search, then evaluates every leaf's
 * sdc-questionnaire-initialExpression against those named resources using the
 * `fhirpath` npm package.
 *
 * Read-only, display-only: this module only produces values to show in the
 * form (QuestionnaireForm's initialOverrides prop). It must never become the
 * source of truth for cross-resource references written into the submitted
 * bundle — that remains bundleAssembler.ts's job via LaunchContext
 * (ADR-0100, ADR-0101).
 *
 * ADR-0090 found this codebase's one prior hand-rolled FHIRPath-lite
 * evaluator (QuestionnaireForm.tsx's former evaluateCalcExpr) silently broken
 * for years on a regex miscount. initialExpression can be an arbitrary dot-path,
 * so this module used the real `fhirpath` library instead of repeating that
 * mistake; the calculatedExpression path has since been migrated to the same
 * library too (lib/calculatedExpression.ts, ADR-0174).
 */

import fhirpath from 'fhirpath'
import { fhirClient } from './fhirClient'
import type { Questionnaire, QuestionnaireItem } from '../types/fhir'
import type { LaunchContext } from './bundleAssembler'

const SDC_POPULATION_CTX = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemPopulationContext'
const SDC_INITIAL_EXPR = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression'
const SDC_LAUNCH_CTX = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-launchContext'

interface PopulationContextDecl {
  contextName: string
  queryTemplate: string
}

export interface FhirResourceLike {
  resourceType: string
  id?: string
  [key: string]: unknown
}

interface LaunchContextDecl {
  /** FHIRPath variable name the Questionnaire wants this resource bound to, e.g. "patient". */
  name: string
  /** Resource type this launch context expects, e.g. "Patient". */
  type: string
}

/**
 * Read the Questionnaire's own top-level sdc-questionnaire-launchContext
 * declarations (root-level extension, not per-item — this is what SDC uses
 * to say "the host app must supply a resource of this type before the form
 * can render"). Previously this extension was declared in FSH but nothing in
 * the frontend actually read it: PatientLookup ran (or didn't) based on a
 * hardcoded `flow !== 'registration'` check, not on this declaration.
 */
export function extractLaunchContextDecls(questionnaire: Questionnaire): LaunchContextDecl[] {
  const out: LaunchContextDecl[] = []
  for (const ext of questionnaire.extension ?? []) {
    if (ext.url !== SDC_LAUNCH_CTX) continue
    const sub = (ext as unknown as {
      extension?: Array<{ url: string; valueCode?: string; valueCoding?: { code?: string } }>
    }).extension ?? []
    const name = sub.find((e) => e.url === 'name')?.valueCoding?.code
    const type = sub.find((e) => e.url === 'type')?.valueCode
    if (name && type) out.push({ name, type })
  }
  return out
}

/** Whether this Questionnaire declares a Patient-typed launch context — i.e. whether a
 * patient must be resolved (via PatientLookup) before the form can render, per the
 * Questionnaire's own declaration rather than a hardcoded per-flow assumption. */
export function requiresPatientLaunchContext(questionnaire: Questionnaire): boolean {
  return extractLaunchContextDecls(questionnaire).some((d) => d.type === 'Patient')
}

/**
 * Merge already-resolved launch-context resources (e.g. the Patient object
 * PatientLookup already fetched) into the FHIRPath environment, keyed by
 * whatever name the Questionnaire itself declares for that resource type —
 * not a hardcoded "patient" string. Mutates and returns `resolved` so it can
 * be chained with resolvePopulationContexts()'s output.
 */
export function withLaunchContextResources(
  questionnaire: Questionnaire,
  resourcesByType: Partial<Record<string, FhirResourceLike>>,
  resolved: Record<string, FhirResourceLike>,
): Record<string, FhirResourceLike> {
  for (const decl of extractLaunchContextDecls(questionnaire)) {
    const resource = resourcesByType[decl.type]
    if (resource) resolved[decl.name] = resource
  }
  return resolved
}

/** Walk group items for the itemPopulationContext extension (recurses into sub-groups). */
export function extractPopulationContexts(items: QuestionnaireItem[]): PopulationContextDecl[] {
  const out: PopulationContextDecl[] = []
  for (const item of items) {
    const ext = (item.extension ?? []).find((e) => e.url === SDC_POPULATION_CTX)
    if (ext) {
      const expr = ext as unknown as { valueExpression?: { name?: string; expression?: string } }
      const { name, expression } = expr.valueExpression ?? {}
      if (name && expression) out.push({ contextName: name, queryTemplate: expression })
    }
    if (item.item) out.push(...extractPopulationContexts(item.item))
  }
  return out
}

/**
 * Resolve each declared population context to a FHIR resource. The IG only
 * ever uses one query variable (`{{%patient.id}}`) today — a plain string
 * replace is sufficient; not building a general templating engine for a
 * single substitution (see plan's Recommended architecture §1).
 */
export async function resolvePopulationContexts(
  contexts: PopulationContextDecl[],
  launchContext: LaunchContext,
): Promise<Record<string, FhirResourceLike>> {
  const resolved: Record<string, FhirResourceLike> = {}
  for (const { contextName, queryTemplate } of contexts) {
    const query = queryTemplate.replace('{{%patient.id}}', launchContext.patientId)
    const [resourceType, paramString] = query.split('?')
    const params = Object.fromEntries(new URLSearchParams(paramString ?? ''))
    const bundle = await fhirClient.search<FhirResourceLike>(resourceType, params)
    const resource = bundle.entry?.[0]?.resource
    if (resource) resolved[contextName] = resource
  }
  return resolved
}

/** Walk leaf items for the initialExpression extension (recurses into sub-groups). */
function findInitialExpressionItems(items: QuestionnaireItem[]): Array<{ linkId: string; expression: string }> {
  const out: Array<{ linkId: string; expression: string }> = []
  for (const item of items) {
    const ext = (item.extension ?? []).find((e) => e.url === SDC_INITIAL_EXPR)
    if (ext) {
      const expr = ext as unknown as { valueExpression?: { expression?: string } }
      if (expr.valueExpression?.expression) out.push({ linkId: item.linkId, expression: expr.valueExpression.expression })
    }
    if (item.item) out.push(...findInitialExpressionItems(item.item))
  }
  return out
}

/**
 * Evaluate every initialExpression leaf against the resolved population
 * contexts, returning linkId → display string overrides. An expression that
 * fails to evaluate (context not resolved, path yields nothing) is simply
 * omitted — the field stays blank rather than the form breaking.
 */
export function evaluateInitialExpressions(
  items: QuestionnaireItem[],
  resolvedContexts: Record<string, FhirResourceLike>,
): Record<string, string> {
  const overrides: Record<string, string> = {}
  for (const { linkId, expression } of findInitialExpressionItems(items)) {
    try {
      const result = fhirpath.evaluate({}, expression, resolvedContexts, undefined, { async: false })
      if (result.length > 0) overrides[linkId] = String(result[0])
    } catch {
      // Leave unset — see doc comment above.
    }
  }
  return overrides
}
