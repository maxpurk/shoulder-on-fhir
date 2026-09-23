// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Q11Timepoint                                                              │
// │  All codes from Q11TimepointCodes                                          │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: Q11Timepoint
Id: q11-timepoint
Title: "Q11 Research Follow-Up Timepoint ValueSet"
Description: "ValueSet containing all codes from Q11TimepointCodes. Bound to RotatorCuffResearchCarePlan.activity.detail.code."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/q11-timepoint"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-08-04"
* ^publisher = "Hasso Plattner Institute"

// Concepts inlined so HAPI does not need to walk the CodeSystem via its
// Lucene index at $expand time (Lucene-on-tmpfs race after restart).
* Q11TimepointCodes#6-weeks "6 Weeks"
* Q11TimepointCodes#3-months "3 Months"
* Q11TimepointCodes#6-months "6 Months"
* Q11TimepointCodes#1-year "1 Year"
* Q11TimepointCodes#2-years "2 Years"
