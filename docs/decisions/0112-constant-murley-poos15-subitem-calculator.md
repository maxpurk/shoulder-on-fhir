# ADR-0112: Constant-Murley POOS-15 sub-item calculator — reverses ADR-0107's no-derivation stance

**Date:** 2026-07-28
**Status:** Accepted

## Context

Follow-up user request: "I want to auto calculate [the Constant-Murley sub-scores] from the most granular fields like pain, rom etc. — this is not shown yet." ADR-0107 (point 11, 2026-07-27) had already looked at this exact ask and concluded there was **no legitimate basis for a numeric derivation** — Constant's ROM sub-score uses banded functional milestones on active painless motion, and its Strength sub-score is a single spring-balance reading, neither of which map linearly onto this IG's degree-valued ROM or 5-axis MMT/dynamometry Observations. ADR-0107 shipped a read-only reference display instead of any auto-fill.

The user has since supplied the missing piece: the **POOS-15 Constant Score** out-patient clinic worksheet (`~/Desktop/POOS-15_Constant_Score.pdf`), which gives the exact point scale the original Constant & Murley (1987) instrument uses for every one of its ~10 sub-items (Pain average of 2 items; ADL = occupation + leisure + sleep + arm-use ladder; ROM = Flexion + Abduction + External Rotation + Internal Rotation, each independently banded; Power = kg × 2). This is the "basis in the original methodology" ADR-0107 found absent — it supersedes that ADR's blanket no-derivation conclusion, though (per the review below) not uniformly in favor of auto-deriving everything.

