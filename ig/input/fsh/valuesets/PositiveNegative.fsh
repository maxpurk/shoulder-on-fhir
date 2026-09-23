// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  PositiveNegative                                                        │
// │  SNOMED CT codes for positive/negative test results                        │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: PositiveNegative
Id: positive-negative
Title: "Positive/Negative Test Result ValueSet"
Description: "ValueSet for recording binary (positive/negative) clinical test results, used in shoulder provocation tests (Jobe, Lift-off, Belly press, Bear hug, Hornblower)."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/positive-negative"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-05-12"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#10828004 "Positive"
* http://snomed.info/sct#260385009 "Negative"
