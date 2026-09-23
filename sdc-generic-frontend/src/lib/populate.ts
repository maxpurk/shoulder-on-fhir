// SDC form population.
//
// Population and extraction are independent features of the standard: this
// module runs before the form is drawn and has no opinion about how the filled
// form will later be turned into resources. Everything it does is declared by
// the Questionnaire itself, so it holds no knowledge of any implementation
// guide.
//
// Four declarations are honoured, plus core FHIR initial values:
//   launchContext          resources the form asks to be handed at launch
//   sourceQueries          a contained batch of queries run before the form is
//                          drawn, bound under the contained resource's own id
//   itemPopulationContext  a query whose result is bound for an item subtree
//   initialExpression      FHIRPath yielding the answer to seed
//   item.initial[x]        a fixed seed value, core FHIR rather than SDC

import fhirpath from 'fhirpath'
import fhirR4Model from 'fhirpath/fhir-context/r4'

const LAUNCH_EXT = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-launchContext'
const POPCTX_EXT = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemPopulationContext'
const INITIAL_EXT = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression'
const SOURCEQ_EXT = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-sourceQueries'

interface Ext { url: string; [k: string]: unknown }
interface ValueExpression { name?: string; language?: string; expression?: string }
interface PItem {
  linkId: string; type: string; item?: PItem[]; extension?: Ext[]
  initial?: Array<Record<string, unknown>>
}
interface PQ { item?: PItem[]; extension?: Ext[]; contained?: Array<Record<string, unknown>> }

export interface LaunchContext { name: string; type: string; description?: string }

/** The resources a Questionnaire asks to be handed when it is launched. */
export function launchContextsOf(q: PQ): LaunchContext[] {
  return (q.extension ?? [])
    .filter((e) => e.url === LAUNCH_EXT)
    .map((e) => {
      const parts = (e.extension ?? []) as Ext[]
      const part = (n: string) => parts.find((p) => p.url === n)
      const nameCoding = part('name') as { valueCoding?: { code?: string }; valueId?: string } | undefined
      return {
        name: nameCoding?.valueCoding?.code ?? nameCoding?.valueId ?? '',
        type: (part('type') as { valueCode?: string } | undefined)?.valueCode ?? 'Resource',
        description: (part('description') as { valueString?: string } | undefined)?.valueString,
      }
    })
    .filter((c) => !!c.name)
}

type Env = Record<string, unknown>

function evaluate(expression: string, env: Env): unknown[] {
  // A population expression reads only the environment: there is no resource
  // under evaluation yet, which is the whole point of populating.
  try {
    return fhirpath.evaluate({}, expression, env, fhirR4Model) as unknown[]
  } catch {
    return []
  }
}

/**
 * An x-fhir-query carries FHIRPath in `{{ }}` placeholders, so the query is
 * only known once the launch resources are in hand.
 */
export function resolveQuery(expression: string, env: Env): string {
  return expression.replace(/\{\{(.*?)\}\}/g, (_m, inner: string) => {
    const r = evaluate(String(inner).trim(), env)
    const v = r[0]
    return v === undefined || v === null ? '' : String(v)
  })
}

/** Shape a FHIRPath result the way the renderer stores answers for that item. */
function coerce(item: PItem, raw: unknown): unknown {
  if (raw === null || raw === undefined) return undefined
  switch (item.type) {
    case 'boolean':
      return raw === true || raw === 'true'
    case 'decimal':
    case 'integer': {
      const n = Number(typeof raw === 'object' ? (raw as { value?: unknown }).value : raw)
      return Number.isFinite(n) ? n : undefined
    }
    case 'choice':
    case 'open-choice':
      if (typeof raw === 'object') {
        const c = raw as { system?: string; code?: string; display?: string; coding?: unknown[] }
        if (c.code) return { system: c.system, code: c.code, display: c.display }
        const first = (c.coding ?? [])[0] as { system?: string; code?: string; display?: string } | undefined
        return first?.code ? { system: first.system, code: first.code, display: first.display } : undefined
      }
      return { code: String(raw) }
    default:
      return typeof raw === 'object' ? undefined : String(raw)
  }
}

