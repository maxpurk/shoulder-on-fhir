# ADR-0172: Remove the seed-only imaging report/order profiles; imaging is `ImagingStudy` (modality + date) + findings on `Condition`

**Date:** 2026-08-21
**Status:** Accepted
**Supersedes:** the "keep as optional" stance of ADR-0130 (§Decision 4) for `RotatorCuffServiceRequest`/`ShoulderDiagnosticReport`; retires the profile created by ADR-0029
**Relates to:** ADR-0130 (Q5/Q6 realisation, minimal `ImagingStudy`), ADR-0155 (Q3 radiograph via multi-select modality), ADR-0104 (imaging vs. intra-op tear-size split, unchanged), ADR-0073 (Observation→Condition linkage), ADR-0170 (same "seed-only is not a real property of the system" principle, resolved by propagating to the frontends)

> **Status update (2026-08-25, ADR-0178):** the per-element Full/Partial "coverage status" this ADR's figures use was replaced by a two-facet code/value **terminology-provenance** axis. Representability (0 Missing) and the two-layer accounting are unchanged; only the per-element status column changed. Body below otherwise unedited.

## Context

The IG defined three imaging resources: `ShoulderImagingStudy`, `ShoulderDiagnosticReport`
(radiology report), and `RotatorCuffServiceRequest` (imaging order). A review of how imaging is
actually handled end-to-end found:

1. **Two of the three profiles were seed-only.** Neither demonstrator frontend ever built a
   `DiagnosticReport` or a `ServiceRequest` (verified by grep: zero occurrences in `frontend/src`
   and `sdc-frontend/src`). They existed only as hand-authored content in the two longitudinal seed
   bundles — including a fabricated four-series DICOM block on Anna Müller's `ImagingStudy` (real
   SOP/series UIDs, `numberOfSeries`/`numberOfInstances`) that no data-entry frontend produces.
