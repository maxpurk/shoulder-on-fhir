/**
 * FHIR Type Definitions for SDC Questionnaire Frontend
 *
 * Extends the primary frontend's types with QuestionnaireResponse and
 * Questionnaire types needed for SDC-based data capture.
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
  valueDecimal?: number
  // http://hl7.org/fhir/StructureDefinition/data-absent-reason (ADR-0147) —
  // FHIR core defines this extension's value[x] as `code`, not `Coding`.
  valueCode?: string
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
  onsetDateTime?: string
  recordedDate?: string
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
  performedDateTime?: string
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
  effectiveDateTime?: string
  valueQuantity?: Quantity
  valueCodeableConcept?: CodeableConcept
  valueString?: string
  valueBoolean?: boolean
  bodySite?: CodeableConcept
  method?: CodeableConcept
  // ADR-0147: set instead of value[x] when a post-op exam item was marked
  // "not applicable / not possible" — parity with the unified frontend's
  // buildNotDoneObservation (ADR-0109).
  dataAbsentReason?: CodeableConcept
  note?: Array<{ text: string }>
  // ADR-0090: named component slices (e.g. ConstantScoreObservation's Pain/
  // ADL/ROM/Strength sub-scores) — only Quantity components used so far.
  component?: Array<{ code: CodeableConcept; valueQuantity?: Quantity }>
  // ADR-0141: links a technique Observation (Approach/Reconstruction Extent/
  // Fixation Technique) to the specific Procedure it describes.
  partOf?: Reference[]
  // ADR-0156: aggregate/survey PROMs (Constant, SSV, SANE, satisfaction,
  // return-to-activity) have no bodySite; focus disambiguates which
  // RotatorCuffCondition the score is about in a bilateral case.
  focus?: Reference[]
}

// ============================================
// Questionnaire Resource (SDC)
// ============================================

export interface QuestionnaireAnswerOption {
  valueCoding?: Coding
  valueString?: string
  valueInteger?: number
}

export interface QuestionnaireItem {
  linkId: string
  text?: string
  type: 'group' | 'string' | 'date' | 'dateTime' | 'time' | 'text' | 'decimal' | 'integer' | 'boolean' | 'choice' | 'open-choice' | 'display'
  definition?: string
  required?: boolean
  repeats?: boolean
  readOnly?: boolean
  answerValueSet?: string
  answerOption?: QuestionnaireAnswerOption[]
  initial?: Array<{
    valueCoding?: Coding
    valueString?: string
    valueDate?: string
    valueBoolean?: boolean
    valueDecimal?: number
  }>
  extension?: Extension[]
  item?: QuestionnaireItem[]
}

export interface Questionnaire {
  resourceType: 'Questionnaire'
  id?: string
  url?: string
  name?: string
  title?: string
  status: 'draft' | 'active' | 'retired' | 'unknown'
  subjectType?: string[]
  extension?: Extension[]
  item?: QuestionnaireItem[]
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
// Coverage Resource (Q1.l workers'-compensation flag, ADR-0061/ADR-0131)
// ============================================

export interface Coverage {
  resourceType: 'Coverage'
  id?: string
  meta?: Meta
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error'
  type?: CodeableConcept
  subscriber?: Reference
  beneficiary?: Reference
  payor?: Reference[]
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
  period?: { start?: string; end?: string }
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

// ============================================
// QuestionnaireResponse Resource (SDC)
// ============================================

export interface QRAnswer {
  valueString?: string
  valueDate?: string
  valueDateTime?: string
  valueDecimal?: number
  valueInteger?: number
  valueBoolean?: boolean
  valueCoding?: Coding
}

export interface QRItem {
  linkId: string
  text?: string
  answer?: QRAnswer[]
  item?: QRItem[]
  // Carries http://hl7.org/fhir/StructureDefinition/data-absent-reason when
  // the item was explicitly marked "not applicable / not possible" with no
  // answer (ADR-0147) — parity with the unified frontend's per-field N/A
  // checkbox (ADR-0109).
  extension?: Extension[]
}

export interface QuestionnaireResponse {
  resourceType: 'QuestionnaireResponse'
  id?: string
  meta?: Meta
  questionnaire?: string
  status: 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped'
  subject?: Reference
  authored?: string
  item?: QRItem[]
}

// ============================================
// Bundle Resource
// ============================================

export interface Bundle<T = AnyFhirResource> {
  resourceType: 'Bundle'
  type: 'searchset' | 'batch' | 'transaction' | 'batch-response' | 'transaction-response' | 'collection'
  total?: number
  entry?: Array<{
    fullUrl?: string
    resource: T
  }>
}

// ============================================
// Canonical URLs
// ============================================
// The hardcoded knowledge that previously lived here (OBSERVATION_CODES,
// OBSERVATION_CODINGS, OBSERVATION_PROFILE_URLS, etc.), and later a
// hand-typed `PROFILE_METADATA` map in `lib/extractor.ts`, is resolved at
// runtime from HAPI instead by `lib/profileMetadataResolver.ts` (ADR-0103;
// generalized from code/category/unit to every element type by ADR-0122).
// Only canonical URLs that callers across the app need are exported here.

const IG_CANONICAL = import.meta.env.VITE_IG_CANONICAL || 'https://maxpurk.github.io/shoulder-on-fhir'
const FHIR_BASE = IG_CANONICAL

export const PROFILE_URLS = {
  PATIENT: `${FHIR_BASE}/StructureDefinition/shoulder-patient`,
  CONDITION: `${FHIR_BASE}/StructureDefinition/rotator-cuff-condition`,
  OTHER_DIAGNOSIS_CONDITION: `${FHIR_BASE}/StructureDefinition/shoulder-diagnosis-condition`,
  PROCEDURE: `${FHIR_BASE}/StructureDefinition/rotator-cuff-procedure`,
  OBSERVATION: `${FHIR_BASE}/StructureDefinition/shoulder-observation`,
  ENCOUNTER: `${FHIR_BASE}/StructureDefinition/shoulder-encounter`,
  QUESTIONNAIRE_RESPONSE: `${FHIR_BASE}/StructureDefinition/rotator-cuff-questionnaire-response`,
  CARE_PLAN: `${FHIR_BASE}/StructureDefinition/rotator-cuff-research-care-plan`,
  IMAGING_STUDY: `${FHIR_BASE}/StructureDefinition/shoulder-imaging-study`,
  COVERAGE: `${FHIR_BASE}/StructureDefinition/shoulder-coverage`,
  COMORBIDITY_CONDITION: `${FHIR_BASE}/StructureDefinition/shoulder-comorbidity-condition`,
} as const

// Bundle profile canonical URLs (ADR-0034). Used by fhirClient.validateBundle/
// submitBundle to stamp meta.profile and route the strict validator-service
// pre-flight call (ADR-0051), not HAPI's $validate.
export const BUNDLE_PROFILE_URLS = {
  REGISTRATION: `${FHIR_BASE}/StructureDefinition/rotator-cuff-registration-bundle`,
  SURGERY: `${FHIR_BASE}/StructureDefinition/rotator-cuff-surgery-bundle`,
  FOLLOW_UP: `${FHIR_BASE}/StructureDefinition/rotator-cuff-follow-up-bundle`,
} as const

// SDC Questionnaire canonical URLs (ADR-0040). The active flow's Questionnaire
// URL drives bundle profile selection in the assembler.
export const QUESTIONNAIRE_URLS = {
  REGISTRATION: `${FHIR_BASE}/Questionnaire/shoulder-registration`,
  SURGERY: `${FHIR_BASE}/Questionnaire/shoulder-surgery`,
  FOLLOW_UP: `${FHIR_BASE}/Questionnaire/shoulder-follow-up`,
} as const

// Map from Questionnaire URL → target bundle profile. The bundle assembler
// uses this to decide which assembly mode to run.
export const QUESTIONNAIRE_TO_BUNDLE: Record<string, string> = {
  [QUESTIONNAIRE_URLS.REGISTRATION]: BUNDLE_PROFILE_URLS.REGISTRATION,
  [QUESTIONNAIRE_URLS.SURGERY]: BUNDLE_PROFILE_URLS.SURGERY,
  [QUESTIONNAIRE_URLS.FOLLOW_UP]: BUNDLE_PROFILE_URLS.FOLLOW_UP,
}

// ============================================
// Encounter Resource (minimal — full shape lives in extractor.ts)
// ============================================

export interface EncounterShape {
  resourceType: 'Encounter'
  id?: string
  meta?: Meta
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled'
  class: Coding
  type?: CodeableConcept[]
  subject?: Reference
  period?: { start?: string; end?: string }
  reasonReference?: Reference[]
}

// ============================================
// Bundle submission types
// ============================================

export type AnyFhirResource = Patient | Condition | Procedure | Observation | EncounterShape | QuestionnaireResponse | CarePlan | ImagingStudy | Coverage

export interface WizardEntry {
  uuid: string
  resource: AnyFhirResource
}

export interface TransactionResponseBundle {
  resourceType: 'Bundle'
  type: 'transaction-response'
  entry?: Array<{
    response?: {
      location?: string
      status?: string
    }
  }>
}

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
