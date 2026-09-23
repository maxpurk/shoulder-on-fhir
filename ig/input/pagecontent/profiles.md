# Profiles

This page describes the FHIR profiles defined in this Implementation Guide. For the complete machine-readable listing with differentials and snapshots, see the [Artifacts](artifacts.html) page.

## Must Support

`mustSupport` carries no meaning in FHIR on its own, so this guide defines it. An element flagged Must Support is one a conformant system is expected to handle, as distinct from one it is required to send.

A **submitting** system SHALL be able to populate a Must Support element when the corresponding information is present in its source record, and SHALL be able to omit it when the information is absent. Omission means the data was not recorded, not that the system cannot carry it.

A **receiving** system SHALL be able to store a Must Support element and make it available for later retrieval and query. It SHALL NOT reject a submission because a Must Support element is absent, and SHALL NOT discard the element when it is present.

Must Support says nothing about display. No requirement is made here that a system show a Must Support element to a user.

Required elements are marked by cardinality (1..1 or 1..*), not by this flag. An element is required only where a submission cannot be interpreted without it: the status, the category, the code, the subject, and the visit anchor.

## Profile Hierarchy

`ShoulderPatient`, the Condition family, and `RotatorCuffProcedure` parent from HL7 Europe Core 2.0.0. The other profiles parent from FHIR R4 base, where no EU Core profile fits. IPS conformance is claimed at the **instance** level through `meta.profile[]` for Patient, the comorbidity Condition, every Procedure, and the smoking Observation.

```
hl7.fhir.r4.core (4.0.1) ←─────────────── base
    │
    ├── hl7.fhir.eu.base (2.0.0) ←──────── EU Core layer
    │   ├── patient-eu-core
    │   │       └── ShoulderPatient       (instances also claim Patient-uv-ips)
    │   ├── condition-eu-core
    │   │       ├── RotatorCuffCondition  (no IPS claim; encounter diagnosis)
    │   │       ├── ShoulderComorbidityCondition  (instances also claim Condition-uv-ips)
    │   │       └── ShoulderDiagnosisCondition  (no IPS claim; encounter diagnosis)
    │   └── procedure-eu-core
    │           └── RotatorCuffProcedure     (instances also claim Procedure-uv-ips)
    │
    └── shoulder-on-fhir (this IG, parented from base R4 where no EU Core fit exists)
            ├── ShoulderObservation  ← abstract base
            │       └── [57 derived observation profiles]
            │           └── SmokingStatusObservation
            │                   (instances also claim Observation-tobaccouse-uv-ips)
            ├── RotatorCuffQuestionnaireResponse
            ├── ShoulderImagingStudy
            ├── ShoulderEncounter
            ├── ShoulderCoverage
            ├── RotatorCuffResearchCarePlan
            ├── RotatorCuffRegistrationBundle  ← transaction envelope (T0 pre-op)
            ├── RotatorCuffSurgeryBundle       ← transaction envelope (T1 surgical event)
            └── RotatorCuffFollowUpBundle      ← transaction envelope (per Q11 visit)
```

## Base Profiles

### ShoulderPatient

**Base:** `patient-eu-core` (HL7 Europe Core 2.0.0) &nbsp;|&nbsp; [Profile](StructureDefinition-shoulder-patient.html)

Derives from HL7 Europe Core `patient-eu-core`. It inherits `name 1..*`, `birthDate 1..1`, the `eu-pat-1` invariant, seven optional EU extension slots (birthPlace, sexParameterForClinicalUse, genderIdentity, pronouns, citizenship, nationality, birthTime), and the EU `Address` datatype (ISO 21090 ADXP with ISO 3166 country codes). Patient identifiers use the canonical HPI-namespaced system. Clinical findings, including hand dominance, live in dedicated `Observation` profiles, not in Patient extensions.

**Instances also claim IPS `Patient-uv-ips` conformance** through `meta.profile[]`. The stricter `ips-pat-1` invariant (`family` or `given` or `text`, with no data-absent-reason escape) is satisfied by the `name.family 1..1 MS` constraint below.

Key constraints (added on top of `patient-eu-core`):
- `Patient.identifier`: 1..* MS, with `system` and `value` 1..1 MS
- `Patient.name.family`: 1..1 MS (satisfies both `eu-pat-1` and `ips-pat-1` by construction)
- `Patient.name.given`: MS only (some European naming conventions omit given names)
- `Patient.gender`: 1..1 MS (administrative gender, FHIR base)
- `Patient.birthDate`: 1..1 MS
- `Patient.address`: uses the EU `Address-eu` datatype, inherited from `patient-eu-core`
- `Patient.extension[recordedSexOrGender]`: 0..1 MS. HL7 Gender Harmony `individual-recordedSexOrGender`, backported to R4 through `hl7.fhir.uv.extensions.r4`. It carries sex assigned at birth as a research variable distinct from administrative `Patient.gender`. `type.coding` is pinned to LOINC `76689-9` "Sex assigned at birth"; `value` is required-bound to `administrative-gender`.

