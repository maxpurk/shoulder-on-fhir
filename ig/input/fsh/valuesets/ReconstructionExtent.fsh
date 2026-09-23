// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ReconstructionExtent                                                      │
// │  SNOMED CT codes for rotator cuff reconstruction extent                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: ReconstructionExtent
Id: reconstruction-extent
Title: "Reconstruction Extent ValueSet"
Description: """
SNOMED CT concepts for the extent of the index rotator cuff procedure, partial reconstruction, complete reconstruction, or shoulder prosthesis
(anatomic or reverse total arthroplasty), decoupled from `Procedure.code`
in a postcoordination style, mirroring the diagnosis-side "one axis, one
element" pattern. All four concepts are
precoordinated SNOMED disorder/procedure-level codes, reused here as
Observation values (the same reuse pattern `TearThickness` already applies).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/reconstruction-extent"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-27"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#304385007 "Partial repair of rotator cuff"
* http://snomed.info/sct#304384006 "Complete repair of rotator cuff"
* http://snomed.info/sct#308681004 "Prosthetic arthroplasty of shoulder"
* http://snomed.info/sct#785850002 "Reverse prosthetic total arthroplasty of shoulder"
