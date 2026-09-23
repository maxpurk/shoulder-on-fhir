/**
 * useValueSet Hook
 *
 * Fetches a ValueSet expansion from the FHIR server and returns the options
 * along with loading and error state.
 *
 * Pass null as the URL to skip fetching (returns empty options immediately).
 */

import { useState, useEffect } from 'react'
import { expandValueSet } from '../lib/terminologyService'
import type { TermOption } from '../lib/terminologyService'

export type { TermOption }

interface UseValueSetResult {
  options: TermOption[]
  loading: boolean
  error: string | null
}

export function useValueSet(valueSetUrl: string | null): UseValueSetResult {
  const [options, setOptions] = useState<TermOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!valueSetUrl) {
      setOptions([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    expandValueSet(valueSetUrl)
      .then((result) => {
        if (!cancelled) setOptions(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load options')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [valueSetUrl])

  return { options, loading, error }
}