Hand dominance is captured separately as a `HandDominanceObservation`.

### RotatorCuffCondition

**Base:** `condition-eu-core` (HL7 Europe Core 2.0.0) &nbsp;|&nbsp; [Profile](StructureDefinition-rotator-cuff-condition.html)

Derives from HL7 Europe Core `condition-eu-core`. It inherits the preferred binding to IPS `problems-uv-ips` and a secondary preferred binding to `eHDSIIllnessandDisorder`; `subject only Reference(patient-eu-core)` (satisfied because `ShoulderPatient` parents from `patient-eu-core`); and the `condition-assertedDate` extension.

Records the rotator cuff diagnosis: affected side and chronicity. `Condition.code` is fixed to the registry's single inclusion diagnosis, a rotator cuff tear (SNOMED CT `926335004`, thickness-neutral). The consensus names no disease-entity choice: every question is scoped to a known or suspected tear, so the tear is the inclusion criterion, not a variable. Laterality uses a pre-coordinated SNOMED CT shoulder region code (`91774008` right, `91775009` left) in `Condition.bodySite` (`1..1`, required binding to `ShoulderLaterality`). Tendon-level involvement (supraspinatus, infraspinatus, subscapularis, teres minor) is captured by `TendonsInvolvedObservation`, one per affected tendon, linked from this Condition through `evidence.detail`.

**Does not claim IPS `Condition-uv-ips` conformance.** An encounter diagnosis is not an IPS problem-list entry.

Key constraints (added on top of `condition-eu-core`):
- `Condition.code`: 1..1 MS, fixed to SNOMED CT `926335004` "Rupture of rotator cuff of shoulder"
- `Condition.bodySite`: `1..1`, required-bound to `ShoulderLaterality` (laterality only)
- `Condition.subject`: reference to `ShoulderPatient`
- `Condition.extension[condition-dueTo]`: **1..1 required**. Carries the Q1.e etiology classifier as a `CodeableConcept` bound to `RotatorCuffEtiology` (traumatic, degenerative, mixed, unknown). Etiology is a separate element from `Condition.code`, because most SNOMED diagnosis concepts pre-coordinate anatomy and pathology but not cause.
- `Condition.stage.assessment`: formal grading Observations (Patte, Goutallier, Cofield tear-size bucket)
- `Condition.evidence.detail`: diagnostic-evidence Observations (tendons involved, tear location, and provocation tests)

### ShoulderComorbidityCondition

**Base:** `condition-eu-core` (HL7 Europe Core 2.0.0) &nbsp;|&nbsp; [Profile](StructureDefinition-shoulder-comorbidity-condition.html)

A problem-list Condition for pre-existing comorbidities (Q1.c) that coexist with the rotator cuff pathology. It is distinct from `RotatorCuffCondition`, the index encounter diagnosis. Shoulder-region disorders are out of scope for this profile; they belong on `RotatorCuffCondition` or `ShoulderDiagnosisCondition`. Both demonstration frontends enforce this by excluding SNOMED descendants of the shoulder-region anchor concepts from the comorbidity typeahead.

**Instances also claim IPS `Condition-uv-ips` conformance**, a problem-list match.

Key constraints (added on top of `condition-eu-core`):
- `Condition.clinicalStatus`: 1..1 MS, required binding to `condition-clinical`
- `Condition.verificationStatus`: 1..1 MS, required binding to `condition-ver-status`
- `Condition.category`: fixed to `problem-list-item` (distinct from `RotatorCuffCondition.category = encounter-diagnosis`)
- `Condition.code`: 1..1 MS, extensible binding to IPS `problems-snomed-absent-unknown-uv-ips`
- `Condition.subject`: reference to `ShoulderPatient`

Carried on `RotatorCuffRegistrationBundle.entry[comorbidity]` (0..*).

### ShoulderDiagnosisCondition

**Base:** `condition-eu-core` (HL7 Europe Core 2.0.0) &nbsp;|&nbsp; [Profile](StructureDefinition-shoulder-diagnosis-condition.html)

