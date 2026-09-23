/**
 * Build a conformant Observation for a Q9 or Q12 follow-up data point.
 *
 * Each Observation carries:
 *  - meta.profile pointing to the specific child Observation profile
 *    (e.g. shoulder-flexion-observation), so HAPI enforces the right value[x]
 *  - code = OBSERVATION_CODINGS[key]
 *  - subject = Patient/{id}
 *  - encounter = urn:uuid of the visit's Encounter entry
 *  - effectiveDateTime = the visit date (same on every Obs of the visit, so
 *    a single GET Observation?code=X&_sort=date returns the time series cleanly)
 *  - exactly one valueQuantity / valueCodeableConcept / valueString
 */

import {
  OBSERVATION_CODINGS,
  OBSERVATION_PROFILE_URLS,
} from '../types/fhir'
import type { Observation, CodeableConcept, Reference } from '../types/fhir'

export type ObservationCategory = 'exam' | 'survey'

const CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/observation-category'

const CATEGORY_DISPLAYS: Record<ObservationCategory, string> = {
  exam: 'Exam',
  survey: 'Survey',
}

interface BuildObsBase {
  /** profile key (e.g. "forward-flexion", "constant-score", "pain-average") */
  profileKey: string
  /** "Patient/{id}" */
  patientReference: string
  /** urn:uuid:... of the Encounter entry in the same transaction bundle */
  encounterUuid: string
  /** ISO-8601 dateTime — anchor for the time series */
  effectiveDateTime: string
  /** observation-category code */
  category: ObservationCategory
  /** Laterality — only set for observations physically anchored to a shoulder (ROM, strength, provocation, inspection, pain) */
  bodySite?: CodeableConcept
  /** ADR-0156 — disambiguates which RotatorCuffCondition (bilateral case) an aggregate/survey PROM (no bodySite) is about */
  focus?: Reference
}

export interface BuildQuantityObs extends BuildObsBase {
  value: number
  unit: string
  unitDisplay?: string
}

export interface BuildCodedObs extends BuildObsBase {
  valueCoding: { system: string; code: string; display?: string }
}

export interface BuildStringObs extends BuildObsBase {
  valueString: string
}

function baseObservation(input: BuildObsBase): Observation {
  const coding = OBSERVATION_CODINGS[input.profileKey]
  if (!coding) throw new Error(`Unknown observation profile key: ${input.profileKey}`)
  const profileUrl = OBSERVATION_PROFILE_URLS[input.profileKey]
  if (!profileUrl) throw new Error(`Missing profile URL for key: ${input.profileKey}`)

  const code: CodeableConcept = {
    coding: [{ system: coding.system, code: coding.code, display: coding.display }],
  }

  return {
    resourceType: 'Observation',
    meta: { profile: [profileUrl] },
    status: 'final',
    category: [
      {
        coding: [
          { system: CATEGORY_SYSTEM, code: input.category, display: CATEGORY_DISPLAYS[input.category] },
        ],
      },
    ],
    code,
    subject: { reference: input.patientReference },
    encounter: { reference: `urn:uuid:${input.encounterUuid}` },
    effectiveDateTime: input.effectiveDateTime,
    ...(input.bodySite ? { bodySite: input.bodySite } : {}),
    ...(input.focus ? { focus: [input.focus] } : {}),
  }
}

export function buildQuantityObservation(input: BuildQuantityObs): Observation {
  return {
    ...baseObservation(input),
    valueQuantity: {
      value: input.value,
      unit: input.unitDisplay ?? input.unit,
      system: 'http://unitsofmeasure.org',
      code: input.unit,
    },
  }
}

export interface BuildQuantityObsComponent {
  /** profile key of the component (e.g. "constant-score-pain") — its OBSERVATION_CODINGS entry supplies component.code */
  code: string
  value: number
  unit: string
  unitDisplay?: string
}

export interface BuildQuantityObsWithComponents extends BuildQuantityObs {
  /** Named component slices (ADR-0090) — e.g. ConstantScoreObservation's Pain/ADL/ROM/Strength sub-scores. */
  components?: BuildQuantityObsComponent[]
}

/**
 * Component-aware sibling of buildQuantityObservation, for composite panel
 * Observations (ADR-0090's ConstantScoreObservation is the first user of
 * this pattern — value[x] is the total, component[] carries the sub-scores,
 * present only when the caller supplies them).
 */
export function buildQuantityObservationWithComponents(input: BuildQuantityObsWithComponents): Observation {
  const obs = buildQuantityObservation(input)
  if (input.components && input.components.length > 0) {
    obs.component = input.components.map((c) => {
      const coding = OBSERVATION_CODINGS[c.code]
      if (!coding) throw new Error(`Unknown observation profile key: ${c.code}`)
      return {
        code: { coding: [{ system: coding.system, code: coding.code, display: coding.display }] },
        valueQuantity: {
          value: c.value,
          unit: c.unitDisplay ?? c.unit,
          system: 'http://unitsofmeasure.org',
          code: c.unit,
        },
      }
    })
  }
  return obs
}

export function buildCodedObservation(input: BuildCodedObs): Observation {
  return {
    ...baseObservation(input),
    valueCodeableConcept: {
      coding: [input.valueCoding],
    },
  }
}

export function buildStringObservation(input: BuildStringObs): Observation {
  return {
    ...baseObservation(input),
    valueString: input.valueString,
  }
}

// A post-op exam item the clinician marked "not applicable / not possible"
// (surgeon feedback, ADR-0109) — e.g. a ROM/strength measurement
// contraindicated this soon after surgery. FHIR R4's Observation.status has
// no 'not-done' code (that exists on Procedure, not Observation — verified
// against the local hl7.fhir.r4.core package); status stays 'final' (the
// assessment attempt concluded, just with no measurable result) and
// dataAbsentReason = #not-performed ("the observation procedure was not
// performed") explains the missing value[x] — the standard FHIR mechanism
// for exactly this case. Unlike simply omitting the field, this still
// counts toward RotatorCuffFollowUpBundle's `observation 1..*` minimum.
const DATA_ABSENT_REASON_SYSTEM = 'http://terminology.hl7.org/CodeSystem/data-absent-reason'

export function buildNotDoneObservation(input: BuildObsBase): Observation {
  return {
    ...baseObservation(input),
    dataAbsentReason: {
      coding: [{ system: DATA_ABSENT_REASON_SYSTEM, code: 'not-performed', display: 'Not Performed' }],
    },
    note: [{ text: 'Not performed — marked not applicable / not possible at this visit.' }],
  }
}
