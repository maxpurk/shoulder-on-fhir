/**
 * Form-data shapes and initial values for each Registration wizard step.
 *
 * Each step is a controlled component — state lives in RegistrationWizard so
 * back-navigation preserves both committed and in-edit fields.
 */

export interface ComorbidityCoded {
  code: string
  display: string
  system: string
}

export interface PatientFormData {
  givenName: string
  familyName: string
  birthDate: string
  gender: string
  sexAtBirth: string
  patientId: string
  handDominance: string
  phone: string
  street: string
  postalCode: string
  city: string
  smokingStatus: string
  // Cumulative pack-years — only meaningful for current/former smokers. See ADR-0105.
  smokingPackYears: string
  employmentStatus: string
  // Physical-demand intensity (sedentary/light/heavy) — overhead exposure is
  // now a separate independent axis, `occupationalOverheadExposure`. See ADR-0105.
  occupationalPhysicalDemand: string
  occupationalOverheadExposure: string
  sleepDisturbance: string
  sportsParticipation: string
  // Coded functional-limitation-severity value (FunctionalLimitationSeverity
  // VS code), not free text. See ADR-0105.
  functionalLimitations: string
  priorPhysicalTherapy: string
  // Bucketed session-count code (PriorPhysicalTherapySessionCount VS),
  // replacing the prior approximate-date field. See ADR-0105.
  priorPhysicalTherapySessionCount: string
  priorInjection: string
  // Bucketed injection-count code (PriorInjectionCount VS), replacing the
  // prior approximate-date field. See ADR-0105.
  priorInjectionCount: string
  comorbidities: ComorbidityCoded[]
  /**
   * Tri-state for expert consensus Q1.c. Determines what (if anything) gets emitted as a
   * ShoulderComorbidityCondition:
   *   'specific'   — iterate `comorbidities[]`, one Condition per SNOMED code
   *                  (today's behavior; default).
   *   'none-known' — emit one Condition with IPS `no-known-problems`
   *                  (clinician asked; patient has none).
   *   'no-info'    — emit one Condition with IPS `no-problem-info`
   *                  (no information available; not asked or unknown).
   * The two absent/unknown codes live in the IPS Problems VS by construction
   * (the bound VS on ShoulderComorbidityCondition.code) but cannot be reached
   * through the SNOMED-only typeahead — see ADR-0062 §2026-05-24 verification.
   */
  comorbidityStatus: 'specific' | 'none-known' | 'no-info'
  /**
   * expert consensus Q1.l "workmen's compensation". Allowed values: 'yes' | 'no' |
   * 'unknown' | ''. Empty string = not asked yet. Hurley names this as a single
   * yes/no patient-history flag (Q1.l in the unanimous-consensus list); broader
   * payer categorisation (GKV/PKV/Selbstzahler) is intentionally out of scope.
   * Submission emits a ShoulderCoverage with `Coverage.type = v3-ActCode#WCBPOL`
   * only when the answer is 'yes'. See ADR-0061.
   */
  workersCompensation: string
}

export function createInitialPatientForm(): PatientFormData {
  return {
    givenName: '',
    familyName: '',
    birthDate: '',
    gender: '',
    sexAtBirth: '',
    patientId: `PAT-${Date.now()}`,
    handDominance: '',
    phone: '',
    street: '',
    postalCode: '',
    city: '',
    smokingStatus: '',
    smokingPackYears: '',
    employmentStatus: '',
    occupationalPhysicalDemand: '',
    occupationalOverheadExposure: '',
    sleepDisturbance: '',
    sportsParticipation: '',
    functionalLimitations: '',
    priorPhysicalTherapy: '',
    priorPhysicalTherapySessionCount: '',
    priorInjection: '',
    priorInjectionCount: '',
    comorbidities: [],
    comorbidityStatus: 'specific',
    workersCompensation: '',
  }
}

/**
 * One diagnosis within the Diagnosis step's repeatable list. `kind` decides
 * which fields apply and which Condition profile + ValueSet the entry emits:
 *   'rotator-cuff' — RotatorCuffCondition. Carries etiology (required by the
 *                    profile), tendons involved (Q4.b), and tear location —
 *                    disease-entity `diagnosisCode` only (thickness/tear
 *                    type); which tendon and etiology are captured on their
 *                    own elements rather than folded into the code.
 *   'other'        — ShoulderDiagnosisCondition, for a coexisting
 *                    non-rotator-cuff shoulder diagnosis on the same
 *                    shoulder (e.g. AC joint arthritis). No etiology/tendon/
 *                    tear-location fields — those classification systems
 *                    don't apply.
 * The first entry in ConditionFormData.diagnoses is always 'rotator-cuff'
 * and is the principal diagnosis (Encounter.diagnosis.rank = 1); every
 * additional entry is always 'other' (rank 2, 3, … in list order) — the UI
 * offers no way to add a second rotator-cuff diagnosis, per surgeon
 * feedback that a second, separately coded tear is not a case this
 * registry needs to represent.
 */
export interface DiagnosisEntry {
  key: string
  kind: 'rotator-cuff' | 'other'
  diagnosisCode: string
  etiologyCode: string
  tearLocation: string
  // Partial vs. full thickness (expert consensus Q4.c) — decoupled from diagnosisCode.
  // See ADR-0105.
  tearThickness: string
  selectedTendons: string[]
}

