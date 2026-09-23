/**
 * FHIR Client for SDC Questionnaire Frontend
 * Identical to the primary frontend's fhirClient — minimal fetch wrapper.
 */

const FHIR_BASE_URL = import.meta.env.VITE_FHIR_SERVER_URL || '/fhir/DEFAULT'

// Validator sidecar URL (ADR-0051). Dev uses the Vite proxy /validate-sidecar
// → localhost:3500/validate; in Docker the same path is proxied by nginx to
// validator-service:3500. The VITE_ override is inlined at build time, so it
// is a local-build knob, not a runtime one.
const VALIDATOR_URL = import.meta.env.VITE_VALIDATOR_URL || '/validate-sidecar'

// How long the client waits for the validator sidecar before giving up and
// fail-opening (submitting directly, per ADR-0051). Deliberately much shorter
// than the sidecar's own backend timeout — that one bounds backend resource
// usage, this one bounds how long a human stares at "Submitting...".
const VALIDATE_CLIENT_TIMEOUT_MS = 20_000

interface FhirResource {
  resourceType: string
  id?: string
}

import type { WizardEntry, TransactionResponseBundle, OperationOutcome } from '../types/fhir'

interface FhirBundle<T extends FhirResource = FhirResource> {
  resourceType: 'Bundle'
  type: string
  total?: number
  entry?: Array<{
    fullUrl?: string
    resource: T
  }>
}

/** Minimal shape of a $lookup response — only the `display` parameter is consumed. */
interface CodeSystemLookupResult {
  resourceType: 'Parameters'
  parameter?: Array<{ name?: string; valueString?: string }>
}

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
 * Thrown when the validator sidecar (ADR-0051) is unreachable. Distinct from
 * FhirError so callers can fail-open with a banner instead of blocking submit.
 */
export class ValidatorUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'ValidatorUnavailableError'
  }
}

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

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const fhirClient = {
  read: <T extends FhirResource>(resourceType: string, id: string): Promise<T> => {
    return fhirRequest<T>('GET', `/${resourceType}/${id}`)
  },

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
   * Validate a bundle via the FHIR Validator sidecar (ADR-0051). Same engine
   * as tools/validate.sh (the design-time gate, ADR-0024). Returns an OperationOutcome with
   * severity-graded issues. Throws ValidatorUnavailableError on connection
   * failure so the caller can fail-open with a banner.
   */
  validateBundle: async (entries: WizardEntry[], bundleProfile: string): Promise<OperationOutcome> => {
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
      throw new ValidatorUnavailableError('Validator sidecar unreachable', err)
    }
    if (!response.ok) {
      throw new ValidatorUnavailableError(
        `Validator sidecar returned ${response.status} ${response.statusText}`
      )
    }
    return response.json()
  },

  /**
   * Submit a FHIR transaction bundle (atomic all-or-nothing) stamped with the
   * supplied bundle profile in meta.profile. The bundle profile drives both
   * the validator advisory call (validateBundle) and the persisted profile
   * marker on the bundle envelope — though note HAPI does not persist the
   * bundle envelope itself, only its entries (ADR-0031).
   */
  submitBundle: (entries: WizardEntry[], bundleProfile: string): Promise<TransactionResponseBundle> => {
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
   * Primary: ValueSet/$expand. Fallback: direct ValueSet read (pre-computed expansion).
   *
   * HAPI's URL-form $expand returns HTTP 200 with expansion.contains=[] (not
   * a throw) for local-CodeSystem-backed VSs when its Lucene index hasn't
   * been populated for the CS — a frequent post-restart state (Lucene runs
   * on tmpfs). Fall back on empty result in addition to throw; the GET
   * below reads the VS resource whose .expansion was pre-computed by
   * seed/generate-expansions.sh.
   */
  expand: async <T = FhirResource>(valueSetUrl: string): Promise<T> => {
    const encoded = encodeURIComponent(valueSetUrl)
    const readVsAsExpansion = async (): Promise<T> => {
      const bundle = await fhirRequest<FhirBundle<FhirResource>>(
        'GET', `/ValueSet?url=${encoded}`
      )
      const vs = bundle.entry?.[0]?.resource
      if (!vs) throw new FhirError(`ValueSet not found: ${valueSetUrl}`, 404)
      return vs as T
    }
    try {
      const result = await fhirRequest<T>('GET', `/ValueSet/$expand?url=${encoded}&_count=200`)
      const contains = (result as { expansion?: { contains?: unknown[] } })?.expansion?.contains
      if (!contains || contains.length === 0) {
        return await readVsAsExpansion()
      }
      return result
    } catch {
      return await readVsAsExpansion()
    }
  },

  /**
   * Expand a ValueSet with a server-side `filter` (typeahead search), no
   * empty-result fallback — a filtered search returning zero matches is a
   * real "no matches" answer, not the Lucene-not-yet-populated case `expand`
   * above falls back for. Added per ADR-0137 for the comorbidity picker.
   */
  expandFiltered: async <T = FhirResource>(valueSetUrl: string, filter: string, count = 20): Promise<T> => {
    const params = `url=${encodeURIComponent(valueSetUrl)}&filter=${encodeURIComponent(filter)}&_count=${count}`
    return fhirRequest<T>('GET', `/ValueSet/$expand?${params}`)
  },

  /**
   * CodeSystem $lookup — used only where a fixed Observation.code's display
   * isn't recoverable any other way (ADR-0103): SNOMED-coded profiles with
   * no inline display in FSH and no local CodeSystem resource to read
   * directly. HAPI proxies SNOMED $lookup to tx.fhir.org transparently
   * (remote_terminology_service.snomed, ADR-0050) — this is still just one
   * more call to HAPI from the caller's point of view.
   */
  lookupCodeSystemDisplay: async (system: string, code: string): Promise<string | undefined> => {
    const params = `system=${encodeURIComponent(system)}&code=${encodeURIComponent(code)}`
    const result = await fhirRequest<CodeSystemLookupResult>('GET', `/CodeSystem/$lookup?${params}`)
    return result.parameter?.find((p) => p.name === 'display')?.valueString
  },
}

export default fhirClient
