# ADR-0096: LHC-Forms frontend revival — evaluated, deferred

**Date:** 2026-07-25
**Status:** Accepted
**Builds on:** ADR-0041 (LHC-Forms deprecated), ADR-0095 (server-side `$extract` — the dependency this would need for full parity)

## Context

Reviving the archived LHC-Forms frontend (deprecated by ADR-0041) was investigated on this date,
so that it would demonstrate the current three-bundle/SDC architecture instead of the frozen
pre-restructure shape it was archived at. The archived code was read in full — a single 251-line `App.tsx`, one hardcoded Questionnaire URL, no
router, no patient lookup, no bundle assembly — and scoped two possible revival levels (see
`docs/future_work_items/0002-lhcforms-frontend-parity/plan.md`). Neither has been approved or started;
this ADR records that the "not now" outcome is itself a decision, not an absence of one.

## Decision

**Defer.** Do not revive LHC-Forms now. The two scoped options — bare resurrection (~30–60 min,
restores exactly what was archived) vs. full three-flow parity (~2–4 days, now unblocked by
ADR-0095's extraction path) — are recorded in `docs/future_work_items/0002-lhcforms-frontend-parity/plan.md`
for future pickup. No code changes were made.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Revive now (bare resurrection) | Restores the historical citation but does not demonstrate the current architecture — the exact reason it was archived (ADR-0041) remains unaddressed. Also untested whether stock LHC-Forms even evaluates the `calculatedExpression` extension added after archival (ADR-0090). |
| Revive now (full parity) | 2–4 days for a third demonstrator whose unique claim (zero-custom-code off-the-shelf renderer) is narrow. ADR-0041 already judged this cost not worth carrying once; reversing that judgment deserves a deliberate choice on its own, not a side effect of a tangential planning session. |
| Defer to `docs/future_work_items/`, record via this ADR | **Chosen.** Nothing currently depends on a third live frontend; the effort estimate and unblocking dependency are on record so the decision can be revisited cheaply. |

## Consequences

✅ The effort/scope analysis is preserved (`docs/future_work_items/0002-lhcforms-frontend-parity/plan.md`) so a future pickup costs no rediscovery time.
✅ Keeps today's demo stack at its current, deliberately-narrowed footprint (ADR-0041: two live frontends + one archived, historically-cited one).
⚠️ The archived frontend's Constant-Murley item behavior against `calculatedExpression` remains genuinely untested until someone picks scope A back up.
❌ The thesis cannot currently claim a third *live* demonstrator paradigm — only two live plus one historical citation, per ADR-0041, unchanged by this decision.

## Sources

- The archived LHC-Forms frontend's `App.tsx` — read in full to ground the effort estimate
- `docs/future_work_items/0002-lhcforms-frontend-parity/plan.md` — the scoped options this ADR defers
- ADR-0041 — original deprecation
- ADR-0095 — server-side `$extract`, the dependency full parity would reuse