/** The first `initial[x]` a core-FHIR item declares, whatever its value type. */
function initialOf(item: PItem): unknown {
  const first = (item.initial ?? [])[0]
  if (!first) return undefined
  const key = Object.keys(first).find((k) => k.startsWith('value'))
  return key ? first[key] : undefined
}

function extOf(item: PItem | PQ, url: string): Ext | undefined {
  return (item.extension ?? []).find((x) => x.url === url)
}

export interface PopulateResult {
  values: Record<string, unknown>
  /** Queries that were run, for the operator to see what the form asked for. */
  queries: string[]
  failed: string[]
}

/**
 * Run the batches a Questionnaire asks to be run before it is filled in.
 *
 * Each sourceQueries extension points at a contained Bundle of requests. The
 * answers come back as a Bundle of their own, bound under the contained
 * resource's id, because that is the name the form's expressions use for it.
 */
async function runSourceQueries(
  q: PQ,
  env: Env,
  fhirQuery: (relativeUrl: string) => Promise<unknown>,
  queries: string[],
  failed: string[],
): Promise<Env> {
  const out: Env = { ...env }
  for (const e of (q.extension ?? []).filter((x) => x.url === SOURCEQ_EXT)) {
    const ref = (e as { valueReference?: { reference?: string } }).valueReference?.reference
    if (!ref?.startsWith('#')) continue
    const id = ref.slice(1)
    const batch = (q.contained ?? []).find((c) => c.id === id) as
      { entry?: Array<{ request?: { url?: string } }> } | undefined
    if (!batch) { failed.push(`${id}: no contained batch at ${ref}`); continue }
    const entry: Array<{ resource: unknown }> = []
    for (const req of batch.entry ?? []) {
      const raw = req.request?.url
      if (!raw) continue
      const url = resolveQuery(raw, out)
      queries.push(url)
      try {
        entry.push({ resource: await fhirQuery(url) })
      } catch (err) {
        failed.push(`${id}: ${url}: ${String(err)}`)
      }
    }
    out[id] = { resourceType: 'Bundle', type: 'batch-response', entry }
  }
  return out
}

/**
 * Walks the Questionnaire, running each item population context as it comes
 * into scope and seeding every item that declares how to seed itself.
 */
export async function populate(
  q: PQ,
  launch: Env,
  fhirQuery: (relativeUrl: string) => Promise<unknown>,
): Promise<PopulateResult> {
  const values: Record<string, unknown> = {}
  const queries: string[] = []
  const failed: string[] = []

  async function walk(items: PItem[] | undefined, env: Env): Promise<void> {
    for (const item of items ?? []) {
      let scoped = env

      const ctx = extOf(item, POPCTX_EXT) as { valueExpression?: ValueExpression } | undefined
      const ve = ctx?.valueExpression
      if (ve?.name && ve.expression) {
        if (ve.language === 'application/x-fhir-query') {
          const url = resolveQuery(ve.expression, env)
          queries.push(url)
          try {
            const bundle = (await fhirQuery(url)) as {
              entry?: Array<{ resource?: unknown }>; resourceType?: string
            }
            const hits = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean)
            // A search yields a Bundle; a read yields the resource itself.
            scoped = { ...env, [ve.name]: hits.length ? hits[0] : (bundle.resourceType ? bundle : undefined) }
          } catch (e) {
            failed.push(`${ve.name}: ${String(e)}`)
            scoped = { ...env, [ve.name]: undefined }
          }
        } else {
          const r = evaluate(ve.expression, env)
          scoped = { ...env, [ve.name]: r.length ? r[0] : undefined }
        }
      }

      const init = extOf(item, INITIAL_EXT) as { valueExpression?: ValueExpression } | undefined
      const expr = init?.valueExpression?.expression
      if (expr) {
        const r = evaluate(expr, scoped)
        const v = coerce(item, r[0])
        if (v !== undefined && v !== '') values[item.linkId] = v
      } else {
        const fixed = initialOf(item)
        if (fixed !== undefined) {
          const v = coerce(item, fixed)
          if (v !== undefined) values[item.linkId] = v
        }
      }

      await walk(item.item, scoped)
    }
  }

  const env = await runSourceQueries(q, launch, fhirQuery, queries, failed)
  await walk(q.item, env)
  return { values, queries, failed }
}
