/**
 * Assemble a RotatorCuffSurgeryBundle transaction:
 *
 *   { Encounter, [Procedure...], [Observation...], [CarePlan?] }
 *
 * The first entry is the Encounter; each Procedure and Observation references
 * it by urn:uuid so HAPI resolves the link server-side at transaction time.
 * The first Procedure entry is, by convention, the primary/index intervention
 * (see ADR-0034). The optional CarePlan (Q11 research follow-up schedule,
 * ADR-0129) has no cross-reference to the Encounter — only `subject`.
 */

import type {
  CarePlan,
  Encounter,
  Observation,
  WizardEntry,
} from '../types/fhir'
import { withIpsClaim } from './shared/ipsProfiles'

export interface AssembleSurgeryInput {
  encounter: Encounter
  encounterUuid: string
  // Pre-tagged with their own uuid (rather than plain Procedure[]) so
  // procedure-technique Observations (ADR-0108) can reference a specific
  // procedure via partOf before the bundle is assembled.
  procedures: WizardEntry[]
  observations: Observation[]
  // Absent when the index procedure has no dated performedPeriod.start yet
  // (schedule can't be computed) — see buildResearchCarePlan in SurgeryWizard.tsx.
  carePlan?: CarePlan
}

export function assembleSurgeryEntries(input: AssembleSurgeryInput): WizardEntry[] {
  const entries: WizardEntry[] = [
    { uuid: input.encounterUuid, resource: input.encounter },
    ...input.procedures,
    ...input.observations.map((o) => ({ uuid: crypto.randomUUID(), resource: o })),
    ...(input.carePlan ? [{ uuid: crypto.randomUUID(), resource: input.carePlan }] : []),
  ]
  // Stamp instance-level IPS claim on the surgical Procedure(s) so the
  // submitted bundle reproduces the IG examples' IPS conformance (non-surgical
  // categories and every other resource pass through unchanged).
  return entries.map((e) => ({ ...e, resource: withIpsClaim(e.resource) }))
}
