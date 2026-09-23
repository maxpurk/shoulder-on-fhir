// Thin FHIR/REST helpers. No registry knowledge: every canonical and every
// profile id arrives from the server or from the Questionnaire.

// The address of each server is resolved per call rather than captured once, so
// changing it in the UI takes effect without a reload and without a rebuild.
import { endpoint } from './config'

const BASE = () => endpoint('fhir')

export async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: { Accept: 'application/fhir+json' } })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`)
  return r.json()
}

export async function listQuestionnaires(): Promise<Array<{ url: string; title: string; id: string }>> {
  const b = (await getJson(`${BASE()}/Questionnaire?_count=50`)) as {
    entry?: Array<{ resource?: { id?: string; url?: string; title?: string; name?: string } }>
  }
  return (b.entry ?? [])
    .map((e) => e.resource)
    .filter((r): r is { id: string; url: string; title?: string; name?: string } => !!r?.url && !!r.id)
    .map((r) => ({ id: r.id, url: r.url, title: r.title ?? r.name ?? r.id }))
}

export async function listBundleProfiles(): Promise<Array<{ url: string; title: string }>> {
  const b = (await getJson(`${BASE()}/StructureDefinition?type=Bundle&_count=50`)) as {
    entry?: Array<{ resource?: { url?: string; title?: string; name?: string } }>
  }
  return (b.entry ?? [])
    .map((e) => e.resource)
    .filter((r): r is { url: string; title?: string; name?: string } => !!r?.url)
    .map((r) => ({ url: r.url, title: r.title ?? r.name ?? r.url }))
}

export async function getQuestionnaire(id: string): Promise<unknown> {
  return getJson(`${BASE()}/Questionnaire/${id}`)
}

export async function expand(valueSetUrl: string): Promise<Array<{ system?: string; code: string; display?: string }>> {
  try {
    const vs = (await getJson(`${BASE()}/ValueSet/$expand?url=${encodeURIComponent(valueSetUrl)}`)) as {
      expansion?: { contains?: Array<{ system?: string; code?: string; display?: string }> }
    }
    const rows = vs.expansion?.contains ?? []
    if (rows.length) return rows.filter((c): c is { code: string } => !!c.code)
  } catch { /* fall through */ }
  try {
    const b = (await getJson(`${BASE()}/ValueSet?url=${encodeURIComponent(valueSetUrl)}`)) as {
      entry?: Array<{ resource?: { expansion?: { contains?: Array<{ system?: string; code?: string; display?: string }> } } }>
    }
    const rows = b.entry?.[0]?.resource?.expansion?.contains ?? []
    if (rows.length) return rows.filter((c): c is { code: string } => !!c.code)
  } catch { /* fall through */ }
  // A value set defined by a SNOMED subsumption filter cannot be expanded by a
  // server that holds no SNOMED CodeSystem. Ask a terminology server that does.
  try {
    const tx = (await getJson(
      `${endpoint('tx')}/ValueSet/$expand?url=${encodeURIComponent(valueSetUrl)}&count=500`,
    )) as { expansion?: { contains?: Array<{ system?: string; code?: string; display?: string }> } }
    return (tx.expansion?.contains ?? []).filter((c): c is { code: string } => !!c.code)
  } catch { return [] }
}

/** A relative FHIR search or read, as an x-fhir-query in a Questionnaire states it. */
export async function fhirQuery(relativeUrl: string): Promise<unknown> {
  return getJson(`${BASE()}/${relativeUrl.replace(/^\//, '')}`)
}

/**
 * Candidates for a launch context of a given resource type. The type is whatever
 * the Questionnaire declared, so the search is by the core parameters every
 * server supports rather than by anything a particular guide defines.
 */
export async function findLaunchCandidates(
  type: string, text: string,
): Promise<Array<{ id: string; label: string }>> {
  const t = text.trim()
  if (!t) return []
  const tries = [`${type}?name=${encodeURIComponent(t)}&_count=10`,
                 `${type}?identifier=${encodeURIComponent(t)}&_count=10`,
                 `${type}?_id=${encodeURIComponent(t)}`]
  for (const url of tries) {
    try {
      const b = (await getJson(`${BASE()}/${url}`)) as {
        entry?: Array<{ resource?: { id?: string; name?: unknown } }>
      }
      const rows = (b.entry ?? []).map((e) => e.resource).filter((r): r is { id: string } => !!r?.id)
      if (rows.length) return rows.map((r) => ({ id: r.id, label: labelOf(r) }))
    } catch { /* an unsupported search parameter is not an error, just a miss */ }
  }
  return []
}

/** A human label from whatever the resource happens to carry. */
function labelOf(r: Record<string, unknown>): string {
  const names = r.name as Array<{ family?: string; given?: string[]; text?: string }> | string | undefined
  if (typeof names === 'string') return `${names} (${r.id})`
  const n = Array.isArray(names) ? names[0] : undefined
  if (n) {
    const txt = n.text ?? [...(n.given ?? []), n.family].filter(Boolean).join(' ')
    if (txt) return `${txt} (${r.id})`
  }
  const title = r.title as string | undefined
  return title ? `${title} (${r.id})` : String(r.id)
}

// The validation engine reports the human-readable message in `details.text`;
// `diagnostics` is left unset. Both are carried so whichever one a given server
// populates is available to the caller.
export interface ValidationIssue {
  severity: string
  code?: string
  details?: { text?: string }
  diagnostics?: string
  expression?: string[]
}

/** The message a server put on an issue, wherever it chose to put it. */
export function issueText(i: ValidationIssue): string {
  return i.details?.text ?? i.diagnostics ?? i.code ?? ''
}

/** Pre-flight against the validator sidecar, using an explicitly chosen profile. */
export async function validateBundle(bundle: unknown, profile: string): Promise<ValidationIssue[]> {
  const r = await fetch(`${endpoint('validate')}?profile=${encodeURIComponent(profile)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json' },
    body: JSON.stringify(bundle),
  })
  const oo = (await r.json()) as { issue?: ValidationIssue[] }
  return oo.issue ?? []
}

export async function submitBundle(bundle: unknown): Promise<unknown> {
  const r = await fetch(`${BASE()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json' },
    body: JSON.stringify(bundle),
  })
  const body = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(body).slice(0, 800))
  return body
}

