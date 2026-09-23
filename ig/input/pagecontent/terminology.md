# Terminology

This page describes the CodeSystems and ValueSets defined in this Implementation Guide. For the complete machine-readable listing, see the [Artifacts](artifacts.html) page.

## Design Principles

This IG is standard-terminology-first. It binds a verified LOINC, SNOMED CT, UCUM, DICOM, or HL7 code wherever one exists at the needed granularity, and a local CodeSystem only where none does. It follows the LOINC and SNOMED CT division of labour, and it chooses the **code** and the **value** of an observation independently:

- **SNOMED CT** for clinical entities and coded answers: anatomical body sites (shoulder laterality, tendon structures), the diagnosis (`Condition.code`), procedures (`Procedure.code`), and the coded value a finding returns (for example a provocation test's positive or negative result, a present or absent inspection finding, or tear thickness).
- **LOINC** for the observation code (the thing measured) of a quantitative measure or standard assessment where a shoulder-specific LOINC exists (range-of-motion angles, smoking status, employment status, patient satisfaction), together with its LOINC answer lists.
- **UCUM** for measurement units (degrees `deg`, kilograms `kg`, dimensionless scores `{score}`, centimetres `cm`).
- **DICOM** for imaging modality. **HL7 v3-ActCode** for the workers'-compensation coverage type.

**ICD-10 is permitted but not exercised.** The diagnosis is coded in SNOMED CT, and no element binds or fixes an ICD-10 code. Where a deploying site adds optional ICD dual-coding (for example on a comorbidity, as an additional `coding[]` sibling), the reference base is **ICD-10 (WHO)**, the jurisdiction-neutral classification that matches this IG's cross-border European scope. A national deployment substitutes its own ICD-10 modification for local billing and statutory reporting; in Germany that is **ICD-10-GM** (BfArM), mandated for DRG and §295/§301 SGB V reporting. Publishing SNOMED CT to ICD-10-GM (and to OPS, for procedures) concept maps to bridge those German workflows is a documented item of future work, not part of the current IG.

Local CodeSystems cover concepts where no verified standard code exists at the needed granularity: orthopaedic grading and staging scales (Goutallier, Patte, Cofield), registry ordinals (the hand-behind-back internal-rotation scale, sleep, sports, occupation, and functional tiers), muscle-specific strength axes, and the provocation tests SNOMED CT does not pre-coordinate. Each local CodeSystem is marked `experimental: true` and `status: draft`, and documents the terminology gap it addresses. Where a standard code exists but does not fit the clinical construct, the IG uses the closest-fitting local code instead (for example the four context-specific pain axes in place of a single generic pain score, and a functional vertebral-level scale for at-side internal rotation in place of goniometric degrees).

## Custom CodeSystems

### ShoulderObservationCodes

[CodeSystem](CodeSystem-shoulder-observation.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/shoulder-observation` &nbsp;|&nbsp; 44 codes

Defines observation-type codes for shoulder-specific clinical measurements that have no suitable verified LOINC or SNOMED CT code at the needed granularity. Some shoulder observation types instead fix `Observation.code` to a verified external concept and do not appear here: the six active and passive LOINC-coded ROM movements (flexion, abduction, external rotation), smoking status (LOINC), smoking pack-years (SNOMED), employment status (LOINC), patient satisfaction (LOINC), the Constant-Murley total (SNOMED `273383002`), hand dominance (SNOMED Handedness), deformity (SNOMED Acquired deformity of shoulder), and the Jobe and Lift-off provocation tests (SNOMED procedure concepts).

| Code | Display | Category |
|------|---------|----------|
| `patte-classification` | Patte Classification | Imaging classification |
| `goutallier-classification` | Goutallier Classification | Imaging classification |
| `tendons-involved` | Tendons Involved | Imaging classification |
| `tear-location` | Tear Location | Imaging classification |
| `tear-thickness` | Tear Thickness | Imaging classification |
| `internal-rotation` | Internal Rotation (at side, active) | Range of motion |
| `passive-internal-rotation` | Internal Rotation (at side, passive) | Range of motion |
| `external-rotation-90-abduction` | External Rotation at 90° Abduction (active) | Range of motion |
| `passive-external-rotation-90-abduction` | External Rotation at 90° Abduction (passive) | Range of motion |
| `internal-rotation-90-abduction` | Internal Rotation at 90° Abduction (active) | Range of motion |
| `passive-internal-rotation-90-abduction` | Internal Rotation at 90° Abduction (passive) | Range of motion |
| `supraspinatus-strength` | Supraspinatus Strength | Strength testing |
| `external-rotation-strength` | External Rotation Strength (Composite: Infraspinatus + Teres Minor) | Strength testing |
| `subscapularis-strength` | Subscapularis Strength | Strength testing |
| `supraspinatus-strength-dynamometry` | Supraspinatus Strength (Dynamometry) | Strength testing |
| `internal-rotation-strength` | Internal Rotation Strength (Composite) | Strength testing |
| `belly-press-test` | Belly Press Test | Provocation test |
| `bear-hug-test` | Bear Hug Test | Provocation test |
| `hornblower-test` | Hornblower Test (Signe du Clairon) | Provocation test |
| `tear-size` | Tear Size | Tear morphology |
| `tear-size-classification` | Tear Size Classification (Cofield) | Tear morphology |
| `constant-score-pain` | Constant-Murley: Pain (0-15) | PROM sub-component |
| `constant-score-adl` | Constant-Murley: Activities of Daily Living (0-20) | PROM sub-component |
| `constant-score-rom` | Constant-Murley: Range of Motion (0-40) | PROM sub-component |
| `constant-score-strength` | Constant-Murley: Strength (0-25) | PROM sub-component |
| `ssv-score` | Subjective Shoulder Value | PROM |
| `sane-score` | SANE Score | PROM |
| `pain-average` | Pain Severity — On Average | Pain (patient history) |
| `pain-active-movement` | Pain Severity — With Active Movement | Pain (patient history) |
| `pain-passive-movement` | Pain Severity — With Passive Movement | Pain (patient history) |
| `pain-rest` | Pain Severity — At Rest | Pain (patient history) |
| `sports-participation` | Sports Participation | Patient history |
| `sleep-disturbance` | Sleep Disturbance | Patient history |
| `occupational-physical-demand` | Occupational Physical Demand | Patient history |
| `occupational-overhead-exposure` | Occupational Overhead Exposure | Patient history |
| `functional-limitation-severity` | Functional Limitation Severity | Patient history |
| `prior-physical-therapy-session-count` | Prior Physical Therapy Session Count | Patient history |
| `prior-injection-count` | Prior Shoulder Injection Count | Patient history |
| `return-to-sport-work` | Return to Sport/Work | Follow-up |
| `atrophy` | Atrophy | Visual inspection |
| `normal-shoulder-contour` | Normal Shoulder Contour | Visual inspection |
| `procedure-approach` | Procedure Approach | Procedure technique |
| `reconstruction-extent` | Reconstruction Extent | Procedure technique |
| `fixation-technique` | Fixation Technique | Procedure technique |

Codes whose observation returns a coded answer carry `value[x]` bound to a ValueSet documented below. Most bind an axis-specific ValueSet, so each clinical axis keeps its own value space; the exceptions are the deliberately shared result scales, `PositiveNegative` for the provocation tests and `PresentAbsent` for the visual-inspection findings. The remaining codes are quantitative (range-of-motion angles, strength grades, pain scores, tear size in centimetres, PROM totals) and constrain `value[x]` to a `Quantity` with a UCUM unit instead of a ValueSet.

### SleepDisturbanceSeverityCodes

[CodeSystem](CodeSystem-sleep-disturbance-severity.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/sleep-disturbance-severity`

A 3-tier ordinal for how much the shoulder pathology disturbs sleep, matching the Constant-Murley score's own ADL sleep sub-item. No SNOMED CT or LOINC concept exists for a graded, shoulder-attributed sleep-disturbance axis.

| Code | Display |
|------|---------|
| `unaffected` | Unaffected |
| `occasional` | Occasionally disturbed |
| `nightly` | Nightly disturbed |

### SportsParticipationLevelCodes

[CodeSystem](CodeSystem-sports-participation-level.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/sports-participation-level`

A 4-tier pre-treatment sports-participation ordinal. No suitable LOINC or SNOMED CT ordinal value codes exist for this axis.

| Code | Display |
|------|---------|
| `none` | Does not participate in sport |
| `recreational` | Recreational / leisure sport |
| `competitive` | Competitive / organized sport |
| `professional` | Professional / elite sport |

### EmploymentStatusSupplement

[CodeSystem](CodeSystem-employment-status-supplement.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/employment-status-supplement`

A single local code that supplements LOINC's answer list `LL1901-9` for employment status (`67875-5`), which has no "self-employed" option.

| Code | Display |
|------|---------|
| `self-employed` | Self-employed |

### OccupationalPhysicalDemandCodes

[CodeSystem](CodeSystem-occupational-physical-demand.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/occupational-physical-demand`

Physical demand intensity of the patient's occupation. No SNOMED CT or LOINC concept exists for this axis.

| Code | Display |
|------|---------|
| `sedentary` | Sedentary / desk-based work |
| `light-manual` | Light manual work |
| `heavy-manual` | Heavy manual work |

### OccupationalOverheadExposureCodes

[CodeSystem](CodeSystem-occupational-overhead-exposure.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/occupational-overhead-exposure`

Whether the patient's occupation regularly involves overhead reaching or repetitive shoulder-loading, an axis independent of physical-demand intensity.

| Code | Display |
|------|---------|
| `yes` | Regular overhead work |
| `no` | No regular overhead work |
| `unknown` | Unknown |

### InternalRotationVertebralLevelCodes

[CodeSystem](CodeSystem-internal-rotation-vertebral-level.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/internal-rotation-vertebral-level`

At-side internal rotation is not recorded in degrees. This 8-tier "hand behind back" functional reach ladder is the standard clinical convention. No pre-coordinated SNOMED CT or LOINC ordinal value codes exist for this axis.

| Code | Display |
|------|---------|
| `unable` | Unable to reach behind back |
| `greater-trochanter` | Greater trochanter (lateral thigh) |
| `buttock` | Buttock |
| `sacrum` | Sacrum |
| `l5` | L5 (belt line) |
| `l3` | L3 (waist) |
| `t12` | T12 (thoracolumbar junction) |
| `t7-or-above` | T7 or above (inferior scapular angle / interscapular) |

### PriorInjectionCountCodes

[CodeSystem](CodeSystem-prior-injection-count.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/prior-injection-count`

Bucketed count of prior shoulder injections (Q1.f, prior treatment). No SNOMED CT or LOINC concept exists for this axis.

| Code | Display |
|------|---------|
| `1-3` | 1 to 3 injections |
| `gt-3` | More than 3 injections |

### PriorPhysicalTherapySessionCountCodes

[CodeSystem](CodeSystem-prior-physical-therapy-session-count.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/prior-physical-therapy-session-count`

Bucketed count of prior physical-therapy sessions (Q1.f, prior treatment). No SNOMED CT or LOINC concept exists for this axis.

| Code | Display |
|------|---------|
| `le-10` | 10 sessions or fewer |
| `11-20` | 11 to 20 sessions |
| `gt-20` | More than 20 sessions |

### FunctionalLimitationSeverityCodes

[CodeSystem](CodeSystem-functional-limitation-severity.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/functional-limitation-severity`

A 5-tier functional-ceiling ordinal for Q1.n. No SNOMED CT or LOINC concept exists for this axis.

| Code | Display |
|------|---------|
| `no-limitation` | No functional limitation |
| `overhead-limitation` | Overhead activity limited |
| `shoulder-level-limitation` | At-shoulder-level activity limited |
| `below-shoulder-limitation` | Below-shoulder-level activity limited |
| `unable-to-use-arm` | Unable to use the arm functionally |

### TearLocationCodes

[CodeSystem](CodeSystem-tear-location.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/tear-location`

Location of the tear along the affected tendon's course. It is distinct from Patte classification, which grades how far the torn stump has retracted, not where the tear originates. No SNOMED CT or LOINC concept exists for this axis.

| Code | Display |
|------|---------|
| `insertion-near` | Near the insertion (footprint) |
| `musculotendinous` | Musculotendinous junction |
| `intratendinous` | Intratendinous (mid-substance) |

### ProcedureApproachCodes

[CodeSystem](CodeSystem-procedure-approach.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/procedure-approach` &nbsp;|&nbsp; Operational layer (procedure technique, not a consensus element)

Surgical approach, kept separate from `Procedure.code` in a post-coordination style. No SNOMED concept exists for a standalone "arthroscopic approach" qualifier.

| Code | Display |
|------|---------|
| `arthroscopic` | Arthroscopic |
| `open` | Open |
| `mini-open` | Mini-open |

### FixationTechniqueCodes

[CodeSystem](CodeSystem-fixation-technique.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/fixation-technique` &nbsp;|&nbsp; Operational layer (procedure technique, not a consensus element)

Suture-anchor fixation construct. Fully local; no SNOMED concept exists for this axis.

| Code | Display |
|------|---------|
| `single-row` | Single-row fixation |
| `double-row` | Double-row fixation |
| `suture-bridge` | Suture-bridge / transosseous-equivalent fixation |
| `transosseous-no-anchor` | Transosseous repair without anchors |
| `not-applicable` | Not applicable |

### GoutallierClassificationCodes

[CodeSystem](CodeSystem-goutallier-classification.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/goutallier-classification`

The **Goutallier classification** grades fatty infiltration of the rotator cuff muscles on CT or MRI, first described by Goutallier et al. (1994). It is a standard grading system in DVSE and SECEC registries. No pre-coordinated SNOMED CT or LOINC code exists for individual Goutallier grades at the needed granularity.

| Code | Display |
|------|---------|
| `0` | Grade 0 – Normal muscle |
| `1` | Grade 1 – Some fatty streaks |
| `2` | Grade 2 – More muscle than fat |
| `3` | Grade 3 – Equal amounts of fat and muscle |
| `4` | Grade 4 – More fat than muscle |

### PatteClassificationCodes

[CodeSystem](CodeSystem-patte-classification.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/patte-classification`

The **Patte classification** stages supraspinatus tendon retraction on MRI, described by Patte (1990). Retraction stage influences surgical repairability and expected outcome. No pre-coordinated SNOMED CT code exists for individual Patte stages.

| Code | Display |
|------|---------|
| `I` | Stage I - Retracted tendon end at the bony insertion |
| `II` | Stage II - Retracted tendon end at the humeral head |
| `III` | Stage III - Retracted tendon end at the glenoid |

### ReturnToActivityCodes

[CodeSystem](CodeSystem-return-to-activity.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/return-to-activity`

Return-to-sport or return-to-work status after rotator cuff surgery, as a 3-value coded set. No SNOMED CT pre-coordinated concept covers this combination as a coded outcome for registry reporting.

| Code | Display |
|------|---------|
| `returned-full` | Returned to Full Activities |
| `returned-modified` | Returned to Modified Activities |
| `not-returned` | Not Returned |

### CofieldTearSizeClassificationCodes

[CodeSystem](CodeSystem-cofield-tear-size-classification.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/cofield-tear-size-classification`

The **Cofield classification** is a categorical scale for rotator cuff tear size in the shoulder surgery literature (DeOrio and Cofield 1984). It buckets the continuous maximum tear diameter (also captured as `TearSizeObservation` in cm) into four categories. No pre-coordinated SNOMED CT or LOINC code exists at the bucket granularity.

| Code | Display | Description |
|------|---------|-------------|
| `small` | Small tear (<1 cm) | <1 cm maximum tear diameter |
| `medium` | Medium tear (1–3 cm) | 1–3 cm maximum tear diameter |
| `large` | Large tear (3–5 cm) | 3–5 cm maximum tear diameter |
| `massive` | Massive tear (>5 cm) | >5 cm maximum tear diameter |

### ShoulderEtiology

[CodeSystem](CodeSystem-shoulder-etiology.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/shoulder-etiology`

One local code (`acute-on-chronic`) for a combined traumatic and degenerative etiology. The other three etiology codes in `RotatorCuffEtiology` come from SNOMED CT directly (`773760007` Traumatic event, `362975008` Degenerative disorder, `54690008` Unknown origin). SNOMED `255212004 Acute-on-chronic` is a qualifier-value concept and is semantically wrong in the cause-of-condition slot, so a local code is used instead.

| Code | Display | Description |
|------|---------|-------------|
| `acute-on-chronic` | Acute-on-chronic (mixed) etiology | Degenerative tear extended by a discrete traumatic event |

### Q11TimepointCodes

[CodeSystem](CodeSystem-q11-timepoint.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/q11-timepoint`

Discriminator for which of the five expert consensus Q11.a–e research follow-up timepoints a planned visit represents. Carried on `RotatorCuffResearchCarePlan.activity.detail.code`, so the schedule is queryable without parsing the free-text `description`. No LOINC or SNOMED CT concept enumerates a study's own follow-up schedule.

| Code | Display | Description |
|------|---------|-------------|
| `6-weeks` | 6 Weeks | Expert consensus Q11.a — 6 weeks post-surgery |
| `3-months` | 3 Months | Expert consensus Q11.b — 3 months post-surgery |
| `6-months` | 6 Months | Expert consensus Q11.c — 6 months post-surgery |
| `1-year` | 1 Year | Expert consensus Q11.d — 1 year post-surgery |
| `2-years` | 2 Years | Expert consensus Q11.e — 2 years post-surgery |

### ConstantCalculatorInputCodes

[CodeSystem](CodeSystem-constant-calculator-input.html) &nbsp;|&nbsp; Canonical: `https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/constant-calculator-input` &nbsp;|&nbsp; 17 codes

The answer categories a Constant-Murley worksheet question offers. The form turns a chosen category into that question's points. What is extracted is the numeric sub-score on `ConstantScoreObservation.component`, so no code from here reaches a stored Observation. The four ordinal codes (`none`, `mild`, `moderate`, `severe`) take their axis from the question that asks them. Three more (`unaffected`, `occasional`, `nightly`) carry the sleep axis the worksheet words separately. The remaining ten name a height the hand reaches, or a posture it reaches it in. The registration and follow-up Questionnaires use them on the Constant-Murley sub-score questions.

## ValueSets

### ShoulderObservationCode

[ValueSet](ValueSet-shoulder-observation-code.html): includes all codes from `ShoulderObservationCodes`, plus the LOINC and SNOMED CT concepts the derived profiles fix on `Observation.code`. Bound on `Observation.code` in `ShoulderObservation`. Binding strength: **extensible**.

### ShoulderLaterality

[ValueSet](ValueSet-shoulder-laterality.html): SNOMED CT codes for the left (`91775009`) and right (`91774008`) shoulder region. Used in `Condition.bodySite` and `Procedure.bodySite` for laterality. Binding strength: **required**.

### TendonsInvolved

[ValueSet](ValueSet-tendons-involved.html): SNOMED CT codes for individual rotator cuff tendon structures: supraspinatus (`5580002`), infraspinatus (`59713001`), subscapularis (`80108009`), teres minor (`700027005`). Bound on `TendonsInvolvedObservation.valueCodeableConcept`. One Observation per affected tendon, linked from the index Condition through `evidence.detail`. Binding strength: **extensible**.

### RotatorCuffDiagnosis

[ValueSet](ValueSet-rotator-cuff-diagnosis.html): the single SNOMED CT inclusion diagnosis (`926335004` Rupture of rotator cuff of shoulder). `RotatorCuffCondition.code` pins this concept as a pattern rather than binding the ValueSet, so a deploying registry may add further `coding[]` siblings (for example an ICD-10-GM code) on the same `CodeableConcept`. The ValueSet publishes the inclusion criterion in machine-readable form.

### RotatorCuffProcedureType

[ValueSet](ValueSet-rotator-cuff-procedure-type.html): SNOMED CT codes for rotator cuff surgical procedures (arthroscopic, open, complete, partial and revision repair), the concomitant procedures commonly performed alongside them (debridement, acromioplasty, subacromial decompression, biceps tenodesis, distal clavicle excision, anatomic and reverse arthroplasty), and the two prior non-surgical treatment types (physical therapy, injection) that share this profile. Used in `RotatorCuffProcedure.code`. Binding strength: **extensible** (tighter than the preferred binding inherited from `procedure-eu-core`).

### PositiveNegative

[ValueSet](ValueSet-positive-negative.html): two SNOMED CT codes: positive (`10828004`) and negative (`260385009`). Used in all provocation-test Observation profiles (`valueCodeableConcept`). Binding strength: **required**.

### GoutallierClassification

[ValueSet](ValueSet-goutallier-classification.html): all grades from `GoutallierClassificationCodes`. Used in `GoutallierObservation.valueCodeableConcept`. Binding strength: **required**.

### PatteClassification

[ValueSet](ValueSet-patte-classification.html): all stages from `PatteClassificationCodes`. Used in `PatteObservation.valueCodeableConcept`. Binding strength: **required**.

### SatisfactionScale

[ValueSet](ValueSet-satisfaction-scale.html): LOINC answer list `LL4543-6`, a 5-point satisfaction scale (`LA27750-1` Not at all satisfied, `LA24976-5` Mostly dissatisfied, `LA27752-7` Somewhat satisfied, `LA24974-0` Mostly satisfied, `LA27754-3` Completely satisfied). Used in `PatientSatisfactionObservation.valueCodeableConcept` where `Observation.code` = LOINC `77218-6`. Binding strength: **required**.

### ReturnToActivity

[ValueSet](ValueSet-return-to-activity.html): all codes from `ReturnToActivityCodes`. Used in `ReturnToActivityObservation.valueCodeableConcept`. Binding strength: **required**.

### HandDominance

[ValueSet](ValueSet-hand-dominance.html): SNOMED CT codes for handedness: right-handed (`46669005`), left-handed (`87683000`), ambidextrous (`23088002`), and an explicit Unknown (`261665006`). Used in `HandDominanceObservation.valueCodeableConcept`. Binding strength: **required**.

### Smoking status: IPS reuse (no local ValueSet)

`SmokingStatusObservation.valueCodeableConcept` is **extensible**-bound to the IPS 1.1.0 ValueSet [`current-smoking-status-uv-ips`](http://hl7.org/fhir/uv/ips/ValueSet-current-smoking-status-uv-ips.html), which IPS publishes as 8 LOINC answer-list (`LA*`) codes: `LA18976-3` Current every day smoker, `LA18977-1` Current some day smoker, `LA15920-4` Former smoker, `LA18978-9` Never smoker, `LA18979-7` Smoker current status unknown, `LA18980-5` Unknown if ever smoked, `LA18981-3` Heavy tobacco smoker, `LA18982-1` Light tobacco smoker. The IPS `loinc-smoking-status-to-snomed-ct-uv-ips` ConceptMap is available for downstream exporters that need SNOMED. The IPS ValueSet is reused directly, so no local smoking-status ValueSet is defined.

### ShoulderEncounterType

[ValueSet](ValueSet-shoulder-encounter-type.html): SNOMED CT codes for shoulder encounter types across all three bundle contexts: `185349003` (Encounter for check up) for the pre-operative registration consultation, `390906007` (Follow-up encounter) for routine post-operative visits (Q10), and `308335008` (Patient encounter procedure) for the surgical admission (T1). Used in `ShoulderEncounter.type`. Binding strength: **extensible**.

### ImagingModality

[ValueSet](ValueSet-imaging-modality.html): DICOM acquisition-modality codes for shoulder imaging: `DX` (radiograph, Q3), `MR`, `CT`, and `US` (the advanced-imaging choice, Q5/Q6, with ultrasound for the Q7 recording pattern). Used on `ShoulderImagingStudy.modality`. A patient can have both a radiograph and an advanced study. Binding strength: **extensible**.

### RotatorCuffProcedureCategory

[ValueSet](ValueSet-rotator-cuff-procedure-category.html): SNOMED CT high-level procedure-category codes used in `RotatorCuffProcedure.category` to distinguish surgical from prior non-surgical interventions (physical therapy, injection). Binding strength: **extensible**.

### CofieldTearSizeClassification

[ValueSet](ValueSet-cofield-tear-size-classification.html): all four buckets from `CofieldTearSizeClassificationCodes` (small, medium, large, massive). Used in `TearSizeClassificationObservation.valueCodeableConcept`, the categorical complement to the continuous `TearSizeObservation` in cm (Q4.a). Binding strength: **required**.

### RotatorCuffEtiology

[ValueSet](ValueSet-rotator-cuff-etiology.html): four mutually exclusive etiology codes: SNOMED `773760007` Traumatic event, SNOMED `362975008` Degenerative disorder, local `ShoulderEtiology#acute-on-chronic` (mixed), SNOMED `54690008` Unknown origin. Used in `RotatorCuffCondition.extension[condition-dueTo].valueCodeableConcept` (1..1 required) for Q1.e. Binding strength: **required**.

### EmploymentStatus

[ValueSet](ValueSet-employment-status.html): LOINC's answer list `LL1901-9` for `67875-5` "Employment status - current", plus one local addition (`EmploymentStatusSupplement#self-employed`) that the list is missing. Used in `EmploymentStatusObservation.valueCodeableConcept`. Binding strength: **required**.

### OccupationalPhysicalDemand / OccupationalOverheadExposure

[OccupationalPhysicalDemand](ValueSet-occupational-physical-demand.html) and [OccupationalOverheadExposure](ValueSet-occupational-overhead-exposure.html): two independent local occupation axes for Q1.k: physical-demand intensity (sedentary, light-manual, heavy-manual) and overhead-work exposure (yes, no, unknown). Used in `OccupationalPhysicalDemandObservation` and `OccupationalOverheadExposureObservation.valueCodeableConcept`. Binding strength: **required**.

### SleepDisturbanceSeverity

[ValueSet](ValueSet-sleep-disturbance-severity.html): all codes from `SleepDisturbanceSeverityCodes`. Used in `SleepDisturbanceObservation.valueCodeableConcept` (Q1.i). Binding strength: **required**.

### SportsParticipationLevel

[ValueSet](ValueSet-sports-participation-level.html): all codes from `SportsParticipationLevelCodes`. Used in `SportsParticipationObservation.valueCodeableConcept` (Q1.j). Binding strength: **required**.

### FunctionalLimitationSeverity

[ValueSet](ValueSet-functional-limitation-severity.html): all codes from `FunctionalLimitationSeverityCodes`. Used in `FunctionalLimitationsObservation.valueCodeableConcept` (Q1.n). Binding strength: **required**.

### InternalRotationVertebralLevel

[ValueSet](ValueSet-internal-rotation-vertebral-level.html): all codes from `InternalRotationVertebralLevelCodes`. Used in `ShoulderInternalRotationObservation` and `ShoulderPassiveInternalRotationObservation.valueCodeableConcept` (Q2.c, Q9.c, at-side internal rotation). Binding strength: **required**.

### PriorInjectionCount / PriorPhysicalTherapySessionCount

[PriorInjectionCount](ValueSet-prior-injection-count.html) and [PriorPhysicalTherapySessionCount](ValueSet-prior-physical-therapy-session-count.html): bucketed counts for Q1.f prior treatment. Used in `PriorInjectionCountObservation` and `PriorPhysicalTherapySessionCountObservation.valueCodeableConcept`. Binding strength: **required**.

### PriorTreatmentCategory

[ValueSet](ValueSet-prior-treatment-category.html): SNOMED CT category codes for Q1.f (`91251008` Physical therapy procedure, `18629005` Administration of medication). Required binding on `RotatorCuffRegistrationBundle.entry[priorTreatment].resource.category`, which keeps surgical procedures out of the Registration bundle's prior-treatment slice.

### PresentAbsent

[ValueSet](ValueSet-present-absent.html): two SNOMED CT qualifier codes: Present (`52101004`), Absent (`2667000`). Used in `AtrophyObservation`, `DeformityObservation`, and `NormalShoulderContourObservation.valueCodeableConcept` (Q2.a, Q9.a, visual inspection). Binding strength: **required**.

### TearLocation / TearThickness

[TearLocation](ValueSet-tear-location.html) and [TearThickness](ValueSet-tear-thickness.html): `TearLocation` uses local codes from `TearLocationCodes`. `TearThickness` uses two pre-coordinated SNOMED disorder-level concepts (`202843000` Full thickness rotator cuff tear, `202842005` Partial thickness rotator cuff tear) as Observation values. Used in `TearLocationObservation` and `TearThicknessObservation.valueCodeableConcept` (Q4 tear-classification sub-axes). Binding strength: **required**.

### ProcedureApproach / ReconstructionExtent / FixationTechnique

[ProcedureApproach](ValueSet-procedure-approach.html), [ReconstructionExtent](ValueSet-reconstruction-extent.html) and [FixationTechnique](ValueSet-fixation-technique.html): operational procedure-technique axes (not consensus elements). `ProcedureApproach` and `FixationTechnique` use local codes. `ReconstructionExtent` uses pre-coordinated SNOMED concepts (`304385007` Partial repair of rotator cuff, `304384006` Complete repair of rotator cuff, plus two arthroplasty concepts). Used in `ProcedureApproachObservation`, `ReconstructionExtentObservation`, and `FixationTechniqueObservation.valueCodeableConcept`, each linked to its `RotatorCuffProcedure` through `Observation.partOf`. Binding strength: **required**.

### ShoulderDiagnosis

[ValueSet](ValueSet-shoulder-diagnosis.html): SNOMED CT codes for shoulder pathology that commonly coexists with a rotator cuff tear but is distinct from it (long head of biceps pathology, AC joint osteoarthritis, glenoid labrum tear, adhesive capsulitis, glenohumeral osteoarthritis, shoulder instability). Not a consensus-named element. Used on `ShoulderDiagnosisCondition.code`, the non-rotator-cuff secondary diagnosis profile. Binding strength: **extensible**.

### Q11Timepoint

[ValueSet](ValueSet-q11-timepoint.html): all codes from `Q11TimepointCodes`, the five research follow-up timepoints. Bound to `RotatorCuffResearchCarePlan.activity.detail.code`. Binding strength: **required**.

### PriorNonSurgicalTreatmentType

[ValueSet](ValueSet-prior-non-surgical-treatment-type.html): SNOMED CT codes for prior non-surgical shoulder treatment (`91251008` Physical therapy procedure, `27813003` Intra-articular injection, `290035003` Injection into shoulder joint) — the non-surgical subset of `RotatorCuffProcedureType`, covering consensus Q1.f. It binds the Registration Questionnaire's `priorTreatment.type` item so the form cannot offer a surgical procedure code in answer to a prior-non-surgical-treatment question. The item names its answer list through `answerValueSet`, which carries no binding strength.
