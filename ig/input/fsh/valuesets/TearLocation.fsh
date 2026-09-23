// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  TearLocation                                                             │
// │  All codes from TearLocationCodes                                          │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: TearLocation
Id: tear-location
Title: "Tear Location ValueSet"
Description: "ValueSet containing all tear-location codes (position of a rotator cuff tear along the tendon's course)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/tear-location"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-13"
* ^publisher = "Hasso Plattner Institute"

// Concepts inlined (rather than `include codes from system TearLocationCodes`)
// so HAPI does not need to walk the CodeSystem via its Lucene index at
// $expand time — same rationale as PatteClassification / GoutallierClassification.
* TearLocationCodes#insertion-near "Near the insertion (footprint)"
* TearLocationCodes#musculotendinous "Musculotendinous junction"
* TearLocationCodes#intratendinous "Intratendinous (mid-substance)"
