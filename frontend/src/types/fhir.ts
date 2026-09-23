/**
 * FHIR Type Definitions for Rotator Cuff Registry
 *
 * These types are simplified versions of the full FHIR R4 types,
 * focused on the elements used in this application.
 */

// ============================================
// Common Types
// ============================================

export interface Identifier {
  system?: string
  value?: string
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old'
}

export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden'
  family?: string
  given?: string[]
  prefix?: string[]
  suffix?: string[]
}

export interface Address {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing'
  line?: string[]
  city?: string
  postalCode?: string
  country?: string
}

export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other'
  value?: string
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile'
}

export interface CodeableConcept {
  coding?: Coding[]
  text?: string
}

export interface Coding {
  system?: string
  code?: string
  display?: string
}

export interface Reference {
  reference?: string
  display?: string
}

export interface Extension {
  url: string
  valueCodeableConcept?: CodeableConcept
  valueString?: string
  valueBoolean?: boolean
  valueInteger?: number
  // Nested sub-extensions for complex extensions (e.g. RSG per ADR-0053).
  extension?: Extension[]
}

export interface Meta {
  profile?: string[]
  versionId?: string
  lastUpdated?: string
}

export interface Quantity {
  value?: number
  unit?: string
  system?: string
  code?: string
}

export interface Period {
  start?: string
  end?: string
}

// ============================================
// Patient Resource
// ============================================

export interface Patient {
  resourceType: 'Patient'
  id?: string
  meta?: Meta
  identifier?: Identifier[]
  name?: HumanName[]
  gender?: 'male' | 'female' | 'other' | 'unknown'
  birthDate?: string
  telecom?: ContactPoint[]
  address?: Address[]
  extension?: Extension[]
}

// ============================================
// Condition Resource
// ============================================

export interface Condition {
  resourceType: 'Condition'
  id?: string
  meta?: Meta
  extension?: Extension[]
  clinicalStatus?: CodeableConcept
  verificationStatus?: CodeableConcept
  category?: CodeableConcept[]
  code?: CodeableConcept
  bodySite?: CodeableConcept[]
  subject: Reference
  encounter?: Reference
  onsetDateTime?: string
  recordedDate?: string
  stage?: Array<{
    assessment?: Reference[]
  }>
  evidence?: Array<{
    detail?: Reference[]
  }>
}

// ============================================
// Procedure Resource
// ============================================

export interface Procedure {
  resourceType: 'Procedure'
  id?: string
  meta?: Meta
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown'
  category?: CodeableConcept
  code?: CodeableConcept
  subject: Reference
  encounter?: Reference
  performedDateTime?: string
  // Incision (start) / suture-closure (end) time for the surgical event
  // (ADR-0108) — replaces performedDateTime for procedures built by the
  // surgery wizard going forward; performedDateTime stays supported for
  // reading older seeded/submitted data.
  performedPeriod?: { start?: string; end?: string }
  bodySite?: CodeableConcept[]
  reasonReference?: Reference[]
  performer?: Array<{ actor: Reference }>
  outcome?: CodeableConcept
  note?: Array<{ text?: string }>
}

// ============================================
// Observation Resource
// ============================================

export interface Observation {
  resourceType: 'Observation'
  id?: string
  meta?: Meta
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown'
  category?: CodeableConcept[]
  code: CodeableConcept
  subject: Reference
  encounter?: Reference
  effectiveDateTime?: string
  valueQuantity?: Quantity
  valueCodeableConcept?: CodeableConcept
  valueInteger?: number
  valueString?: string
  valueBoolean?: boolean
  // ADR-0109: "test not applicable / not possible" (e.g. contraindicated
  // this soon after surgery) — no value[x], status stays 'final' (the
  // assessment attempt concluded, just with no measurable value); FHIR R4's
  // Observation.status has no 'not-done' code (that exists on Procedure,
  // not Observation) — dataAbsentReason#not-performed is the correct base
  // FHIR mechanism, verified against the local hl7.fhir.r4.core package.
  dataAbsentReason?: CodeableConcept
  bodySite?: CodeableConcept
  method?: CodeableConcept
  interpretation?: CodeableConcept[]
  note?: Array<{ text?: string }>
  // ADR-0090: named component slices (e.g. ConstantScoreObservation's Pain/
  // ADL/ROM/Strength sub-scores) — only Quantity components used so far.
  component?: Array<{ code: CodeableConcept; valueQuantity?: Quantity }>
  // ADR-0108: procedure-technique Observations (approach/reconstruction-extent/
  // fixation-technique) reference the specific RotatorCuffProcedure they
  // describe via partOf, since a Surgery encounter can carry several procedures.
  partOf?: Reference[]
  // ADR-0156: aggregate/survey PROMs (Constant, SSV, SANE, satisfaction,
  // return-to-activity) have no bodySite (ADR-0074); focus disambiguates
  // which RotatorCuffCondition the score is about in a bilateral case.
  focus?: Reference[]
}

// ============================================
// Encounter Resource (added per ADR-0028, used by Surgery + Follow-Up flows)
// ============================================

export interface Encounter {
  resourceType: 'Encounter'
  id?: string
  meta?: Meta
  status: 'planned' | 'arrived' | 'in-progress' | 'finished' | 'cancelled' | 'unknown'
  class: Coding
  type?: CodeableConcept[]
  subject: Reference
  period?: Period
  reasonReference?: Reference[]
  // Ranked diagnoses addressed by this visit — rank 1 is the principal
  // ("Hauptdiagnose") when more than one Condition is submitted in the same
  // bundle. See ShoulderEncounter.diagnosis.
  diagnosis?: Array<{
    condition: Reference
    use?: CodeableConcept
    rank?: number
  }>
}

// ============================================
// QuestionnaireResponse Resource
// ============================================

// Coverage — Hurley Q1.l workmen's compensation. Single yes/no patient-history
// flag in Hurley's unanimous-consensus list (Q1). When the patient is under a
// workers'-compensation regime (German BG / Berufsgenossenschaft), the IG
// emits a ShoulderCoverage with `Coverage.type = v3-ActCode#WCBPOL`; no
// Coverage is emitted otherwise. Broader payer categorisation (GKV/PKV/
// Selbstzahler) is intentionally out of scope. See ADR-0061.
export interface Coverage {
  resourceType: 'Coverage'
  id?: string
  meta?: Meta
  text?: { status: string; div: string }
  identifier?: Identifier[]
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error'
  type?: CodeableConcept
  subscriber?: Reference
  beneficiary?: Reference
  payor?: Reference[]
}