A Condition profile for shoulder pathology that coexists with the index rotator cuff tear but is distinct from it: long head of biceps tendinopathy, AC joint osteoarthritis, a glenoid labrum tear, adhesive capsulitis, glenohumeral osteoarthritis, or shoulder instability. It is an anatomy-region profile (`Shoulder*`, not `RotatorCuff*`): these diagnoses carry none of `RotatorCuffCondition`'s tear-specific elements (no `condition-dueTo` classifier, no Patte, Goutallier, tendons-involved, or tear-location staging).

**Does not claim IPS `Condition-uv-ips` conformance**, the same encounter-diagnosis mismatch as `RotatorCuffCondition`.

Key constraints (added on top of `condition-eu-core`):
- `Condition.category`: fixed to `encounter-diagnosis`
- `Condition.code`: 1..1 MS, extensible-bound to `ShoulderDiagnosis`
- `Condition.bodySite`: 1..1, required-bound to `ShoulderLaterality` (matches the laterality of the `RotatorCuffCondition` in the same bundle; one registration is always one patient and one shoulder)
- `Condition.subject`: reference to `ShoulderPatient`
- `Condition.extension[condition-dueTo]`: forbidden (`0..0`). Etiology classification does not apply to non-rotator-cuff pathology. Forbidding the extension also keeps this profile structurally disjoint from `RotatorCuffCondition`, so the registration bundle's profile-based slicing can tell `condition` and `otherDiagnosis` entries apart.

Carried on `RotatorCuffRegistrationBundle.entry[otherDiagnosis]` (0..*), alongside one or more `RotatorCuffCondition` entries. Which diagnosis is the principal reason for the visit is recorded on `ShoulderEncounter.diagnosis.rank`, not on the Condition.

### RotatorCuffProcedure

**Base:** `procedure-eu-core` (HL7 Europe Core 2.0.0) &nbsp;|&nbsp; [Profile](StructureDefinition-rotator-cuff-procedure.html)

Derives from HL7 Europe Core `procedure-eu-core`, which tightens two base-R4 optionals to required: `code 1..1` (the procedure type must be documented) and `performed[x] 1..1` (the procedure date must be present, and is used for Q11 timepoint calculation). It also inherits `subject only Reference(patient-eu-core)` and the R5 backport `Procedure.recorded` extension.

Documents the surgical intervention (procedure type, surgical approach, body site, and the conditions treated) and prior non-surgical treatments (physical therapy, injections), distinguished by category.

**Instances also claim IPS `Procedure-uv-ips` conformance**, both index surgical procedures and prior physical-therapy or injection procedures.

Key constraints (added on top of `procedure-eu-core`):
- `Procedure.code`: bound to `RotatorCuffProcedureType` (extensible; tighter than the inherited preferred binding)
- `Procedure.bodySite`: from `ShoulderLaterality` (required)
- `Procedure.subject`: reference to `ShoulderPatient`
- `Procedure.reasonReference`: reference to `RotatorCuffCondition` or `ShoulderDiagnosisCondition`, so a concomitant procedure can cite the coexisting diagnosis it treats
- `Procedure.performed[x]`: `only dateTime or Period` (used for Q11 timepoint calculation)
- `Procedure.partOf`: `0..1`, reference to the `RotatorCuffProcedure` this one accompanies. Set on a concomitant procedure to point at the index procedure of the same surgical event; the index procedure carries none, and that absence is what identifies it

### RotatorCuffQuestionnaireResponse

**Base:** `QuestionnaireResponse` &nbsp;|&nbsp; [Profile](StructureDefinition-rotator-cuff-questionnaire-response.html)

Captures structured PROM instruments where the full item-level response is needed. It complements the score-level derived Observation profiles: use `RotatorCuffQuestionnaireResponse` when the full question-and-answer detail is required, and the derived Observation profiles when only the aggregate score matters.

### ShoulderImagingStudy

**Base:** `ImagingStudy` &nbsp;|&nbsp; [Profile](StructureDefinition-shoulder-imaging-study.html)

Records which shoulder imaging modality was obtained (radiograph, MRI, CT, or ultrasound), when, and at which visit. Modality codes follow DICOM conventions, tightened to a shoulder-registry ValueSet. One instance per modality obtained. The registry-capturable fact is the modality and its date, not the pixel data, a radiology report, or an imaging order. The imaging-derived classifications (Goutallier, Patte, tear size) are recorded as separate derived `ShoulderObservation` instances linked to the `RotatorCuffCondition`.

`encounter` references the `ShoulderEncounter` the study belongs to, so pre-operative and follow-up imaging are distinguishable without comparing dates. It is optional rather than required, unlike the visit anchor on Observations and Procedures, because a study a patient brings in from outside predates any registry visit and has none to reference.

### ShoulderCoverage

**Base:** `Coverage` &nbsp;|&nbsp; [Profile](StructureDefinition-shoulder-coverage.html)

