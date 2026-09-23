// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  EmploymentStatus                                                          │
// │  Hybrid: LOINC LL1901-9 answer codes + one local addition (self-employed). │
// │  Bound `required` to EmploymentStatusObservation.valueCodeableConcept.     │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: EmploymentStatus
Id: employment-status
Title: "Employment Status ValueSet"
Description: """
Current employment status (expert consensus Q1.k, part of "Occupation"). LOINC's
official answer list for 67875-5 "Employment status - current" (LL1901-9)
plus one local addition (self-employed) that list is missing. See
`EmploymentStatusSupplement` for why the local code is needed. Same hybrid
pattern as `RotatorCuffEtiology`.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/employment-status"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-17"
* ^publisher = "Hasso Plattner Institute"

// Concepts inlined (not `include codes from system`) per this IG's
// Lucene-pre-expander-avoidance convention — see PatteClassification.fsh.
* http://loinc.org#LA17957-4 "Employed full time"
* http://loinc.org#LA17958-2 "Employed part time"
* EmploymentStatusSupplement#self-employed "Self-employed"
* http://loinc.org#LA17956-6 "Unemployed"
* http://loinc.org#LA17959-0 "Homemaker"
* http://loinc.org#LA17960-8 "Retired due to age/preference"
* http://loinc.org#LA17961-6 "Retired due to disability"
* http://loinc.org#LA17962-4 "Medical leave of absence"
* http://loinc.org#LA15276-1 "Student"