// ============================================
// ImagingStudy Resource (Q6 imaging modality, ADR-0130)
// ============================================

// Minimal shape — only the elements this IG actually populates. A real
// PACS/DICOM-gateway integration would also set series/instance/endpoint;
// this registry only needs the study-level modality roll-up.
export interface ImagingStudy {
  resourceType: 'ImagingStudy'
  id?: string
  meta?: Meta
  status: 'registered' | 'available' | 'cancelled' | 'entered-in-error' | 'unknown'
  subject: Reference
  // When the study started — set from the visit date the flow already holds (ADR-0172)
  started?: string
  encounter?: Reference
  modality?: Coding[]
}

// ============================================
// CarePlan Resource (Q11 research follow-up schedule, ADR-0129)
// ============================================

// Minimal Timing shape — only `event` (explicit dateTime occurrences) is
// used here. Each Q11 timepoint is a single fixed date computed from the
// surgery date, not a recurring pattern, so Timing.repeat is not needed.
export interface Timing {
  event?: string[]
}

export interface CarePlan {
  resourceType: 'CarePlan'
  id?: string
  meta?: Meta
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown'
  intent: 'proposal' | 'plan' | 'order' | 'option'
  subject: Reference
  period?: Period
  activity?: Array<{
    detail?: {
      status?: 'not-started' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled' | 'stopped' | 'unknown' | 'entered-in-error'
      scheduledTiming?: Timing
      description?: string
      /** Discriminates which of the 5 Q11.a-e timepoints this activity represents (Q11Timepoint VS). */
      code?: CodeableConcept
    }
  }>
}

export interface QuestionnaireResponse {
  resourceType: 'QuestionnaireResponse'
  id?: string
  meta?: Meta
  questionnaire?: string
  status: 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped'
  subject?: Reference
  encounter?: Reference
  authored?: string
  item?: Array<{
    linkId: string
    text?: string
    answer?: Array<{
      valueString?: string
      valueDecimal?: number
      valueInteger?: number
      valueBoolean?: boolean
      valueCoding?: Coding
    }>
  }>
}

// ============================================
// Bundle Resource
// ============================================

export interface Bundle<T = Patient | Condition | Procedure | Encounter | Observation> {
  resourceType: 'Bundle'
  meta?: Meta
  type: 'searchset' | 'batch' | 'transaction' | 'batch-response' | 'transaction-response' | 'collection'
  total?: number
  entry?: Array<{
    fullUrl?: string
    resource: T
    request?: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      url: string
    }
    response?: {
      status?: string
      location?: string
    }
  }>
}

// ============================================
// ValueSet Canonical URLs
// ============================================

// Canonical base URL of the IG. Override via VITE_IG_CANONICAL env var if needed.
export const IG_CANONICAL = import.meta.env.VITE_IG_CANONICAL || 'https://maxpurk.github.io/shoulder-on-fhir'
const FHIR_BASE = IG_CANONICAL

export const VALUESET_URLS = {
  HAND_DOMINANCE: `${FHIR_BASE}/ValueSet/hand-dominance`,
  ROTATOR_CUFF_DIAGNOSIS: `${FHIR_BASE}/ValueSet/rotator-cuff-diagnosis`,
  SHOULDER_DIAGNOSIS: `${FHIR_BASE}/ValueSet/shoulder-diagnosis`,
  ROTATOR_CUFF_ETIOLOGY: `${FHIR_BASE}/ValueSet/rotator-cuff-etiology`,
  TEAR_LOCATION: `${FHIR_BASE}/ValueSet/tear-location`,
  // ADR-0105: decoupled from ROTATOR_CUFF_DIAGNOSIS — partial vs. full thickness.
  TEAR_THICKNESS: `${FHIR_BASE}/ValueSet/tear-thickness`,
  ROTATOR_CUFF_PROCEDURE_TYPE: `${FHIR_BASE}/ValueSet/rotator-cuff-procedure-type`,
  // ADR-0108: postcoordinated procedure-technique axes, decoupled from Procedure.code.
  PROCEDURE_APPROACH: `${FHIR_BASE}/ValueSet/procedure-approach`,
  RECONSTRUCTION_EXTENT: `${FHIR_BASE}/ValueSet/reconstruction-extent`,
  FIXATION_TECHNIQUE: `${FHIR_BASE}/ValueSet/fixation-technique`,
  SHOULDER_OBSERVATION_CODE: `${FHIR_BASE}/ValueSet/shoulder-observation-code`,
  PATTE_CLASSIFICATION: `${FHIR_BASE}/ValueSet/patte-classification`,
  GOUTALLIER_CLASSIFICATION: `${FHIR_BASE}/ValueSet/goutallier-classification`,
  SATISFACTION_SCALE: `${FHIR_BASE}/ValueSet/satisfaction-scale`,
  RETURN_TO_ACTIVITY: `${FHIR_BASE}/ValueSet/return-to-activity`,
  TENDONS_INVOLVED: `${FHIR_BASE}/ValueSet/tendons-involved`,
  SLEEP_DISTURBANCE_SEVERITY: `${FHIR_BASE}/ValueSet/sleep-disturbance-severity`,
  EMPLOYMENT_STATUS: `${FHIR_BASE}/ValueSet/employment-status`,
  OCCUPATIONAL_PHYSICAL_DEMAND: `${FHIR_BASE}/ValueSet/occupational-physical-demand`,
  // ADR-0105: split off from OCCUPATIONAL_PHYSICAL_DEMAND as an independent axis.
  OCCUPATIONAL_OVERHEAD_EXPOSURE: `${FHIR_BASE}/ValueSet/occupational-overhead-exposure`,
  SPORTS_PARTICIPATION_LEVEL: `${FHIR_BASE}/ValueSet/sports-participation-level`,
  // ADR-0105: replaces the prior valueString free-text realisation of "Functional limitations".
  FUNCTIONAL_LIMITATION_SEVERITY: `${FHIR_BASE}/ValueSet/functional-limitation-severity`,
  // ADR-0105: bucketed counts replacing prior approximate-date fields.
  PRIOR_PHYSICAL_THERAPY_SESSION_COUNT: `${FHIR_BASE}/ValueSet/prior-physical-therapy-session-count`,
  PRIOR_INJECTION_COUNT: `${FHIR_BASE}/ValueSet/prior-injection-count`,
  PRESENT_ABSENT: `${FHIR_BASE}/ValueSet/present-absent`,
  // ADR-0088: at-side Internal Rotation "hand behind back" ordinal, replacing
  // a degree-valued measurement.
  INTERNAL_ROTATION_VERTEBRAL_LEVEL: `${FHIR_BASE}/ValueSet/internal-rotation-vertebral-level`,
  // IPS Smoking VS — `Observation.valueCodeableConcept` binding on
  // SmokingStatusObservation. IPS 1.1.0 publishes this VS as 8 LOINC LA
  // answer-list codes (LA18976-3 … LA18982-1). Expanded by HAPI from the
  // IPS package loaded by seed/load-ips-package.sh (ADR-0056).
  SMOKING_STATUS: 'http://hl7.org/fhir/uv/ips/ValueSet/current-smoking-status-uv-ips',
  SHOULDER_IMAGING_PROCEDURE: `${FHIR_BASE}/ValueSet/shoulder-imaging-procedure`,
  SHOULDER_ENCOUNTER_TYPE: `${FHIR_BASE}/ValueSet/shoulder-encounter-type`,
  COFIELD_TEAR_SIZE_CLASSIFICATION: `${FHIR_BASE}/ValueSet/cofield-tear-size-classification`,
  ADMINISTRATIVE_GENDER: 'http://hl7.org/fhir/ValueSet/administrative-gender',
  // Comorbidity typeahead VS — SNOMED implicit subset of `< 404684003
  // |Clinical finding|`, served by `tx.fhir.org` (the only endpoint that can
  // walk the SNOMED hierarchy; ADR-0062). The resource-level binding on
  // `ShoulderComorbidityCondition.code` is still the IPS Problems VS
  // (`problems-snomed-absent-unknown-uv-ips`, ADR-0055) — every code
  // returned by this typeahead is by construction a Clinical-finding
  // descendant and therefore inside the IPS VS.
  COMORBIDITY_TYPEAHEAD: 'http://snomed.info/sct?fhir_vs=isa/404684003',
  // ADR-0130: shoulder-registry-scoped DICOM modality options (MR/CT/US) for
  // ShoulderImagingStudy.modality — Q6's realisation, tightened from the base
  // R4 extensible binding (the full DICOM dicom-cid29 catalogue).
  IMAGING_MODALITY: `${FHIR_BASE}/ValueSet/imaging-modality`,
} as const