Records insurance and payer information, including workers' compensation status, an administrative factor for registry inclusion criteria and outcome analysis.

### RotatorCuffResearchCarePlan

**Base:** `CarePlan` &nbsp;|&nbsp; [Profile](StructureDefinition-rotator-cuff-research-care-plan.html)

Documents the planned research follow-up schedule for a registry participant: the five Q11 timepoints (6 weeks, 3 months, 6 months, 12 months, 24 months post-surgery), computed from the index procedure date. Carried in `RotatorCuffSurgeryBundle`, not `RotatorCuffRegistrationBundle`, because the schedule cannot be computed before the surgery date is known. The routine clinical visit lifecycle is captured by `ShoulderEncounter`.

This profile uses `CarePlan` for per-patient activity scheduling. The canonical FHIR pattern for research enrolment is `ResearchStudy` with `ResearchSubject`; comparable registry IGs (mCODE STU 4) do not adopt that layer, because for an observational registry the clinical resource graph is both the data model and the research data model. A production deployment that integrates with a clinical trial management system could add `ResearchSubject` alongside this profile without changing the core IG.

### ShoulderEncounter

**Base:** `Encounter` &nbsp;|&nbsp; [Profile](StructureDefinition-shoulder-encounter.html)

Documents a shoulder clinical encounter across all three bundle contexts: pre-operative registration consultation, surgical admission, and routine post-operative follow-up (Q10). `Encounter.status` is fixed to `finished`: an encounter is submitted to the registry once it has taken place. `period.start` and `period.end` carry the start and the completion timestamps. `type` is `1..*`, bound (extensible) to `ShoulderEncounterType`: `185349003` (Encounter for check up) for registration, `390906007` (Follow-up encounter) for post-op visits, `308335008` (Patient encounter procedure) for the surgical admission. `reasonReference` is required (1..1) and points to the `Condition` that is the reason for the encounter; in the registration bundle the Condition slice constrains it to a `RotatorCuffCondition`. This reference is the anchor that ties every Observation, Procedure, and QuestionnaireResponse in the bundle back to the diagnosis.

## Transaction Bundles

The IG defines three named transaction-bundle profiles, one per stage of the registry workflow (Registration, Surgery, Follow-Up per visit). They are machine-readable contracts for a conformant registry submission. A FHIR validator can check a whole bundle against its profile in one call. All three use the IPS slicing pattern, discriminating by resource type and then by profile.

### RotatorCuffRegistrationBundle

**Base:** `Bundle` &nbsp;|&nbsp; [Profile](StructureDefinition-rotator-cuff-registration-bundle.html)

Transaction bundle for the **index** submission: one patient registration with pre-operative assessment, diagnoses, and prior non-surgical treatment. The surgical procedure is not included; it belongs in `RotatorCuffSurgeryBundle`. Entry cardinality:

| Slice | Profile | Cardinality |
|-------|---------|-------------|
| `patient` | `ShoulderPatient` | 1..1 |
| `encounter` | `ShoulderEncounter` | 1..1 |
| `condition` | `RotatorCuffCondition` | 1..* |
| `otherDiagnosis` | `ShoulderDiagnosisCondition` (coexisting non-rotator-cuff shoulder pathology) | 0..* |
| `comorbidity` | `ShoulderComorbidityCondition` (problem-list, Q1.c) | 0..* |
| `priorTreatment` | `RotatorCuffProcedure`, category-bound to non-surgical (Q1.f, prior physical therapy or injection) | 0..* |
| `observation` | `ShoulderObservation` (any derived) | 0..* |
| `imagingStudy` | `ShoulderImagingStudy` | 0..* |
| `coverage` | `ShoulderCoverage` | 0..1 |
| `questionnaireResponse` | `RotatorCuffQuestionnaireResponse` | 0..* |

Which single Condition (from `condition` or `otherDiagnosis`) is the principal reason for the visit is recorded on `ShoulderEncounter.diagnosis.rank`, not by slice membership. The Q11 research follow-up schedule (`RotatorCuffResearchCarePlan`) is carried in `RotatorCuffSurgeryBundle`, because it cannot be computed before the surgery date is known.

### RotatorCuffSurgeryBundle

**Base:** `Bundle` &nbsp;|&nbsp; [Profile](StructureDefinition-rotator-cuff-surgery-bundle.html)

Transaction bundle for the **surgical event** (T1) of an already-registered patient. A sibling of `RotatorCuffRegistrationBundle` (pre-op, T0) and `RotatorCuffFollowUpBundle` (post-op, per Q11 timepoint). Entry cardinality:

