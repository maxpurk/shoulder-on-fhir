// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Functional Limitation Severity CodeSystem                                 │
// │  Functional-ceiling ordinal for shoulder-attributable limitation           │
// │  (expert consensus Q1.n / Q12.c)                                           │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: FunctionalLimitationSeverityCodes
Id: functional-limitation-severity
Title: "Functional Limitation Severity"
Description: """
Five-tier ordinal grading the highest functional plane at which the patient's
shoulder still limits activity: overhead, at shoulder level, below shoulder
level, and unable to use the arm. Each tier names an observable functional
plane, so the grading is anchored to what the patient can do.

Each tier is a strict functional subset of the one above it. A patient unable
to use the arm is, by construction, also overhead-limited and
shoulder-level-limited. That subset relation is what makes the scale ordinal
for registry analysis, not merely categorical. The tiers match how rotator
cuff patients are already triaged verbally in clinic.

The CodeSystem realises expert consensus Q1.n "Functional limitations" (unanimous
consensus, no mechanism specified). A coded ordinal is used so that the
answer is analysable across the registry.

It is distinct from the Constant-Murley score's own ADL sub-score
(`ConstantScoreObservation` `component[ADL]`, 0-20 points, the expert consensus Q12
preferred outcome instrument, captured at follow-up): this is a quick
one-item baseline gestalt captured once at registration, not a multi-domain
instrument.

No SNOMED CT or LOINC concept exists for this functional-ceiling axis as of
authoring (verified July 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/functional-limitation-severity"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"
* ^caseSensitive = true
* ^content = #complete
* ^count = 5

* #no-limitation "No functional limitation"
    "Patient reports no restriction attributable to the shoulder in overhead, at-shoulder-level, or below-shoulder-level activities."

* #overhead-limitation "Overhead activity limited"
    "Patient can perform activities at or below shoulder level without difficulty, but overhead activity (e.g. reaching a high shelf, overhead work or sport) is limited by the shoulder."

* #shoulder-level-limitation "At-shoulder-level activity limited"
    "Overhead activity is not attempted or not possible; activity at shoulder level (e.g. combing hair, reaching sideways to shoulder height) is also limited by the shoulder, though below-shoulder-level activity remains largely unaffected."

* #below-shoulder-limitation "Below-shoulder-level activity limited"
    "Even activities performed below shoulder level (e.g. dressing, perineal care, lifting light objects at waist height) are limited by the shoulder."

* #unable-to-use-arm "Unable to use the arm functionally"
    "The shoulder/arm cannot be used for functional activity; patient relies substantially on the contralateral arm for activities of daily living."
