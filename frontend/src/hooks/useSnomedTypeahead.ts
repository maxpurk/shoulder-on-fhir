/**
 * useSnomedTypeahead Hook
 *
 * Debounced filter-driven ValueSet typeahead. Delegates to `searchValueSet`
 * which routes by URL pattern: SNOMED implicit subsets
 * (`http://snomed.info/sct?fhir_vs=…`) go straight to `tx.fhir.org` because
 * HAPI cannot walk the SNOMED hierarchy locally (ADR-0062); all other VS
 * URLs are expanded against HAPI as before.
 *
 * Fires only when the query is at least 2 characters; debounced 250 ms.
 *
 * Optional `excludeValueSetUrl`: when provided, results whose code belongs
 * to that second ValueSet are filtered out client-side (ADR-0084) — used by
 * the comorbidity picker to exclude shoulder-region disorders, which belong
 * on RotatorCuffCondition / ShoulderDiagnosisCondition instead.
 *
 * See ADR-0055 (resource-level IPS Problems binding), ADR-0062
 * (typeahead-UX vs validation-binding split), and ADR-0084 (exclusion
 * mechanism).
 */

import { useEffect, useState } from 'react'
import { searchValueSet } from '../lib/terminologyService'
import type { TermOption } from '../lib/terminologyService'

interface UseSnomedTypeaheadResult {
  options: TermOption[]
  loading: boolean
  error: string | null
}

export function useSnomedTypeahead(
  valueSetUrl: string,
  query: string,
  debounceMs = 250,
  excludeValueSetUrl?: string | readonly string[],
): UseSnomedTypeaheadResult {
  const [options, setOptions] = useState<TermOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setOptions([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const timer = setTimeout(() => {
      searchValueSet(valueSetUrl, trimmed, 20, excludeValueSetUrl)
        .then((result) => {
          if (!cancelled) setOptions(result)
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Failed to search terminology')
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [valueSetUrl, query, debounceMs, excludeValueSetUrl])

  return { options, loading, error }
}
