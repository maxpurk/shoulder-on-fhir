// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PriorInjectionCountObservation Profile                                    │
// │  Bucketed prior-injection count, part of expert consensus Q1.f              │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: PriorInjectionCountObservation
Parent: ShoulderObservation
Id: prior-injection-count-observation
Title: "Prior Shoulder Injection Count Observation"
Description: """
Observation documenting a bucketed count of prior shoulder injections
received for the condition being registered, part of the
unanimous-consensus Q1.f "Prior treatment (PT/injections)," which names no
mechanism. Only recorded when the prior-injection `RotatorCuffProcedure`
(`reasonReference` → the index `RotatorCuffCondition`) is present, this
Observation is never emitted for a "no prior injections" answer.

`valueCodeableConcept` is `required`-bound to `PriorInjectionCount` (fully
local, no SNOMED CT or LOINC concept exists for this axis, verified July
2026). The count is what matters for treatment history; the date the
injections were given is not recorded here.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/prior-injection-count-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"

* code = ShoulderObservationCodes#prior-injection-count
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from PriorInjectionCount (required)
