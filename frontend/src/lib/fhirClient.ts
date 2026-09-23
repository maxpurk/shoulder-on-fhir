/**
 * FHIR Client Configuration for Rotator Cuff Registry
 *
 * This module provides a simple FHIR client for interacting with the HAPI FHIR server.
 * It uses direct REST calls rather than the fhirclient.js library for simplicity,
 * but the architecture supports easy migration to SMART on FHIR authentication.
 */

// FHIR server base URL - uses Vite proxy in development
// Note: HAPI server has multitenancy enabled, so we use the DEFAULT tenant
const FHIR_BASE_URL = import.meta.env.VITE_FHIR_SERVER_URL || '/fhir/DEFAULT'

// Validator sidecar URL (ADR-0051). The sidecar runs the same FHIR Validator
// CLI engine as tools/validate.sh (the design-time gate), closing the drift
// HAPI's $validate used to leave open. Dev uses the Vite proxy
// /validate-sidecar → localhost:3500/validate; in Docker the same path is
// proxied by nginx to validator-service:3500. The VITE_ override is inlined
// at build time, so it is a local-build knob — setting it as container
// environment in docker-compose would have no effect.
const VALIDATOR_URL = import.meta.env.VITE_VALIDATOR_URL || '/validate-sidecar'

// How long the client waits for the validator sidecar before giving up and
// fail-opening (submitting directly, per ADR-0051). Deliberately much shorter
// than the sidecar's own backend timeout — that one bounds backend resource
// usage, this one bounds how long a human stares at "Submitting...".
const VALIDATE_CLIENT_TIMEOUT_MS = 20_000

/**
 * Generic FHIR resource interface
 */
interface FhirResource {
  resourceType: string
  id?: string
}

import type { WizardEntry, TransactionResponseBundle, OperationOutcome } from '../types/fhir'
import { BUNDLE_PROFILES } from '../types/fhir'

// Re-export so consumers can import BUNDLE_PROFILES from fhirClient too.
export { BUNDLE_PROFILES }

/**
 * FHIR Bundle interface
 */
interface FhirBundle<T extends FhirResource = FhirResource> {
  resourceType: 'Bundle'
  type: string
  total?: number
  entry?: Array<{
    fullUrl?: string
    resource: T
  }>
}

/**
 * Error class for FHIR operations
 */
export class FhirError extends Error {
  constructor(
    message: string,
    public status: number,
    public operationOutcome?: unknown
  ) {
    super(message)
    this.name = 'FhirError'
  }
}

/**
 * Thrown when the validator sidecar (ADR-0051) is unreachable — connection
 * refused, network failure, or DNS error. Distinct from FhirError so callers
 * can fail-open (submit anyway with a banner) instead of treating it as a
 * validation failure.
 */
export class ValidatorUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'ValidatorUnavailableError'
  }
}

/**
 * Make a FHIR REST request
 */
