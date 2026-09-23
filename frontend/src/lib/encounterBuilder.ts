/**
 * Build conformant ShoulderEncounter resources for the three bundle contexts
 * (registration consultation, follow-up visit). The Encounter is the
 * cross-resource anchor: each Observation in the bundle sets
 * `Observation.encounter` to this Encounter's urn:uuid (resolved server-side
 * during transaction processing). See ADR-0037.
 */

import {
  ENCOUNTER_CLASS_AMBULATORY,
  FOLLOW_UP_ENCOUNTER_TYPE,
  PROFILE_URLS,
  REGISTRATION_ENCOUNTER_TYPE,
} from '../types/fhir'
import type { Encounter } from '../types/fhir'

export interface BuildEncounterInput {
  /** "Patient/{id}" or "urn:uuid:..." of the patient */
  patientReference: string
  /** "Condition/{id}" or "urn:uuid:..." of the rotator cuff diagnosis */
  conditionReference: string
  /** ISO-8601 dateTime — visit start */
  visitStart: string
  /** ISO-8601 dateTime — visit end (defaults to visitStart + 30 min if omitted) */
  visitEnd?: string
  /**
   * Ranked diagnoses addressed by this visit (rank 1 = principal). Populated
   * whenever the Registration flow submits more than one Condition
   * (RotatorCuffCondition and/or ShoulderDiagnosisCondition) in the same
   * bundle; omitted when there is only one, since rank is then unambiguous.
   */
  diagnoses?: Array<{
    reference: string
    rank: number
    use?: { system: string; code: string; display: string }
  }>
}

function buildEncounter(
  input: BuildEncounterInput,
  typeCoding: { SYSTEM: string; CODE: string; DISPLAY: string },
): Encounter {
  const end =
    input.visitEnd ?? new Date(new Date(input.visitStart).getTime() + 30 * 60 * 1000).toISOString()

  return {
    resourceType: 'Encounter',
    meta: { profile: [PROFILE_URLS.ENCOUNTER] },
    status: 'finished',
    class: ENCOUNTER_CLASS_AMBULATORY,
    type: [
      {
        coding: [
          {
            system: typeCoding.SYSTEM,
            code: typeCoding.CODE,
            display: typeCoding.DISPLAY,
          },
        ],
      },
    ],
    subject: { reference: input.patientReference },
    period: { start: input.visitStart, end: end },
    reasonReference: [{ reference: input.conditionReference }],
    ...(input.diagnoses &&
      input.diagnoses.length > 0 && {
        diagnosis: input.diagnoses.map((d) => ({
          condition: { reference: d.reference },
          rank: d.rank,
          ...(d.use && { use: { coding: [d.use] } }),
        })),
      }),
  }
}

/** Pre-operative registration consultation visit (T0). */
export function buildRegistrationEncounter(input: BuildEncounterInput): Encounter {
  return buildEncounter(input, REGISTRATION_ENCOUNTER_TYPE)
}

/** Routine post-operative follow-up visit (Hurley Q10). */
export function buildFollowUpEncounter(input: BuildEncounterInput): Encounter {
  return buildEncounter(input, FOLLOW_UP_ENCOUNTER_TYPE)
}
