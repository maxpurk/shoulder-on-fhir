/**
 * SDC calculatedExpression evaluation (real fhirpath)
 *
 * Evaluates the SDC `sdc-questionnaire-calculatedExpression` extension with the
 * real `fhirpath` npm package — the same library standard SDC engines
 * (NLM LForms) and HAPI `$extract` use — against a QuestionnaireResponse built
 * from the current form state. One mechanism, everywhere.
 *
 * This replaces QuestionnaireForm.tsx's former hand-rolled regex evaluator,
 * which understood only the Constant-Murley `...startsWith('PREFIX')...sum()`
 * shape and silently no-op'd on anything else (the reason the second
 * calculatedExpression in the IG — prior-treatment laterality → Procedure.bodySite
 * — had to be patched imperatively in bundleAssembler.ts). See ADR-0090 (the
 * regex pitfall), ADR-0100 (real fhirpath adopted for the sibling
 * initialExpression/itemPopulationContext features), ADR-0118 (complete-only
 * gating) and ADR-0171 (which deferred this refactor).
 *
 * The ONE piece of string matching kept, `dependencyLinkIdsOf`, reads only the
 * `linkId` predicate to know which leaves must be present for the completeness
 * gate — it does no value computation (that is now entirely fhirpath's job), so
 * it is not the fragile ADR-0090 arithmetic regex.
 */

import fhirpath from 'fhirpath'
import type { QuestionnaireItem, QuestionnaireResponse, Coding } from '../types/fhir'

export type CalcOutcome =
  | { kind: 'number'; value: number }
  | { kind: 'coding'; value: Coding }
  | { kind: 'incomplete' }

/**
 * The leaf linkIds a calculatedExpression depends on, derived from the
 * flattened Questionnaire item tree (a blank leaf may be entirely absent from
 * the QR rather than present-but-empty, so the questionnaire — not the QR —
 * supplies the full expected set). Recognises the two linkId-predicate shapes
 * this IG's expressions use:
 *   - `linkId.startsWith('PREFIX')` → every non-group leaf whose linkId starts
 *     with PREFIX (e.g. the four `obs.constant-score.*` sub-scores; the total
 *     `obs.constant-score`, having no trailing dot, is excluded naturally)
 *   - `linkId='LINKID'`            → that single leaf (e.g. `condition.laterality`)
 * Any other shape returns `[]` — no gating, the raw fhirpath result is applied
 * if non-empty.
 */
export function dependencyLinkIdsOf(expression: string, flatItems: QuestionnaireItem[]): string[] {
  const startsWith = expression.match(/linkId\.startsWith\('([^']+)'\)/)
  if (startsWith) {
    const prefix = startsWith[1]
    return flatItems.filter((it) => it.type !== 'group' && it.linkId.startsWith(prefix)).map((it) => it.linkId)
  }
  const eq = expression.match(/linkId\s*=\s*'([^']+)'/)
  if (eq) {
    const linkId = eq[1]
    return flatItems.filter((it) => it.linkId === linkId).map((it) => it.linkId)
  }
  return []
}

interface QRItemLike {
  linkId: string
  answer?: unknown[]
  item?: QRItemLike[]
}

/** Every linkId that carries at least one answer anywhere in the QR (recurses). */
function answeredLinkIds(qr: QuestionnaireResponse): Set<string> {
  const out = new Set<string>()
  const walk = (items?: QRItemLike[]): void => {
    for (const it of items ?? []) {
      if (Array.isArray(it.answer) && it.answer.length > 0) out.add(it.linkId)
      if (it.item) walk(it.item)
    }
  }
  walk((qr.item ?? []) as QRItemLike[])
  return out
}

/**
 * Evaluate one calculatedExpression against a QR shim.
 *
 * @param expression       the FHIRPath expression
 * @param qr               the QuestionnaireResponse built from current form state
 * @param dependencyLinkIds leaves that must all be answered before the result is
 *                          meaningful (ADR-0118); from `dependencyLinkIdsOf`
 * @param env              extra FHIRPath environment variables (e.g. %patient);
 *                         `%resource` is bound to the QR internally
 */
export function evaluateCalc(
  expression: string,
  qr: QuestionnaireResponse,
  dependencyLinkIds: string[],
  env: Record<string, unknown> = {},
): CalcOutcome {
  // Completeness gate (ADR-0118): a partial result (e.g. 3 of 4 Constant-Murley
  // sub-scores) is not clinically meaningful. Relies on buildQuestionnaireResponse
  // omitting empty-string answers, so an unfilled dependency is simply absent here.
  if (dependencyLinkIds.length > 0) {
    const answered = answeredLinkIds(qr)
    if (!dependencyLinkIds.every((id) => answered.has(id))) return { kind: 'incomplete' }
  }

  let result: unknown[]
  try {
    // %resource is NOT auto-bound by fhirpath — it must be supplied in the
    // environment or the expression throws (and would silently no-op in this
    // catch). Bind the QR shim as both the evaluation root and %resource so
    // `%resource.repeat(item)...` resolves.
    result = fhirpath.evaluate(qr, expression, { resource: qr, ...env }, undefined, { async: false }) as unknown[]
  } catch {
    return { kind: 'incomplete' }
  }

  if (!result || result.length === 0) return { kind: 'incomplete' }
  const first = result[0]
  if (typeof first === 'number') return { kind: 'number', value: first }
  if (first && typeof first === 'object' && 'code' in (first as Record<string, unknown>)) {
    return { kind: 'coding', value: first as Coding }
  }
  return { kind: 'incomplete' }
}
