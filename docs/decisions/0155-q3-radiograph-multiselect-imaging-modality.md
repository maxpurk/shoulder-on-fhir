# ADR-0155: Realise Q3 (radiograph) by widening the Q6 imaging-modality slot to a multi-select; fix a repeating-leaf data-loss bug in the SDC extractor found while building it

**Date:** 2026-08-05
**Status:** Accepted
**Found via:** `docs/limitations_items/` — "Q3 (radiographs) has the same never-instantiated-resource defect Q5/Q6 had," logged 2026-08-02 alongside the Q6 fix (ADR-0130) but deliberately left out of that ADR's scope.

## Context

ADR-0130 built `ImagingStudy.modality` for Q6 (which advanced-imaging modality — MRI or CT — was used) in both frontends, and explicitly deferred Q3 (a plain radiograph should be obtained in all suspected rotator-cuff-tear patients) as "the identical defect... left untouched here." Q3's mapping row is realised by the exact same resource shape as Q6 (`ImagingStudy` + optionally `DiagnosticReport`), and — like Q6 before ADR-0130 — neither frontend's write path ever produced one.

Unlike Q6, Q3 is not a *choice between* modalities — a plain radiograph and an advanced study are frequently **both** obtained for the same patient (radiograph first, MRI/CT if surgery is being considered), so simply adding `DX` as a third option to the existing single-select "Imaging Modality" dropdown would force an artificial either/or choice. The fix widens that dropdown to a multi-select instead, letting a submission record any combination of radiograph + advanced study as separate `ImagingStudy` entries.

## Decision

1. **`ImagingModality` ValueSet** (`^version` 0.1.0 → 0.2.0): add `DX` "Digital Radiography" (standard DICOM CID-29 acquisition-modality code) alongside the existing MR/CT/US, and reword the Description to describe the VS as feeding a multi-select.
2. **Unified frontend:** `ImagingFormData.imagingModality: string` → `imagingModalities: string[]`; `StepImaging.tsx`'s single `<select>` replaced with a checkbox group (mirroring the existing tendons-involved checkbox pattern in `StepCondition.tsx`); one `ImagingStudy` resource built per checked modality.
3. **SDC frontend:** `ShoulderRegistrationQuestionnaire.fsh`'s `imaging.modality` item (`item[6].item[0]`) gains `repeats = true`. `QuestionnaireForm.tsx` needed **no changes** — its generic `item.repeats && item.type === 'choice'` branch already renders a checkbox group (proven by the pre-existing `tendons-involved` item), confirming this is a genuinely reusable, already-generic rendering path, not something built new for this ADR.

## Bug found and fixed while building this: repeating leaves inside a resource-anchored extraction group silently lost every answer but the first

`buildResourceForExtractionGroup` (used for `itemExtractionContext` groups targeting a single resource — `condition`, `encounter`, and `imaging` among them) read only `answers[0]` for every leaf, unconditionally — there was no branch for `item.repeats` at all. Setting `imaging.modality.repeats = true` without also fixing this would have made the checkbox UI fully functional-looking while silently discarding every modality past the first one checked, a genuine data-loss bug (not a validation-visible one — the resulting `ImagingStudy` would just have one `Coding` in `modality` regardless of how many were checked). Root cause was two-layered:

1. **The call site** never iterated `leafQR.answer` beyond index 0.
2. **`assignByPath`'s array-typed single/two-segment branches** would have overwritten, not accumulated, even if the call site did loop — each call replaced `target[path]` with a fresh one-element array rather than appending.

Both are fixed generically, not with an `imaging`/`modality`-specific special case: `buildResourceForExtractionGroup` now loops over every answer for every leaf (a no-op-equivalent single iteration for the non-repeating leaves that make up the overwhelming majority of every group), and `assignByPath`'s array branches (both the 1-segment and 2-segment cases) now append to whatever is already at the target path instead of replacing it. This is the same class of fix `buildObservationsForPerLeafGroup` already had correctly in place for its own, structurally different, repeating-leaf case (`tendons-involved`, ADR-0064) — that function produces one *resource* per answer, so it never needed array-accumulation; `buildResourceForExtractionGroup`'s repeating leaves accumulate into one *element* of one resource instead, which is the shape that was missing.

