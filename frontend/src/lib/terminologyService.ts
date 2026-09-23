/**
 * Terminology Service
 *
 * Fetches and caches ValueSet expansions from the FHIR server.
 * Results are cached in memory for the lifetime of the page — one round-trip
 * per ValueSet URL per session.
 *
 * SNOMED-implicit subsets (`http://snomed.info/sct?fhir_vs=…`) are dispatched
 * directly to `tx.fhir.org` because HAPI cannot expand SNOMED VSs with
 * `descendent-of` filters — it has no local SNOMED CodeSystem and its
 * `remote_terminology_service.snomed` delegation only covers code-level ops,
 * not hierarchy traversal (ADR-0062 extends the ADR-0050 boundary). All other
 * VS URLs continue to expand against HAPI via `fhirClient.expand`.
 */

import fhirClient from './fhirClient'

// Default routes through the same-origin /tx-fhir proxy declared in
// vite.config.ts (dev) and nginx.conf (prod). Same-origin requests avoid
// tx.fhir.org's duplicate CORS headers, which Chromium rejects with
// "Failed to fetch" despite HTTP 200 (ADR-0062 amendment 2026-05-23).
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
const exclusionCache = new Map<string, Promise<Set<string>>>()

/**
 * Expand a ValueSet by its canonical URL.
 * Returns a flat array of TermOption, sorted by the server expansion order.
 * Results are cached: repeated calls with the same URL return immediately.
 */
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

  // Only cache non-empty results: a transient empty return (HAPI's NOT_EXPANDED
  // in-memory fallback firing before pre-expansion / IPS load completes) would
  // otherwise pin an empty dropdown for the whole session.
  if (options.length > 0) {
    cache.set(valueSetUrl, options)
  }
  return options
}

/**
 * Fetch and cache the full code set of a ValueSet, for use as a client-side
 * exclusion blocklist against a separate typeahead's results.
 *
 * Not a general-purpose expansion helper — always fetches with a large count
 * and no `filter`, since the caller needs the complete set once, not a
 * paginated/searched view. One round-trip per URL for the lifetime of the
 * page (module-level cache, matches the `expandValueSet` cache pattern).
 */
function getExclusionSet(valueSetUrl: string): Promise<Set<string>> {
  let cached = exclusionCache.get(valueSetUrl)
  if (!cached) {
    cached = (
      valueSetUrl.startsWith(SNOMED_IMPLICIT_PREFIX)
        ? expandViaTx(valueSetUrl, '', 2000)
        : fhirClient.expand<ValueSetExpansion>(valueSetUrl, { count: 2000 })
    ).then(
      (result) =>
        new Set(
          (result.expansion?.contains ?? [])
            .map((c) => c.code)
            .filter((c): c is string => Boolean(c)),
        ),
    )
    exclusionCache.set(valueSetUrl, cached)
  }
  return cached
}

/**
 * Search a ValueSet with a server-side `filter` (typeahead).
 *
 * Results vary by filter so they are not memoized. Returns up to `count`
 * matches (default 20) — fewer if `excludeValueSetUrl` filters some out.
 *
 * Dispatch:
 *  - SNOMED implicit subset URLs (`http://snomed.info/sct?fhir_vs=…`) — sent
 *    directly to `tx.fhir.org/r4/ValueSet/$expand`. HAPI cannot walk the
 *    SNOMED hierarchy locally and its `remote_terminology_service.snomed`
 *    delegation does not cover VS expansion (ADR-0062).
 *  - All other URLs (local IG VSs, IPS LOINC VSs, etc.) — expanded against
 *    HAPI via `fhirClient.expand`.
 *
 * `excludeValueSetUrl` (optional): codes belonging to this second ValueSet
 * (or the union of several, if given an array) are filtered out of the
 * results client-side, after the primary search. Server-side `compose.exclude`
 * was tried and rejected (ADR-0084) — tx.fhir.org throws when a text `filter`
 * is combined with `exclude` in a POST `$expand` body, and does not support
 * the `ecl/` implicit-VS form needed to express "A minus B" as a single GET
 * request. An array is supported because a single SNOMED grouper concept's
 * inferred closure is not always complete (ADR-0084 documents one such gap).
 */
export async function searchValueSet(
  valueSetUrl: string,
  filter: string,
  count = 20,
  excludeValueSetUrl?: string | readonly string[],
): Promise<TermOption[]> {
  const result = valueSetUrl.startsWith(SNOMED_IMPLICIT_PREFIX)
    ? await expandViaTx(valueSetUrl, filter, count)
    : await fhirClient.expand<ValueSetExpansion>(valueSetUrl, { filter, count })
  const options = (result.expansion?.contains ?? [])
    .filter((c): c is Required<Pick<ExpansionContains, 'code' | 'system'>> & ExpansionContains =>
      Boolean(c.code && c.system)
    )
    .map((c) => ({
      code: c.code,
      display: c.display ?? c.code,
      system: c.system,
    }))
  if (!excludeValueSetUrl) return options
  const excludeUrls = Array.isArray(excludeValueSetUrl) ? excludeValueSetUrl : [excludeValueSetUrl]
  const exclusionSets = await Promise.all(excludeUrls.map((url) => getExclusionSet(url)))
  return options.filter((o) => !exclusionSets.some((set) => set.has(o.code)))
}

async function expandViaTx(
  valueSetUrl: string,
  filter: string,
  count: number,
): Promise<ValueSetExpansion> {
  const url =
    `${TX_FHIR_URL}/ValueSet/$expand` +
    `?url=${encodeURIComponent(valueSetUrl)}` +
    `&filter=${encodeURIComponent(filter)}` +
    `&count=${count}`
  const response = await fetch(url, { headers: { Accept: 'application/fhir+json' } })
  if (!response.ok) {
    throw new Error(
      `FHIR request failed: ${response.status} ${response.statusText} (tx.fhir.org)`,
    )
  }
  return response.json()
}