// Client-side exclusion blocklist for the comorbidity typeahead (ADR-0084) —
// shoulder-region disorders (rotator cuff tear, AC joint OA, frozen
// shoulder, shoulder dislocation, impingement, etc.) belong on
// RotatorCuffCondition / ShoulderDiagnosisCondition (ADR-0076/ADR-0077), not
// as a "comorbidity". Verified via `$subsumes` that `118944007 |Disorder of
// shoulder region|` subsumes the diagnosis codes this IG uses (e.g.
// `202843000` full-thickness rotator cuff tear, `399114005` adhesive
// capsulitis, `417076003` shoulder dislocation) and does not subsume
// unrelated conditions (e.g. hypertension). tx.fhir.org does not support the
// `ecl/` implicit-VS form (`isa/` only) and its POST `$expand` throws when
// `compose.exclude` is combined with a text `filter` parameter — so
// exclusion is applied client-side against pre-fetched descendant sets
// (cached) rather than server-side.
//
// Three anchor concepts, not one: `118944007`'s own inferred closure was
// empirically found (live-tested, ADR-0084) to NOT reach
// `359532006 |Rotator cuff impingement syndrome|`, despite its two stated
// parents — `239960007 |Impingement syndrome of shoulder region|` (itself
// correctly subsumed by `118944007`) and `414033006 |Disorder of rotator
// cuff|` — neither of which reaches `359532006` either via tx.fhir.org's
// `isa/` implicit-VS expansion, and `$subsumes` confirms `not-subsumed`
// against all three. `359532006` is confirmed active (not deprecated) via
// `$lookup`. This looks like a genuine, isolated classification anomaly on
// this one SNOMED concept on the live edition, not a bug in this filter —
// added directly as a third anchor (self-inclusion always works regardless
// of hierarchy gaps above it) rather than chasing further SNOMED
// classification archaeology (this remains a UX-layer defense-in-depth
// filter, not a FHIR-conformance-enforced guarantee — see ADR-0084
// §Consequences for what "not proven exhaustive" means in practice).
export const SHOULDER_REGION_DISORDERS_EXCLUSION_VS = [
  'http://snomed.info/sct?fhir_vs=isa/118944007',
  'http://snomed.info/sct?fhir_vs=isa/239960007',
  'http://snomed.info/sct?fhir_vs=isa/359532006',
] as const

// IPS Absent/Unknown Data CodeSystem — convenience codes for positively
// asserting the absence (or unknown-ness) of clinical data. The IPS Problems
// VS bound on ShoulderComorbidityCondition.code includes these by
// construction, but the SNOMED-only typeahead (ADR-0062) cannot surface
// them; the StepPatient tri-state radio exposes both problem-relevant codes.
export const IPS_ABSENT_UNKNOWN = {
  SYSTEM: 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips',
  NO_KNOWN_PROBLEMS: { code: 'no-known-problems', display: 'No known problems' },
  NO_PROBLEM_INFO: { code: 'no-problem-info', display: 'No information about problems' },
} as const

// HL7 Gender Harmony recorded-sex-or-gender (RSG) extension, R4-backported
// from hl7.fhir.uv.extensions.r4 (ADR-0053). Complex extension — the value
// lives in a nested `value` sub-extension and the registry pins `type` to
// LOINC 76689-9 "Sex assigned at birth" so every RSG instance uniformly
// represents sex at birth (separate from administrative Patient.gender).
export const RSG_EXT_URL = 'http://hl7.org/fhir/StructureDefinition/individual-recordedSexOrGender'
export const RSG_TYPE_LOINC = '76689-9'
export const RSG_TYPE_DISPLAY = 'Sex assigned at birth'
// LOINC_SYSTEM constant already declared below (used by OBSERVATION_CODINGS).

// ============================================
// Code System Constants
// (System URLs only — codes and displays are fetched dynamically via useValueSet)
// ============================================

export const HAND_DOMINANCE = {
  SYSTEM: 'http://snomed.info/sct',
} as const

export const PATTE_CLASSIFICATION = {
  SYSTEM: `${FHIR_BASE}/CodeSystem/patte-classification`,
} as const

export const GOUTALLIER_CLASSIFICATION = {
  SYSTEM: `${FHIR_BASE}/CodeSystem/goutallier-classification`,
} as const

