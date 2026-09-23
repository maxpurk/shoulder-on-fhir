// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Constant-Murley worksheet input CodeSystem                                 │
// │  The answer categories the sub-score questions offer, not clinical findings  │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: ConstantCalculatorInputCodes
Id: constant-calculator-input
Title: "Constant-Murley Worksheet Input"
Description: """
The answer categories a Constant-Murley worksheet question offers, which the form turns
into that question's points before the total is summed. These are inputs to a calculation
and never leave the form: what is extracted is the numeric sub-score on
`ConstantScoreObservation.component`, so no code from here reaches a stored Observation.

An ordinal category takes its axis from the question that asks it. `none`, `moderate` and
`severe` are the zero, middle and highest categories of whichever axis the question names,
so the same code reads as no pain on the pain question and as not limited on an
activity-limitation question, and each question supplies the wording that applies to it.
The positional codes name a height the hand reaches or a posture it reaches it in.

Two forms use these: the registration and follow-up Questionnaires, on the sub-score
questions of the Constant-Murley group.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-09-23"
* ^publisher = "Hasso Plattner Institute"
* ^caseSensitive = true
* ^content = #complete

// ── Ordinal categories, axis supplied by the question ────────────────────────
* #none "None" "The zero category of the axis the question names: no pain, or not limited."
* #mild "Mild" "The category above none: mild pain."
* #moderate "Moderate" "The middle category: moderate pain, or moderately limited."
* #severe "Severe" "The highest category: severe or permanent pain, or severely limited."

// ── Sleep disturbance, the axis the Constant worksheet words separately ──────
* #unaffected "Unaffected" "Sleep is not disturbed by the shoulder."
* #occasional "Occasionally disturbed" "Sleep is occasionally disturbed by the shoulder."
* #nightly "Nightly disturbed" "Sleep is disturbed by the shoulder every night."

// ── The height the hand reaches, for the positioning sub-score ───────────────
* #waist "Waist" "The hand reaches the waist."
* #xiphoid "Xiphoid" "The hand reaches the xiphoid, at the sternum."
* #neck "Neck" "The hand reaches the neck."
* #head "Head" "The hand reaches the head."
* #above-head "Above head" "The hand reaches above the head."
* #full-elevation "Full elevation" "The arm reaches full elevation."

// ── The posture the hand reaches it in ───────────────────────────────────────
* #behind-head-elbow-forward "Hand behind head, elbow forward" "The hand reaches behind the head with the elbow forward."
* #behind-head-elbow-back "Hand behind head, elbow back" "The hand reaches behind the head with the elbow back."
* #above-head-elbow-forward "Hand above head, elbow forward" "The hand reaches above the head with the elbow forward."
* #above-head-elbow-back "Hand above head, elbow back" "The hand reaches above the head with the elbow back."