async function fhirRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const url = `${FHIR_BASE_URL}${path}`

  const headers: HeadersInit = {
    'Accept': 'application/fhir+json',
    ...extraHeaders,
  }

  if (body) {
    headers['Content-Type'] = 'application/fhir+json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    let operationOutcome
    try {
      operationOutcome = await response.json()
    } catch {
      // Response might not be JSON
    }
    throw new FhirError(
      `FHIR request failed: ${response.status} ${response.statusText}`,
      response.status,
      operationOutcome
    )
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

/**
 * FHIR Client API
 */
export const fhirClient = {
  /**
   * Read a resource by ID
   */
  read: <T extends FhirResource>(resourceType: string, id: string): Promise<T> => {
    return fhirRequest<T>('GET', `/${resourceType}/${id}`)
  },

  /**
   * Search for resources
   */
  search: <T extends FhirResource>(
    resourceType: string,
    params?: Record<string, string>
  ): Promise<FhirBundle<T>> => {
    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : ''
    return fhirRequest<FhirBundle<T>>('GET', `/${resourceType}${queryString}`)
  },

  /**
   * Create a new resource
   */
  create: <T extends FhirResource>(resource: T): Promise<T> => {
    return fhirRequest<T>('POST', `/${resource.resourceType}`, resource)
  },

  /**
   * Update an existing resource.
   * Pass versionId (from meta.versionId of the previously read resource) to
   * include an If-Match header for optimistic concurrency control (FHIR best practice).
   * HAPI returns 409 Conflict if the version has changed since the resource was read.
   */
  update: <T extends FhirResource>(resource: T, versionId?: string): Promise<T> => {
    if (!resource.id) {
      throw new Error('Resource must have an ID for update')
    }
    const extraHeaders = versionId ? { 'If-Match': `W/"${versionId}"` } : undefined
    return fhirRequest<T>(
      'PUT',
      `/${resource.resourceType}/${resource.id}`,
      resource,
      extraHeaders
    )
  },

  /**
   * Delete a resource
   */
  delete: (resourceType: string, id: string): Promise<void> => {
    return fhirRequest<void>('DELETE', `/${resourceType}/${id}`)
  },

  /**
   * Get server capability statement
   */
  metadata: (): Promise<FhirResource> => {
    return fhirRequest<FhirResource>('GET', '/metadata')
  },

  /**
   * Validate a bundle against one of the three IG bundle profiles
   * (Registration, Surgery, FollowUp) via the FHIR Validator sidecar (ADR-0051).
   * The sidecar runs the same validator_cli.jar engine as tools/validate.sh
   * (the design-time gate, ADR-0024). The bundle's meta.profile drives validation.
   *
   * Returns an OperationOutcome with severity-graded issues.
   * Throws ValidatorUnavailableError on connection failure (network down,
   * sidecar not running, DNS error) so the caller can fail-open with a banner
   * instead of blocking submission. Also throws it if the sidecar doesn't
   * respond within VALIDATE_CLIENT_TIMEOUT_MS — the sidecar's own backend
   * timeout is much longer (it protects backend resources, not UX), so
   * without a client-side limit a slow/stuck sidecar leaves the user
   * staring at "Submitting..." long enough to give up and close the tab,
   * which skips fail-open entirely (fail-open only runs if this call
   * actually resolves).
   */
  validateBundle: async (
    entries: WizardEntry[],
    bundleProfile: string = BUNDLE_PROFILES.REGISTRATION
  ): Promise<OperationOutcome> => {
    const bundle = {
      resourceType: 'Bundle',
      meta: { profile: [bundleProfile] },
      type: 'transaction',
      entry: entries.map(({ uuid, resource }) => ({
        fullUrl: `urn:uuid:${uuid}`,
        resource,
        request: { method: 'POST', url: resource.resourceType },
      })),
    }
    let response: Response
    try {
      response = await fetch(VALIDATOR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
          Accept: 'application/fhir+json',
        },
        body: JSON.stringify(bundle),
        signal: AbortSignal.timeout(VALIDATE_CLIENT_TIMEOUT_MS),
      })
    } catch (err) {
      // TypeError (network / DNS / refused) or AbortError (client timeout) —
      // either way the wrapper's signal that the sidecar isn't usable right now.
      throw new ValidatorUnavailableError(
        'Validator sidecar unreachable',
        err
      )
    }
    if (!response.ok) {
      // 5xx from the sidecar means it ran but failed internally — still treat
      // as unavailable so the user isn't blocked by a sidecar bug.
      throw new ValidatorUnavailableError(
        `Validator sidecar returned ${response.status} ${response.statusText}`
      )
    }
    return response.json()
  },

  /**
   * Submit a FHIR transaction bundle conforming to one of the three IG bundle
   * profiles. Each entry is POST-ed atomically — HAPI guarantees all-or-nothing.
   * Returns the transaction-response Bundle; use response.entry[n].response.location
   * to extract server-assigned IDs (e.g. "Patient/abc123/_history/1").
   */
  submitBundle: (
    entries: WizardEntry[],
    bundleProfile: string = BUNDLE_PROFILES.REGISTRATION
  ): Promise<TransactionResponseBundle> => {
    const bundle = {
      resourceType: 'Bundle',
      meta: { profile: [bundleProfile] },
      type: 'transaction',
      entry: entries.map(({ uuid, resource }) => ({
        fullUrl: `urn:uuid:${uuid}`,
        resource,
        request: { method: 'POST', url: resource.resourceType },
      })),
    }
    return fhirRequest<TransactionResponseBundle>('POST', '', bundle)
  },

  /**
   * Expand a ValueSet by canonical URL.
   * Returns the ValueSet resource with an `expansion.contains` array.
   *
   * Primary: ValueSet/$expand (works for SNOMED-backed ValueSets).
   * Fallback: direct ValueSet read — used when HAPI cannot dynamically expand
   * custom CodeSystem-backed ValueSets (requires Lucene, which is not enabled).
   * The fallback relies on the pre-computed expansion block injected by
   * seed/generate-expansions.sh before upload.
   *
   * Optional `filter` narrows the expansion server-side (typeahead pattern,
   * works for SNOMED-implicit and IPS-style ECL value sets via tx.fhir.org
   * delegation — see ADR-0050). When `filter` is set, the fallback is skipped
   * because filtered lookup is only meaningful for dynamic expansion.
   */
  expand: async <T = FhirResource>(
    valueSetUrl: string,
    options?: { filter?: string; count?: number },
  ): Promise<T> => {
    const encoded = encodeURIComponent(valueSetUrl)
    const count = options?.count ?? 200
    const filterParam = options?.filter ? `&filter=${encodeURIComponent(options.filter)}` : ''
    const path = `/ValueSet/$expand?url=${encoded}&_count=${count}${filterParam}`
    if (options?.filter) {
      return await fhirRequest<T>('GET', path)
    }
    // HAPI's URL-form $expand returns HTTP 200 with expansion.contains=[]
    // (not a throw) for local-CodeSystem-backed VSs when its Lucene index
    // hasn't been populated for the CS — a frequent post-restart state
    // (Lucene runs on tmpfs). Fall back on empty result in addition to
    // throw; the GET below reads the VS resource whose .expansion was
    // pre-computed by seed/generate-expansions.sh.
    const readVsAsExpansion = async (): Promise<T> => {
      const bundle = await fhirRequest<FhirBundle<FhirResource>>(
        'GET', `/ValueSet?url=${encoded}`
      )
      const vs = bundle.entry?.[0]?.resource
      if (!vs) throw new FhirError(`ValueSet not found: ${valueSetUrl}`, 404)
      return vs as T
    }
    try {
      const result = await fhirRequest<T>('GET', path)
      const contains = (result as { expansion?: { contains?: unknown[] } })?.expansion?.contains
      if (!contains || contains.length === 0) {
        return await readVsAsExpansion()
      }
      return result
    } catch {
      return await readVsAsExpansion()
    }
  },
}

export default fhirClient
