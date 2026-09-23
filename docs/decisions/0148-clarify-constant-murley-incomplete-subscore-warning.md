# ADR-0148: Name the incomplete sub-score(s) in the Constant-Murley "stays blank" warning

**Date:** 2026-08-03
**Status:** Accepted

## Context

During the same end-to-end parity test (ADR-0145–0147), diffing a maximally-filled patient's `$everything` showed the unified frontend produced one fewer `ConstantScoreObservation` than expected across 6 visits (5 instead of 6) — the missing one traced to the 6-month Follow-Up visit, where "Active Internal Rotation, at side" had been deliberately marked N/A (ADR-0109) as part of exercising that code path. This was initially reported as a "silent bug: N/A-ing one ROM field drops the entire composite score with no warning."

Deeper investigation found that characterization was wrong. `Q12PromForm.tsx` (Follow-Up) and `StepOutcomeScores.tsx` (Registration) both already gate the total on `isSubscoreComplete` for **all four** sub-scores — a deliberate, documented decision from ADR-0113/ADR-0118 ("the total is likewise only computed once ALL FOUR sub-scores are complete — never as a sum of whichever sub-scores happen to be present," since a partial sum is not a valid POOS-15 score) — and both already render a warning (`"N of 4 sub-scores complete — the total stays blank until all four are filled"`) whenever the total is being suppressed. The behavior is correct and was not silent; the warning was simply not noticed during the live click-through session that first reported it.

## Decision

No change to the calculation or gating logic — ADR-0113/ADR-0118's correctness rule stands. The existing warning message in both files is extended to name which specific sub-score(s) are still incomplete (previously just a count, e.g. "3 of 4"), and the Follow-Up version additionally notes that a field marked N/A is a possible cause — since N/A only exists in the Follow-Up flow (ADR-0109's `NOT_DONE_GROUPS` scoping), that sentence is Follow-Up-only, not duplicated into Registration where it would be irrelevant.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Submit the total using only the complete sub-scores, treating missing ones as zero | Would silently corrupt the POOS-15 total into a number that looks valid but isn't — exactly what ADR-0113/ADR-0118 already rejected |
| Leave the existing generic "N of 4" warning unchanged | The count alone doesn't tell a clinician *which* answer to go fix, or that N/A is a possible cause — the whole reason this was mis-diagnosed as silent in the first place |

## Consequences

✅ Corrects a wrong finding before it became a wrong fix — the original "bug" report is documented here rather than silently dropped, since the initial mischaracterization is itself worth a record.
✅ Small, real clarity improvement: the warning now says what's missing, not just how much.
⚠️ None — no behavior change to what gets submitted, only to the warning text shown before submission.

## Sources

- ADR-0109 (N/A / dataAbsentReason mechanism, unified frontend)
- ADR-0113, ADR-0118 (Constant-Murley calculated-only fields, all-four-required gating)
- `frontend/src/components/followup/Q12PromForm.tsx`, `frontend/src/components/wizard/StepOutcomeScores.tsx`
- Live diff: `Patient/$everything` — 5 of 6 expected `ConstantScoreObservation`s for a patient with one visit's ROM item marked N/A, 2026-08-03
