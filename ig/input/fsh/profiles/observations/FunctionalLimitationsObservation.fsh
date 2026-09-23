// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  FunctionalLimitationsObservation Profile                                  │
// │  Functional limitations (expert consensus Q1.n)                            │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: FunctionalLimitationsObservation
Parent: ShoulderObservation
Id: functional-limitations-observation
Title: "Functional Limitations Observation"
Description: """
Observation documenting a five-tier functional-ceiling ordinal, the highest
plane at which the patient's shoulder still limits activity (overhead /
at-shoulder-level / below-shoulder-level / unable to use the arm), matching
expert consensus Q1.n "Functional limitations" (unanimous consensus, no mechanism
specified).

`valueCodeableConcept` is `required`-bound to `FunctionalLimitationSeverity`
(fully local, no SNOMED CT or LOINC concept exists for this axis, verified
July 2026). Shared with
expert consensus Q12.c (function/limitations PROM component).

`Observation.code` is a local `ShoulderObservationCodes` entry. The nearest
LOINC candidate, `10158-4` "History of Functional status Narrative", carries
the `Nar` scale type, which does not match a coded ordinal value.

A coded ordinal is used so that the answer is analysable across the registry.

For instrument-grade quantification of limitations, use the Constant-Murley
score (`ConstantScoreObservation`'s `component[ADL]`) or one of the SSV/SANE
instruments. This profile complements those with a quick, one-item
baseline gestalt, not a duplicate multi-domain instrument.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/functional-limitations-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"

* code = ShoulderObservationCodes#functional-limitation-severity
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from FunctionalLimitationSeverity (required)
