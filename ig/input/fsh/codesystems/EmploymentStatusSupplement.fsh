// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  EmploymentStatusSupplement CodeSystem                                     │
// │  Local code for employment-status values with no apt LOINC answer.         │
// │  Used together with LOINC LA answer codes in EmploymentStatus.             │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: EmploymentStatusSupplement
Id: employment-status-supplement
Title: "Employment Status Supplement"
Description: """
Local code for employment-status distinctions with no apt concept in LOINC's
official answer list for "Employment status - current" (67875-5, answer list
LL1901-9: Unemployed / Employed full time / Employed part time / Homemaker /
Retired due to age-preference / Retired due to disability / Medical leave of
absence / Student, no self-employed distinction). Used together with the
LOINC LA answer codes in `EmploymentStatus` for
`EmploymentStatusObservation.valueCodeableConcept`. Same pattern as
`ShoulderEtiology` supplying `#acute-on-chronic` alongside SNOMED concepts
for `RotatorCuffEtiology`.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/employment-status-supplement"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-17"
* ^publisher = "Hasso Plattner Institute"
* ^caseSensitive = true
* ^content = #complete
* ^count = 1

* #self-employed "Self-employed"
    "Self-employed (Selbständigkeit), distinct from LOINC LL1901-9's 'Employed full time'/'Employed part time', neither of which distinguishes employment status from self-employment. No LOINC answer list found that captures this distinction (verified July 2026)."
