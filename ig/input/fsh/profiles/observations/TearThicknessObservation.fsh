// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  TearThicknessObservation Profile                                          │
// │  Partial vs. full thickness (expert consensus Q4.c)                        │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: TearThicknessObservation
Parent: ShoulderObservation
Id: tear-thickness-observation
Title: "Tear Thickness Observation"
Description: """
Observation documenting whether the rotator cuff tear is full-thickness or
partial-thickness, expert consensus Q4.c "Partial vs full thickness."

Thickness has its own element, following the "one axis, one element"
principle the IG also applies to tendon involvement and to etiology. The
Observation is linked back to the index `RotatorCuffCondition` via
`Condition.evidence.detail`, mirroring `TendonsInvolvedObservation` and
`TearLocationObservation`.

`valueCodeableConcept` is `required`-bound to `TearThickness`, two
precoordinated SNOMED CT disorder-level concepts, reused here as an
Observation value (the same reuse pattern `TendonsInvolvedObservation`
already applies to anatomy codes).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/tear-thickness-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"

* code = ShoulderObservationCodes#tear-thickness
* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"
* value[x] only CodeableConcept
* valueCodeableConcept from TearThickness (required)
