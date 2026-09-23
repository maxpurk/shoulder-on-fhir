# ADR-0140: Patte and Goutallier classification — Registration/imaging is the canonical timepoint

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** the cross-frontend parity audit, item #9 — SDC captured Patte tendon-retraction stage and Goutallier fatty-infiltration grade only on the Surgery form (intra-operative, direct surgical inspection); the unified frontend captures both only on Registration/Imaging (pre-operative, imaging-based staging). Both mapping rows stayed `Full` in either case, but `Observation.effectiveDateTime` for the "same" classification would differ by weeks between two patients depending only on which frontend was used.

## Context

Hurley's consensus names Patte and Goutallier classification without fixing a mechanism or timepoint — Q4's tear-classification decomposition (including Patte/Goutallier) is this thesis's own design choice (already noted in `TearLocationObservation`'s own FSH doc comment: "Hurley names tear classification without fixing which axes it decomposes into; this is a design decision of this thesis"). Per the Clinical Feedback Integration Workflow, choosing *which* timepoint is canonical therefore falls under classification **(a) Refinement** — the consensus is silent on mechanism, so the project has design freedom, and the clinical review's own recommendation explicitly framed this as "worth an explicit decision... documented in an ADR," which this ADR provides.

Both classifications are clinically valid at either timepoint (Patte/Goutallier are classically imaging-based — MRI/CT — but a surgeon can also stage them by direct arthroscopic/open inspection). The Human Decision on this feedback point was to bring SDC in line with the unified frontend rather than pick a third option or leave both valid, so this ADR documents *that* choice's consequences rather than re-litigating which timepoint is "more correct" in the abstract.

## Decision

**Registration/imaging (pre-operative) is canonical for both frontends.** SDC's Patte/Goutallier capture moved from `ShoulderSurgeryQuestionnaire.fsh`'s `intraOpObservations` group to `ShoulderRegistrationQuestionnaire.fsh`'s `clinicalAssessment` group — same per-leaf-extraction pattern, same target profiles (`PatteObservation`, `GoutallierObservation`), same answerValueSets (`patte-classification`, `goutallier-classification`), removed entirely from Surgery. `Questionnaire.version` bumped: Registration `0.7.1` → `0.8.0`, Surgery `0.2.0` → `0.3.0`.

Tear Size Classification (Cofield) is explicitly **not** affected — unlike Patte/Goutallier, it already has two deliberately separate profiles (`TearSizeClassificationObservation` at Registration for the imaging-estimated size, `IntraopTearSizeClassificationObservation` at Surgery for the intra-operatively confirmed size) representing two genuinely different measurements the surgeon is expected to compare, not one classification duplicated across timepoints.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Make Surgery/intra-operative the canonical timepoint instead (port unified *to* SDC's existing behavior) | Human Decision explicitly chose to bring SDC to unified's modeling, not the reverse — and imaging-based pre-op staging is also the more conventional clinical use of Patte/Goutallier in the literature these classifications originate from. |
| Capture at both timepoints (like Cofield) | Rejected for now — no evidence either frontend's surgeon-facing design wanted two Patte/Goutallier readings per patient; would need its own clinical go/no-go as a (d) out-of-consensus addition (new data-collection burden) rather than a straight port. Revisit if a future feedback round asks for it explicitly. |
| Leave both frontends as-is, document the discrepancy as an accepted limitation | The clinical review's decision for this item was "update it," not "document it" — this alternative was the fallback the review itself offered, but was not the path chosen. |

## Consequences

✅ Closes clinical-review item #9 — both frontends now assert Patte/Goutallier at the same clinical timepoint (pre-op, imaging-based), making `Observation.effectiveDateTime` comparable across patients regardless of which frontend was used to register them.
✅ `sushi .`: 0 errors / 0 warnings. No frontend code changes — both moves are pure per-leaf-extraction relocations, already proven generic mechanisms in both Questionnaires.
✅ No mapping status change — Patte (Q4-derived) and Goutallier (Q4-derived) stay Full; this is a timepoint/method clarification, not a coverage change.
⚠️ A surgeon who wants to record an intra-operative *revision* of the pre-op Patte/Goutallier stage (e.g., imaging under-graded a tear later found more retracted) has no field for that anymore in either frontend. Not a new gap this ADR introduces — SDC's intra-op capture was itself an undocumented, frontend-specific divergence, not a deliberate "revise at surgery" feature; logged here for completeness, not `docs/limitations_items/` (no user-facing capability existed to lose — this was an inconsistency, not a designed feature).

## Sources

- the cross-frontend parity audit, item #9.
- `frontend/src/components/wizard/StepImaging.tsx` — reference implementation (unified's existing Registration-time Patte/Goutallier capture, unchanged by this ADR).
- `ig/input/fsh/profiles/observations/{Patte,Goutallier}Observation.fsh` — pre-existing profiles, unchanged.
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` (new `item[3].item[35-36]`), `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh` (`intraOpObservations` group, items removed).