/**
 * A value set too large or too dependent to enumerate is searched instead of
 * listed. The storage server holds the definitions but no SNOMED CodeSystem, so
 * the composition is flattened here, any CodeSystem the terminology server will
 * not know travels with the request, and the filter does the work.
 */
const BIG_SYSTEMS = ['http://snomed.info/sct', 'http://loinc.org', 'http://unitsofmeasure.org']

async function storedByUrl(type: 'ValueSet' | 'CodeSystem', url: string): Promise<Json | undefined> {
  const b = (await getJson(`${BASE()}/${type}?url=${encodeURIComponent(url)}`)) as {
    entry?: Array<{ resource?: Json }>
  }
  return b.entry?.[0]?.resource
}

interface Include { system?: string; valueSet?: string[]; concept?: unknown[]; filter?: unknown[] }
type Json = Record<string, unknown>

async function flattenIncludes(url: string, depth = 0): Promise<Include[]> {
  if (depth > 4) return []
  const vs = (await storedByUrl('ValueSet', url)) as { compose?: { include?: Include[] } } | undefined
  if (!vs?.compose?.include) return []
  const out: Include[] = []
  for (const inc of vs.compose.include) {
    if (inc.valueSet?.length) {
      for (const v of inc.valueSet) out.push(...(await flattenIncludes(v, depth + 1)))
    } else out.push(inc)
  }
  return out
}

export async function searchValueSet(
  valueSetUrl: string, filter: string, count = 20,
): Promise<Array<{ system?: string; code: string; display?: string }>> {
  const include = await flattenIncludes(valueSetUrl)
  if (!include.length) return []
  const extra: Array<{ name: string; resource: Json }> = []
  for (const inc of include) {
    if (inc.system && !BIG_SYSTEMS.includes(inc.system)) {
      const cs = await storedByUrl('CodeSystem', inc.system)
      if (cs) extra.push({ name: 'tx-resource', resource: cs })
    }
  }
  const body = {
    resourceType: 'Parameters',
    parameter: [
      { name: 'valueSet', resource: { resourceType: 'ValueSet', status: 'active', compose: { include } } },
      { name: 'filter', valueString: filter },
      { name: 'count', valueInteger: count },
      ...extra,
    ],
  }
  const r = await fetch(`${endpoint('tx')}/ValueSet/$expand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json', Accept: 'application/fhir+json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) return []
  const j = (await r.json()) as { expansion?: { contains?: Array<{ system?: string; code?: string; display?: string }> } }
  return (j.expansion?.contains ?? []).filter((c): c is { code: string } => !!c.code)
}
