# ADR-0139: Port Follow-Up provocation tests and visual inspection to SDC

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** the cross-frontend parity audit, item #6 — ADR-0093 specifies post-op follow-up should carry 3 of Registration's 5 provocation tests (Jobe/Lift-off/Belly-press, deliberately excluding Bear Hug/Hornblower) plus 3 visual-inspection findings. The unified Follow-Up wizard implements exactly this; SDC's Follow-Up questionnaire had neither — its post-op exam was ROM + strength + pain only.

## Context

All 6 target Observation profiles (`JobeTestObservation`, `LiftOffTestObservation`, `BellyPressTestObservation`, `AtrophyObservation`, `DeformityObservation`, `NormalShoulderContourObservation`) already exist in the IG and were already wired into SDC's *Registration* questionnaire — this ADR only ports the same 6 items into the *Follow-Up* questionnaire's equivalent per-leaf-extraction group (`postOpExam`), reusing the identical FSH shape (same `item.definition` targets, same `$SCT` Positive/Negative and Present/Absent `answerOption` codings) already proven correct there. Per the Clinical Feedback Integration Workflow: classification **(b) structural gap fix** — ADR-0093 already settled which 3-of-5 tests apply post-op and ADR-0086 already settled the 3 inspection findings; nothing here revisits either.

## Decision

Appended 6 items to `ShoulderFollowUpQuestionnaire.fsh`'s `postOpExam` group (`item[1]`, a per-leaf-extraction group, at indices 14–19, after the existing ROM/strength/pain items): `obs.jobe-test`, `obs.lift-off-test`, `obs.belly-press-test`, `obs.atrophy`, `obs.deformity`, `obs.normal-shoulder-contour` — byte-identical `item.definition`/`answerOption` shape to Registration's equivalents. `Questionnaire.version` bumped `0.1.0` → `0.2.0`. No `extractor.ts`/`bundleAssembler.ts` changes — all 6 flow through the existing generic per-leaf-extraction mechanism already exercised by every other `postOpExam` field.

## Alternatives Considered

None — this is a direct, mechanical port of an already-proven pattern (same profiles, same VS/coding choices, same group type already used by 14 sibling items in the same file) with no design freedom left to exercise.

## Consequences

✅ Closes clinical-review item #6 — SDC Follow-Up can now record the exact post-op exam findings ADR-0093 designed for.
✅ `sushi .`: 0 errors / 0 warnings. No frontend code touched.
✅ No mapping status change.

## Sources

- the cross-frontend parity audit, item #6.
- ADR-0093 — sole authority for which 3 of 5 provocation tests apply post-op; nothing here revisits it.
- ADR-0086 — sole authority for the 3-finding inspection redesign; nothing here revisits it.
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — the already-correct reference shape these 6 items were copied from.
- `frontend/src/config/followupObservationMetadata.ts` — confirms the unified frontend's Q9 field set this ADR ports.