2. **The consensus names neither a report nor an order object.** Hurley et al. (2024) Q3/Q5/Q6/Q13
   are clinical-practice guidance about *obtaining* imaging ("a radiograph should be obtained",
   "advanced imaging when planning surgery", "MRI unless arthroplasty → CT", "no routine follow-up
   imaging except research") — not instructions to capture a radiology report or an imaging order as
   structured data. The registry-capturable fact is which modality was obtained.
3. **No real registry or peer IG carries them.** The surveyed shoulder/ortho registries (DART, EPRD,
   SEPR) store imaging as a modality flag plus coded findings — no report object, no order object,
   no image (the surveyed registry landscape material). mCODE — the closest FHIR analogue to an
   observational registry — defines no `ImagingStudy`, no imaging `DiagnosticReport`, and no
   `ServiceRequest`; imaging-derived findings are free-standing Observations with the diagnosis-basis
   on `Condition.evidence`, which is exactly the `Condition.evidence.detail` / `Condition.stage.assessment`
   pattern this IG already uses for Patte/Goutallier/tear-size/tendons-involved (ADR-0073).

This violates the project's own data-flow discipline: **consensus → interpretation → IG → frontend →
data created (= seed data)**. A resource that lives only in the seed or only in the IG, never emitted
by the data-creation flow, is a defect — the same class of gap ADR-0169/0170 closed for the IPS
`meta.profile[]` claims (there, resolved by propagating to the frontends; here, the consensus does
not ask for these objects at all, so the correct resolution is removal, not propagation). ADR-0130
kept the two profiles as "optional for real-world RIS/PACS deployments"; the user directed that the
artifact be clean end-to-end, with no seed-only or IG-only resources.

## Decision

- **Remove `ShoulderDiagnosticReport` and `RotatorCuffServiceRequest`** (`profiles/*.fsh`) and the
  now-orphaned `ShoulderImagingProcedure` ValueSet (its only role was the `RotatorCuffServiceRequest.code`
  binding).
- **Remove their bundle slices** from `RotatorCuffRegistrationBundle` (`diagnosticReport 0..1`,
  `serviceRequest 0..1` and their `entry[...].resource only ...` constraints).
- **Widen the `ImagingStudy` bundle slices `0..1` → `0..*`** in both `RotatorCuffRegistrationBundle`
  and `RotatorCuffFollowUpBundle` — one `ImagingStudy` per modality obtained (matches the ADR-0155
  multi-select). This also fixes a live defect where a two-modality registration (radiograph + MRI)
  failed validation with `Bundle.entry:imagingStudy: max allowed = 1, but found 2`.
- **Keep `ShoulderImagingStudy` lean and real:** `status` + `subject` + `modality` + `started`
  (Must-Support). Dropped the `series`/`series.*`/`procedureReference` Must-Support flags — no
  DICOM series/instance/procedure metadata is carried, because a data-entry registry does not
  produce it. Imaging is *when a modality was obtained*, not a PACS/DICOM record.
- **Both frontends emit one `ImagingStudy` per selected modality, with `started`.** The unified
  frontend already emitted one-per-modality; it gains `started` (from the encounter date, no new UI
  field). The SDC frontend, which emitted a single study carrying all modality codes, is changed to
  emit one study per modality for parity. Neither frontend builds a `DiagnosticReport` or
  `ServiceRequest` (they never did).
- **Slim the seed** so it equals frontend output: both registration bundles lose their
  `ServiceRequest` and `DiagnosticReport` entries and the fabricated DICOM series; each
  `ImagingStudy` is reduced to `status`/`subject`/`modality`/`started`, split one-per-modality.
- **The imaging-derived clinical findings are unchanged** — Goutallier, Patte, Cofield tear-size,
  tendons-involved, tear-thickness, tear-location remain `ShoulderObservation`s linked to the
  `RotatorCuffCondition` via `stage.assessment` / `evidence.detail` (ADR-0073). The imaging-vs-intra-op
  tear-size split (ADR-0104) is unchanged. **No consensus element's status changes.**

## Consequences

- ✅ Imaging is now straightforward end-to-end: consensus → IG (`ImagingStudy` modality fact +
  findings on `Condition`) → both frontends → seed, with no seed-only or IG-only resource.
- ✅ **Consensus coverage unchanged** — all 58 consensus elements remain representable (0 Missing). Q3/Q5/Q6/Q13 stay
  `Full`: a radiograph/MRI/CT/US being *obtained* is recorded by `ImagingStudy.modality`; no report
  object was ever needed for that claim.
- ◽ **Layer 2 (IG-operational) drops 45 → 44 rows** (43 Full + 1 Partial): the
  `RotatorCuffServiceRequest` row `L3.G.5` is retired. Category **G** subtotal 6 → 5. Mapping CSV/MD
  and both the project guides updated.
- ✅ A registration with both a radiograph and an advanced study now validates (the `0..1` cap that
  contradicted the ADR-0155 multi-select UI is fixed) — closes limitation item 0003.
- ✅ Resolves future-work item 0020 (capture a `DiagnosticReport` in the frontends) — mooted by
  removing the profile rather than wiring it.
- ◽ A real deployment integrating with a RIS/PACS that genuinely wants order/report tracking would
  re-introduce `ServiceRequest`/`DiagnosticReport` (both are standard FHIR resources); this IG scopes
  them out because the consensus does not name them and this artifact does not produce them. The
  imaging-vs-intra-op tear-size split (ADR-0104) is the honest, consensus-silent design choice that
  stays.
- ✅ `sushi .` 0 errors / 0 warnings after the deletions (profiles 73 → 71, ValueSets 36 → 35).

## Sources

- `ig/input/fsh/profiles/ShoulderImagingStudy.fsh` (lean profile)
- `ig/input/fsh/profiles/RotatorCuffRegistrationBundle.fsh`, `RotatorCuffFollowUpBundle.fsh` (slices)
- deleted: `ig/input/fsh/profiles/ShoulderDiagnosticReport.fsh`, `RotatorCuffServiceRequest.fsh`,
  `ig/input/fsh/valuesets/ShoulderImagingProcedure.fsh`
- `frontend/src/components/wizard/StepImaging.tsx`; `sdc-frontend/src/lib/extractor.ts` + `bundleAssembler.ts`
- `seed/bundles/{anna-mueller,kemal-demir}/*_01_registration.json`; `example_data/{anna_mueller,kemal_demir}_story.md`
- `mapping/SECEC_FHIR_Mapping.csv` (rows Q3/Q5/Q6/L3.G.1; L3.G.5 deleted) + `.md`
- ADR-0130 (superseded stance), ADR-0029 (retired profile), ADR-0155/0104/0073 (unchanged)
- the surveyed registry landscape material (DART/EPRD/SEPR imaging practice); mCODE (no imaging resources)
