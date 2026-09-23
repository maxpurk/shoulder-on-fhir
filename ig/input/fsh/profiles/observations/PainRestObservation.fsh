// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PainRestObservation Profile                                               │
// │  Pain severity at rest 0–10 (consensus Q1.h, Q8.a, Q12.a)                   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: PainRestObservation
Parent: ShoulderObservation
Id: pain-rest-observation
Title: "Pain At Rest Observation"
Description: """
Observation documenting the patient's shoulder pain severity at rest
(no movement or loading), on a 0–10 numeric rating scale. One of four
context-specific pain measurements (alongside PainAverageObservation,
PainActiveMovementObservation, PainPassiveMovementObservation). Pain is decomposed by
context rather than captured as a single generic "pain severity" field.

No precoordinated LOINC or SNOMED CT concept exists for "pain at rest" as a
distinct question-level clinical variable (verified July 2026); a local code
(ShoulderObservationCodes#pain-rest) is used. valueQuantity uses UCUM
{score} unit with allowed range 0–10.

Reused symmetrically across three expert consensus elements:
- Q1.h, pain at presentation (patient history)
- Q8.a, improved pain (treatment-success criterion a)
- Q12.a, pain component of the PROM (expert consensus required component Q12.a)

Pre/post discrimination is via effectiveDateTime relative to the index procedure.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-rest-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-18"

* code = ShoulderObservationCodes#pain-rest
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#{score}, 0, 10)
