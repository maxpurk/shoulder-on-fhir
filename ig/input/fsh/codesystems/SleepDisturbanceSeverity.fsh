// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Sleep Disturbance Severity CodeSystem                                     │
// │  Graded scale for shoulder-attributed sleep disturbance (consensus Q1.i)   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: SleepDisturbanceSeverityCodes
Id: sleep-disturbance-severity
Title: "Sleep Disturbance Severity"
Description: """
Three-tier ordinal grading how much the patient's sleep is disturbed
specifically by the shoulder pathology being registered. Matches the sleep
sub-item of the Constant-Murley score's Activities-of-Daily-Living section, the expert consensus Q12 preferred outcome instrument, rather than inventing a new
scale.

Reference: Constant JF, Murley AH. A clinical method of functional
assessment of the shoulder. Clin Orthop Relat Res. 1987;214:160-4.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/sleep-disturbance-severity"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-17"
* ^caseSensitive = true
* ^content = #complete
* ^count = 3

* #unaffected "Unaffected"
    "Sleep is not disturbed by shoulder pain. Corresponds to the Constant-Murley sleep sub-item's full 2 points."

* #occasional "Occasionally disturbed"
    "Shoulder pain occasionally disturbs sleep. Corresponds to the Constant-Murley sleep sub-item's 1 point."

* #nightly "Nightly disturbed"
    "Shoulder pain disturbs sleep nightly. Corresponds to the Constant-Murley sleep sub-item's 0 points."
