# ADR-0118: Constant-Murley score shown only when every contributing value is present

**Date:** 2026-07-31
**Status:** Accepted

## Context

a final review pass flagged: "Constant Score should only be calculated if all values exist." Investigation confirmed the complaint: across all three Constant-Murley compute sites — `frontend/src/components/wizard/StepOutcomeScores.tsx` (Registration), `frontend/src/components/followup/Q12PromForm.tsx` (Follow-Up), and `sdc-frontend/src/components/QuestionnaireForm.tsx`'s `evaluateCalcExpr` (both SDC Questionnaires) — the total was computed as **the sum of whichever sub-scores happened to be present**, and each of the four sub-scores (Pain, ADL, ROM, Strength) was itself **the sum/average of whichever of its own sub-items happened to be present** (`sumDefined`/`averageDefined` in `frontend/src/lib/constantScore.ts`, and the SDC evaluator's `hasAny` gate). A user clarified the intent directly: display a calculated value "only ... when all data are there — not when others are missing."

A partial Constant-Murley score is not a meaningful clinical value — the instrument's four sub-scores (0–15/20/40/25) and the ten POOS-15 sub-items behind them only add up to a valid 0–100 total when every contributing answer is recorded. Showing (and, before ADR-0090's gating, potentially persisting) a partial number invites misreading a half-computed score as a real outcome measure.

## Decision

Tightened the existing "sum of whatever's present" logic to "all-or-nothing" in both frontends, at two levels:

1. **Sub-score level.** A sub-score (Pain/ADL/ROM/Strength) is displayed/written only once **all** of its contributing sub-items are filled — not merely "at least one." `constantScore.ts` gains `isSubscoreComplete(s: SubscoreResult): boolean` (`s.value !== undefined && s.filled === s.total`), reusing the `filled`/`total` bookkeeping `computeConstantSubscores()` already tracked (2 items for Pain, 4 for ADL, 4 for ROM, 1 for Strength). Both `StepOutcomeScores.tsx` and `Q12PromForm.tsx` gate their `setSub(...)` calls on this helper — an incomplete sub-score is cleared (`''`/deleted) rather than shown as a partial figure.
2. **Total level.** The Constant-Murley total is computed only once **all four** sub-scores are complete (`[pain, adl, rom, strength].every(isSubscoreComplete)`), replacing the previous `values.length > 0 ? sum : ''` gate. Both amber progress hints (`partialFillHint` per sub-score, and the total's own "N of 4 sub-scores" hint) reworded to state plainly that the value stays blank until complete, rather than implying a partial number is already showing.
3. **SDC frontend.** `evaluateCalcExpr` in `QuestionnaireForm.tsx` changed from "sum whichever formState entries match the prefix, `hasAny` gate" to requiring **every** dependency item present. Since a blank sub-item may be entirely absent from `formState` rather than present-but-empty, the evaluator now takes the flattened Questionnaire item tree (`flattenItems()`, new) to enumerate the full expected dependency set (`type !== 'group'` items whose `linkId` starts with the calculatedExpression's prefix) before summing — a leaf item present in the tree but missing from `formState` now correctly blocks the total, which the old `Object.entries(formState)`-only iteration could not detect. The direct-total entry mode (ADR-0090: type the total by hand when no sub-items are filled) is preserved — `computed === undefined` still leaves a manually-typed value alone rather than clobbering it.

No change to the derive functions themselves (`bandRomDegrees`, `derivePainItem2Points`, `derivePowerPoints`, the ladder/point tables), to any profile/ValueSet, or to the SECEC mapping — `Q12-Constant` stays Full. This is a display/entry-mode refinement (Layer 1(a) — the expert consensus names the instrument, not the completeness policy for partially-filled sub-items), not a structural or terminology change.

Incidentally fixed while investigating the same findings-file entry for the Follow-Up flow: `FollowUpWizard.tsx`'s `ContextBanner` read `lookup.indexProcedure.performedDateTime` directly, which is always blank for any Procedure built by the current Surgery wizard (ADR-0108, `performedPeriod.start`) or either seed bundle — corrected to `getProcedureEffectiveDate(lookup.indexProcedure)` (`lib/patientStage.ts`, already used by the schedule-chip logic). The separate "No index Procedure with a performedPeriod or performedDateTime found" warning in `TimepointPicker.tsx` was investigated and found to be **correct behavior** (fires when Follow-Up is opened before the Surgery flow has been submitted for that patient; the custom-date input already covers it) — no fallback added, only reworded from developer-facing field-name jargon to clinician-facing wording.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep partial sub-scores/total, just hide them behind a stronger warning | Doesn't address the actual ask — the value would still be computed and available to a submit handler; the gating has to happen at computation, not just display, so an incomplete Observation is never built either. |
| Gate only the total, leave sub-scores summing partially | Inconsistent — a partial ROM sub-score (e.g. only Flexion + Abduction, missing External/Internal Rotation) is exactly as clinically meaningless as a partial total; the user's instruction ("not when others are missing") applies at the sub-item level, not just the top-level total. |

## Consequences

✅ Neither frontend can display or submit a partial Constant-Murley sub-score or total anymore — `frontend/src/components/wizard/StepOutcomeScores.tsx`'s existing `if (scores.constantScore) observations.push(...)` submit gate now only ever sees a fully-computed total.
✅ SDC frontend's `calculatedExpression` demonstration now actually matches its own stated semantics (`sum()` over a complete set), not just "sum of whatever answered."
✅ Fixed the unrelated `ContextBanner` op-date display bug found during the Follow-Up investigation.
✅ `npm run build` (tsc + vite) and `npm run lint` (zero-warnings) clean on both `frontend/` and `sdc-frontend/`.
❌ Not yet re-verified live on the deployment server (browser click-through) — code/type-level review and clean build/lint only, per this session's scope.

## Sources

- a final review pass (the two open findings this ADR closes)
- `frontend/src/lib/constantScore.ts`, `frontend/src/components/wizard/StepOutcomeScores.tsx`, `frontend/src/components/followup/Q12PromForm.tsx`
- `sdc-frontend/src/components/QuestionnaireForm.tsx`
- `frontend/src/lib/patientStage.ts`, `frontend/src/components/followup/{FollowUpWizard,TimepointPicker}.tsx`
- ADR-0090 (introduces `Observation.component[]` sub-scores + the two entry modes this ADR refines), ADR-0113 (read-only calculated-field UX this ADR's comments amend), ADR-0108 (surgery wizard's `performedPeriod` shape, root cause of the `ContextBanner` bug)
