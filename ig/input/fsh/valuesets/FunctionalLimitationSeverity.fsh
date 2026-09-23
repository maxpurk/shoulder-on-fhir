// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  FunctionalLimitationSeverity                                              │
// │  All codes from FunctionalLimitationSeverityCodes                          │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: FunctionalLimitationSeverity
Id: functional-limitation-severity
Title: "Functional Limitation Severity ValueSet"
Description: "ValueSet containing the five functional-limitation severity tiers (expert consensus Q1.n)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/functional-limitation-severity"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-27"
* ^publisher = "Hasso Plattner Institute"

* FunctionalLimitationSeverityCodes#no-limitation "No functional limitation"
* FunctionalLimitationSeverityCodes#overhead-limitation "Overhead activity limited"
* FunctionalLimitationSeverityCodes#shoulder-level-limitation "At-shoulder-level activity limited"
* FunctionalLimitationSeverityCodes#below-shoulder-limitation "Below-shoulder-level activity limited"
* FunctionalLimitationSeverityCodes#unable-to-use-arm "Unable to use the arm functionally"