export const SHOULDER_LATERALITY = {
  SYSTEM: 'http://snomed.info/sct',
  LEFT: '91775009',
  LEFT_DISPLAY: 'Structure of left shoulder region',
  RIGHT: '91774008',
  RIGHT_DISPLAY: 'Structure of right shoulder region',
} as const

// Official FHIR terminology.hl7.org CodeSystem/condition-clinical displays
// for the 4 values ADR-0075 offers in this registry's clinicalStatus dropdowns.
export const CONDITION_CLINICAL_DISPLAY: Record<string, string> = {
  active: 'Active',
  recurrence: 'Recurrence',
  inactive: 'Inactive',
  resolved: 'Resolved',
}

// Fixed inclusion diagnosis for RotatorCuffCondition.code (ADR-0111). Hurley
// et al. 2024 (SECEC Delphi) names no disease-entity choice — every consensus
// question is scoped "in the setting of a suspected/known rotator cuff tear."
// Not a dropdown: character is carried entirely by tendons/thickness/location/
// etiology, each its own element.
export const ROTATOR_CUFF_TEAR_DIAGNOSIS = {
  SYSTEM: 'http://snomed.info/sct',
  CODE: '926335004',
  DISPLAY: 'Rupture of rotator cuff of shoulder',
  LABEL: 'Rotator Cuff Tear',
} as const

export const OBSERVATION_CODES = {
  SYSTEM: `${FHIR_BASE}/CodeSystem/shoulder-observation`,
  PATTE_CLASSIFICATION: 'patte-classification',
  GOUTALLIER_CLASSIFICATION: 'goutallier-classification',
  FORWARD_FLEXION: 'forward-flexion',
  EXTERNAL_ROTATION: 'external-rotation',
  INTERNAL_ROTATION: 'internal-rotation',
  ABDUCTION: 'abduction',
  SUPRASPINATUS_STRENGTH: 'supraspinatus-strength',
  JOBE_TEST: 'jobe-test',
  EXTERNAL_ROTATION_STRENGTH: 'external-rotation-strength',
  SUBSCAPULARIS_STRENGTH: 'subscapularis-strength',
  // ADR-0089: new sibling strength axes
  INTERNAL_ROTATION_STRENGTH: 'internal-rotation-strength',
  SUPRASPINATUS_STRENGTH_DYNAMOMETRY: 'supraspinatus-strength-dynamometry',
  PASSIVE_FORWARD_FLEXION: 'passive-forward-flexion',
  PASSIVE_EXTERNAL_ROTATION: 'passive-external-rotation',
  PASSIVE_INTERNAL_ROTATION: 'passive-internal-rotation',
  PASSIVE_ABDUCTION: 'passive-abduction',
  // ADR-0088: rotation measured at 90° abduction — new fields alongside at-side ROM
  EXTERNAL_ROTATION_90_ABDUCTION: 'external-rotation-90-abduction',
  INTERNAL_ROTATION_90_ABDUCTION: 'internal-rotation-90-abduction',
  PASSIVE_EXTERNAL_ROTATION_90_ABDUCTION: 'passive-external-rotation-90-abduction',
  PASSIVE_INTERNAL_ROTATION_90_ABDUCTION: 'passive-internal-rotation-90-abduction',
  LIFT_OFF_TEST: 'lift-off-test',
  BELLY_PRESS_TEST: 'belly-press-test',
  BEAR_HUG_TEST: 'bear-hug-test',
  HORNBLOWER_TEST: 'hornblower-test',
  TEAR_SIZE: 'tear-size',
  TEAR_SIZE_CLASSIFICATION: 'tear-size-classification',
  // Intra-operative siblings (ADR-0104) — same Observation.code as above, distinct fixed profile + category (exam).
  INTRAOP_TEAR_SIZE: 'intraop-tear-size',
  INTRAOP_TEAR_SIZE_CLASSIFICATION: 'intraop-tear-size-classification',
  TENDONS_INVOLVED: 'tendons-involved',
  TEAR_LOCATION: 'tear-location',
  TEAR_THICKNESS: 'tear-thickness',
  // ADR-0108: postcoordinated procedure-technique axes
  PROCEDURE_APPROACH: 'procedure-approach',
  RECONSTRUCTION_EXTENT: 'reconstruction-extent',
  FIXATION_TECHNIQUE: 'fixation-technique',
  CONSTANT_SCORE: 'constant-score',
  // ADR-0090: Constant-Murley sub-score component codes (Observation.component,
  // not separate profiles — same constant-score-observation profile URL).
  CONSTANT_SCORE_PAIN: 'constant-score-pain',
  CONSTANT_SCORE_ADL: 'constant-score-adl',
  CONSTANT_SCORE_ROM: 'constant-score-rom',
  CONSTANT_SCORE_STRENGTH: 'constant-score-strength',
  SSV_SCORE: 'ssv-score',
  SANE_SCORE: 'sane-score',
  PATIENT_SATISFACTION: 'patient-satisfaction',
  RETURN_TO_SPORT_WORK: 'return-to-sport-work',
  HAND_DOMINANCE: 'hand-dominance',
  // Observations using local CS code (expert consensus additions, May 2026)
  SPORTS_PARTICIPATION: 'sports-participation',
  // Visual inspection findings (ADR-0086) — replaced free-text INSPECTION
  ATROPHY: 'atrophy',
  DEFORMITY: 'deformity',
  NORMAL_SHOULDER_CONTOUR: 'normal-shoulder-contour',
  // Pain severity (ADR-0087) — replaced single free-text-shaped LOINC field
  // with 4 context-specific axes
  PAIN_AVERAGE: 'pain-average',
  PAIN_ACTIVE_MOVEMENT: 'pain-active-movement',
  PAIN_PASSIVE_MOVEMENT: 'pain-passive-movement',
  PAIN_REST: 'pain-rest',
  // ADR-0105 additions
  SMOKING_PACK_YEARS: 'smoking-pack-years',
  OCCUPATIONAL_OVERHEAD_EXPOSURE: 'occupational-overhead-exposure',
  FUNCTIONAL_LIMITATION_SEVERITY: 'functional-limitation-severity',
  PRIOR_PHYSICAL_THERAPY_SESSION_COUNT: 'prior-physical-therapy-session-count',
  PRIOR_INJECTION_COUNT: 'prior-injection-count',
} as const

// ============================================
// Observation Codings (system + code + display per profile key)
// ============================================

