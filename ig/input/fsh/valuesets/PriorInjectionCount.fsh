// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PriorInjectionCount                                                       │
// │  All codes from PriorInjectionCountCodes                                   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: PriorInjectionCount
Id: prior-injection-count
Title: "Prior Shoulder Injection Count ValueSet"
Description: "ValueSet containing the two bucketed prior-injection count categories (expert consensus Q1.f)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/prior-injection-count"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-27"
* ^publisher = "Hasso Plattner Institute"

* PriorInjectionCountCodes#1-3 "1 to 3 injections"
* PriorInjectionCountCodes#gt-3 "More than 3 injections"
