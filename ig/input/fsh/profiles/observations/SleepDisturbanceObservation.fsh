// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  SleepDisturbanceObservation Profile                                       │
// │  Sleep disturbance due to shoulder pathology (expert consensus Q1.i)       │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: SleepDisturbanceObservation
Parent: ShoulderObservation
Id: sleep-disturbance-observation
Title: "Sleep Disturbance Observation"
Description: """
Observation documenting the degree to which the patient's sleep is disturbed
specifically by the shoulder pathology being registered. Three-tier ordinal
(unaffected / occasionally disturbed / nightly disturbed) matching the sleep
sub-item of the Constant-Murley score's Activities-of-Daily-Living section, the expert consensus Q12 preferred outcome instrument (Constant JF, Murley AH. A
clinical method of functional assessment of the shoulder. Clin Orthop Relat
Res. 1987;214:160-4), already used elsewhere in this IG as
`ConstantScoreObservation`, which carries the total and, optionally, the four
sub-scores as `component[]`.

Expert consensus Q1.i (unanimous consensus), required patient-history
element. The expert consensus names "sleep disturbance" without fixing whether
it must be generic or attributed to the index pathology. This profile asks
specifically about shoulder-caused disturbance, so the attribution is explicit
rather than left to the reader of a generic "is your sleep disturbed?" item.
No SNOMED CT or LOINC concept exists for this axis (a graded,
shoulder-attributed sleep-disturbance scale) as of authoring (verified July
2026).

Linked to the index RotatorCuffCondition via `Condition.evidence.detail`
(same pattern as the provocation tests, `TendonsInvolvedObservation`,
`TearLocationObservation`), nocturnal pain/sleep disruption is a recognized
supportive clinical feature of symptomatic rotator cuff tears, and the
linkage makes "attributed to this diagnosis" a queryable FHIR relationship
rather than only implied by question wording.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sleep-disturbance-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-17"

* code = ShoulderObservationCodes#sleep-disturbance
* category = http://terminology.hl7.org/CodeSystem/observation-category#social-history "Social History"
* value[x] only CodeableConcept
* valueCodeableConcept from SleepDisturbanceSeverity (required)
