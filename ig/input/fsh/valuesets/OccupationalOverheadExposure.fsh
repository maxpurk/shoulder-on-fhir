// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  OccupationalOverheadExposure                                              │
// │  All codes from OccupationalOverheadExposureCodes                          │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: OccupationalOverheadExposure
Id: occupational-overhead-exposure
Title: "Occupational Overhead Exposure ValueSet"
Description: "ValueSet containing the three occupational overhead-exposure categories (expert consensus Q1.k)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/occupational-overhead-exposure"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-27"
* ^publisher = "Hasso Plattner Institute"

* OccupationalOverheadExposureCodes#yes "Regular overhead work"
* OccupationalOverheadExposureCodes#no "No regular overhead work"
* OccupationalOverheadExposureCodes#unknown "Unknown"