export function createDiagnosisEntry(kind: DiagnosisEntry['kind']): DiagnosisEntry {
  return {
    key: crypto.randomUUID(),
    kind,
    diagnosisCode: '',
    etiologyCode: '',
    tearLocation: '',
    tearThickness: '',
    selectedTendons: [],
  }
}

export interface ConditionFormData {
  laterality: string
  onsetDate: string
  clinicalStatus: string
  // verificationStatus is no longer asked in the UI (surgeon feedback,
  // ADR-0105) — every registered diagnosis is clinically confirmed at this
  // point in the workflow, so it is fixed to 'confirmed' at submission
  // rather than collected here. Condition.verificationStatus itself stays
  // 1..1 MS (FHIR-required, L3.B.2).
  // Shared across every diagnosis in this registration entry — one patient,
  // one shoulder, one visit. diagnoses[0] is always the principal
  // ('rotator-cuff'); a bilateral case is two separate registrations.
  diagnoses: DiagnosisEntry[]
}

export function createInitialConditionForm(): ConditionFormData {
  return {
    laterality: '',
    onsetDate: '',
    clinicalStatus: 'active',
    diagnoses: [createDiagnosisEntry('rotator-cuff')],
  }
}

export interface ImagingFormData {
  patte: string
  goutallier: string
  tearSize: string
  tearSizeClassification: string
  // Multi-select (ADR-0155): a patient can have both a plain radiograph (Q3,
  // DX) and an advanced-imaging study (Q6, MR/CT/US) — one ImagingStudy
  // resource is built per selected code.
  imagingModalities: string[]
}

export const INITIAL_IMAGING_FORM: ImagingFormData = {
  patte: '',
  goutallier: '',
  tearSize: '',
  tearSizeClassification: '',
  imagingModalities: [],
}

export interface ClinicalAssessmentFormData {
  forwardFlexion: string
  externalRotation: string
  // ADR-0088: at-side Internal Rotation holds an InternalRotationVertebralLevel
  // code ("hand behind back" ordinal), not a degree value.
  internalRotation: string
  abduction: string
  // ADR-0088: rotation measured at 90° abduction — new, alongside at-side ROM.
  externalRotation90Abduction: string
  internalRotation90Abduction: string
  passiveForwardFlexion: string
  passiveExternalRotation: string
  passiveInternalRotation: string
  passiveExternalRotation90Abduction: string
  passiveInternalRotation90Abduction: string
  passiveAbduction: string
  supraspinatusStrength: string
  externalRotationStrength: string
  subscapularisStrength: string
  // ADR-0089: new sibling strength axes
  internalRotationStrength: string
  supraspinatusStrengthDynamometry: string
  jobeTest: string
  liftOffTest: string
  bellyPressTest: string
  bearHugTest: string
  hornblowerTest: string
  painAverage: string
  painActiveMovement: string
  painPassiveMovement: string
  painRest: string
  atrophy: string
  deformity: string
  normalShoulderContour: string
}

export const INITIAL_CLINICAL_ASSESSMENT_FORM: ClinicalAssessmentFormData = {
  forwardFlexion: '',
  externalRotation: '',
  internalRotation: '',
  abduction: '',
  externalRotation90Abduction: '',
  internalRotation90Abduction: '',
  passiveForwardFlexion: '',
  passiveExternalRotation: '',
  passiveInternalRotation: '',
  passiveExternalRotation90Abduction: '',
  passiveInternalRotation90Abduction: '',
  passiveAbduction: '',
  supraspinatusStrength: '',
  externalRotationStrength: '',
  subscapularisStrength: '',
  internalRotationStrength: '',
  supraspinatusStrengthDynamometry: '',
  jobeTest: '',
  liftOffTest: '',
  bellyPressTest: '',
  bearHugTest: '',
  hornblowerTest: '',
  painAverage: '',
  painActiveMovement: '',
  painPassiveMovement: '',
  painRest: '',
  atrophy: '',
  deformity: '',
  normalShoulderContour: '',
}

export interface OutcomeScoresFormData {
  // ADR-0090: two entry modes on the same field, distinguished by whether the
  // four component fields below are filled — direct total entry when they're
  // blank, auto-calculated (sum) when they're filled. See StepOutcomeScores.tsx.
  constantScore: string
  constantScorePain: string
  constantScoreAdl: string
  constantScoreRom: string
  constantScoreStrength: string
  // POOS-15 sub-item calculator inputs (see constantScore.ts). These six are
  // UI-only computation inputs — never submitted as their own Observations —
  // for the sub-items this registry does not otherwise capture in a form
  // POOS-15's own auto-derivable from. Sleep (B3), Flexion/Abduction (C1/C2),
  // and Internal Rotation (C4) instead auto-derive live from `assessment`/
  // `patient` (StepClinicalAssessment / StepPatient), with no dedicated field
  // here.
  constantPainNormalActivities: string
  constantAdlOccupation: string
  constantAdlLeisure: string
  constantAdlArmUse: string
  constantRomExternalRotation: string
  constantPowerTest: string
  ssvScore: string
  saneScore: string
}

export const INITIAL_OUTCOME_SCORES_FORM: OutcomeScoresFormData = {
  constantScore: '',
  constantScorePain: '',
  constantScoreAdl: '',
  constantScoreRom: '',
  constantScoreStrength: '',
  constantPainNormalActivities: '',
  constantAdlOccupation: '',
  constantAdlLeisure: '',
  constantAdlArmUse: '',
  constantRomExternalRotation: '',
  constantPowerTest: '',
  ssvScore: '',
  saneScore: '',
}
