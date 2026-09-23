/**
 * Assemble a RotatorCuffFollowUpBundle transaction:
 *
 *   { Encounter, [Observations...], QuestionnaireResponse? }
 *
 * The first entry is always the Encounter; each Observation's
 * `encounter` field references that entry by its urn:uuid so HAPI
 * resolves the link server-side at transaction time.
 */

import type {
  BundleEntry,
  Encounter,
  ImagingStudy,
  Observation,
  QuestionnaireResponse,
} from '../types/fhir'
import { withIpsClaim } from './shared/ipsProfiles'

export interface AssembleInput {
  encounter: Encounter
  encounterUuid: string
  observations: Observation[]
  questionnaireResponse?: QuestionnaireResponse
  // Research re-imaging (Q13 exception, RotatorCuffFollowUpBundle's
  // entry[imagingStudy] 0..1 slice) — optional, only present at the
  // research re-imaging timepoint.
  imagingStudy?: ImagingStudy
}

export function assembleFollowUpEntries(input: AssembleInput): BundleEntry[] {
  const entries: BundleEntry[] = [
    { uuid: input.encounterUuid, resource: input.encounter },
    ...input.observations.map((obs) => ({ uuid: crypto.randomUUID(), resource: obs })),
  ]
  if (input.questionnaireResponse) {
    entries.push({ uuid: crypto.randomUUID(), resource: input.questionnaireResponse })
  }
  if (input.imagingStudy) {
    entries.push({ uuid: crypto.randomUUID(), resource: input.imagingStudy })
  }
  // Uniform with the other two bundle builders: a follow-up visit carries no
  // IPS-eligible resource today (no Patient/Condition/Procedure/smoking), so
  // this is a no-op, but keeps the IPS-claim stamping consistent if one is
  // ever added here.
  return entries.map((e) => ({ ...e, resource: withIpsClaim(e.resource) }))
}
