/**
 * useQuantityBounds Hook
 *
 * Fetches a profile's StructureDefinition from the FHIR server and returns the
 * min/max Quantity bounds declared on Observation.value[x]. Lets numeric inputs
 * source their HTML5 min/max from the IG (single source of truth — IG-driven UI).
 *
 * Pass null to skip fetching (returns empty bounds immediately).
 */

import { useEffect, useState } from 'react'
import { fhirClient } from '../lib/fhirClient'
import { extractQuantityBounds, type QuantityBounds, type StructureDefinition } from '../lib/profileBounds'

interface UseQuantityBoundsResult extends QuantityBounds {
  loading: boolean
  error: string | null
}

const cache = new Map<string, QuantityBounds>()

export function useQuantityBounds(profileUrl: string | null): UseQuantityBoundsResult {
  const [bounds, setBounds] = useState<QuantityBounds>(() =>
    profileUrl ? (cache.get(profileUrl) ?? {}) : {},
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profileUrl) {
      setBounds({})
      setLoading(false)
      setError(null)
      return
    }

    const cached = cache.get(profileUrl)
    if (cached) {
      setBounds(cached)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fhirClient
      .search<StructureDefinition>('StructureDefinition', { url: profileUrl })
      .then((bundle) => {
        if (cancelled) return
        const sd = bundle.entry?.[0]?.resource
        if (!sd) {
          setError(`StructureDefinition not found for ${profileUrl}`)
          return
        }
        const next = extractQuantityBounds(sd)
        cache.set(profileUrl, next)
        setBounds(next)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load profile bounds')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [profileUrl])

  return { ...bounds, loading, error }
}
