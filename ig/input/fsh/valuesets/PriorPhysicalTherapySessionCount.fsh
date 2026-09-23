// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PriorPhysicalTherapySessionCount                                          │
// │  All codes from PriorPhysicalTherapySessionCountCodes                      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: PriorPhysicalTherapySessionCount
Id: prior-physical-therapy-session-count
Title: "Prior Physical Therapy Session Count ValueSet"
Description: "ValueSet containing the three bucketed prior-PT session-count categories (expert consensus Q1.f)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/prior-physical-therapy-session-count"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-27"
* ^publisher = "Hasso Plattner Institute"

* PriorPhysicalTherapySessionCountCodes#le-10 "10 sessions or fewer"
* PriorPhysicalTherapySessionCountCodes#11-20 "11 to 20 sessions"
* PriorPhysicalTherapySessionCountCodes#gt-20 "More than 20 sessions"
