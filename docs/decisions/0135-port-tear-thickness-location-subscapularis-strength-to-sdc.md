# ADR-0135: Port Tear Thickness, Tear Location, Subscapularis Strength to SDC

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** the cross-frontend parity audit, item #1 — a cross-frontend content-parity audit found the unified frontend records 9 Observation types the SDC frontend never captures. Items 5/6/7/8/9 of the same audit already covered 6 of the 9 (prior-treatment counts, provocation tests, surgery technique fields, Patte/Goutallier timepoint); this ADR closes the remaining 3, all Registration-time fields with no other open review item covering them.

## Context

All three profiles (`SubscapularisStrengthObservation`, `TearThicknessObservation`, `TearLocationObservation`) already exist in the IG — the unified frontend has used them since ADR-0089 (subscapularis strength) and ADR-0105 (tear thickness/location decoupled from `Condition.code`). SDC's Registration Questionnaire never had matching items.

Per the Clinical Feedback Integration Workflow: classification **(b) structural gap fix** — no new clinical/terminology decision, straight port of already-decided modeling (Recommendation on the parent item #1 explicitly says "None of this is a design decision to re-litigate — the unified frontend already settled the modeling; it's a straight port gap").

Tear Thickness and Tear Location needed one extra check before porting: in the unified frontend they're built alongside `Condition` and linked via `Condition.evidence.detail` (`StepCondition.tsx`), which raised the question of whether porting them to SDC would need `extractor.ts`/`bundleAssembler.ts` changes. It doesn't — `bundleAssembler.ts`'s `isImagingObservation()` already generically wires *any* Observation with `category=imaging` into `Condition.evidence.detail` (the same mechanism already used for `TendonsInvolvedObservation` and the tear-size-classification Observation, both already present in SDC's `clinicalAssessment` per-leaf-extraction group). Both new profiles fix `category` to `imaging`, so simply adding them as ordinary per-leaf items reuses this existing generic wiring with zero code changes.

## Decision

Added 3 new items to `ShoulderRegistrationQuestionnaire.fsh`'s `clinicalAssessment` group (`item[3]`, a per-leaf-extraction group — appended at indices 32-34 rather than renumbering the existing 32 items, to avoid disturbing any existing linkId/index mapping for no benefit):
- `obs.subscapularis-strength` — `#decimal`, targets `SubscapularisStrengthObservation#Observation.valueQuantity`, bounds 0-5 (same MMT pattern as the three strength items already present).
- `obs.tear-thickness` — `#choice`, targets `TearThicknessObservation#Observation.valueCodeableConcept`, bound to `TearThickness` VS.
- `obs.tear-location` — `#choice`, targets `TearLocationObservation#Observation.valueCodeableConcept`, bound to `TearLocation` VS.

`Questionnaire.version` bumped `0.4.0` → `0.5.0`. No `extractor.ts`/`bundleAssembler.ts` changes — all three flow through the existing generic per-leaf-extraction + category-based evidence-wiring mechanisms (ADR-0103/ADR-0122 for the former, the pre-existing `isImagingObservation()` check for the latter).

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Insert the 3 new items in thematic position (subscapularis strength next to the other strength items, tear thickness/location next to tear-size-classification), renumbering the existing 32 `clinicalAssessment` items | Purely cosmetic ordering benefit, for the cost of touching (and risking a typo in) every existing item's index — not worth it for a machine-read Questionnaire definition where index order has no clinical meaning. |
| Give Tear Thickness/Location their own itemExtractionContext group referencing `Condition` directly (mirroring `StepCondition.tsx`'s literal implementation) | Would duplicate the evidence.detail wiring logic that `bundleAssembler.ts` already does generically for any imaging-category Observation — more code for the same result. |

## Consequences

✅ Closes the last 3 of clinical-review item #1's 9 listed content gaps — the other 6 were closed by ADR-0133 (prior-treatment counts, Pack-Years, Occupational Overhead) and the ADRs covering clinical-review items #6/#7/#8 (provocation tests, surgery technique fields) as those land.
✅ `sushi .`: 0 errors / 0 warnings. No frontend code touched, so no `npm run build` needed.
✅ No mapping status change.

## Sources

- the cross-frontend parity audit, item #1.
- `frontend/src/components/wizard/StepCondition.tsx` (tearThickness/tearLocation, lines ~99-144), `StepClinicalAssessment.tsx` (subscapularisStrength) — reference implementations this ADR ports.
- `sdc-frontend/src/lib/bundleAssembler.ts` (`isImagingObservation`, `attachConditionEvidence`) — the existing generic mechanism this ADR relies on unchanged.
- `ig/input/fsh/profiles/observations/{SubscapularisStrength,TearThickness,TearLocation}Observation.fsh` — pre-existing profiles, unchanged.
- ADR-0089 (subscapularis strength), ADR-0105 (tear thickness/location decoupling), ADR-0064 (the tendons-involved precedent for the evidence.detail wiring pattern).
