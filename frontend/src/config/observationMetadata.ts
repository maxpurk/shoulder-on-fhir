/**
 * Observation Metadata Configuration
 *
 * Static per-observation-code metadata that describes *how* a ShoulderObservation
 * value is entered (input type, unit, range) and *which* ValueSet to expand for
 * coded-value dropdowns.
 *
 * This is the only file that must be updated when new ShoulderObservationCS codes
 * are added to the IG. Everything else (display names, coded options) is fetched
 * dynamically from the FHIR server.
 */

import { IG_CANONICAL as BASE } from '../types/fhir'

export type ValueInputType = 'quantity' | 'codeable' | 'string' | 'boolean'
export type ObservationGroup = 'imaging' | 'rom' | 'strength' | 'provocation' | 'prom' | 'history' | 'exam-finding'

export interface ObservationMeta {
  /** Input control type for the value field */
  valueType: ValueInputType
  /** FHIR observation category code (observation-category CS) */
  category: 'exam' | 'imaging' | 'survey' | 'social-history'
  /** UI group for the observation type dropdown */
  group: ObservationGroup
  /** UCUM unit code for Quantity values (e.g. 'deg', 'cm') */
  unit?: string
  /** Human-readable unit label (e.g. 'degrees') */
  unitDisplay?: string
  /** Minimum allowed numeric value */
  min?: number
  /** Maximum allowed numeric value */
  max?: number
  /** Canonical ValueSet URL to $expand for codeable value options (omit for provocation tests) */
  valueSetUrl?: string
  /** CodeSystem URL used in valueCodeableConcept.coding[0].system when building the FHIR resource */
  codeSystem?: string
}