export interface FhirCoding {
  system: string
  code: string
  display: string
}

export const SHOULDER_OBS_SYSTEM = `${FHIR_BASE}/CodeSystem/shoulder-observation`
export const LOINC_SYSTEM = 'http://loinc.org'
export const SNOMED_SYSTEM = 'http://snomed.info/sct'

// Canonical FHIR coding for each observation profile, keyed by profile key.
// For most profiles the code lives in ShoulderObservationCS; for profiles whose
// derived FSH fixes a standard LOINC/SNOMED code (expert consensus additions), the coding
// reflects that standard system+code directly. This map is the single source of
// truth for building Observation.code in the wizard.
export const OBSERVATION_CODINGS: Record<string, FhirCoding> = {
  // Standard LOINC codes
  'smoking-status': { system: LOINC_SYSTEM, code: '72166-2', display: 'Tobacco smoking status' },
  // ADR-0087: "Pain severity" (formerly single LOINC#72514-3, retired) decomposed
  // into 4 context-specific local-code axes (no LOINC/SNOMED concept
  // distinguishes pain-context as of authoring).
  'pain-average': { system: SHOULDER_OBS_SYSTEM, code: 'pain-average', display: 'Pain Severity — On Average' },
  'pain-active-movement': { system: SHOULDER_OBS_SYSTEM, code: 'pain-active-movement', display: 'Pain Severity — With Active Movement' },
  'pain-passive-movement': { system: SHOULDER_OBS_SYSTEM, code: 'pain-passive-movement', display: 'Pain Severity — With Passive Movement' },
  'pain-rest': { system: SHOULDER_OBS_SYSTEM, code: 'pain-rest', display: 'Pain Severity — At Rest' },
  // ADR-0082: "Occupation" (formerly free-text LOINC#85658-3, retired) decomposed
  // into employment-status (standard LOINC) + occupational-physical-demand (local,
  // no LOINC/SNOMED axis exists).
  'employment-status': { system: LOINC_SYSTEM, code: '67875-5', display: 'Employment status - current' },
  // ADR-0105: cumulative pack-years, sibling to smoking-status. No LOINC
  // concept exists for this axis (verified July 2026) — SNOMED CT observable entity.
  'smoking-pack-years': { system: SNOMED_SYSTEM, code: '782516008', display: 'Number of calculated smoking pack years' },
  // ADR-0105: replaces prior LOINC#10158-4 valueString free text — a coded
  // functional-ceiling ordinal, local code (no LOINC/SNOMED concept exists).
  'functional-limitations': { system: SHOULDER_OBS_SYSTEM, code: 'functional-limitation-severity', display: 'Functional Limitation Severity' },
  // ADR-0105: split off from occupational-physical-demand as an independent axis.
  'occupational-overhead-exposure': { system: SHOULDER_OBS_SYSTEM, code: 'occupational-overhead-exposure', display: 'Occupational Overhead Exposure' },
  // ADR-0105: bucketed counts replacing prior approximate-date fields.
  'prior-physical-therapy-session-count': { system: SHOULDER_OBS_SYSTEM, code: 'prior-physical-therapy-session-count', display: 'Prior Physical Therapy Session Count' },
  'prior-injection-count': { system: SHOULDER_OBS_SYSTEM, code: 'prior-injection-count', display: 'Prior Shoulder Injection Count' },
  // Local CS codes (mirror `* code = ShoulderObservationCS#<key>` in each FSH profile)
  'sports-participation': { system: SHOULDER_OBS_SYSTEM, code: 'sports-participation', display: 'Sports Participation' },
  // ADR-0086: free-text "Visual Inspection" replaced by 3 structured findings.
  // deformity subsequently migrated off local code to a laterality-neutral
  // SNOMED disorder/finding concept (finding-as-code + present/absent value).
  // atrophy was migrated the same way by ADR-0115, then reverted to local by
  // ADR-0116 — SNOMED#1119438000 is a real concept but doesn't resolve
  // against tx.fhir.org's currently-served SNOMED edition (verified live).
  // normal-shoulder-contour re-verified to have no comparable concept, stays local.
  'atrophy': { system: SHOULDER_OBS_SYSTEM, code: 'atrophy', display: 'Atrophy' },
  'deformity': { system: SNOMED_SYSTEM, code: '111263009', display: 'Acquired deformity of shoulder' },
  'normal-shoulder-contour': { system: SHOULDER_OBS_SYSTEM, code: 'normal-shoulder-contour', display: 'Normal Shoulder Contour' },
  // Migrated off local code to the SNOMED observable entity "Handedness".
  'hand-dominance': { system: SNOMED_SYSTEM, code: '57427004', display: 'Handedness' },
  'occupational-physical-demand': { system: SHOULDER_OBS_SYSTEM, code: 'occupational-physical-demand', display: 'Occupational Physical Demand' },
  // ADR-0081: no SNOMED/LOINC concept exists for a graded, shoulder-attributed
  // sleep-disturbance axis — local code, value bound to SleepDisturbanceSeverity.
  'sleep-disturbance': { system: SHOULDER_OBS_SYSTEM, code: 'sleep-disturbance', display: 'Sleep Disturbance' },
  // Active ROM (LOINC, per ADR-0045)
  'forward-flexion': { system: LOINC_SYSTEM, code: '41389-8', display: 'Shoulder Flexion Active Range of Motion Quantitative' },
  'external-rotation': { system: LOINC_SYSTEM, code: '41387-2', display: 'Shoulder External rotation Active Range of Motion Quantitative' },
  // ADR-0088: at-side Internal Rotation moved off LOINC (formerly 41391-4) —
  // recorded on a vertebral-level ordinal, not degrees.
  'internal-rotation': { system: SHOULDER_OBS_SYSTEM, code: 'internal-rotation', display: 'Internal Rotation (at side, active)' },
  'abduction': { system: LOINC_SYSTEM, code: '41381-5', display: 'Shoulder Abduction Active Range of Motion Quantitative' },
  // ADR-0088: rotation measured at 90° abduction — new, local (no LOINC/SNOMED
  // code exists for a position-specific rotation measurement).
  'external-rotation-90-abduction': { system: SHOULDER_OBS_SYSTEM, code: 'external-rotation-90-abduction', display: 'External Rotation at 90° Abduction (active)' },
  'internal-rotation-90-abduction': { system: SHOULDER_OBS_SYSTEM, code: 'internal-rotation-90-abduction', display: 'Internal Rotation at 90° Abduction (active)' },
  // Passive ROM (LOINC, per ADR-0045)
  'passive-forward-flexion': { system: LOINC_SYSTEM, code: '41390-6', display: 'Shoulder Flexion Passive Range of Motion Quantitative' },
  'passive-external-rotation': { system: LOINC_SYSTEM, code: '41388-0', display: 'Shoulder External rotation Passive Range of Motion Quantitative' },
  // ADR-0088: at-side Internal Rotation moved off LOINC (formerly 41392-2) —
  // recorded on a vertebral-level ordinal, not degrees.
  'passive-internal-rotation': { system: SHOULDER_OBS_SYSTEM, code: 'passive-internal-rotation', display: 'Internal Rotation (at side, passive)' },
  'passive-abduction': { system: LOINC_SYSTEM, code: '41382-3', display: 'Shoulder Abduction Passive Range of Motion Quantitative' },
  // ADR-0088: rotation measured at 90° abduction — new, local.
  'passive-external-rotation-90-abduction': { system: SHOULDER_OBS_SYSTEM, code: 'passive-external-rotation-90-abduction', display: 'External Rotation at 90° Abduction (passive)' },
  'passive-internal-rotation-90-abduction': { system: SHOULDER_OBS_SYSTEM, code: 'passive-internal-rotation-90-abduction', display: 'Internal Rotation at 90° Abduction (passive)' },
  // Strength (MMT / Janda 0-5)
  // ADR-0114: named "Supraspinatus Strength" (not "Abduction Strength") —
  // consistent everywhere (CodeSystem, this map, UI labels) since "abduction
  // strength" unqualified is ambiguous with deltoid-dominant gross abduction
  // testing.
  'supraspinatus-strength': { system: SHOULDER_OBS_SYSTEM, code: 'supraspinatus-strength', display: 'Supraspinatus Strength' },
  'external-rotation-strength': { system: SHOULDER_OBS_SYSTEM, code: 'external-rotation-strength', display: 'External Rotation Strength (Composite: Infraspinatus + Teres Minor)' },
  'subscapularis-strength': { system: SHOULDER_OBS_SYSTEM, code: 'subscapularis-strength', display: 'Subscapularis Strength' },
  // ADR-0089: new sibling strength axes
  'internal-rotation-strength': { system: SHOULDER_OBS_SYSTEM, code: 'internal-rotation-strength', display: 'Internal Rotation Strength (Composite)' },
  'supraspinatus-strength-dynamometry': { system: SHOULDER_OBS_SYSTEM, code: 'supraspinatus-strength-dynamometry', display: 'Supraspinatus Strength (Dynamometry)' },
  // Provocation tests — Jobe/lift-off migrated to SNOMED procedure concepts;
  // belly-press/bear-hug/hornblower have no SNOMED equivalent, stay local.
  'jobe-test': { system: SNOMED_SYSTEM, code: '1231437004', display: 'Empty can test' },
  'lift-off-test': { system: SNOMED_SYSTEM, code: '1231510004', display: 'Lift-off test' },
  'belly-press-test': { system: SHOULDER_OBS_SYSTEM, code: 'belly-press-test', display: 'Belly Press Test' },
  'bear-hug-test': { system: SHOULDER_OBS_SYSTEM, code: 'bear-hug-test', display: 'Bear Hug Test' },
  'hornblower-test': { system: SHOULDER_OBS_SYSTEM, code: 'hornblower-test', display: 'Hornblower Test (Signe du Clairon)' },
  // Imaging classifications
  'patte-classification': { system: SHOULDER_OBS_SYSTEM, code: 'patte-classification', display: 'Patte Classification' },
  'tear-location': { system: SHOULDER_OBS_SYSTEM, code: 'tear-location', display: 'Tear Location' },
  'goutallier-classification': { system: SHOULDER_OBS_SYSTEM, code: 'goutallier-classification', display: 'Goutallier Classification' },
  'tear-size': { system: SHOULDER_OBS_SYSTEM, code: 'tear-size', display: 'Tear Size' },
  'tear-size-classification': { system: SHOULDER_OBS_SYSTEM, code: 'tear-size-classification', display: 'Tear Size Classification (Cofield)' },
  // Intra-operative siblings (ADR-0104): code stays 'tear-size'/'tear-size-classification' —
  // code names the concept, not the acquisition context; only the profile + category differ.
  'intraop-tear-size': { system: SHOULDER_OBS_SYSTEM, code: 'tear-size', display: 'Tear Size' },
  'intraop-tear-size-classification': { system: SHOULDER_OBS_SYSTEM, code: 'tear-size-classification', display: 'Tear Size Classification (Cofield)' },
  // PROM scores — Hurley A12 preferred instruments only (ADR-0054)
  // Constant-Murley: SNOMED CT 273383002 (assessment scale) — see ConstantScoreObservation.fsh
  'constant-score': { system: SNOMED_SYSTEM, code: '273383002', display: 'Constant and Murley shoulder assessment score' },
  // ADR-0090: Constant-Murley sub-score components (Observation.component,
  // local codes — no LOINC/SNOMED concept exists for any of them).
  'constant-score-pain': { system: SHOULDER_OBS_SYSTEM, code: 'constant-score-pain', display: 'Constant-Murley: Pain (0-15)' },
  'constant-score-adl': { system: SHOULDER_OBS_SYSTEM, code: 'constant-score-adl', display: 'Constant-Murley: Activities of Daily Living (0-20)' },
  'constant-score-rom': { system: SHOULDER_OBS_SYSTEM, code: 'constant-score-rom', display: 'Constant-Murley: Range of Motion (0-40)' },
  'constant-score-strength': { system: SHOULDER_OBS_SYSTEM, code: 'constant-score-strength', display: 'Constant-Murley: Strength (0-25)' },
  'ssv-score': { system: SHOULDER_OBS_SYSTEM, code: 'ssv-score', display: 'Subjective Shoulder Value' },
  'sane-score': { system: SHOULDER_OBS_SYSTEM, code: 'sane-score', display: 'SANE Score' },
  'patient-satisfaction': { system: 'http://loinc.org', code: '77218-6', display: 'Patient satisfaction with healthcare delivery' },
  'return-to-sport-work': { system: SHOULDER_OBS_SYSTEM, code: 'return-to-sport-work', display: 'Return to Sport/Work' },
}

