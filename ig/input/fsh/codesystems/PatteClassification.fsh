// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Patte Classification CodeSystem                                           │
// │  Classification system for rotator cuff tendon retraction                  │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: PatteClassificationCodes
Id: patte-classification
Title: "Patte Classification"
Description: """
The Patte classification describes the degree of tendon retraction in rotator cuff tears.
This classification is used to assess the severity of tendon retraction on imaging studies
(MRI or CT arthrography) and helps guide surgical planning.

Reference: Patte D. Classification of rotator cuff lesions. Clin Orthop Relat Res. 1990;254:81-86.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/patte-classification"
* ^version = "0.1.1"
* ^status = #draft
* ^experimental = true
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-18"
* ^caseSensitive = true
* ^content = #complete
* ^count = 3

// Wording is deliberately relational — "retracted tendon end at [landmark]" —
// rather than treating "proximal stump" as a fixed compound noun. Patte
// staging grades the *position* the retracted (medial) tendon end has
// migrated to, not an intrinsic property of the stump itself. Landmarks
// (footprint / humeral head / glenoid) are unchanged and remain
// Patte-1990-standard; only the framing was corrected on surgeon feedback,
// verified via the shoulder-surgeon subagent — see ADR-0085.

* #I "Stage I - Retracted tendon end at the bony insertion"
    "Minimal retraction: the retracted (medial) end of the torn tendon lies at or near the level of the bony insertion (footprint), close to its anatomical attachment site."

* #II "Stage II - Retracted tendon end at the humeral head"
    "Moderate retraction: the retracted tendon end lies at the level of the humeral head, retracted medially away from the footprint but still lateral to the glenoid."

* #III "Stage III - Retracted tendon end at the glenoid"
    "Severe retraction: the retracted tendon end lies at the level of the glenoid, i.e. at or medial to the glenoid rim."


