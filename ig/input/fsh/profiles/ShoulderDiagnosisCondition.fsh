// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderDiagnosisCondition Profile                                       │
// │  Condition profile for coexisting NON-rotator-cuff shoulder pathology      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: ShoulderDiagnosisCondition
Parent: http://hl7.eu/fhir/base/StructureDefinition/condition-eu-core
Id: shoulder-diagnosis-condition
Title: "Shoulder Diagnosis (Non-Rotator-Cuff)"
Description: """
Profile for documenting shoulder pathology that coexists with, but is
distinct from, the index rotator cuff tear, e.g. long head of biceps
tendinopathy, AC joint osteoarthritis, a glenoid labrum tear, adhesive
capsulitis, glenohumeral osteoarthritis, or shoulder instability.

An anatomy-region profile (`Shoulder*`, not `RotatorCuff*`): these
diagnoses are not rotator cuff tears and
carry none of RotatorCuffCondition's RC-specific apparatus (no required
`condition-dueTo` etiology classifier, no `stage`/`evidence` staging
machinery for Patte/Goutallier/tendons-involved/tear-location, since those
classification systems do not apply to e.g. adhesive capsulitis).

Used via `RotatorCuffRegistrationBundle.otherDiagnosis` (`0..*`) alongside
one or more `RotatorCuffCondition` entries. The registry convention still
holds: one registration entry = one patient + one shoulder side: a
ShoulderDiagnosisCondition's `bodySite` MUST match the laterality of the
RotatorCuffCondition(s) in the same bundle, it names a second problem on
the same shoulder, not a diagnosis on the other side.

Which diagnosis in the bundle (RC or non-RC) is the principal reason for the
visit is recorded on `ShoulderEncounter.diagnosis.rank`, not on the Condition
itself.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-diagnosis-condition"
* ^version = "0.1.1"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-13"

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Clinical Status                                                           │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* clinicalStatus 1..1 MS
* clinicalStatus from http://hl7.org/fhir/ValueSet/condition-clinical (required)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Verification Status                                                       │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* verificationStatus 1..1 MS
* verificationStatus from http://hl7.org/fhir/ValueSet/condition-ver-status (required)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Category                                                                  │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* category 1..* MS
* category = http://terminology.hl7.org/CodeSystem/condition-category#encounter-diagnosis

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Code (Diagnosis)                                                          │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* code 1..1 MS
* code from ShoulderDiagnosis (extensible)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Body Site: Laterality only, must match the RotatorCuffCondition(s) in   │
// │  the same bundle (one registration entry = one patient + one shoulder).   │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* bodySite 1..1 MS
* bodySite from ShoulderLaterality (required)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Subject (Patient Reference)                                               │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* subject 1..1 MS
* subject only Reference(ShoulderPatient)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Onset                                                                     │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* onset[x] MS
* onset[x] only dateTime or Period or Age

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Recorded Date                                                             │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* recordedDate MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Extensions                                                                │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// condition-dueTo explicitly forbidden (not just left undeclared): etiology
// classification does not apply to non-rotator-cuff pathology (see profile
// Description above). Without this, a RotatorCuffCondition instance (which
// REQUIRES condition-dueTo 1..1) satisfies every constraint this profile
// declares too, so RotatorCuffRegistrationBundle's `entry` #profile
// discriminator can't tell `condition` and `otherDiagnosis` apart and every
// principal diagnosis fails validation with "Element matches more than one
// slice". Forbidding the extension makes the two profiles structurally
// disjoint, restoring an unambiguous discriminator.
* extension contains
    http://hl7.org/fhir/StructureDefinition/condition-dueTo named dueTo 0..0
