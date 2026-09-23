// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ProcedureApproach                                                          │
// │  All codes from ProcedureApproachCodes                                     │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: ProcedureApproach
Id: procedure-approach
Title: "Procedure Approach ValueSet"
Description: "ValueSet containing the three surgical-approach categories (arthroscopic / open / mini-open)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/procedure-approach"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-27"
* ^publisher = "Hasso Plattner Institute"

* ProcedureApproachCodes#arthroscopic "Arthroscopic"
* ProcedureApproachCodes#open "Open"
* ProcedureApproachCodes#mini-open "Mini-open"