| Slice | Profile | Cardinality |
|-------|---------|-------------|
| `encounter` | `ShoulderEncounter` | 1..1 |
| `procedure` | `RotatorCuffProcedure`, category-bound to surgical (index procedure plus any concomitant procedures) | 1..* |
| `observation` | `ShoulderObservation` (any derived; intra-operative findings) | 0..* |
| `carePlan` | `RotatorCuffResearchCarePlan` (the Q11 follow-up schedule, computed from the index procedure date) | 0..1 |

Index and concomitant procedures are not separately sliced, because both are `RotatorCuffProcedure` and neither slicing discriminator separates them. The distinction is carried on the resources instead: a concomitant procedure references the index procedure through `Procedure.partOf`, and the index procedure is the one that carries none. Stating it on the resources rather than through entry order means it still holds once the bundle has been persisted and each entry has its own identity.

The bundle does not include Patient, Condition, or prior non-surgical treatments; those were established by the prior `RotatorCuffRegistrationBundle` and are referenced by their persisted IDs.

### RotatorCuffFollowUpBundle

**Base:** `Bundle` &nbsp;|&nbsp; [Profile](StructureDefinition-rotator-cuff-follow-up-bundle.html)

Transaction bundle for a **single post-operative follow-up visit** of an already-registered patient. A sibling of `RotatorCuffRegistrationBundle`. Entry cardinality:

| Slice | Profile | Cardinality |
|-------|---------|-------------|
| `encounter` | `ShoulderEncounter` | 1..1 |
| `observation` | `ShoulderObservation` (any derived) | 1..* |
| `questionnaireResponse` | `RotatorCuffQuestionnaireResponse` | 0..1 |
| `imagingStudy` | `ShoulderImagingStudy` | 0..* (research re-imaging, Q13) |

The bundle does not include Patient, Condition, or Procedure; those were established by the prior `RotatorCuffRegistrationBundle` and are referenced by their persisted IDs. It covers longitudinal capture across the Q11 timepoints: 6 weeks, 3, 6, 12, and 24 months.

## Observation Profiles

### ShoulderObservation (abstract base)

**Base:** `Observation` &nbsp;|&nbsp; [Profile](StructureDefinition-shoulder-observation.html)

An abstract base profile with the shared constraints for all shoulder clinical observations. It is not used directly; every observation conforms to one of the 57 derived profiles below.

Shared constraints:
- `Observation.status`: 1..1, fixed to `final`
- `Observation.category`: one of `exam` (clinical assessment), `imaging` (imaging-derived classification), `procedure` (procedure technique), `social-history` (patient history), or `survey` (PROM and patient self-report)
- `Observation.code`: 1..1, from `ShoulderObservationCode`
- `Observation.subject`: reference to `ShoulderPatient`
- `Observation.encounter`: 1..1, reference to `ShoulderEncounter` (the visit anchor, so every measurement is tied to the visit it was taken at)
- `Observation.effective[x]`: Must Support, `dateTime` or `Period` (date of assessment)
- `Observation.bodySite`: Must Support, extensible binding to `ShoulderLaterality`, so a derived profile may use a more specific SNOMED CT anatomy code

A derived profile is identified by `Observation.code` together with `Observation.category`. Almost every code selects a single profile; the two exceptions are `tear-size` and `tear-size-classification`, where the same concept is recorded pre-operatively from imaging (`category = imaging`) and intra-operatively by direct measurement (`category = exam`), so each of those codes selects one of two profiles. The four `constant-score-*` codes are `component.code` values inside `ConstantScoreObservation` and are not used as `Observation.code`.

### Range of Motion: Flexion, External Rotation, Abduction (active)

Coded with verified shoulder-specific LOINC concepts.

| Profile | LOINC Code | Display | Unit |
|---------|------------|---------|------|
| [ShoulderFlexionObservation](StructureDefinition-shoulder-flexion-observation.html) | `41389-8` | Shoulder Flexion Active Range of Motion Quantitative | degrees |
| [ShoulderExternalRotationObservation](StructureDefinition-shoulder-external-rotation-observation.html) | `41387-2` | Shoulder External rotation Active Range of Motion Quantitative | degrees |
| [ShoulderAbductionObservation](StructureDefinition-shoulder-abduction-observation.html) | `41381-5` | Shoulder Abduction Active Range of Motion Quantitative | degrees |

### Range of Motion: Flexion, External Rotation, Abduction (passive)

