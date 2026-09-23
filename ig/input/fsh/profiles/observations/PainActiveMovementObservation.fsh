// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PainActiveMovementObservation Profile                                     │
// │  Pain severity with active movement 0–10 (consensus Q1.h, Q8.a, Q12.a)      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: PainActiveMovementObservation
Parent: ShoulderObservation
Id: pain-active-movement-observation
Title: "Pain With Active Movement Observation"
Description: """
Observation documenting the patient's shoulder pain severity during
patient-generated active movement, on a 0–10 numeric rating scale. One of
four context-specific pain measurements (alongside PainAverageObservation,
PainPassiveMovementObservation, PainRestObservation). Pain is decomposed by
context rather than captured as a single generic "pain severity" field.

Distinguished from PainPassiveMovementObservation because pain reproduced by
active (patient-generated) motion versus passive (examiner-generated) motion
helps differentiate mechanical/structural pathology from muscular guarding, the same active/passive distinction this IG already applies throughout its
range-of-motion profiles (e.g. ShoulderFlexionObservation vs.
ShoulderPassiveFlexionObservation).

No precoordinated LOINC or SNOMED CT concept exists for "pain with active
movement" as a distinct question-level clinical variable (verified July
2026); a local code (ShoulderObservationCodes#pain-active-movement) is used.
valueQuantity uses UCUM {score} unit with allowed range 0–10.

Reused symmetrically across three expert consensus elements:
- Q1.h, pain at presentation (patient history)
- Q8.a, improved pain (treatment-success criterion a)
- Q12.a, pain component of the PROM (expert consensus required component Q12.a)

Pre/post discrimination is via effectiveDateTime relative to the index procedure.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/pain-active-movement-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-18"

* code = ShoulderObservationCodes#pain-active-movement
* category = http://terminology.hl7.org/CodeSystem/observation-category#exam "Exam"
* insert BoundedQuantity(#{score}, 0, 10)