This was caught by code review before any submission tested it, not by a live failure — no prior repeating leaf existed inside a resource-anchored group (`tendons-involved` is inside a *per-leaf* group, a different function), so the bug had zero prior exposure.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Add `DX` to the existing single-select dropdown, forcing a choice between radiograph and advanced imaging | Clinically wrong — both are frequently obtained for the same patient; a single-select would make recording both impossible. |
| A separate, dedicated "Radiograph obtained? Yes/No" boolean field, independent of the Q6 modality picker | Rejected — `ImagingStudy.modality` is already the FHIR-correct home for "which imaging happened" (ADR-0130's own conclusion); a parallel boolean field would duplicate that concept under a different shape for no benefit. |
| Leave `buildResourceForExtractionGroup`'s single-answer read as-is, and instead give `imaging.modality` its own hand-written special case in `extractor.ts` (matching the project's documented "loose leaf" pattern for Coverage/RSG/performer) | Rejected — those hand-written cases exist because their target elements have no `item.definition`-resolvable path at all (fixed status codes, no matching form field). `imaging.modality` has a perfectly good resolvable `item.definition`; the generic mechanism should handle it, and fixing the generic mechanism benefits every future repeating leaf inside a resource-anchored group, not just this one. |

## Classification (Clinical Feedback Integration Workflow)

**(a) Refinement**, same bucket ADR-0130 used for Q6 — Hurley names the concept (Q3: a radiograph should be obtained) but not the FHIR mechanism; realised via the already-established `ImagingStudy.modality` pattern, not a new data-collection burden.

## Verification

- `sushi .` — 0 errors/0 warnings; compiled `ValueSet-imaging-modality.json` confirmed carrying `DX`, and `Questionnaire-shoulder-registration.json`'s `imaging.modality` item confirmed carrying `"repeats": true`.
- `npm run build`/`npm run lint` clean on both frontends.
- Verified live on the deployment server (2026-08-05): the unified frontend's Registration Imaging step renders all four modalities (Computed Tomography, Digital Radiography, Magnetic Resonance, Ultrasound) as checkboxes, and checking two simultaneously (Digital Radiography + Magnetic Resonance) correctly keeps both checked — confirms the multi-select behavior end-to-end in a real browser, not just at the type level. The SDC repeating-leaf fix was not separately exercised in the browser this session (no live multi-modality SDC submission attempted) — its correctness rests on the isolated code-path tracing in this ADR's own Decision section, not a live click-through.

## Consequences

✅ Q3 is now genuinely demonstrated by both frontends' write paths, matching Q6's ADR-0130 fix — the mapping's `Full` claim for Q3 no longer rests on profile existence alone.
✅ A patient with both a radiograph and an MRI can now have both recorded as separate `ImagingStudy` resources, which a single-select could never have expressed.
✅ Fixed a real, previously-undetected data-loss bug in the SDC extractor's generic resource-anchored-group path — benefits any future repeating leaf added inside a `condition`/`encounter`/other resource-anchored group, not just this one.
⚠️ Not yet verified live — see Verification above.

## Sources

- `docs/limitations_items/` — "Q3 (radiographs) has the same never-instantiated-resource defect Q5/Q6 had," the entry this ADR closes.
- ADR-0130 — the Q6 fix this ADR extends and structurally mirrors.
- `ig/input/fsh/valuesets/ImagingModality.fsh`, `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — FSH changes.
- `frontend/src/components/wizard/StepImaging.tsx`, `stepFormData.ts` — unified frontend.
- `sdc-frontend/src/lib/extractor.ts` (`assignByPath`, `buildResourceForExtractionGroup`) — SDC frontend, including the repeating-leaf fix.
- `sdc-frontend/src/components/QuestionnaireForm.tsx` — confirmed unchanged; its existing generic `item.repeats` choice-rendering branch (introduced for `tendons-involved`, ADR-0064) needed no modification.
