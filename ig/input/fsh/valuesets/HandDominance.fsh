// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  HandDominance                                                           │
// │  SNOMED CT codes for hand dominance (handedness)                           │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: HandDominance
Id: hand-dominance
Title: "Hand Dominance ValueSet"
Description: """
ValueSet containing SNOMED CT codes for hand dominance (handedness), including
an explicit `Unknown` answer for when the patient/clinician cannot state
dominance, distinct from the field being left unanswered (which emits no
HandDominanceObservation at all; see StepPatient.tsx).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/hand-dominance"
* ^version = "0.2.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-13"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#46669005 "Right handed"
* http://snomed.info/sct#87683000 "Left handed"
* http://snomed.info/sct#23088002 "Ambidextrous"
* http://snomed.info/sct#261665006 "Unknown"
