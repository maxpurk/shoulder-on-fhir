// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Procedure Approach CodeSystem                                             │
// │  Surgical approach for the index rotator cuff procedure                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: ProcedureApproachCodes
Id: procedure-approach
Title: "Procedure Approach"
Description: """
Surgical approach used for the procedure, arthroscopic, open, or mini-open
(arthroscopic-assisted with a small open incision). Layer 2 (IG-operational)
addition, decoupled from `Procedure.code` in a postcoordination style
mirroring the diagnosis-side decoupling: `RotatorCuffProcedureType` bakes
approach into fused codes (e.g. SNOMED `699120002` "Arthroscopic repair of rotator cuff" vs.
`56060000` "Repair of musculotendinous cuff of shoulder" for the open
equivalent), which cannot represent approach and reconstruction-extent
independently.

Fully local rather than mixed-system: SNOMED CT has a generic `129236007`
"Open approach - access" qualifier, but no equivalent standalone
"arthroscopic approach" qualifier exists, SNOMED instead bakes
"arthroscopic" into whole-procedure concepts (verified July 2026 against a
live SNOMED CT terminology server). Keeping all three tiers on one local CodeSystem avoids an
internally inconsistent mix of one real code and two invented ones.

Layer 2 (IG-operational) addition: the expert consensus (Q1-Q13) never
enumerates procedure technique.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/procedure-approach"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"
* ^caseSensitive = true
* ^content = #complete
* ^count = 3

* #arthroscopic "Arthroscopic"
    "Fully arthroscopic (all-portal) approach."

* #open "Open"
    "Traditional open surgical approach."

* #mini-open "Mini-open"
    "Arthroscopic-assisted approach with a small open incision for the repair/reconstruction step."
