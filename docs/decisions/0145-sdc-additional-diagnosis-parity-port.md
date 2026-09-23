# ADR-0145: Port additional (non-rotator-cuff) diagnosis capture to the SDC frontend

**Date:** 2026-08-03
**Status:** Accepted

## Context

An end-to-end parity test (build one exhaustively-filled longitudinal patient through each frontend independently, diff the submitted `$everything` bundles) found that `ShoulderRegistrationQuestionnaire` had no way to capture a coexisting non-rotator-cuff shoulder diagnosis (e.g. AC joint osteoarthritis, biceps tendinopathy) — `RotatorCuffRegistrationBundle.otherDiagnosis` (0..*, `ShoulderDiagnosisCondition`, ADR-0077) has existed since ADR-0077 and is fully supported by the unified frontend's repeatable "+ Add another diagnosis" (`StepCondition.tsx`), but the SDC Questionnaire never grew a matching item group. The diff showed exactly one fewer `Condition` in the SDC-built patient, tracing directly to this gap.

## Decision

Add a new repeatable top-level group `otherDiagnosis` to `ShoulderRegistrationQuestionnaire.fsh` (`item[7]`, appended at the end of the item list to avoid renumbering the six existing groups), with `itemExtractionContext` targeting `ShoulderDiagnosisCondition` and a single leaf (`otherDiagnosis.code`, bound to `ShoulderDiagnosis`). Reuses the existing repeating-group machinery ADR-0141 built for Surgery's concomitant procedures — no new frontend mechanism needed for the repeat/remove UI.

`bodySite` is deliberately **not** asked in this group. `ShoulderDiagnosisCondition`'s own profile requires it to match the laterality of the `RotatorCuffCondition`(s) in the same bundle (one registration entry = one patient + one shoulder side). Asking it a second time risks a clinician entering a mismatched side. Instead, `bundleAssembler.ts`'s `assembleRegistrationBundle` copies `bodySite` from the already-resolved main Condition onto every extracted `otherDiagnosis` Condition before adding it to the bundle.

`extractor.ts`'s group dispatcher previously routed every extracted `Condition` resource to `out.condition` (singular) regardless of which group produced it. Since both the main `condition` group and the new `otherDiagnosis` group target `resourceType === 'Condition'`, the dispatcher now distinguishes them by the group's own `linkId` (`groupQItem.linkId === 'otherDiagnosis'`) rather than resource type alone, pushing to a new `ExtractedResources.otherDiagnoses: Condition[]`.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Also ask `bodySite` in the new group, matching the main diagnosis's UX | Profile invariant requires it to always equal the main Condition's laterality — asking twice only creates a chance to submit a contradictory bundle for no benefit |
| Distinguish extracted Conditions by target profile canonical instead of group linkId | Group linkId is simpler, already unique by FSH convention, and avoids adding a profile-canonical string comparison the rest of the dispatcher doesn't otherwise need |

## Consequences

✅ SDC Registration now has full parity with the unified frontend's diagnosis capture — closes a real, diff-confirmed content gap, not a hypothetical one.
✅ No mapping/coverage change: `RotatorCuffRegistrationBundle.otherDiagnosis` and `ShoulderDiagnosisCondition` already existed (ADR-0077); this is a frontend port, not a new IG element.
⚠️ The generic repeating-group "+ Add concomitant …" button label reads slightly awkwardly for this group's text ("Additional Diagnosis (optional)") — cosmetic only, not special-cased since the renderer is intentionally generic.

## Sources

- `ig/input/fsh/profiles/RotatorCuffRegistrationBundle.fsh` (`otherDiagnosis` slice, ADR-0077)
- `ig/input/fsh/profiles/ShoulderDiagnosisCondition.fsh` (bodySite-must-match invariant)
- `frontend/src/components/wizard/StepCondition.tsx` (unified frontend's equivalent repeatable UI)
- Live diff: `Patient/$everything` for a matched pair of exhaustively-filled patients, one per frontend, 2026-08-03