// SNOMED CT codes for prior non-surgical treatments (expert consensus Q1.f)
export const PRIOR_TREATMENT_CODES = {
  PHYSICAL_THERAPY: { system: SNOMED_SYSTEM, code: '91251008', display: 'Physical therapy procedure' },
  SHOULDER_INJECTION: { system: SNOMED_SYSTEM, code: '290035003', display: 'Injection into shoulder joint' },
} as const

export const PROVOCATION_TEST_RESULT = {
  SYSTEM: 'http://snomed.info/sct',
  POSITIVE: { code: '10828004', display: 'Positive' },
  NEGATIVE: { code: '260385009', display: 'Negative' },
} as const

// Present/Absent visual-inspection findings (ADR-0086) — same shape as
// PROVOCATION_TEST_RESULT, reused across Atrophy / Deformity / Normal
// Shoulder Contour.
export const PRESENT_ABSENT_RESULT = {
  SYSTEM: 'http://snomed.info/sct',
  PRESENT: { code: '52101004', display: 'Present' },
  ABSENT: { code: '2667000', display: 'Absent' },
} as const

export const PROFILE_URLS = {
  PATIENT: `${FHIR_BASE}/StructureDefinition/shoulder-patient`,
  CONDITION: `${FHIR_BASE}/StructureDefinition/rotator-cuff-condition`,
  OTHER_DIAGNOSIS_CONDITION: `${FHIR_BASE}/StructureDefinition/shoulder-diagnosis-condition`,
  COMORBIDITY_CONDITION: `${FHIR_BASE}/StructureDefinition/shoulder-comorbidity-condition`,
  PROCEDURE: `${FHIR_BASE}/StructureDefinition/rotator-cuff-procedure`,
  OBSERVATION: `${FHIR_BASE}/StructureDefinition/shoulder-observation`,
  IMAGING_STUDY: `${FHIR_BASE}/StructureDefinition/shoulder-imaging-study`,
  DIAGNOSTIC_REPORT: `${FHIR_BASE}/StructureDefinition/shoulder-diagnostic-report`,
  COVERAGE: `${FHIR_BASE}/StructureDefinition/shoulder-coverage`,
  CARE_PLAN: `${FHIR_BASE}/StructureDefinition/rotator-cuff-research-care-plan`,
  QUESTIONNAIRE_RESPONSE: `${FHIR_BASE}/StructureDefinition/rotator-cuff-questionnaire-response`,
  SERVICE_REQUEST: `${FHIR_BASE}/StructureDefinition/rotator-cuff-service-request`,
  ENCOUNTER: `${FHIR_BASE}/StructureDefinition/shoulder-encounter`,
} as const

