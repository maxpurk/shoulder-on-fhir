// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  FixationTechniqueObservation Profile                                      │
// │  Suture-anchor fixation construct for the index rotator cuff procedure     │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: FixationTechniqueObservation
Parent: ShoulderObservation
Id: fixation-technique-observation
Title: "Fixation Technique Observation"
Description: """
Observation documenting the suture-anchor fixation construct used for
rotator cuff repair, single-row, double-row, suture-bridge
(transosseous-equivalent), transosseous without anchors, or not applicable
(non-repair procedures). Linked to the specific `RotatorCuffProcedure` it
describes via `Observation.partOf`.

Layer 2 (IG-operational) addition, out-of-consensus: the expert consensus
never names fixation technique. `valueCodeableConcept` is `required`-bound to
`FixationTechnique`, which is fully local because no SNOMED CT concept exists
for any of the five tiers as a standalone axis.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/fixation-technique-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"

* code = ShoulderObservationCodes#fixation-technique
* category = http://terminology.hl7.org/CodeSystem/observation-category#procedure "Procedure"
* value[x] only CodeableConcept
* valueCodeableConcept from FixationTechnique (required)
* partOf 1..1 MS
* partOf only Reference(RotatorCuffProcedure)
