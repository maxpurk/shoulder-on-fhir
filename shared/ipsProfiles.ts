/**
 * CANONICAL SOURCE — edit this file, then run `tools/sync-shared-code.sh`
 * (or `build-and-deploy.sh`, which runs it automatically) to propagate to
 * `frontend/src/lib/shared/ipsProfiles.ts` and
 * `sdc-frontend/src/lib/shared/ipsProfiles.ts`. Both copies are generated
 * and carry a header saying so — do not edit them directly. See
 * `shared/constantScore.ts` for why a sync script is used instead of a real
 * shared package/Vite alias (ADR-0157: each frontend's Docker build context
 * is scoped to its own directory).
 *
 * Instance-level IPS multi-profile claims (`meta.profile[]`).
 *
 * The IG's Patient / Condition / Procedure profiles parent from HL7 Europe
 * Core; IPS conformance is asserted per-instance via `meta.profile[]`. The
 * IG's own example instances already carry these claims — this helper lets
 * BOTH demonstrator frontends stamp the same claims on the resources they
 * build, so the running system reproduces the IG-example IPS conformance
 * instead of leaving it example/seed-only.
 *
 * Which resource claims which IPS profile (matches the IG examples exactly):
 *   - Patient                     -> Patient-uv-ips
 *   - comorbidity Condition       -> Condition-uv-ips
 *       NOT the index RotatorCuffCondition: an encounter diagnosis is not an
 *       IPS problem-list entry (the deliberate asymmetry).
 *   - SURGICAL Procedure          -> Procedure-uv-ips
 *       NOT prior physiotherapy / injection treatments: scoping to surgery
 *       avoids over-claiming IPS on non-surgical procedures.
 *   - tobacco-smoking Observation -> Observation-tobaccouse-uv-ips
 *
 * Self-contained (no imports from either frontend's types), because it is
 * copied verbatim into both frontends by the sync step. It recognises the
 * eligible instances structurally — by the local IG profile canonical each
 * resource already carries in `meta.profile`, or (for surgical procedures)
 * the SNOMED CT category code.
 */

export const IPS_PROFILE = {
  PATIENT: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips',
  CONDITION: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips',
  PROCEDURE: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips',
  TOBACCO_USE: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-tobaccouse-uv-ips',
} as const

// Local IG profile-canonical suffixes used to recognise eligible instances.
const COMORBIDITY_CONDITION_SUFFIX = '/shoulder-comorbidity-condition'
const SMOKING_OBSERVATION_SUFFIX = '/smoking-status-observation'
// SNOMED CT "Surgical procedure" — Procedure.category code that distinguishes a
// surgical intervention from prior physiotherapy/injection treatments.
const SNOMED_SURGICAL_CATEGORY = '387713003'

// Minimal structural shape — both frontends' fuller resource types satisfy it.
interface IpsClaimable {
  resourceType: string
  meta?: { profile?: string[] }
  category?: unknown
}

function hasLocalProfile(resource: IpsClaimable, suffix: string): boolean {
  return (resource.meta?.profile ?? []).some((p) => p.endsWith(suffix))
}

function isSurgicalProcedure(resource: IpsClaimable): boolean {
  // Procedure.category is 0..1 (a single CodeableConcept) in FHIR R4.
  const cat = (resource as { category?: { coding?: Array<{ code?: string }> } }).category
  return (cat?.coding ?? []).some((c) => c.code === SNOMED_SURGICAL_CATEGORY)
}

/** The IPS profile canonical this resource should additionally claim, or null. */
function ipsProfileFor(resource: IpsClaimable): string | null {
  switch (resource.resourceType) {
    case 'Patient':
      return IPS_PROFILE.PATIENT
    case 'Condition':
      return hasLocalProfile(resource, COMORBIDITY_CONDITION_SUFFIX) ? IPS_PROFILE.CONDITION : null
    case 'Procedure':
      return isSurgicalProcedure(resource) ? IPS_PROFILE.PROCEDURE : null
    case 'Observation':
      return hasLocalProfile(resource, SMOKING_OBSERVATION_SUFFIX) ? IPS_PROFILE.TOBACCO_USE : null
    default:
      return null
  }
}

/**
 * Return a copy of `resource` with the appropriate IPS profile appended to
 * `meta.profile[]` when it is an IPS-eligible instance; otherwise return the
 * resource unchanged. Idempotent (never adds a duplicate) and non-mutating.
 */
export function withIpsClaim<T extends IpsClaimable>(resource: T): T {
  const ips = ipsProfileFor(resource)
  if (!ips) return resource
  const existing = resource.meta?.profile ?? []
  if (existing.includes(ips)) return resource
  return {
    ...resource,
    meta: { ...resource.meta, profile: [...existing, ips] },
  } as T
}
