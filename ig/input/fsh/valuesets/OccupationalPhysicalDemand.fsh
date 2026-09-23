// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  OccupationalPhysicalDemand                                                │
// │  All codes from OccupationalPhysicalDemandCodes                            │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: OccupationalPhysicalDemand
Id: occupational-physical-demand
Title: "Occupational Physical Demand ValueSet"
Description: "ValueSet containing the three occupational physical-demand intensity categories (expert consensus Q1.k). Overhead work exposure is a separate, independent axis, see OccupationalOverheadExposure."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/occupational-physical-demand"
* ^version = "0.2.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-27"
* ^publisher = "Hasso Plattner Institute"

// Concepts inlined (rather than `include codes from system OccupationalPhysicalDemandCodes`)
// so HAPI does not need to walk the CodeSystem via its Lucene index at
// $expand time — see PatteClassification.fsh for the same convention.
* OccupationalPhysicalDemandCodes#sedentary "Sedentary / desk-based work"
* OccupationalPhysicalDemandCodes#light-manual "Light manual work"
* OccupationalPhysicalDemandCodes#heavy-manual "Heavy manual work"
