/**
 * Assemble a RotatorCuffRegistrationBundle transaction:
 *
 *   { Patient, Encounter, Condition, [Procedure...prior], [Observation...] }
 *
 * The Encounter is the cross-resource anchor (ADR-0037): every Observation and
 * Procedure in the bundle already carries `encounter: { reference: urn:uuid:... }`
 * set by its owning step, and every prior Procedure carries
 * `reasonReference → Condition`. The builder orders the resources and produces
 * the urn:uuid envelope; it also stamps the instance-level IPS multi-profile
 * claims (`withIpsClaim`, non-mutating copy) so the submitted Patient,
 * comorbidity Condition, and smoking Observation reproduce the IG examples'
 * IPS conformance.
 *
 * The first three entries (Patient, Encounter, Condition) carry stable UUIDs
 * supplied by the wizard so cross-references in subsequent entries resolve
 * during HAPI's transaction processing (FHIR R4 §3.2.0.1).
 */

import type {
  Condition,
  Encounter,
  Patient,
  WizardEntry,
} from '../types/fhir'
import { withIpsClaim } from './shared/ipsProfiles'

export interface AssembleRegistrationInput {
  patient: Patient
  patientUuid: string
  encounter: Encounter
  encounterUuid: string
  condition: Condition
  conditionUuid: string
  /** Already wired with encounter + reasonReference by StepPatient. */
  priorAndObservationEntries: WizardEntry[]
}

export function assembleRegistrationEntries(
  input: AssembleRegistrationInput,
): WizardEntry[] {
  return [
    { uuid: input.patientUuid, resource: input.patient },
    { uuid: input.encounterUuid, resource: input.encounter },
    { uuid: input.conditionUuid, resource: input.condition },
    ...input.priorAndObservationEntries,
  ].map((e) => ({ ...e, resource: withIpsClaim(e.resource) }))
}
