// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Q11Timepoint CodeSystem                                                   │
// │  Discriminator for the 5 expert consensus Q11 research follow-up timepoints │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: Q11TimepointCodes
Id: q11-timepoint
Title: "Q11 Research Follow-Up Timepoint"
Description: """
Discriminator for which of the 5 expert consensus Q11.a–e research follow-up timepoints
(6 weeks, 3 months, 6 months, 1 year, 2 years post-surgery) a
`RotatorCuffResearchCarePlan.activity` represents, bound to
`activity.detail.code`. Fixed by the consensus (Hurley et al. 2024, Q11), not
a clinician choice; both frontends stamp this automatically when
auto-generating the 5-activity schedule from the index procedure date.
No SNOMED CT or LOINC concept exists for this axis (verified
August 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/q11-timepoint"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-08-04"
* ^publisher = "Hasso Plattner Institute"
* ^caseSensitive = true
* ^content = #complete
* ^count = 5

* #6-weeks "6 Weeks" "Expert consensus Q11.a — 6 weeks post-surgery"
* #3-months "3 Months" "Expert consensus Q11.b — 3 months post-surgery"
* #6-months "6 Months" "Expert consensus Q11.c — 6 months post-surgery"
* #1-year "1 Year" "Expert consensus Q11.d — 1 year post-surgery"
* #2-years "2 Years" "Expert consensus Q11.e — 2 years post-surgery"
