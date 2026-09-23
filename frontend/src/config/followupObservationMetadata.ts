/**
 * Observation metadata — Q9 post-op exam + Q12 PROM fields only.
 *
 * Q9 covers (Hurley et al. 2024): Inspection (atrophy / deformity / normal
 * contour — 3 structured findings per ADR-0086), Active ROM, Passive ROM,
 * Strength, Jobe, Lift-off, Belly-press.
 * Q12 covers: Constant-Murley, SSV/SANE, VAS pain (4 context-specific axes —
 * average / active movement / passive movement / rest — per ADR-0087),
 * satisfaction, return-to-activity.
 *
 * Pre-op-only fields (Q1 history items, imaging classification) are intentionally
 * absent from this map — the follow-up frontend does not capture them.
 */

import { IG_CANONICAL, VALUESET_URLS, SHOULDER_OBS_SYSTEM } from '../types/fhir'

export type ValueInputType = 'quantity' | 'codeable' | 'string'
export type ObservationGroup = 'rom-active' | 'rom-passive' | 'strength' | 'provocation' | 'prom-score' | 'prom-coded' | 'exam-finding'

export interface ObservationMeta {
  /** Display label shown in the form */
  label: string
  /** Input control type for the value field */
  valueType: ValueInputType
  /** UI grouping */
  group: ObservationGroup
  /** FHIR observation-category code — must match the fixed category on the field's Observation profile */
  category: 'exam' | 'survey'
  /** UCUM unit code for quantity inputs */
  unit?: string
  unitDisplay?: string
  min?: number
  max?: number
  /** HTML5 step for quantity inputs — defaults to 'any' (decimals allowed) when unset */
  step?: number
  /** ValueSet to expand for coded value dropdowns */
  valueSetUrl?: string
  /** CodeSystem URL for the value coding (only set for coded values) */
  valueCodeSystem?: string
  /** Explanatory gloss rendered under the label, mirroring the Registration wizard's convention */
  helpText?: string
  /** Shows a required-field marker; does not itself enforce submission (all follow-up fields remain optional-by-design) */
  required?: boolean
}