// ============================================
// Wizard accumulation type
// ============================================

export type AnyFhirResource = Patient | Condition | Procedure | Encounter | Observation | QuestionnaireResponse | Coverage | CarePlan | ImagingStudy

export interface WizardEntry {
  uuid: string
  resource: AnyFhirResource
}

// Narrower alias used by the follow-up flow: an entry can only be Encounter,
// Observation, QuestionnaireResponse, or (optionally, Q13 research
// re-imaging) ImagingStudy (Patient/Condition/Procedure are referenced by
// persisted ID, not contained).
export type FollowUpResource = Encounter | Observation | QuestionnaireResponse | ImagingStudy
export interface BundleEntry {
  uuid: string
  resource: FollowUpResource
}

/**
 * Bundle profile URLs for the three named transaction bundles in the IG.
 * Pass one to fhirClient.validateBundle / submitBundle to target the
 * corresponding submission shape. See ADR-0034.
 */
export const BUNDLE_PROFILES = {
  REGISTRATION: `${FHIR_BASE}/StructureDefinition/rotator-cuff-registration-bundle`,
  SURGERY: `${FHIR_BASE}/StructureDefinition/rotator-cuff-surgery-bundle`,
  FOLLOW_UP: `${FHIR_BASE}/StructureDefinition/rotator-cuff-follow-up-bundle`,
} as const

export const ENCOUNTER_CLASS_AMBULATORY: Coding = {
  system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  code: 'AMB',
  display: 'ambulatory',
} as const

export const ENCOUNTER_CLASS_INPATIENT: Coding = {
  system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  code: 'IMP',
  display: 'inpatient encounter',
} as const

export const FOLLOW_UP_ENCOUNTER_TYPE = {
  SYSTEM: 'http://snomed.info/sct',
  CODE: '390906007',
  DISPLAY: 'Follow-up encounter',
} as const

export const SURGERY_ENCOUNTER_TYPE = {
  SYSTEM: 'http://snomed.info/sct',
  CODE: '308335008',
  DISPLAY: 'Patient encounter procedure',
} as const

export const REGISTRATION_ENCOUNTER_TYPE = {
  SYSTEM: 'http://snomed.info/sct',
  CODE: '185349003',
  DISPLAY: 'Encounter for check up',
} as const

// SNOMED CT category codes used to distinguish prior treatments per
// PriorTreatmentCategoryVS (ADR-0034). Required binding on the Registration
// bundle's priorTreatment slice rejects any other category — surgical-category
// procedures (387713003) belong in RotatorCuffSurgeryBundle instead.
export const PROCEDURE_CATEGORY = {
  SURGICAL: { system: 'http://snomed.info/sct', code: '387713003', display: 'Surgical procedure' },
  PHYSICAL_THERAPY: { system: 'http://snomed.info/sct', code: '91251008', display: 'Physical therapy procedure' },
  MEDICATION_ADMIN: { system: 'http://snomed.info/sct', code: '18629005', display: 'Administration of medication' },
} as const

export const PATIENT_IDENTIFIER_SYSTEM = `${FHIR_BASE}/identifier/patient`

export interface OperationOutcome {
  resourceType: 'OperationOutcome'
  issue: Array<{
    severity: 'error' | 'warning' | 'information' | 'fatal'
    code: string
    details?: { text?: string; coding?: Array<{ display?: string }> }
    diagnostics?: string
    location?: string[]
    expression?: string[]
  }>
}

export interface TransactionResponseBundle {
  resourceType: 'Bundle'
  type: 'transaction-response'
  entry?: Array<{
    response?: {
      location?: string  // e.g. "Patient/abc123/_history/1"
      status?: string    // e.g. "201 Created"
    }
  }>
}

