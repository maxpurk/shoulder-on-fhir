Alias: $condition-ver-status = http://terminology.hl7.org/CodeSystem/condition-ver-status
// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffCondition Profile                                              │
// │  Condition profile for rotator cuff tear documentation                     │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: RotatorCuffCondition
Parent: http://hl7.eu/fhir/base/StructureDefinition/condition-eu-core
Id: rotator-cuff-condition
Title: "Rotator Cuff Condition"
Description: """
Profile for documenting rotator cuff tears and related shoulder pathology.
Derives from HL7 Europe Core `condition-eu-core`, which preferred-
binds `code` to IPS `problems-uv-ips` plus a secondary preferred binding to
`eHDSIIllnessandDisorder` and pins `subject` to `Reference(patient-eu-core)`
, the chain is satisfied because `ShoulderPatient` parents from `patient-eu-
core`. Our local `code` is fixed to a single RotatorCuffDiagnosis concept, a
tighter constraint than the inherited preferred binding (FHIR-legal).

Captures the diagnosis with laterality and chronicity, and links to detailed
classification observations via two buckets: formal grading observations
(Patte retraction, Goutallier fatty infiltration, Cofield tear-size
classification) link via `stage.assessment`; diagnostic-evidence observations
(**tendons involved**, **tear location**, tear thickness) link via
`evidence.detail`. The raw tear-size measurement (cm) is neither, it is
reachable through the encounter chain.

`code` is fixed to the registry's single inclusion diagnosis, a rotator
cuff tear (thickness-neutral SNOMED concept). It is not a clinician
choice. Hurley et al. 2024 (SECEC Delphi) defines no disease-entity
selection at all: every consensus question is scoped "in the setting of a
suspected/known rotator cuff tear," i.e. the tear is this registry's
inclusion criterion, not a variable. Tendon involvement, partial/full
thickness, tear location, and traumatic/non-traumatic etiology are each
captured on their own separate element instead of being folded into
overlapping pre-coordinated `code` choices, see TendonsInvolvedObservation,
TearThicknessObservation, TearLocationObservation, and the `condition-dueTo`
extension below.

Multiple `RotatorCuffCondition` instances may coexist in one registration
(e.g. a combined supraspinatus + infraspinatus tear coded as two Conditions,
or a re-evaluation superseding an earlier one), see
RotatorCuffRegistrationBundle's `condition 1..*` slice. Which one is the
principal diagnosis for the visit is recorded on
`ShoulderEncounter.diagnosis.rank`, not here; a Condition carries no opinion
about its own rank. Coexisting **non-rotator-cuff** shoulder pathology (e.g.
AC joint arthritis, long head of biceps pathology) uses the separate
ShoulderDiagnosisCondition profile instead of this one.

One registration entry always corresponds to exactly one patient and one
shoulder side, a bilateral case is two separate registrations, one per side,
each anchored by its own `bodySite`.

bodySite (1..1, required): laterality of the affected shoulder (left or right
shoulder region, pre-coordinated SNOMED region code, ShoulderLaterality ValueSet).
Tendon involvement is NOT carried here, it is captured in
TendonsInvolvedObservation (one per affected tendon) linked from this
Condition via evidence.detail.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-28"

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Clinical Status                                                           │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* clinicalStatus 1..1 MS
* clinicalStatus from http://hl7.org/fhir/ValueSet/condition-clinical (required)
* clinicalStatus ^comment = """
Registry-specific guidance for the four values exposed by the frontend
(`relapse` and `remission` are not offered, insufficiently distinct from
`recurrence` and `inactive` for this registry's purposes):

- **active**, the tear is currently present and clinically relevant
  (symptomatic and/or structurally confirmed, not yet surgically addressed).
  Default at registration; surgery itself does not change this status,   treatment outcome does.
- **recurrence**, a new tear (re-tear) at a repair site previously marked
  `resolved`.
- **inactive**, the patient is currently asymptomatic despite a structurally
  persistent or unrepaired tear (e.g. compensated on conservative
  management). Imaging may still show the defect; symptoms could return.
  Distinct from `resolved`, which implies the underlying pathology itself is
  gone, not merely quiet.
- **resolved**, the repair is confirmed intact and healed on follow-up
  exam or imaging, with no ongoing symptoms expected to recur.
"""

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Verification Status, fixed #confirmed                                     │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// Not a fresh guess: surgeon feedback (ADR-0105) already established that
// every registered diagnosis is clinically confirmed at this point in the
// workflow, which is why the field was already dropped from the UI in favor
// of a fixed submission value everywhere in the app; this closes the loop by
// fixing it in the IG too, matching status/category (ADR-0125).
* verificationStatus 1..1 MS
// Pinned with its code system. A code on its own belongs to no code system and
// so is in no value set, and every resource built from this profile carried a
// verification status the validator rejected.
* verificationStatus = $condition-ver-status#confirmed "Confirmed"

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Category                                                                  │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* category 1..* MS
* category = http://terminology.hl7.org/CodeSystem/condition-category#encounter-diagnosis

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Code (Diagnosis), fixed to the registry's single inclusion diagnosis.     │
// │  Not a clinician choice: the consensus names no disease-entity element,     │
// │  every characterizing axis (tendon, thickness, location, etiology,         │
// │  staging) already has its own element below. See ADR-0111.                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* code 1..1 MS
* code = http://snomed.info/sct#926335004 "Rupture of rotator cuff of shoulder"
* code ^short = "Rotator cuff tear (fixed inclusion diagnosis; character carried by decomposed axes)"

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Body Site: Laterality only                                                │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// bodySite carries the affected shoulder side (left or right shoulder region,
// pre-coordinated SNOMED region code from ShoulderLaterality ValueSet).
// Tendon involvement is captured in TendonsInvolvedObservation (one per affected
// tendon), linked from this Condition via evidence.detail. See ADR-0064, // supersedes the prior ADR-0014b dual-content convention.
* bodySite 1..1 MS
* bodySite from ShoulderLaterality (required)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Subject (Patient Reference)                                               │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* subject 1..1 MS
* subject only Reference(ShoulderPatient)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Onset (for chronicity assessment)                                         │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* onset[x] MS
* onset[x] only dateTime or Period or Age

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Recorded Date                                                             │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* recordedDate MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Staging, formal grading/classification observations (Patte retraction,    │
// │  Goutallier fatty-infiltration, Cofield tear-size bucket). Applied after   │
// │  diagnosis is confirmed; characterize severity. See ADR-0073.              │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* stage MS
* stage ^short = "Formal staging assessments: Patte classification, Goutallier grade, Cofield tear-size bucket"
* stage.assessment MS
* stage.assessment only Reference(ShoulderObservation)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Evidence, diagnostic evidence supporting the diagnosis: tendons           │
// │  involved, tear location (TendonsInvolvedObservation,                      │
// │  TearLocationObservation) and provocation tests (Jobe, Lift-off, Belly     │
// │  Press, Bear Hug, Hornblower). See ADR-0073.                               │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* evidence MS
* evidence ^short = "Diagnostic evidence: TendonsInvolvedObservation, TearLocationObservation, and provocation tests (Jobe, Lift-off, Belly Press, Bear Hug, Hornblower)"
* evidence.detail MS
* evidence.detail only Reference(ShoulderObservation)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Extensions                                                                │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// condition-assertedDate: INHERITED from condition-eu-core (ADR-0058), no
// longer redeclared locally. The slice + binding chain holds as before; only
// the source of the declaration changed.
//
// condition-dueTo (ADR-0046): required (1..1) classifier for causation, // post-coordinated etiology, independent of the anatomic SNOMED code in
// Condition.code. Required binding to RotatorCuffEtiology (traumatic /
// degenerative / mixed / unknown). Forces explicit classification; clinicians
// select `Unknown (origin)` rather than omit when causation is not
// determinable. Replaces the previous code-choice-only mechanism for
// expert consensus Q1.e.
* extension contains
    http://hl7.org/fhir/StructureDefinition/condition-dueTo named dueTo 1..1 MS
* extension[dueTo] ^short = "Etiology classifier (expert consensus Q1.e)"
* extension[dueTo].value[x] only CodeableConcept
* extension[dueTo].valueCodeableConcept from RotatorCuffEtiology (required)