| Profile | LOINC Code | Display | Unit |
|---------|------------|---------|------|
| [ShoulderPassiveFlexionObservation](StructureDefinition-shoulder-passive-flexion-observation.html) | `41390-6` | Shoulder Flexion Passive Range of Motion Quantitative | degrees |
| [ShoulderPassiveExternalRotationObservation](StructureDefinition-shoulder-passive-external-rotation-observation.html) | `41388-0` | Shoulder External rotation Passive Range of Motion Quantitative | degrees |
| [ShoulderPassiveAbductionObservation](StructureDefinition-shoulder-passive-abduction-observation.html) | `41382-3` | Shoulder Abduction Passive Range of Motion Quantitative | degrees |

### Range of Motion: Internal Rotation (at side)

At-side internal rotation is not recorded in degrees. It is graded by a functional "hand behind back" reach scale. `value[x] only CodeableConcept`, required binding to a local 8-tier vertebral-level ordinal (unable, greater trochanter, buttock, sacrum, L5, L3, T12, T7 or above). No LOINC or SNOMED CT code exists for this axis.

| Profile | `Observation.code` | ValueSet |
|---------|--------------------|---------|
| [ShoulderInternalRotationObservation](StructureDefinition-shoulder-internal-rotation-observation.html) | local `internal-rotation` | `InternalRotationVertebralLevel` |
| [ShoulderPassiveInternalRotationObservation](StructureDefinition-shoulder-passive-internal-rotation-observation.html) | local `passive-internal-rotation` | `InternalRotationVertebralLevel` |

### Range of Motion: Rotation at 90° Abduction

A controlled, goniometer-reliable position distinct from at-side rotation, used to assess capsular tightness (GIRD) and rotator-cuff competence. `value[x] only Quantity`, degrees, local codes (a permissive 0–360° data-entry bound, not a physiological range claim).

| Profile | `Observation.code` |
|---------|--------------------|
| [ShoulderExternalRotation90AbductionObservation](StructureDefinition-shoulder-external-rotation-90-abduction-observation.html) | local `external-rotation-90-abduction` |
| [ShoulderPassiveExternalRotation90AbductionObservation](StructureDefinition-shoulder-passive-external-rotation-90-abduction-observation.html) | local `passive-external-rotation-90-abduction` |
| [ShoulderInternalRotation90AbductionObservation](StructureDefinition-shoulder-internal-rotation-90-abduction-observation.html) | local `internal-rotation-90-abduction` |
| [ShoulderPassiveInternalRotation90AbductionObservation](StructureDefinition-shoulder-passive-internal-rotation-90-abduction-observation.html) | local `passive-internal-rotation-90-abduction` |

### Strength Assessment

Manual Muscle Testing (Janda 0–5 grading); `value[x] only Quantity` with UCUM unit `{score}`. Q2.d (pre-treatment), Q9.d (post-treatment), Q12.b.

| Profile | Code | Value type / Unit |
|---------|------|------|
| [SupraspinatusStrengthObservation](StructureDefinition-supraspinatus-strength-observation.html) | local `supraspinatus-strength` | MMT `{score}` 0–5 |
| [ExternalRotationStrengthObservation](StructureDefinition-external-rotation-strength-observation.html) | local `external-rotation-strength` | MMT `{score}` 0–5 |
| [InternalRotationStrengthObservation](StructureDefinition-internal-rotation-strength-observation.html) | local `internal-rotation-strength` | MMT `{score}` 0–5 |
| [SubscapularisStrengthObservation](StructureDefinition-subscapularis-strength-observation.html) | local `subscapularis-strength` | MMT `{score}` 0–5 |
| [SupraspinatusStrengthDynamometryObservation](StructureDefinition-supraspinatus-strength-dynamometry-observation.html) | local `supraspinatus-strength-dynamometry` | Quantity, kg 0–50 (dynamometer; more sensitive to partial supraspinatus weakness than the ordinal MMT grade) |

### Provocation Tests

Each provocation test result is coded positive or negative using `PositiveNegative` (required binding). Jobe and Lift-off use verified SNOMED CT procedure concepts; the others use local codes.

| Profile | `Observation.code` | Test |
|---------|--------------------|------|
| [JobeTestObservation](StructureDefinition-jobe-test-observation.html) | SNOMED `1231437004` "Empty can test" | Jobe Test (Empty Can), supraspinatus integrity |
| [LiftOffTestObservation](StructureDefinition-lift-off-test-observation.html) | SNOMED `1231510004` "Lift-off test" | Lift-off Test, subscapularis integrity |
| [BellyPressTestObservation](StructureDefinition-belly-press-test-observation.html) | local `belly-press-test` | Belly Press Test, subscapularis integrity |
| [BearHugTestObservation](StructureDefinition-bear-hug-test-observation.html) | local `bear-hug-test` | Bear Hug Test, subscapularis integrity |
| [HornblowerTestObservation](StructureDefinition-hornblower-test-observation.html) | local `hornblower-test` | Hornblower Test (Signe du Clairon), teres minor integrity |

