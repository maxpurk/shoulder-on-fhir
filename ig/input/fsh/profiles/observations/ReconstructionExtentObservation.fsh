// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ReconstructionExtentObservation Profile                                   │
// │  Reconstruction extent for the index rotator cuff procedure                │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: ReconstructionExtentObservation
Parent: ShoulderObservation
Id: reconstruction-extent-observation
Title: "Reconstruction Extent Observation"
Description: """
Observation documenting the extent of the index rotator cuff procedure, partial reconstruction, complete reconstruction, or shoulder prosthesis
(anatomic or reverse total arthroplasty), decoupled from `Procedure.code`
in a postcoordination style mirroring the diagnosis-side "one axis, one
element" pattern. Linked to the specific
`RotatorCuffProcedure` it describes via `Observation.partOf`.

Layer 2 (IG-operational) addition: the expert consensus never names the
extent of reconstruction. `valueCodeableConcept` is `required`-bound
to `ReconstructionExtent`, four precoordinated SNOMED CT concepts, reused
as Observation values (the same reuse pattern `TearThicknessObservation`
already applies).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/reconstruction-extent-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"

* code = ShoulderObservationCodes#reconstruction-extent
* category = http://terminology.hl7.org/CodeSystem/observation-category#procedure "Procedure"
* value[x] only CodeableConcept
* valueCodeableConcept from ReconstructionExtent (required)
* partOf 1..1 MS
* partOf only Reference(RotatorCuffProcedure)
