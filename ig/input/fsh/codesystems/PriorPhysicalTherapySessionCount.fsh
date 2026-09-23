// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Prior Physical Therapy Session Count CodeSystem                           │
// │  Bucketed session-count for prior PT, part of expert consensus Q1.f         │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: PriorPhysicalTherapySessionCountCodes
Id: prior-physical-therapy-session-count
Title: "Prior Physical Therapy Session Count"
Description: """
Bucketed count of prior physical-therapy sessions received for the shoulder
condition being registered, part of the unanimous-consensus Q1.f
"Prior treatment (PT/injections)," which names no mechanism.

The count is bucketed because exact session counts are rarely recalled
precisely and are not analytically useful as an unbounded number. Three tiers
are enough to distinguish a brief trial of therapy from extended conservative
management. What matters for treatment history is the amount of therapy
received, not when it was given.

No SNOMED CT or LOINC concept exists for a bucketed physical-therapy
session-count axis as of authoring (verified July 2026).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/prior-physical-therapy-session-count"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-27"
* ^caseSensitive = true
* ^content = #complete
* ^count = 3

* #le-10 "10 sessions or fewer"
    "1 to 10 physical-therapy sessions received for this condition."

* #11-20 "11 to 20 sessions"
    "11 to 20 physical-therapy sessions received for this condition."

* #gt-20 "More than 20 sessions"
    "More than 20 physical-therapy sessions received for this condition."
