// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ReturnToActivity CodeSystem                                               │
// │  Coded status for patient return to sport or occupational activities       │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: ReturnToActivityCodes
Id: return-to-activity
Title: "Return to Activity Status"
Description: """
Coded classification of a patient's ability to return to pre-injury sport or
occupational activities after shoulder surgery (expert consensus component Q12.e).
No equivalent codes exist in SNOMED CT or LOINC for this three-category instrument
as used in shoulder surgery registries; local codes are used in the interim.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/return-to-activity"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-04-08"
* ^publisher = "Hasso Plattner Institute"
* ^caseSensitive = true
* ^content = #complete
* ^count = 3

* #returned-full "Returned to Full Activities"
    "Patient has returned to their pre-injury level of sport or occupational activities without restrictions."

* #returned-modified "Returned to Modified Activities"
    "Patient has returned to sport or work but at a reduced or modified level compared to pre-injury status."

* #not-returned "Not Returned"
    "Patient has not returned to pre-injury sport or occupational activities at the time of assessment."


