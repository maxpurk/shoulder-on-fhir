/**
 * Terminology Service — fetches and caches ValueSet expansions from HAPI.
 * `expandValueSet` is identical to the primary frontend's terminologyService.
 *
 * `searchValueSet`/`expandViaTx` (added per ADR-0137, ported from the same
 * file in the unified frontend): SDC's bounded-dropdown `answerValueSet`
 * items go through `expandValueSet` above; these exist solely for the
 * comorbidity picker's free-text search, which needs a server-side `filter`
 * against a ValueSet too large to enumerate as a dropdown (IPS Problems /
 * SNOMED Clinical finding). SNOMED-implicit-VS routing rationale (ADR-0062):
 * HAPI cannot walk the SNOMED hierarchy locally, so `isa/` implicit-VS URLs
 * go straight to `tx.fhir.org` via the same-origin `/tx-fhir` proxy (added
 * to `vite.config.ts`/`nginx.conf` alongside this file).
 */

import fhirClient from './fhirClient'

const TX_FHIR_URL = import.meta.env.VITE_TX_FHIR_URL || '/tx-fhir'
const SNOMED_IMPLICIT_PREFIX = 'http://snomed.info/sct?fhir_vs='

export interface TermOption {
  code: string
  display: string
  system: string
}

interface ExpansionContains {
  system?: string
  code?: string
  display?: string
}

interface ValueSetExpansion {
  resourceType: string
  expansion?: {
    total?: number
    contains?: ExpansionContains[]
  }
}

const cache = new Map<string, TermOption[]>()

export async function expandValueSet(valueSetUrl: string): Promise<TermOption[]> {
  if (cache.has(valueSetUrl)) {
    return cache.get(valueSetUrl)!
  }

  const result = await fhirClient.expand<ValueSetExpansion>(valueSetUrl)
  const options: TermOption[] = (result.expansion?.contains ?? [])
    .filter((c): c is Required<Pick<ExpansionContains, 'code' | 'system'>> & ExpansionContains =>
      Boolean(c.code && c.system)
    )
    .map((c) => ({
      code: c.code,
      display: c.display ?? c.code,
      system: c.system,
    }))

  cache.set(valueSetUrl, options)
  return options
}

function toOptions(result: ValueSetExpansion): TermOption[] {
  return (result.expansion?.contains ?? [])
    .filter((c): c is Required<Pick<ExpansionContains, 'code' | 'system'>> & ExpansionContains =>
      Boolean(c.code && c.system)
    )
    .map((c) => ({ code: c.code, display: c.display ?? c.code, system: c.system }))
}

async function expandViaTx(valueSetUrl: string, filter: string, count: number): Promise<ValueSetExpansion> {
  const url =
    `${TX_FHIR_URL}/ValueSet/$expand` +
    `?url=${encodeURIComponent(valueSetUrl)}` +
    `&filter=${encodeURIComponent(filter)}` +
    `&count=${count}`
  const response = await fetch(url, { headers: { Accept: 'application/fhir+json' } })
  if (!response.ok) {
    throw new Error(`FHIR request failed: ${response.status} ${response.statusText} (tx.fhir.org)`)
  }
  return response.json()
}

const exclusionCache = new Map<string, Promise<Set<string>>>()

/** Fetches and caches the complete code set of a ValueSet for client-side exclusion (ADR-0084). */
function getExclusionSet(valueSetUrl: string): Promise<Set<string>> {
  let cached = exclusionCache.get(valueSetUrl)
  if (!cached) {
    cached = (
      valueSetUrl.startsWith(SNOMED_IMPLICIT_PREFIX)
        ? expandViaTx(valueSetUrl, '', 2000)
        : fhirClient.expandFiltered<ValueSetExpansion>(valueSetUrl, '', 2000)
    ).then(
      (result) => new Set((result.expansion?.contains ?? []).map((c) => c.code).filter((c): c is string => Boolean(c)))
    )
    exclusionCache.set(valueSetUrl, cached)
  }
  return cached
}

/**
 * Search a ValueSet with a server-side `filter` (typeahead). Not memoized —
 * results vary by filter. `excludeValueSetUrl` (optional): codes belonging
 * to that second ValueSet (or the union of several) are filtered out
 * client-side, same ADR-0084 pattern as unified.
 */
export async function searchValueSet(
  valueSetUrl: string,
  filter: string,
  count = 20,
  excludeValueSetUrl?: string | readonly string[],
): Promise<TermOption[]> {
  const result = valueSetUrl.startsWith(SNOMED_IMPLICIT_PREFIX)
    ? await expandViaTx(valueSetUrl, filter, count)
    : await fhirClient.expandFiltered<ValueSetExpansion>(valueSetUrl, filter, count)
  const options = toOptions(result)
  if (!excludeValueSetUrl) return options
  const excludeUrls = Array.isArray(excludeValueSetUrl) ? excludeValueSetUrl : [excludeValueSetUrl]
  const exclusionSets = await Promise.all(excludeUrls.map((url) => getExclusionSet(url)))
  return options.filter((o) => !exclusionSets.some((set) => set.has(o.code)))
}
