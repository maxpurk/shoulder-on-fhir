// Where the servers are.
//
// The engines in this directory hold no knowledge of any implementation guide,
// so the only thing tying the app to one deployment is the address it asks. That
// address is resolved here, and nowhere else, so the same build can be pointed
// at any FHIR server that serves Questionnaires.
//
// Resolution order, most specific first:
//   1. ?fhir= / ?tx= / ?validate= in the page URL   a one-off, shareable as a link
//   2. localStorage                                  sticky, what the UI field writes
//   3. VITE_FHIR_BASE / VITE_TX_BASE / VITE_VALIDATE_URL   how a deployment pins its own
//   4. the bundled demo server behind this page's own origin
//
// A value may be absolute ("https://hapi.fhir.org/baseR4") or relative to the
// page ("fhir/DEFAULT"), so the app still works mounted under a path prefix.

export type Endpoint = 'fhir' | 'tx' | 'validate'

const KEY: Record<Endpoint, string> = {
  fhir: 'sdc.fhirBase',
  tx: 'sdc.txBase',
  validate: 'sdc.validateUrl',
}

const FALLBACK: Record<Endpoint, string> = {
  fhir: 'fhir/DEFAULT',
  tx: 'tx',
  validate: 'validate-sidecar',
}

function buildTime(which: Endpoint): string | undefined {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env
    if (!env) return undefined
    return { fhir: env.VITE_FHIR_BASE, tx: env.VITE_TX_BASE, validate: env.VITE_VALIDATE_URL }[which]
  } catch { return undefined }
}

function fromQuery(which: Endpoint): string | undefined {
  if (typeof location === 'undefined') return undefined
  try { return new URLSearchParams(location.search).get(which) ?? undefined } catch { return undefined }
}

function fromStorage(which: Endpoint): string | undefined {
  // A private-mode browser throws on read as readily as on write.
  try { return localStorage.getItem(KEY[which]) ?? undefined } catch { return undefined }
}

/** Resolve a configured value, absolute or page-relative, to something fetch accepts. */
function absolute(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // Outside a browser there is no document to resolve against and no server to
  // reach either: the tests drive the engines with their own fetcher.
  if (typeof document === 'undefined') return trimmed
  return new URL(trimmed, document.baseURI).href.replace(/\/+$/, '')
}

/** The configured address of one endpoint, with no trailing slash. */
export function endpoint(which: Endpoint): string {
  const raw = fromQuery(which) ?? fromStorage(which) ?? buildTime(which) ?? FALLBACK[which]
  return absolute(raw)
}

/** What a UI field should show: the stored override, or '' when none is set. */
export function configuredOverride(which: Endpoint): string {
  return fromQuery(which) ?? fromStorage(which) ?? ''
}

/** Persist an override, or clear it when given nothing. */
export function setOverride(which: Endpoint, value: string): void {
  try {
    if (value.trim()) localStorage.setItem(KEY[which], value.trim())
    else localStorage.removeItem(KEY[which])
  } catch { /* nothing to do: the address then lasts only for this page */ }
}

/** The default this build falls back to, for a UI placeholder. */
export function defaultOf(which: Endpoint): string {
  return buildTime(which) ?? FALLBACK[which]
}
