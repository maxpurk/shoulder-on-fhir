// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ProcedureApproachObservation Profile                                      │
// │  Surgical approach for the index rotator cuff procedure                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: ProcedureApproachObservation
Parent: ShoulderObservation
Id: procedure-approach-observation
Title: "Procedure Approach Observation"
Description: """
Observation documenting the surgical approach (arthroscopic / open /
mini-open) used for a specific rotator cuff procedure, decoupled from
`Procedure.code`, which today bakes approach into fused precoordinated
codes (see `ProcedureApproachCodes` for the rationale). Linked to the
specific `RotatorCuffProcedure` it describes via `Observation.partOf`
(base FHIR, a Surgery-bundle encounter can carry an index procedure plus
0..* concomitant procedures, so the link must be unambiguous).

Layer 2 (IG-operational) addition: the expert consensus never enumerates
procedure technique. `valueCodeableConcept` is `required`-bound to
`ProcedureApproach` (fully local, no SNOMED CT concept exists for a
standalone "arthroscopic approach" qualifier, verified July 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/procedure-approach-observation"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"

* code = ShoulderObservationCodes#procedure-approach
* category = http://terminology.hl7.org/CodeSystem/observation-category#procedure "Procedure"
* value[x] only CodeableConcept
* valueCodeableConcept from ProcedureApproach (required)
* partOf 1..1 MS
* partOf only Reference(RotatorCuffProcedure)
