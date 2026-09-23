// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  SleepDisturbanceSeverity                                                  │
// │  All codes from SleepDisturbanceSeverityCodes                              │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: SleepDisturbanceSeverity
Id: sleep-disturbance-severity
Title: "Sleep Disturbance Severity ValueSet"
Description: "ValueSet containing the three sleep-disturbance severity grades (expert consensus Q1.i)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/sleep-disturbance-severity"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-17"
* ^publisher = "Hasso Plattner Institute"

// Concepts inlined (rather than `include codes from system SleepDisturbanceSeverityCodes`)
// so HAPI does not need to walk the CodeSystem via its Lucene index at
// $expand time — see PatteClassification.fsh for the same convention.
* SleepDisturbanceSeverityCodes#unaffected "Unaffected"
* SleepDisturbanceSeverityCodes#occasional "Occasionally disturbed"
* SleepDisturbanceSeverityCodes#nightly "Nightly disturbed"
