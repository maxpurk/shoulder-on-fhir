// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Sports Participation Level CodeSystem                                     │
// │  Graded scale for pre-treatment sports participation (consensus Q1.j)      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: SportsParticipationLevelCodes
Id: sports-participation-level
Title: "Sports Participation Level"
Description: """
Four-tier ordinal grading the patient's pre-treatment level of sports
participation, the sports-medicine return-to-sport stratification
(none / recreational / competitive / professional), coarsely comparable to
DART's `DEM-08` "Activity level (pre-injury)" enum and to the Tegner
Activity Scale, without importing Tegner's lower-limb-oriented item
descriptors, which do not transfer to a shoulder registry.

No precoordinated SNOMED CT or LOINC ordinal value codes exist for a
sports-participation-level scale as of authoring (verified July 2026):
SNOMED CT `social_context` has no match for "sports participation" or
"competitive sport"; SNOMED `observable_entity` has candidate axis codes
(e.g. `68130003` Physical activity, `256235009` Exercise) but no
precoordinated grade values; LOINC's answer-list `LL6103-7` ("Physical
activity levels") has no corresponding bindable FHIR ValueSet and no
sports-specific question code. Local codes are used in the interim.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/sports-participation-level"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-18"
* ^caseSensitive = true
* ^content = #complete
* ^count = 4

* #none "Does not participate in sport"
    "Patient does not participate in any regular sport pre-treatment."

* #recreational "Recreational / leisure sport"
    "Patient participates in sport at a recreational or leisure level (unorganized, non-competitive)."

* #competitive "Competitive / organized sport"
    "Patient participates in organized, competitive sport at a club or amateur-league level."

* #professional "Professional / elite sport"
    "Patient participates in sport at a professional or elite competitive level."
