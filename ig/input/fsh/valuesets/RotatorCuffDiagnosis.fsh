// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffDiagnosis                                                      │
// │  Enumerated SNOMED CT codes for the rotator cuff DISEASE ENTITY only —     │
// │  which tendon and etiology are captured elsewhere (see below). Scope and   │
// │  provenance documented in ADR-0032: the consensus fixes the data element,  │
// │  not the coded values; this enumerated list is an editorial baseline.      │
// │  RotatorCuffCondition.code pins the single concept as a pattern; it does   │
// │  not bind this ValueSet.                                                   │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: RotatorCuffDiagnosis
Id: rotator-cuff-diagnosis
Title: "Rotator Cuff Diagnosis ValueSet"
Description: """
Single-code enumeration carrying the registry's fixed inclusion diagnosis, a
rotator cuff tear (thickness-neutral SNOMED concept). It publishes the
inclusion criterion in machine-readable form. `RotatorCuffCondition.code`
pins the concept as a pattern rather than binding this ValueSet, so a
deploying registry may add further `coding[]` siblings on the same
`CodeableConcept` where local practice requires it.

The enumeration is deliberately one code, not a disease-entity list: none of
the 13 consensus questions defines a disease-entity selection. Every question
is scoped "in the setting of a suspected/known rotator cuff tear," so the tear
is the registry's inclusion criterion, not a variable to be chosen. The only
classification axis the consensus names is Q4 (size, tendons involved, partial
vs. full thickness, Patte, Goutallier), each of which already has its own
element in this IG. Neighbouring entities such as "Rotator cuff tear
arthropathy" name distinct, disjoint SNOMED concepts (late-stage glenohumeral
joint destruction secondary to a chronic massive tear, a reverse arthroplasty
indication, not a repair indication) and are neither sub- nor supertypes of
the tear code.

Excludes three axes that are captured elsewhere on
RotatorCuffCondition, so a case is coded once per axis, not through an
overlapping choice of pre-coordinated concepts:
- **which tendon** is torn (supraspinatus / infraspinatus / subscapularis /
  teres minor), TendonsInvolvedObservation, one per affected tendon, linked
  via `Condition.evidence.detail`.
- **traumatic vs. non-traumatic** etiology, the `condition-dueTo` extension,
  bound to RotatorCuffEtiology (required).
- **partial vs. full thickness**, TearThicknessObservation, linked via
  `Condition.evidence.detail`.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-diagnosis"
* ^version = "0.4.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-28"
* ^publisher = "Hasso Plattner Institute"

// Rotator cuff tear/rupture (thickness-neutral — see TearThicknessObservation)
* http://snomed.info/sct#926335004 "Rupture of rotator cuff of shoulder"
