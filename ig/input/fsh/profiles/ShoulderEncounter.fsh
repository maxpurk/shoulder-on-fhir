// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderEncounter Profile                                                 │
// │  Encounter profile shared by all three bundle contexts                     │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: ShoulderEncounter
Parent: Encounter
Id: shoulder-encounter
Title: "Shoulder Encounter"
Description: """
Profile for documenting shoulder-related clinical encounters across all three
bundle contexts of the three-bundle architecture:

* **Registration consultation (T0)**, pre-operative visit at which the
  diagnosis is established and the patient is enrolled; 1..1 anchor in
  `RotatorCuffRegistrationBundle`.
* **Surgical admission (T1)**, the encounter framing the index procedure in
  `RotatorCuffSurgeryBundle`.
* **Routine follow-up (Tn)**, expert consensus Q11 follow-up at 6 wk / 3 mo /
  6 mo / 1 y / 2 y in `RotatorCuffFollowUpBundle`.

`status` is fixed to `finished`: an encounter is submitted to the registry once
it has taken place. `period.start` and `period.end` carry the start and the
completion timestamp.

`type` is bound (extensible) to `ShoulderEncounterType`: SNOMED CT
`185349003` (Encounter for check up) for registration, `390906007` (Follow-up
encounter) for post-operative visits (expert consensus Q10), `308335008` (Patient
encounter procedure) for surgical admission (T1).

`reasonReference` is **required (1..1)** and MUST point to a `Condition` that
motivates the visit, the type is `Reference(Condition)` so `ShoulderEncounter`
remains anatomy-region and reusable by sibling shoulder IGs (e.g. a future
arthroplasty IG). Inside the three rotator-cuff bundle profiles the Condition
slice is constrained to `RotatorCuffCondition`, so `Encounter.reasonReference`
resolves to a `RotatorCuffCondition` by composition.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-encounter"
* ^version = "0.4.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-13"

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Status, fixed #finished                                                   │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// Every Encounter across all three bundle contexts (registration consultation,
// surgical admission, follow-up visit) documents a completed visit at
// submission time -- never planned/arrived/in-progress. Unlike `class` below,
// this is genuinely invariant across all three contexts, so it's safe to fix
// on this profile directly rather than needing a per-context derived profile.
* status 1..1 MS
* status = #finished

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Class, deliberately left open on THIS shared profile (ambulatory vs.      │
// │  inpatient genuinely varies by case for Surgery; see ADR-0124). Registration │
// │  and Follow-Up close it instead at the bundle level (their own             │
// │  entry[encounter].resource.class fix, ADR-0126) since it IS constant in    │
// │  those two contexts -- just not one this shared profile alone can express. │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* class 1..1 MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Type, kind of follow-up                                                   │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* type 1..* MS
* type from ShoulderEncounterType (extensible)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Subject (Patient Reference)                                               │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* subject 1..1 MS
* subject only Reference(ShoulderPatient)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Period (start = scheduled or actual start; end = completion)              │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* period MS
* period.start MS
* period.end MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Reason, link to the Condition this visit concerns (1..1)                  │
// │  ADR-0037: this is the anchor that ties Observations / Procedures /        │
// │  QuestionnaireResponses in the enclosing bundle back to the diagnosis.     │
// │  ADR-0066: type relaxed from Reference(RotatorCuffCondition) to            │
// │  Reference(Condition) so this profile stays anatomy-region and reusable.   │
// │  The RC pathology guarantee is preserved one layer up via the bundle's     │
// │  Condition slice (only RotatorCuffCondition).                              │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* reasonReference 1..1 MS
* reasonReference only Reference(Condition)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Diagnosis, ranked list of Conditions addressed by this visit. `rank = 1`  │
// │  marks the principal ("Hauptdiagnose") among several coexisting            │
// │  diagnoses; `reasonReference` above continues to point at that same        │
// │  principal Condition. Populated by the Registration flow whenever more     │
// │  than one Condition (RotatorCuffCondition and/or                           │
// │  ShoulderDiagnosisCondition) is submitted in the same bundle; optional     │
// │  when there is only one, since rank is then unambiguous.                   │
// │  ADR-0195: `rank` is 0..1, not 1..1. R5 removes the element outright in    │
// │  favour of `use`, which already carries the same split here (CC for the    │
// │  principal diagnosis, CM for coexisting ones), so requiring it would       │
// │  over-constrain against the direction of the specification -- and 1..1     │
// │  contradicted the "optional when there is only one" rule stated above.     │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* diagnosis 0..* MS
* diagnosis ^short = "Ranked diagnoses addressed by this visit, rank 1 is the principal (Hauptdiagnose)"
* diagnosis.condition 1..1 MS
* diagnosis.condition only Reference(Condition)
* diagnosis.use MS
* diagnosis.use from http://terminology.hl7.org/ValueSet/diagnosis-role (extensible)
* diagnosis.rank 0..1 MS