The user framed the desired approach as four tiers, applied per sub-item: (1) already collect exactly that value → auto-populate; (2) capture something similar and extractable → extract; (3) capture something similar but not cleanly extractable → adapt how we capture; (4) not captured yet → capture too. Scope choice (of three offered): the **full sub-item calculator** — decompose all ~10 POOS-15 sub-items in the score step, auto-fill what's cleanly derivable, add direct new inputs for what isn't, roll everything up to the four existing `Observation.component[]` sub-scores and the total (ADR-0090's model, unchanged).

Every proposed conversion table was routed through the `shoulder-surgeon` subagent against the POOS-15 PDF before implementation, per this project's Clinical Feedback Integration Workflow. Two of the six originally-proposed auto-derivations were **rejected outright** on clinical grounds — not because no formula could be written, but because the "source" field this registry already captures measures a genuinely different construct than the POOS-15 item.

## Shoulder-surgeon review findings

| POOS-15 sub-item | Proposed source | Verdict | Resolution |
|---|---|---|---|
| A. Pain (0–15) | `painAverage` (0–10) alone, linear rescale | **Rejected as sole derivation.** POOS-15's Pain is itself an average of a categorical "pain in normal activities" question and a separate 0–15 linear scale; a generic average-pain rating does not reliably predict activity-impact judgment (e.g. high pain tolerance with low activity impact in chronic presentations). | Add new categorical select (POOS-15 item 1 verbatim); average it with `painAverage` rescaled as a legitimate stand-in for item 2 *alone*. Partial auto-calc, not silent single-field substitution. |
| B3. Sleep (0/1/2) | `sleepDisturbance` ordinal | **Accepted as-is.** ADR-0081 already designed this field to mirror the Constant sleep sub-item exactly. | Direct map: `unaffected→2, occasional→1, nightly→0`. |
| C1/C2. Flexion/Abduction (0–10 each) | `forwardFlexion`/`abduction` degrees (Active) | **Accepted**, with an explicit requirement that the Active (not Passive) field is wired in. | Verbatim POOS-15 band table. |
| C4. Internal Rotation (0–10) | `internalRotation` 8-tier vertebral ordinal | **Accepted with correction.** Originally proposed `l3→6` (collapsed with `l5`) and `greater-trochanter→0` treated as equal to `unable`. Surgeon: `l3` must round **up** to align with `t12` (8), not down to `l5`'s waist-level anchor (6) — rounding a functional-reach ladder toward the lower/more-impaired anchor is the larger of two possible errors; `greater-trochanter` scores 0 only because it sits below POOS-15's own lowest named rung, not because it is clinically equivalent to total inability. | Corrected map: `unable→0, greater-trochanter→0, buttock→2, sacrum→4, l5→6, l3→8, t12→8, t7-or-above→10`. |
| C3. External Rotation (0–10) | (none — new) | N/A, confirmed as a genuinely different test (cumulative functional hand-position ladder) from our at-side ER degrees. | New single-select field, POOS-15 options verbatim. |
| B1/B2/B4. Occupation/leisure/arm-use | (none — new) | Transcription and single-select semantics confirmed correct. | New select fields, POOS-15 options verbatim. |
| D. Power (0–25) | `supraspinatusStrengthDynamometry` kg × 2 | **Rejected.** That field is deliberately positioned (ADR-0089) to isolate supraspinatus and minimize deltoid contribution (empty-can/Jobe); Constant's power test is a global scaption-plane abduction-strength test (deltoid + cuff, resisted downward pull, neutral rotation) — a different muscle target, clinically expected to diverge in exactly the cuff-tear population this registry serves. Same rejection logic ADR-0090 already applied to IG-field reuse for ROM/Strength. | New dedicated `constantPowerTest` (kg) field with the POOS-15 test protocol as helptext; existing dynamometry value may still be shown as unrelated reference text but does not feed the formula. |

Total = A + B + C + D remains a simple unweighted sum (confirmed by surgeon against the worksheet) — ADR-0090's existing live auto-calc of the total from the four component sub-scores is unchanged.

## Decision

1. **New shared module** `frontend/src/lib/constantScore.ts` — pure functions (`bandRomDegrees`, `mapInternalRotationLadder`, `mapSleepToAdlPoints`, `derivePainItem2Points`, `derivePowerPoints`, `averageDefined`/`sumDefined` roll-up helpers) plus the POOS-15 option catalogs (`PAIN_NORMAL_ACTIVITIES_OPTS`, `OCCUPATION_LIMIT_OPTS`, `LEISURE_LIMIT_OPTS`, `ARM_USE_OPTS`, `ER_POSITION_OPTS`, `SLEEP_DISTURBANCE_OPTS`) and `computeConstantSubscores(...)`, the single source of truth for both frontends.
2. **Registration** (`StepOutcomeScores.tsx`): now receives `assessment`/`patient` as two additive props from `RegistrationWizard.tsx` (previously received neither). Auto-derives and displays Pain-item-2, ADL-sleep, ROM-flexion/abduction/internal-rotation live from Step 4/Step 1 data (via a `useEffect` so navigating back-and-forth between steps re-syncs on remount); renders six new manual inputs (`constantPainNormalActivities`, `constantAdlOccupation`, `constantAdlLeisure`, `constantAdlArmUse`, `constantRomExternalRotation`, `constantPowerTest`) added to `OutcomeScoresFormData`.
3. **Follow-Up** (`Q12PromForm.tsx`): reads `q9State` (already passed in per ADR-0107) for Flexion/Abduction/Internal-Rotation auto-derivation, and its own `pain-average` field for Pain-item-2. Since Follow-Up captures no sleep/occupation/leisure/arm-use axis and has no Constant-power equivalent, **all of B1/B2/B3/B4, C3, and D are manual here** (Registration auto-derives B3 from Step 1; Follow-Up cannot). The six-plus-sleep calculator-input keys (`constant-pain-normal-activities`, `constant-adl-occupation`, `constant-adl-leisure`, `constant-adl-sleep`, `constant-adl-arm-use`, `constant-rom-external-rotation`, `constant-power-test`) live only in `Q12FormState`, are never registered in `Q12_FIELDS`, and are therefore automatically skipped by both the generic per-field render loop and `buildObservationsFromState` (`FollowUpWizard.tsx`) — no risk of a bogus standalone Observation. A `useEffect` syncs the four component fields whenever a calculator input OR an externally-edited field (`pain-average`, Q9 ROM fields) changes, since those are edited via sibling components in the same render tree, not through a handler owned by the calculator itself.
4. **No FHIR/IG/mapping change.** All ten POOS-15 sub-items are UI-only computation inputs; the four `Observation.component[]` sub-scores and the total (ADR-0090) are the only things ever submitted. `Q12-Constant` stays Full — Hurley's A12 names only "the Constant score" as the preferred instrument with zero mechanism specified, so this entire feature is a Refinement (classification (a)) regardless of which individual derivations were accepted or rejected.
5. **SDC frontend (port 3001) deferred**, same precedent as ADR-0064/ADR-0090's own scoping — its `calculatedExpression` still only computes the total from manually-entered components. Logged in `docs/limitations_items/`.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Derive Pain solely from `painAverage` (linear rescale, no new field) | Rejected by shoulder-surgeon review — silently assumes item 1 (activity-impact judgment) always equals item 2's rescaled value, which real patients contradict (e.g. high pain tolerance, low activity impact). |
| Derive Power solely from `supraspinatusStrengthDynamometry` (kg × 2, no new field) | Rejected by shoulder-surgeon review — different test position/muscle target (supraspinatus-isolated vs. global scaption-plane abduction), clinically expected to diverge in this registry's own patient population. Same rejection logic already established in ADR-0090 for IG-field reuse. |
| Collapse Internal Rotation's `l3`/`l5` to the same 6 points, as originally drafted | Surgeon correction: rounding toward the lower/more-impaired anchor is the larger of two possible errors on a functional-reach ladder; `l3` now aligns with `t12` (8). |
| Leave ADR-0107's reference-display-only approach in place | Superseded — the surgeon-supplied POOS-15 worksheet provides exactly the "basis in the original methodology" ADR-0107 found missing, for at least 4 of the 10 sub-items; a partial calculator is more useful than none while still respecting the sub-items that genuinely cannot be derived. |
| Model the six new manual sub-items as real FHIR Observations | Unnecessary — none of them is independently named by the SECEC/Hurley consensus or needed as a standalone clinical fact; they exist only to compute the four `Observation.component[]` values this IG already models. Keeping them UI-only avoids new profiles/ValueSets/CodeSystems for a pure calculator input. |

## Consequences

✅ Four of ten POOS-15 sub-items (Sleep, Flexion, Abduction, Internal Rotation) now auto-populate live from data already captured elsewhere in the same flow — directly closes the "this is not shown yet" gap.
✅ Pain partially auto-calculates from a legitimate two-item average once both the new categorical field and `painAverage` are present, instead of a clinically unsound single-field substitution.
✅ Clinicians get explicit new inputs (with POOS-15's own point values shown inline) for the six sub-items that cannot be derived, rather than either fabricating them or leaving the whole sub-score opaque.
✅ `Q12-Constant` mapping classification unchanged (Full) — this is a Refinement, not a new consensus element.
✅ No FHIR/IG/`tools/validate.sh` re-run needed — zero StructureDefinition/ValueSet/CodeSystem changes.
✅ `npm run build` (tsc + vite) and `npm run lint` (zero-warning gate) pass clean on both changed components.
⚠️ SDC frontend (port 3001) does not get this calculator — its `calculatedExpression` still sums manually-entered components only. Logged in `docs/limitations_items/` as a parity gap, not fixed here.
⚠️ The corrected Internal Rotation ladder map is a judgment call at exactly one ambiguous rung (`l3`) where POOS-15's 6-tier scale has no exact anchor for this IG's finer 8-tier ladder — documented rationale above, not a verified clinical equivalence.

## Sources

- `~/Desktop/POOS-15_Constant_Score.pdf` — source worksheet (user-supplied, text-extracted and cross-checked)
- `shoulder-surgeon` subagent review (2026-07-28) — full per-sub-item verdicts summarized in the table above
- Hurley et al. 2024 (SECEC Delphi consensus), Q12/A12 wording — confirms zero sub-item mechanism specified, supporting the "Refinement" classification
- ADR-0107 (prior no-derivation conclusion, now superseded for 4+1 of 10 sub-items), ADR-0090 (Constant `Observation.component[]` model, unchanged), ADR-0081 (sleep ordinal), ADR-0088 (internal-rotation vertebral ladder), ADR-0089 (muscle strength/dynamometry test positions)
- `frontend/src/lib/constantScore.ts` (new)
- `frontend/src/components/wizard/{StepOutcomeScores.tsx,RegistrationWizard.tsx,stepFormData.ts}`
- `frontend/src/components/followup/Q12PromForm.tsx`
- `mapping/SECEC_FHIR_Mapping.csv` row `Q12-Constant` (status unchanged, no edit needed)
