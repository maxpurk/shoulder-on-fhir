# ADR-0113: Constant-Murley total and sub-scores become calculated, read-only outputs

**Date:** 2026-07-29
**Status:** Accepted

## Context

Domain-expert review of the live Registration frontend surfaced a data-integrity bug:
typing `555` into the Strength sub-score box produced a Constant-Murley total of `589`
— far outside the instrument's valid 0–100 range (screenshot: Strength `555`, ROM `10`,
Pain `11`, ADL `13`, total `589`).

Root cause: the Constant total and its four sub-score boxes (Pain / ADL / ROM /
Strength, in both `StepOutcomeScores.tsx` and `Q12PromForm.tsx`) were plain
`<input type="number">` fields with `min`/`max` attributes. Those attributes only
affect the spinner UI and native form-submission validity state — they do **not**
block keyboard entry of an out-of-range value. The sub-score sync effect
(ADR-0090, extended by ADR-0112) compounded this: it only ever *wrote* a sub-score
when its own contributing sub-items changed, and deliberately preserved a manual
override otherwise — so a hand-typed `555` was never corrected and flowed straight
into the summed total.

Every point-derivation function in `frontend/src/lib/constantScore.ts`
(`bandRomDegrees`, `derivePowerPoints`, `mapInternalRotationLadder`, `sumDefined`,
etc.) already clamps its output at the source — `derivePowerPoints` caps Strength at
25 regardless of kg entered. The corruption was only possible because the aggregate
fields were themselves directly editable, bypassing every clamp downstream of them.

Clinical-feedback classification: **(a) Refinement.** Hurley Q12/A12 names the
Constant-Murley score as a preferred instrument but specifies no data-entry
mechanism — free to change without affecting the `Q12-Constant` Full mapping status.

## Decision

The Constant-Murley total and its four `Observation.component[]` sub-scores (Pain,
ADL, ROM, Strength) become **calculated, read-only display fields** in both
frontends that render the POOS-15 sub-item calculator:

- `frontend/src/components/wizard/StepOutcomeScores.tsx` (Registration)
- `frontend/src/components/followup/Q12PromForm.tsx` (Follow-Up)

1. All five fields (total + 4 sub-scores) get `readOnly`, `tabIndex={-1}`,
   `aria-readonly`, a greyed style, and a `(calculated)` label suffix. They can no
   longer be hand-typed in either direction — not the sub-scores, and not the total.
   This **removes ADR-0090's dual-mode total field** (direct-total entry vs.
   component-derived entry) — the total is now unconditionally the sum of the four
   sub-scores, or empty if none are present.
2. The sync `useEffect` in each file changes from *write-if-defined,
   preserve-manual-override* to an **unconditional mirror**: every render, each
   sub-score is set to its freshly computed value (or cleared to empty if no longer
   resolvable — e.g. a clinician clears a dropdown), and the total is recomputed as
   the sum of whichever sub-scores are currently present (or cleared if none are).
   Because the four component values feeding the sum are each individually clamped
   at their own derivation site, the total can never exceed 100 by construction —
   the previous bypass path (typing directly into a sub-score or the total) no
   longer exists.
3. `handleComponentChange`/the total's inline `onChange` (Q12PromForm) and the
   `CONSTANT_COMPONENT_FIELDS` branch of `handleScoreChange`
   (StepOutcomeScores) are removed as dead code — the only remaining editable
   inputs are the granular ones (dropdowns, the Constant power-test kg field, and
   whatever's entered upstream in Step 1/3/4).
4. The Constant power-test (kg) field — the one manually-typed input that feeds
   Strength via `derivePowerPoints` — gains an explicit `max={50}` and clamps on
   entry in both frontends. Not load-bearing for correctness (`derivePowerPoints`
   already clamps its point output to 0–25 for any kg value), but avoids displaying
   a nonsensical kg figure.
5. **No FHIR/IG/mapping change.** The submitted `Observation` (`code`
   SNOMED#273383002, `component[]` per ADR-0090) is byte-for-byte unaffected — this
   is a client-side input-mode change only.
6. **SDC frontend (port 3001) deferred**, same precedent as ADR-0064/ADR-0090/
   ADR-0112's own scoping. Its Constant total is driven by SDC
   `calculatedExpression`, a different mechanism entirely; out of scope here.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep fields typeable but clamp on every keystroke | Still allows a *plausible-looking but wrong* manually-typed sub-score to silently diverge from what the granular inputs actually compute (e.g. clamped-555→25 for Strength looks identical to a genuinely-derived 25, but the underlying kg entry may be nonsense). Read-only removes the divergence risk entirely, not just the range violation. |
| Keep ADR-0090's dual-mode total (direct entry OR component-derived) | This is exactly the design that permitted the corruption — a clinician (or an errant paste) can always type over a component-derived total. Removing the direct-entry path was requested explicitly and is the simplest fix that structurally forecloses the bug class. |
| Add server-side range validation only (`tools/validate.sh` / `validator-service`) | Both already reject out-of-range `valueQuantity` at submission time, but the corrupted value would still round-trip through the UI, be visible mid-entry, and only get caught at the very end of the wizard — a worse authoring experience than preventing it at the source. |

## Consequences

✅ An out-of-range Constant-Murley total is now structurally impossible from the UI
— every sub-score is a pure function of clamped, granular inputs, and the total is
their sum.
✅ Sub-scores and the total now stay live-accurate even when a clinician *clears* a
previously-filled dropdown (the old guard left a stale sub-score in that case).
✅ Clear visual signal (`(calculated)` label, greyed input) for which fields are
outputs vs. which are actual data entry — addresses the reviewer's ask to "clearly
mark the fields which are calculated and shall not be entered manually."
✅ `npm run build` (tsc + vite) and `npm run lint` (zero-warning gate) pass clean on
both changed files.
⚠️ Removes ADR-0090's direct-total-entry mode entirely — a clinician who only knows
the paper-computed Constant total (without the sub-item breakdown) can no longer
enter it directly; they must now go through the sub-items (or leave the field
blank). Accepted as the deliberate trade-off requested.
⚠️ SDC frontend (port 3001) untouched — its `calculatedExpression`-driven total
remains manually-entry-adjacent (components typed, then summed by the SDC engine);
not audited for the same corruption risk in this pass.

## Sources

- User-supplied screenshot (Registration Outcome Scores step): Strength `555` →
  total `589`, reviewed alongside `POOS-15_Constant_Score.pdf` /
  `constant_murley_score.pdf`.
- ADR-0090 (original `Observation.component[]` model, dual-mode total — the mode
  this ADR removes), ADR-0107 (interim no-derivation stance), ADR-0112 (POOS-15
  sub-item calculator, the immediate predecessor whose write-guarded sync effect
  this ADR replaces with an unconditional one).
- `frontend/src/lib/constantScore.ts` (unchanged — its existing per-item clamping is
  what makes read-only sub-scores safe).
- `frontend/src/components/wizard/StepOutcomeScores.tsx`,
  `frontend/src/components/followup/Q12PromForm.tsx`,
  `frontend/src/config/followupObservationMetadata.ts` (help-text wording only).