### Imaging Classifications

| Profile | Code | Value type | ValueSet |
|---------|------|-----------|---------|
| [GoutallierObservation](StructureDefinition-goutallier-observation.html) | local `goutallier-classification` | CodeableConcept | `GoutallierClassification` (grades 0–4) |
| [PatteObservation](StructureDefinition-patte-observation.html) | local `patte-classification` | CodeableConcept | `PatteClassification` (stages I–III) |
| [TearSizeObservation](StructureDefinition-tear-size-observation.html) | local `tear-size` | Quantity | cm (UCUM), pre-operative, from imaging |
| [TearSizeClassificationObservation](StructureDefinition-tear-size-classification-observation.html) | local `tear-size-classification` | CodeableConcept | `CofieldTearSizeClassification` (small, medium, large, massive), pre-operative, from imaging |
| [IntraopTearSizeObservation](StructureDefinition-intraop-tear-size-observation.html) | local `tear-size` | Quantity | cm (UCUM), intra-operative direct measurement |
| [IntraopTearSizeClassificationObservation](StructureDefinition-intraop-tear-size-classification-observation.html) | local `tear-size-classification` | CodeableConcept | `CofieldTearSizeClassification`, intra-operative direct measurement |

### Tear Location and Diagnosis Refinement

Q4 tear-classification sub-axes beyond Goutallier, Patte, and size. They are captured on Observations, away from `RotatorCuffCondition.code`, to avoid double-coding.

| Profile | `Observation.code` | Value type | ValueSet |
|---------|--------------------|-----------|---------|
| [TendonsInvolvedObservation](StructureDefinition-tendons-involved-observation.html) | local `tendons-involved` | CodeableConcept | `TendonsInvolved` (extensible), Q4.b, one Observation per affected tendon, linked through `Condition.evidence.detail` |
| [TearLocationObservation](StructureDefinition-tear-location-observation.html) | local `tear-location` | CodeableConcept | `TearLocation` (near insertion, musculotendinous, intratendinous) |
| [TearThicknessObservation](StructureDefinition-tear-thickness-observation.html) | local `tear-thickness` | CodeableConcept | `TearThickness` |

### Surgical Procedure Technique (operational layer, not a consensus element)

Procedure-technique axes documenting how a repair was performed.

| Profile | `Observation.code` | Value type | ValueSet |
|---------|--------------------|-----------|---------|
| [ProcedureApproachObservation](StructureDefinition-procedure-approach-observation.html) | local `procedure-approach` | CodeableConcept | `ProcedureApproach` |
| [ReconstructionExtentObservation](StructureDefinition-reconstruction-extent-observation.html) | local `reconstruction-extent` | CodeableConcept | `ReconstructionExtent` |
| [FixationTechniqueObservation](StructureDefinition-fixation-technique-observation.html) | local `fixation-technique` | CodeableConcept | `FixationTechnique` |

### Patient-Reported Outcome Measures (PROMs)

PROM scores use `value[x] only Quantity`. The unit follows the instrument: the Constant-Murley score carries the UCUM annotation `{score}`, while SSV and SANE are by definition a percentage of a normal shoulder and carry UCUM `%`. The set is limited to the instruments the consensus names as preferred (Q12).

| Profile | Instrument | Score range and unit | `Observation.code` |
|---------|-----------|-------------|--------------------|
| [ConstantScoreObservation](StructureDefinition-constant-score-observation.html) | Constant-Murley Score | 0–100 `{score}` | SNOMED CT `273383002`, optionally with `component[]` sub-scores (Pain 0–15, ADL 0–20, ROM 0–40, Strength 0–25) |
| [SsvScoreObservation](StructureDefinition-ssv-score-observation.html) | Subjective Shoulder Value (SSV) | 0–100 `%` | local `ssv-score` (no SNOMED CT or LOINC equivalent) |
| [SaneScoreObservation](StructureDefinition-sane-score-observation.html) | SANE Score | 0–100 `%` | local `sane-score` (no SNOMED CT or LOINC equivalent) |

SSV and SANE are two separately published instruments that ask for the same kind of single rating, and the consensus names them together as one preferred score. The guide therefore keeps a profile for each, and the mapping counts the pair as one consensus element. A registry that uses only one of them records only that one.

ASES, WORC, DASH, and QuickDASH are not included, because none reached the 80% Delphi threshold. An adopter who needs additional PROMs can profile them in a downstream IG.

### Patient Self-Report Items (Q12.e, Q12.g)

