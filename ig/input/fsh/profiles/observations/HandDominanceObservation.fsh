// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  HandDominanceObservation Profile                                          │
// │  Observation recording the patient's hand dominance (handedness)           │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: HandDominanceObservation
Parent: ShoulderObservation
Id: hand-dominance-observation
Title: "Hand Dominance Observation"
Description: """
Observation recording the patient's hand dominance (handedness), clinically
relevant for shoulder surgery planning and outcome interpretation. Injuries to
the dominant arm may have greater functional impact and influence treatment
decisions and rehabilitation planning.

Coded via SNOMED CT 57427004 "Handedness" (observable entity), the
textbook code=question / value=answer pairing. Value is bound to
HandDominance (SNOMED CT codes: right-handed, left-handed, ambidextrous,
and an explicit unknown). Category is social-history as handedness is a
stable patient characteristic. No LOINC code exists for handedness.

Covers expert consensus Q1.m (hand dominance / handedness). Handedness is a
clinical finding, so it is carried as an Observation rather than as a Patient
extension.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/hand-dominance-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-29"

* code = http://snomed.info/sct#57427004 "Handedness"
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from HandDominance (required)
