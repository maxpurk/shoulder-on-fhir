// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PriorPhysicalTherapySessionCountObservation Profile                       │
// │  Bucketed prior-PT session count, part of expert consensus Q1.f             │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: PriorPhysicalTherapySessionCountObservation
Parent: ShoulderObservation
Id: prior-physical-therapy-session-count-observation
Title: "Prior Physical Therapy Session Count Observation"
Description: """
Observation documenting a bucketed count of prior physical-therapy sessions
received for the shoulder condition being registered, part of the
unanimous-consensus Q1.f "Prior treatment (PT/injections)," which names no
mechanism. Only recorded when the prior-PT `RotatorCuffProcedure`
(`reasonReference` → the index `RotatorCuffCondition`) is present, this
Observation is never emitted for a "no prior PT" answer.

`valueCodeableConcept` is `required`-bound to `PriorPhysicalTherapySessionCount`
(fully local, no SNOMED CT or LOINC concept exists for this axis, verified
July 2026). The count is what matters for treatment history; the date the
therapy was given is not recorded here.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/prior-physical-therapy-session-count-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"

* code = ShoulderObservationCodes#prior-physical-therapy-session-count
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from PriorPhysicalTherapySessionCount (required)
