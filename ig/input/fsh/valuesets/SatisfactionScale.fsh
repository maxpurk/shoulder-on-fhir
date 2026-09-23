// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  SatisfactionScale                                                          │
// │  LOINC answer list LL4543-6 (5-point satisfaction scale)                   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: SatisfactionScale
Id: satisfaction-scale
Title: "Patient Satisfaction Scale ValueSet"
Description: "ValueSet containing the five LOINC answer codes from LL4543-6. Bound to Observation.valueCodeableConcept when code = LOINC 77218-6 (patient satisfaction with healthcare delivery)."
// Migrated from local SatisfactionScaleCodes (ADR-0070).
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/satisfaction-scale"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-04-08"
* ^publisher = "Hasso Plattner Institute"

* http://loinc.org#LA27750-1 "Not at all satisfied"
* http://loinc.org#LA24976-5 "Mostly dissatisfied"
* http://loinc.org#LA27752-7 "Somewhat satisfied"
* http://loinc.org#LA24974-0 "Mostly satisfied"
* http://loinc.org#LA27754-3 "Completely satisfied"