| Profile | `Observation.code` | ValueSet |
|---------|--------------------|---------|
| [PatientSatisfactionObservation](StructureDefinition-patient-satisfaction-observation.html) | LOINC `77218-6` "Patient satisfaction with healthcare delivery" | `SatisfactionScale` (LOINC answer list `LL4543-6`, 5-point scale) |
| [ReturnToActivityObservation](StructureDefinition-return-to-activity-observation.html) | local `return-to-sport-work` | `ReturnToActivity` |

### Patient History (Q1)

| Profile | `Observation.code` | Value type | Binding / notes |
|---------|--------------------|-----------|-----------------|
| [SmokingStatusObservation](StructureDefinition-smoking-status-observation.html) | LOINC `72166-2` | CodeableConcept | IPS `current-smoking-status-uv-ips` (extensible, 8 LOINC LA codes). Instances also claim IPS `Observation-tobaccouse-uv-ips`. |
| [SmokingPackYearsObservation](StructureDefinition-smoking-pack-years-observation.html) | SNOMED `782516008` "Number of calculated smoking pack years" | Quantity `{pack-years}` | Smoking-history quantification |
| [PainAverageObservation](StructureDefinition-pain-average-observation.html) | local `pain-average` | Quantity (0–10 `{score}`) | Pain on average |
| [PainActiveMovementObservation](StructureDefinition-pain-active-movement-observation.html) | local `pain-active-movement` | Quantity (0–10 `{score}`) | Pain during active movement |
| [PainPassiveMovementObservation](StructureDefinition-pain-passive-movement-observation.html) | local `pain-passive-movement` | Quantity (0–10 `{score}`) | Pain during passive movement |
| [PainRestObservation](StructureDefinition-pain-rest-observation.html) | local `pain-rest` | Quantity (0–10 `{score}`) | Pain at rest |
| [EmploymentStatusObservation](StructureDefinition-employment-status-observation.html) | LOINC `67875-5` | CodeableConcept | LOINC answer list `LL1901-9` plus one local "self-employed" addition |
| [OccupationalPhysicalDemandObservation](StructureDefinition-occupational-physical-demand-observation.html) | local `occupational-physical-demand` | CodeableConcept | Sedentary, light-manual, heavy-manual; no SNOMED or LOINC axis exists |
| [OccupationalOverheadExposureObservation](StructureDefinition-occupational-overhead-exposure-observation.html) | local `occupational-overhead-exposure` | CodeableConcept | Occupational overhead-work exposure |
| [SleepDisturbanceObservation](StructureDefinition-sleep-disturbance-observation.html) | local `sleep-disturbance` | CodeableConcept | 3-tier ordinal (unaffected, occasionally disturbed, nightly disturbed), matching the Constant-Murley ADL sleep sub-item |
| [FunctionalLimitationsObservation](StructureDefinition-functional-limitations-observation.html) | local `functional-limitation-severity` | CodeableConcept | `FunctionalLimitationSeverity` |
| [SportsParticipationObservation](StructureDefinition-sports-participation-observation.html) | local `sports-participation` | CodeableConcept | 4-tier participation-level ordinal (none, recreational, competitive, professional) |
| [PriorInjectionCountObservation](StructureDefinition-prior-injection-count-observation.html) | local `prior-injection-count` | CodeableConcept | `PriorInjectionCount` |
| [PriorPhysicalTherapySessionCountObservation](StructureDefinition-prior-physical-therapy-session-count-observation.html) | local `prior-physical-therapy-session-count` | CodeableConcept | `PriorPhysicalTherapySessionCount` |
| [HandDominanceObservation](StructureDefinition-hand-dominance-observation.html) | SNOMED `57427004` "Handedness" | CodeableConcept | `HandDominance` (includes an explicit Unknown) |

### Physical Examination: Visual Inspection (Q2.a, Q9.a)

Three structured findings replace a single free-text inspection note. Each is `value[x] only CodeableConcept`, required-bound to a shared `PresentAbsent` (SNOMED `52101004` Present, `2667000` Absent). Shared across Q2.a (pre-op) and Q9.a (post-op) by `effectiveDateTime`.

| Profile | `Observation.code` | Notes |
|---------|--------------------|-------|
| [AtrophyObservation](StructureDefinition-atrophy-observation.html) | local `atrophy` | No laterality-neutral SNOMED observable-entity concept exists for muscle atrophy on exam |
| [DeformityObservation](StructureDefinition-deformity-observation.html) | SNOMED `111263009` "Acquired deformity of shoulder" | |
| [NormalShoulderContourObservation](StructureDefinition-normal-shoulder-contour-observation.html) | local `normal-shoulder-contour` | |
