// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffRegistrationBundle Profile                                     │
// │  Transaction bundle wrapping the pre-operative (T0) registry submission    │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Alias: $V3_ACT_CODE = http://terminology.hl7.org/CodeSystem/v3-ActCode

Profile: RotatorCuffRegistrationBundle
Parent: Bundle
Id: rotator-cuff-registration-bundle
Title: "Rotator Cuff Registration Bundle"
Description: """
Transaction bundle defining the pre-operative submission for a patient entering
a rotator cuff surgery research registry. This is the first of three named
submissions per patient (Registration → Surgery → Follow-Up×N), corresponding
to the pre-operative phase implied by Hurley et al. (2024): patient history
(Q1), pre-op physical examination (Q2), classification (Q4), imaging
(Q3 / Q5 / Q6, plus optional ultrasound), recorded as which modality was
obtained (`ImagingStudy.modality`), one `ImagingStudy` per modality, prior
non-surgical treatments (expert consensus Q1.f, PT / injection) and baseline
PROMs (Q8). The Q11 research follow-up schedule is carried by
RotatorCuffSurgeryBundle, because it is computed from the surgery date.

The bundle establishes the patient context that subsequent submissions
(RotatorCuffSurgeryBundle, RotatorCuffFollowUpBundle) reference by persisted
ID. It MUST NOT contain the surgical procedure, that belongs in
RotatorCuffSurgeryBundle. The `priorTreatment` slice is bound to
`PriorTreatmentCategory` so the validator rejects any surgical-category
Procedure entry in this bundle.

A `ShoulderEncounter` is **required (1..1)** as the registration consultation
visit. It serves as the cross-resource anchor: every Observation
in the bundle sets `Observation.encounter → Encounter`, and every prior
treatment Procedure sets `Procedure.encounter → Encounter` and
`Procedure.reasonReference → Condition`. Imaging-derived classification
observations (Goutallier, Patte, tear size) additionally populate
`Condition.evidence.detail`. This matches the Encounter-as-anchor pattern
already used by `RotatorCuffSurgeryBundle` and `RotatorCuffFollowUpBundle`.

The bundle still enforces the rotator-cuff pathology binding via the
`condition` slice (`only RotatorCuffCondition`) even though
`ShoulderEncounter.reasonReference` was relaxed to `Reference(Condition)`. The
composition guarantee that `Encounter.reasonReference` resolves to a
`RotatorCuffCondition` holds because that Condition is the only one allowed in
the bundle's Condition slice.

**Multiple diagnoses (`condition 1..*`, `otherDiagnosis 0..*`):** a
registration may carry more than one `RotatorCuffCondition` (e.g. a combined
supraspinatus + infraspinatus tear coded as two Conditions) and, separately,
zero or more coexisting non-rotator-cuff shoulder diagnoses
(`ShoulderDiagnosisCondition`, AC joint arthritis, biceps tendinopathy,
adhesive capsulitis, etc.) via `otherDiagnosis`. Which single Condition is
the principal reason for the visit is recorded on
`ShoulderEncounter.diagnosis.rank` (`1` = principal); `reasonReference`
continues to point at that same principal Condition, and the pathology
binding is still enforced structurally by the `condition` slice type
constraint regardless of how many entries it holds.

**One patient, one shoulder per registration.** Every Condition in a given
registration bundle, RC or non-RC, MUST carry the same `bodySite`
laterality. A registration entry is always scoped to one patient and one
shoulder side; a bilateral case is submitted as two separate registrations,
one per side.

Slicing follows the IPS two-discriminator pattern (resource type + profile)
inherited from BundleUvIps.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-registration-bundle"
* ^version = "0.5.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-13"

// ── Bundle type ───────────────────────────────────────────────────────────────
* type = #transaction (exactly)

// ── Entry fullUrl required (needed for urn:uuid cross-references) ─────────────
* entry.fullUrl 1..

// ── Entry slicing ─────────────────────────────────────────────────────────────
// Two discriminators (IPS pattern): first by FHIR resource type, then by profile.
* entry ^slicing.discriminator[0].type = #type
* entry ^slicing.discriminator[=].path = "resource"
* entry ^slicing.discriminator[+].type = #profile
* entry ^slicing.discriminator[=].path = "resource"
* entry ^slicing.rules = #open
* entry ^short = "Entry resources in the pre-operative registration submission"
* entry contains
    patient               1..1 and
    encounter             1..1 and
    condition             1..* and
    otherDiagnosis        0..* and
    comorbidity           0..* and
    priorTreatment        0..* and
    observation           0..* and
    imagingStudy          0..* and
    coverage              0..1 and
    questionnaireResponse 0..*

// ── Slice constraints ─────────────────────────────────────────────────────────
* entry[patient].resource 1..
* entry[patient].resource only ShoulderPatient

* entry[encounter].resource 1..
* entry[encounter].resource only ShoulderEncounter
// ShoulderEncounter.class is deliberately left open at the profile level
// (Surgery genuinely varies by case, ADR-0124) -- but a registration
// consultation visit is always ambulatory, so it's fixed here, at the bundle
// level, instead. See ADR-0126.
* entry[encounter].resource.class = $V3_ACT_CODE#AMB "ambulatory"

* entry[condition].resource 1..
* entry[condition].resource only RotatorCuffCondition

// otherDiagnosis: coexisting NON-rotator-cuff shoulder pathology on the SAME
// shoulder (e.g. AC joint arthritis, biceps tendinopathy, adhesive
// capsulitis), distinct from the rotator-cuff diagnosis carried in the
// `condition` slice above. See ShoulderDiagnosisCondition. Which diagnosis
// (RC or non-RC) is the visit's principal reason is recorded on
// `ShoulderEncounter.diagnosis.rank`, not by slice membership.
* entry[otherDiagnosis].resource 1..
* entry[otherDiagnosis].resource only ShoulderDiagnosisCondition

// comorbidity: expert consensus Q1.c, pre-existing problem-list conditions (e.g. hypertension,
// diabetes) coexisting with the rotator-cuff diagnosis. Distinct from the index
// RotatorCuffCondition by category (problem-list-item vs encounter-diagnosis) and
// by code binding (IPS ProblemsUvIps extensible vs the fixed inclusion-diagnosis
// pattern on RotatorCuffCondition.code).
// See ADR-0055.
* entry[comorbidity].resource 1..
* entry[comorbidity].resource only ShoulderComorbidityCondition

// priorTreatment: expert consensus Q1.f, prior PT (physical therapy) and prior injection (intra-articular /
// shoulder-joint injections). Surgical procedures are excluded by the required
// binding on `category`, they belong in RotatorCuffSurgeryBundle.
* entry[priorTreatment].resource 1..
* entry[priorTreatment].resource only RotatorCuffProcedure
* entry[priorTreatment].resource.category from PriorTreatmentCategory (required)

* entry[observation].resource 1..
* entry[observation].resource only ShoulderObservation

// imagingStudy: one ShoulderImagingStudy per modality obtained (radiograph,
// MRI, CT, ultrasound), expert consensus Q3 / Q5 / Q6 / Q7. The registry-capturable
// fact is which modality was used, not a radiology report or an imaging order
// (neither of which the consensus names, and neither of which a data-entry
// registry produces). Imaging-derived classifications (Goutallier, Patte, tear
// size, tendons involved, tear location) are carried as ShoulderObservation
// entries linked into Condition.stage.assessment / Condition.evidence.detail.
* entry[imagingStudy].resource 1..
* entry[imagingStudy].resource only ShoulderImagingStudy

// carePlan (Q11 research follow-up schedule) moved to
// RotatorCuffSurgeryBundle, its period/activities can only be computed
// from the surgery date, which is not yet known at registration. See
// ADR-0129.

* entry[coverage].resource 1..
* entry[coverage].resource only ShoulderCoverage

* entry[questionnaireResponse].resource 1..
* entry[questionnaireResponse].resource only RotatorCuffQuestionnaireResponse