export const OBSERVATION_METADATA: Record<string, ObservationMeta> = {
  // ── Imaging classifications ───────────────────────────────────────────────
  'patte-classification': {
    valueType: 'codeable',
    category: 'imaging',
    group: 'imaging',
    valueSetUrl: `${BASE}/ValueSet/patte-classification`,
    codeSystem: `${BASE}/CodeSystem/patte-classification`,
  },
  'goutallier-classification': {
    valueType: 'codeable',
    category: 'imaging',
    group: 'imaging',
    valueSetUrl: `${BASE}/ValueSet/goutallier-classification`,
    codeSystem: `${BASE}/CodeSystem/goutallier-classification`,
  },
  'tear-size': {
    valueType: 'quantity',
    category: 'imaging',
    group: 'imaging',
    unit: 'cm',
    unitDisplay: 'centimetres',
  },
  'tear-size-classification': {
    valueType: 'codeable',
    category: 'imaging',
    group: 'imaging',
    valueSetUrl: `${BASE}/ValueSet/cofield-tear-size-classification`,
    codeSystem: `${BASE}/CodeSystem/cofield-tear-size-classification`,
  },
  // Intra-operative siblings (ADR-0104) — same concept/code as tear-size /
  // tear-size-classification above, different fixed profile + category
  // (exam, not imaging): captured during surgery, not from pre-op imaging.
  'intraop-tear-size': {
    valueType: 'quantity',
    category: 'exam',
    group: 'imaging',
    unit: 'cm',
    unitDisplay: 'centimetres',
  },
  'intraop-tear-size-classification': {
    valueType: 'codeable',
    category: 'exam',
    group: 'imaging',
    valueSetUrl: `${BASE}/ValueSet/cofield-tear-size-classification`,
    codeSystem: `${BASE}/CodeSystem/cofield-tear-size-classification`,
  },
  'tendons-involved': {
    valueType: 'codeable',
    category: 'imaging',
    group: 'imaging',
    valueSetUrl: `${BASE}/ValueSet/tendons-involved`,
    codeSystem: 'http://snomed.info/sct',
  },

  // ── Active range of motion ────────────────────────────────────────────────
  'forward-flexion': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 180,
  },
  'external-rotation': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 360,
  },
  // ADR-0088: at-side Internal Rotation redesigned from degrees to the
  // "hand behind back" vertebral-level ordinal.
  'internal-rotation': {
    valueType: 'codeable',
    category: 'exam',
    group: 'rom',
    valueSetUrl: `${BASE}/ValueSet/internal-rotation-vertebral-level`,
    codeSystem: `${BASE}/CodeSystem/internal-rotation-vertebral-level`,
  },
  // ADR-0088: rotation measured at 90° abduction — new, alongside at-side ROM.
  'external-rotation-90-abduction': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 360,
  },
  'internal-rotation-90-abduction': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 360,
  },
  'abduction': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 180,
  },

  // ── Passive range of motion ───────────────────────────────────────────────
  'passive-forward-flexion': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 180,
  },
  'passive-external-rotation': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 360,
  },
  // ADR-0088: at-side Internal Rotation redesigned from degrees to the
  // "hand behind back" vertebral-level ordinal.
  'passive-internal-rotation': {
    valueType: 'codeable',
    category: 'exam',
    group: 'rom',
    valueSetUrl: `${BASE}/ValueSet/internal-rotation-vertebral-level`,
    codeSystem: `${BASE}/CodeSystem/internal-rotation-vertebral-level`,
  },
  // ADR-0088: rotation measured at 90° abduction — new, alongside at-side ROM.
  'passive-external-rotation-90-abduction': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 360,
  },
  'passive-internal-rotation-90-abduction': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 360,
  },
  'passive-abduction': {
    valueType: 'quantity',
    category: 'exam',
    group: 'rom',
    unit: 'deg',
    unitDisplay: 'degrees',
    min: 0,
    max: 180,
  },

  // ── Strength testing ──────────────────────────────────────────────────────
  'supraspinatus-strength': {
    valueType: 'quantity',
    category: 'exam',
    group: 'strength',
    unit: '{score}',
    unitDisplay: 'MMT grade',
    min: 0,
    max: 5,
  },
  'external-rotation-strength': {
    valueType: 'quantity',
    category: 'exam',
    group: 'strength',
    unit: '{score}',
    unitDisplay: 'MMT grade',
    min: 0,
    max: 5,
  },
  'subscapularis-strength': {
    valueType: 'quantity',
    category: 'exam',
    group: 'strength',
    unit: '{score}',
    unitDisplay: 'MMT grade',
    min: 0,
    max: 5,
  },
  // ADR-0089: new sibling strength axes
  'internal-rotation-strength': {
    valueType: 'quantity',
    category: 'exam',
    group: 'strength',
    unit: '{score}',
    unitDisplay: 'MMT grade',
    min: 0,
    max: 5,
  },
  'supraspinatus-strength-dynamometry': {
    valueType: 'quantity',
    category: 'exam',
    group: 'strength',
    unit: 'kg',
    unitDisplay: 'kilograms',
    min: 0,
    max: 50,
  },

  // ── Provocation tests (SNOMED positive/negative — no ValueSet URL needed) ─
  'jobe-test': {
    valueType: 'codeable',
    category: 'exam',
    group: 'provocation',
    codeSystem: 'http://snomed.info/sct',
  },
  'lift-off-test': {
    valueType: 'codeable',
    category: 'exam',
    group: 'provocation',
    codeSystem: 'http://snomed.info/sct',
  },
  'belly-press-test': {
    valueType: 'codeable',
    category: 'exam',
    group: 'provocation',
    codeSystem: 'http://snomed.info/sct',
  },
  'bear-hug-test': {
    valueType: 'codeable',
    category: 'exam',
    group: 'provocation',
    codeSystem: 'http://snomed.info/sct',
  },
  'hornblower-test': {
    valueType: 'codeable',
    category: 'exam',
    group: 'provocation',
    codeSystem: 'http://snomed.info/sct',
  },

  // ── Patient-reported outcome measures (PROMs) ─────────────────────────────
  'constant-score': {
    valueType: 'quantity',
    category: 'survey',
    group: 'prom',
    unit: '{score}',
    unitDisplay: 'points',
    min: 0,
    max: 100,
  },
  'ssv-score': {
    valueType: 'quantity',
    category: 'survey',
    group: 'prom',
    unit: '%',
    unitDisplay: '%',
    min: 0,
    max: 100,
  },
  'sane-score': {
    valueType: 'quantity',
    category: 'survey',
    group: 'prom',
    unit: '%',
    unitDisplay: '%',
    min: 0,
    max: 100,
  },
  'patient-satisfaction': {
    valueType: 'codeable',
    category: 'survey',
    group: 'prom',
    valueSetUrl: `${BASE}/ValueSet/satisfaction-scale`,
    codeSystem: 'http://loinc.org',
  },
  'return-to-sport-work': {
    valueType: 'codeable',
    category: 'survey',
    group: 'prom',
    valueSetUrl: `${BASE}/ValueSet/return-to-activity`,
    codeSystem: `${BASE}/CodeSystem/return-to-activity`,
  },

  // ── Patient history (expert consensus Q1, unanimous consensus) ───────────────────────
  'smoking-status': {
    valueType: 'codeable',
    category: 'social-history',
    group: 'history',
    valueSetUrl: 'http://hl7.org/fhir/uv/ips/ValueSet/current-smoking-status-uv-ips',
    codeSystem: 'http://loinc.org',
  },
  'employment-status': {
    valueType: 'codeable',
    category: 'social-history',
    group: 'history',
    valueSetUrl: `${BASE}/ValueSet/employment-status`,
    codeSystem: 'http://loinc.org',
  },
  'occupational-physical-demand': {
    valueType: 'codeable',
    category: 'social-history',
    group: 'history',
    valueSetUrl: `${BASE}/ValueSet/occupational-physical-demand`,
    codeSystem: `${BASE}/CodeSystem/occupational-physical-demand`,
  },
  'sleep-disturbance': {
    valueType: 'codeable',
    category: 'social-history',
    group: 'history',
    valueSetUrl: `${BASE}/ValueSet/sleep-disturbance-severity`,
    codeSystem: `${BASE}/CodeSystem/sleep-disturbance-severity`,
  },
  'sports-participation': {
    valueType: 'codeable',
    category: 'social-history',
    group: 'history',
    valueSetUrl: `${BASE}/ValueSet/sports-participation-level`,
    codeSystem: `${BASE}/CodeSystem/sports-participation-level`,
  },
  'functional-limitations': {
    valueType: 'string',
    category: 'social-history',
    group: 'history',
  },

  // ── Pain & physical exam findings (expert consensus Q1.h, Q8.a, Q12.a, Q2.a, Q9.a) ──
  // ADR-0087: single "pain-severity" (LOINC 72514-3) replaced by 4
  // context-specific axes.
  'pain-average': {
    valueType: 'quantity',
    category: 'exam',
    group: 'exam-finding',
    unit: '{score}',
    unitDisplay: 'pain score',
    min: 0,
    max: 10,
  },
  'pain-active-movement': {
    valueType: 'quantity',
    category: 'exam',
    group: 'exam-finding',
    unit: '{score}',
    unitDisplay: 'pain score',
    min: 0,
    max: 10,
  },
  'pain-passive-movement': {
    valueType: 'quantity',
    category: 'exam',
    group: 'exam-finding',
    unit: '{score}',
    unitDisplay: 'pain score',
    min: 0,
    max: 10,
  },
  'pain-rest': {
    valueType: 'quantity',
    category: 'exam',
    group: 'exam-finding',
    unit: '{score}',
    unitDisplay: 'pain score',
    min: 0,
    max: 10,
  },
  // ADR-0086: free-text "Visual Inspection" replaced by 3 structured findings
  'atrophy': {
    valueType: 'codeable',
    category: 'exam',
    group: 'exam-finding',
    valueSetUrl: `${BASE}/ValueSet/present-absent`,
    codeSystem: 'http://snomed.info/sct',
  },
  'deformity': {
    valueType: 'codeable',
    category: 'exam',
    group: 'exam-finding',
    valueSetUrl: `${BASE}/ValueSet/present-absent`,
    codeSystem: 'http://snomed.info/sct',
  },
  'normal-shoulder-contour': {
    valueType: 'codeable',
    category: 'exam',
    group: 'exam-finding',
    valueSetUrl: `${BASE}/ValueSet/present-absent`,
    codeSystem: 'http://snomed.info/sct',
  },
}

export const OBSERVATION_GROUP_LABELS: Record<ObservationGroup, string> = {
  imaging: 'Imaging Classifications',
  rom: 'Range of Motion',
  strength: 'Strength Testing',
  provocation: 'Provocation Tests',
  prom: 'Patient-Reported Outcomes',
  history: 'Patient History',
  'exam-finding': 'Physical Examination',
}
