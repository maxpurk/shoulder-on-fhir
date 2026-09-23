// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Occupational Overhead Exposure CodeSystem                                 │
// │  Whether the patient's occupation involves regular overhead work           │
// │  (expert consensus Q1.k) — independent axis from physical-demand intensity │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: OccupationalOverheadExposureCodes
Id: occupational-overhead-exposure
Title: "Occupational Overhead Exposure"
Description: """
Whether the patient's occupation regularly involves overhead reaching or
repetitive shoulder-loading tasks (Überkopfarbeit), split off from
`OccupationalPhysicalDemandCodes` as its own independent yes/no/unknown axis
so that intensity and overhead exposure can be recorded
simultaneously (a roofer is both heavy-manual and overhead-exposed; a single
enum would force an artificial either/or choice).

Part of the unanimous-consensus Q1.k "Occupation," which names no
mechanism. No SNOMED CT or LOINC concept exists for occupational overhead
exposure as of authoring (verified July 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/occupational-overhead-exposure"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"
* ^caseSensitive = true
* ^content = #complete
* ^count = 3

* #yes "Regular overhead work"
    "Occupation regularly requires overhead reaching or repetitive shoulder-loading tasks."

* #no "No regular overhead work"
    "Occupation does not regularly require overhead reaching or repetitive shoulder-loading."

* #unknown "Unknown"
    "Overhead-exposure status of the occupation is not known or not asked."