export const Q9_FIELDS: Record<string, ObservationMeta> = {
  // ADR-0086: free-text "Inspection" replaced by 3 structured findings
  atrophy: {
    label: 'Atrophy',
    valueType: 'codeable',
    group: 'exam-finding',
    category: 'exam',
    valueSetUrl: VALUESET_URLS.PRESENT_ABSENT,
    valueCodeSystem: 'http://snomed.info/sct',
  },
  deformity: {
    label: 'Deformity',
    valueType: 'codeable',
    group: 'exam-finding',
    category: 'exam',
    valueSetUrl: VALUESET_URLS.PRESENT_ABSENT,
    valueCodeSystem: 'http://snomed.info/sct',
  },
  'normal-shoulder-contour': {
    label: 'Normal Shoulder Contour',
    valueType: 'codeable',
    group: 'exam-finding',
    category: 'exam',
    valueSetUrl: VALUESET_URLS.PRESENT_ABSENT,
    valueCodeSystem: 'http://snomed.info/sct',
  },
  // ROM + Strength fields: min/max sourced from the IG profile's
  // maxValueQuantity / minValueQuantity at render time (useQuantityBounds).
  'forward-flexion': {
    label: 'Active Forward Flexion',
    valueType: 'quantity',
    group: 'rom-active',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  'external-rotation': {
    label: 'Active External Rotation, at side',
    valueType: 'quantity',
    group: 'rom-active',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  // ADR-0088: at-side Internal Rotation redesigned from degrees to the
  // "hand behind back" vertebral-level ordinal.
  'internal-rotation': {
    label: 'Active Internal Rotation, at side (hand behind back)',
    valueType: 'codeable',
    group: 'rom-active',
    category: 'exam',
    valueSetUrl: VALUESET_URLS.INTERNAL_ROTATION_VERTEBRAL_LEVEL,
    valueCodeSystem: `${IG_CANONICAL}/CodeSystem/internal-rotation-vertebral-level`,
  },
  // ADR-0088: rotation measured at 90° abduction — new, alongside at-side ROM.
  'external-rotation-90-abduction': {
    label: 'Active External Rotation, at 90° abduction',
    valueType: 'quantity',
    group: 'rom-active',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  'internal-rotation-90-abduction': {
    label: 'Active Internal Rotation, at 90° abduction',
    valueType: 'quantity',
    group: 'rom-active',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  abduction: {
    label: 'Active Abduction',
    valueType: 'quantity',
    group: 'rom-active',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  'passive-forward-flexion': {
    label: 'Passive Forward Flexion',
    valueType: 'quantity',
    group: 'rom-passive',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  'passive-external-rotation': {
    label: 'Passive External Rotation, at side',
    valueType: 'quantity',
    group: 'rom-passive',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  // ADR-0088: at-side Internal Rotation redesigned from degrees to the
  // "hand behind back" vertebral-level ordinal.
  'passive-internal-rotation': {
    label: 'Passive Internal Rotation, at side (hand behind back)',
    valueType: 'codeable',
    group: 'rom-passive',
    category: 'exam',
    valueSetUrl: VALUESET_URLS.INTERNAL_ROTATION_VERTEBRAL_LEVEL,
    valueCodeSystem: `${IG_CANONICAL}/CodeSystem/internal-rotation-vertebral-level`,
  },
  // ADR-0088: rotation measured at 90° abduction — new, alongside at-side ROM.
  'passive-external-rotation-90-abduction': {
    label: 'Passive External Rotation, at 90° abduction',
    valueType: 'quantity',
    group: 'rom-passive',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  'passive-internal-rotation-90-abduction': {
    label: 'Passive Internal Rotation, at 90° abduction',
    valueType: 'quantity',
    group: 'rom-passive',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  'passive-abduction': {
    label: 'Passive Abduction',
    valueType: 'quantity',
    group: 'rom-passive',
    category: 'exam',
    unit: 'deg',
    unitDisplay: 'degrees',
  },
  'supraspinatus-strength': {
    label: 'Supraspinatus Strength (Janda, MMT 0–5)',
    valueType: 'quantity',
    group: 'strength',
    category: 'exam',
    unit: '{score}',
    unitDisplay: 'MMT grade',
    helpText: 'Tested at the empty-can/Jobe position (scapular-plane abduction, internally rotated).',
  },
  'external-rotation-strength': {
    label: 'External Rotation Strength (Janda, MMT 0–5)',
    valueType: 'quantity',
    group: 'strength',
    category: 'exam',
    unit: '{score}',
    unitDisplay: 'MMT grade',
  },
  'subscapularis-strength': {
    label: 'Subscapularis Strength (Janda, MMT 0–5)',
    valueType: 'quantity',
    group: 'strength',
    category: 'exam',
    unit: '{score}',
    unitDisplay: 'MMT grade',
  },
  // ADR-0089: new sibling strength axes
  'internal-rotation-strength': {
    label: 'Internal Rotation Strength (Janda, MMT 0–5)',
    valueType: 'quantity',
    group: 'strength',
    category: 'exam',
    unit: '{score}',
    unitDisplay: 'MMT grade',
  },
  'supraspinatus-strength-dynamometry': {
    label: 'Supraspinatus Strength (Dynamometry)',
    valueType: 'quantity',
    group: 'strength',
    category: 'exam',
    unit: 'kg',
    unitDisplay: 'kilograms',
    helpText: 'Same test position as the Janda grade above.',
  },
  // Only 3 provocation tests here, not the 5 Registration captures — this is
  // intentional, not a gap. Hurley's own A9 (post-op physical exam) names
  // exactly Jobe/lift-off/belly-press; A2 (pre-op exam, which Registration's
  // 5-test set maps to) additionally names bear-hug and Hornblower. Verified
  // directly against the paper before considering this a parity bug — do not
  // add bear-hug/Hornblower here without re-checking Hurley A9 first.
  'jobe-test': {
    label: 'Jobe Test',
    valueType: 'codeable',
    group: 'provocation',
    category: 'exam',
    valueCodeSystem: 'http://snomed.info/sct',
  },
  'lift-off-test': {
    label: 'Lift-off Test',
    valueType: 'codeable',
    group: 'provocation',
    category: 'exam',
    valueCodeSystem: 'http://snomed.info/sct',
  },
  'belly-press-test': {
    label: 'Belly-press Test',
    valueType: 'codeable',
    group: 'provocation',
    category: 'exam',
    valueCodeSystem: 'http://snomed.info/sct',
  },
}

export const Q12_FIELDS: Record<string, ObservationMeta> = {
  // ADR-0090: rendered via a bespoke ConstantScoreField in Q12PromForm.tsx,
  // not the generic per-field loop (needs live auto-calc across 5 related
  // fields) — metadata kept here for the label/unit/bounds it still supplies.
  'constant-score': {
    label: 'Constant-Murley Score',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'survey',
    unit: '{score}',
    unitDisplay: 'points',
    min: 0,
    max: 100,
    helpText: 'Higher = better function. Calculated automatically from the four sub-scores below.',
  },
  'constant-score-pain': {
    label: 'Constant: Pain',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'survey',
    unit: '{score}',
    unitDisplay: 'points',
    min: 0,
    max: 15,
  },
  'constant-score-adl': {
    label: 'Constant: Activities of Daily Living',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'survey',
    unit: '{score}',
    unitDisplay: 'points',
    min: 0,
    max: 20,
  },
  'constant-score-rom': {
    label: 'Constant: Range of Motion',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'survey',
    unit: '{score}',
    unitDisplay: 'points',
    min: 0,
    max: 40,
  },
  'constant-score-strength': {
    label: 'Constant: Strength',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'survey',
    unit: '{score}',
    unitDisplay: 'points',
    min: 0,
    max: 25,
  },
  'ssv-score': {
    label: 'Subjective Shoulder Value (SSV)',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'survey',
    unit: '%',
    unitDisplay: '%',
    min: 0,
    max: 100,
    helpText: 'Subjective Shoulder Value — patient self-rating.',
  },
  'sane-score': {
    label: 'SANE (Single Assessment Numeric Evaluation)',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'survey',
    unit: '%',
    unitDisplay: '%',
    min: 0,
    max: 100,
    helpText: 'Single Assessment Numeric Evaluation.',
  },
  // ADR-0087: single "pain-severity" (LOINC 72514-3) replaced by 4
  // context-specific axes. step: 1 mirrors Registration's hardcoded
  // integer-only pain inputs (StepClinicalAssessment.tsx) — Follow-Up
  // previously fell through to the field's unconstrained "any" default,
  // silently accepting decimal pain values Registration would reject.
  // category is 'exam' (not 'survey' like the rest of this Q12 group) —
  // all four PainXxxObservation profiles fix Observation.category to
  // #exam, matching Registration's own pain fields (StepClinicalAssessment.tsx).
  'pain-average': {
    label: 'Pain — On Average (0–10)',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'exam',
    unit: '{score}',
    unitDisplay: 'pain score',
    step: 1,
    helpText: '0 = no pain, 10 = worst pain imaginable.',
  },
  'pain-active-movement': {
    label: 'Pain — With Active Movement (0–10)',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'exam',
    unit: '{score}',
    unitDisplay: 'pain score',
    step: 1,
    helpText: '0 = no pain, 10 = worst pain imaginable.',
  },
  'pain-passive-movement': {
    label: 'Pain — With Passive Movement (0–10)',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'exam',
    unit: '{score}',
    unitDisplay: 'pain score',
    step: 1,
    helpText: '0 = no pain, 10 = worst pain imaginable.',
  },
  'pain-rest': {
    label: 'Pain — At Rest (0–10)',
    valueType: 'quantity',
    group: 'prom-score',
    category: 'exam',
    unit: '{score}',
    unitDisplay: 'pain score',
    step: 1,
    helpText: '0 = no pain, 10 = worst pain imaginable.',
  },
  'patient-satisfaction': {
    label: 'Patient Satisfaction with Treatment',
    valueType: 'codeable',
    group: 'prom-coded',
    category: 'survey',
    valueSetUrl: VALUESET_URLS.SATISFACTION_SCALE,
    valueCodeSystem: 'http://loinc.org',
  },
  'return-to-sport-work': {
    label: 'Return to Sport / Work',
    valueType: 'codeable',
    group: 'prom-coded',
    category: 'survey',
    valueSetUrl: VALUESET_URLS.RETURN_TO_ACTIVITY,
    valueCodeSystem: `${IG_CANONICAL}/CodeSystem/return-to-activity`,
  },
}

export const GROUP_LABELS: Record<ObservationGroup, string> = {
  'rom-active': 'Active Range of Motion',
  'rom-passive': 'Passive Range of Motion',
  strength: 'Strength Testing (MMT)',
  provocation: 'Provocation Tests',
  'prom-score': 'Outcome Scores',
  'prom-coded': 'Coded Outcomes',
  'exam-finding': 'Physical Examination',
}

// Re-export so callers can read the local CS URL without re-importing types/fhir
export { SHOULDER_OBS_SYSTEM }