// Maps each observation profile key to its specific child profile URL.
// Use this in meta.profile so HAPI validates against the tightest applicable profile.
// ROM URLs were renamed under ADR-0045 (Forward Flexion → Shoulder Flexion) when the
// `Observation.code` binding was migrated from a local CodeSystem to LOINC.
export const OBSERVATION_PROFILE_URLS: Record<string, string> = {
  'patte-classification': `${FHIR_BASE}/StructureDefinition/patte-observation`,
  'goutallier-classification': `${FHIR_BASE}/StructureDefinition/goutallier-observation`,
  'forward-flexion': `${FHIR_BASE}/StructureDefinition/shoulder-flexion-observation`,
  'external-rotation': `${FHIR_BASE}/StructureDefinition/shoulder-external-rotation-observation`,
  'internal-rotation': `${FHIR_BASE}/StructureDefinition/shoulder-internal-rotation-observation`,
  'abduction': `${FHIR_BASE}/StructureDefinition/shoulder-abduction-observation`,
  'passive-forward-flexion': `${FHIR_BASE}/StructureDefinition/shoulder-passive-flexion-observation`,
  'passive-external-rotation': `${FHIR_BASE}/StructureDefinition/shoulder-passive-external-rotation-observation`,
  'passive-internal-rotation': `${FHIR_BASE}/StructureDefinition/shoulder-passive-internal-rotation-observation`,
  'passive-abduction': `${FHIR_BASE}/StructureDefinition/shoulder-passive-abduction-observation`,
  // ADR-0088: rotation measured at 90° abduction
  'external-rotation-90-abduction': `${FHIR_BASE}/StructureDefinition/shoulder-external-rotation-90-abduction-observation`,
  'internal-rotation-90-abduction': `${FHIR_BASE}/StructureDefinition/shoulder-internal-rotation-90-abduction-observation`,
  'passive-external-rotation-90-abduction': `${FHIR_BASE}/StructureDefinition/shoulder-passive-external-rotation-90-abduction-observation`,
  'passive-internal-rotation-90-abduction': `${FHIR_BASE}/StructureDefinition/shoulder-passive-internal-rotation-90-abduction-observation`,
  'supraspinatus-strength': `${FHIR_BASE}/StructureDefinition/supraspinatus-strength-observation`,
  'external-rotation-strength': `${FHIR_BASE}/StructureDefinition/external-rotation-strength-observation`,
  'subscapularis-strength': `${FHIR_BASE}/StructureDefinition/subscapularis-strength-observation`,
  // ADR-0089: new sibling strength axes
  'internal-rotation-strength': `${FHIR_BASE}/StructureDefinition/internal-rotation-strength-observation`,
  'supraspinatus-strength-dynamometry': `${FHIR_BASE}/StructureDefinition/supraspinatus-strength-dynamometry-observation`,
  'jobe-test': `${FHIR_BASE}/StructureDefinition/jobe-test-observation`,
  'lift-off-test': `${FHIR_BASE}/StructureDefinition/lift-off-test-observation`,
  'belly-press-test': `${FHIR_BASE}/StructureDefinition/belly-press-test-observation`,
  'bear-hug-test': `${FHIR_BASE}/StructureDefinition/bear-hug-test-observation`,
  'hornblower-test': `${FHIR_BASE}/StructureDefinition/hornblower-test-observation`,
  'tear-size': `${FHIR_BASE}/StructureDefinition/tear-size-observation`,
  'tear-size-classification': `${FHIR_BASE}/StructureDefinition/tear-size-classification-observation`,
  'intraop-tear-size': `${FHIR_BASE}/StructureDefinition/intraop-tear-size-observation`,
  'intraop-tear-size-classification': `${FHIR_BASE}/StructureDefinition/intraop-tear-size-classification-observation`,
  'tendons-involved': `${FHIR_BASE}/StructureDefinition/tendons-involved-observation`,
  'tear-location': `${FHIR_BASE}/StructureDefinition/tear-location-observation`,
  'tear-thickness': `${FHIR_BASE}/StructureDefinition/tear-thickness-observation`,
  'procedure-approach': `${FHIR_BASE}/StructureDefinition/procedure-approach-observation`,
  'reconstruction-extent': `${FHIR_BASE}/StructureDefinition/reconstruction-extent-observation`,
  'fixation-technique': `${FHIR_BASE}/StructureDefinition/fixation-technique-observation`,
  'constant-score': `${FHIR_BASE}/StructureDefinition/constant-score-observation`,
  'ssv-score': `${FHIR_BASE}/StructureDefinition/ssv-score-observation`,
  'sane-score': `${FHIR_BASE}/StructureDefinition/sane-score-observation`,
  'patient-satisfaction': `${FHIR_BASE}/StructureDefinition/patient-satisfaction-observation`,
  'return-to-sport-work': `${FHIR_BASE}/StructureDefinition/return-to-activity-observation`,
  'hand-dominance': `${FHIR_BASE}/StructureDefinition/hand-dominance-observation`,
  // expert consensus additions, May 2026
  'smoking-status': `${FHIR_BASE}/StructureDefinition/smoking-status-observation`,
  'pain-average': `${FHIR_BASE}/StructureDefinition/pain-average-observation`,
  'pain-active-movement': `${FHIR_BASE}/StructureDefinition/pain-active-movement-observation`,
  'pain-passive-movement': `${FHIR_BASE}/StructureDefinition/pain-passive-movement-observation`,
  'pain-rest': `${FHIR_BASE}/StructureDefinition/pain-rest-observation`,
  'employment-status': `${FHIR_BASE}/StructureDefinition/employment-status-observation`,
  'occupational-physical-demand': `${FHIR_BASE}/StructureDefinition/occupational-physical-demand-observation`,
  'sleep-disturbance': `${FHIR_BASE}/StructureDefinition/sleep-disturbance-observation`,
  'functional-limitations': `${FHIR_BASE}/StructureDefinition/functional-limitations-observation`,
  // ADR-0105 additions
  'smoking-pack-years': `${FHIR_BASE}/StructureDefinition/smoking-pack-years-observation`,
  'occupational-overhead-exposure': `${FHIR_BASE}/StructureDefinition/occupational-overhead-exposure-observation`,
  'prior-physical-therapy-session-count': `${FHIR_BASE}/StructureDefinition/prior-physical-therapy-session-count-observation`,
  'prior-injection-count': `${FHIR_BASE}/StructureDefinition/prior-injection-count-observation`,
  'sports-participation': `${FHIR_BASE}/StructureDefinition/sports-participation-observation`,
  'atrophy': `${FHIR_BASE}/StructureDefinition/atrophy-observation`,
  'deformity': `${FHIR_BASE}/StructureDefinition/deformity-observation`,
  'normal-shoulder-contour': `${FHIR_BASE}/StructureDefinition/normal-shoulder-contour-observation`,
}
