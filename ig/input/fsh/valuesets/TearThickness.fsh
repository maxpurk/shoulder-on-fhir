// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  TearThickness                                                             │
// │  SNOMED CT codes for rotator cuff tear thickness (expert consensus Q4.c)   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: TearThickness
Id: tear-thickness
Title: "Tear Thickness ValueSet"
Description: """
SNOMED CT concepts for rotator cuff tear thickness, full-thickness vs.
partial-thickness, decoupled from `RotatorCuffCondition.code`.
Both concepts are precoordinated SNOMED disorder-level codes, reused here as
Observation values (the same precoordinated-concept-reuse pattern already
used by `TendonsInvolved`'s anatomy codes).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/tear-thickness"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-27"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#202843000 "Full thickness rotator cuff tear"
* http://snomed.info/sct#202842005 "Partial thickness rotator cuff tear"
