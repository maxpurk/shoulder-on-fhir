# ADR-0144: Retire the "SDC parity is a separate, deferrable call" precedent — parity is now mandatory per point

**Date:** 2026-08-03
**Status:** Accepted
**Amends:** ADR-0064 (§Decision, §Consequences), ADR-0077 (§Decision, §Consequences), ADR-0083 (§Decision), ADR-0093 (§Decision, §Consequences), ADR-0104 (§Decision), ADR-0105 (§Consequences), ADR-0106 (§Context, §Consequences), ADR-0108 (§Consequences), ADR-0109 (§Consequences), ADR-0110 (§Consequences), ADR-0111 (§Consequences), ADR-0121 (§Consequences) — each gets a one-line note pointing here; none of their original historical text is deleted.

## Context

Starting with ADR-0064 (tendons-involved observation pattern, the "unified frontend only, SDC parity deferred" call was made for a specific, reasonable reason at the time: the SDC frontend was a secondary demonstration paradigm, and mirroring every unified-frontend change onto it in the same pass would have doubled the cost of every point in the Clinical Feedback Integration Workflow. That call was then cited as standing precedent by at least eleven further ADRs (0077, 0083, 0093, 0104, 0105, 0106, 0108, 0109, 0110, 0111, 0121), each individually reasonable in isolation, but which compounded into a real, measured content gap: the live end-to-end parity exercise recorded in the cross-frontend parity audit (two identical patients built through both frontends, 2026-08-02/03) found the unified frontend recording 9 whole Observation types the SDC frontend never captures for the same clinical scenario, plus the clinicalStatus/multi-diagnosis/fixed-diagnosis-label gaps in the Diagnosis step specifically, among other findings. The reverse diff — content in SDC but missing from unified — was empty. SDC had become a strict content subset, not a second demonstration of equal standing.

This is now being corrected point-by-point (ADR-0100, ADR-0101, ADR-0141, ADR-0142, ADR-0143, and further clinical-review items as they're worked through), but the *documented policy* that licensed the drift — The project guide's Clinical Feedback Integration Workflow, §3.4, "the unified frontend first... SDC frontend parity is a separate call per point, not automatic" — was still in force, and would keep licensing the same drift on the next feedback pass unless retired explicitly.

## Decision

**The "SDC parity is a separate, deferrable call" policy is retired.** The project guide's Clinical Feedback Integration Workflow now requires implementing both the unified frontend (port 3000) and the SDC frontend (port 3001) in the same pass for every point, unless a point is genuinely inapplicable to one paradigm on structural grounds (e.g. a `QuestionnaireResponse`-specific mechanic that has no unified-frontend analogue) — and even then, that inapplicability must be stated explicitly, not silently assumed.

The eleven ADRs listed in **Amends** above each recorded, at the time, "SDC parity deferred, consistent with this project's standing precedent (ADR-0064...)" as their justification for not touching the SDC frontend. Those statements are **left in place, unedited** — they are accurate historical records of what was decided and why, at the time. Each one gets a single added line: *"Amended by ADR-0144 (2026-08-03): the 'SDC parity is a separate call' precedent this note relies on is retired going forward. The SDC gap this ADR left open is not thereby closed by this amendment alone — it remains open and should be tracked as an ordinary parity item (see the cross-frontend parity audit), not treated as a permanently accepted deferral."* This mirrors this project's own established amendment convention (ADR-0048 → ADR-0049; ADR-0071/0079 → ADR-0080): a superseded stance stays visible with its correction attached, rather than being silently rewritten.

This ADR does **not** itself implement any of the eleven still-open SDC gaps — closing them is ordinary follow-up work, tracked in the cross-frontend parity audit like every other parity finding, not a byproduct of a policy-document change.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Delete/rewrite the "SDC parity deferred" sentences in the eleven ADRs | Rejected — same reasoning as ADR-0080's §Decision 6: those sentences are accurate records of what was actually decided at the time; silently rewriting them would hide a real, instructive policy evolution from future readers (including future sessions) who might otherwise reintroduce the same drift. |
| Leave the eleven ADRs untouched, only change the project guide | Considered, but leaves each of those eleven ADRs reading as if "SDC parity being a separate call" is still live, standing project policy — a future reader citing e.g. ADR-0105 as precedent for skipping SDC on a *new* point would be relying on a stance this ADR explicitly retires. The one-line pointer closes that risk cheaply. |
| Retire the policy but make SDC parity "best-effort" rather than mandatory | Rejected — a soft preference is exactly what produced the ADR-0064→0121 drift in the first place (each individual deferral was reasonable; the compounding wasn't). Mandatory-by-default with an explicit inapplicability exception is the stronger, self-correcting version of the same rule. |
| Bundle this policy change into whichever clinical-review items happens to be worked next | Rejected — the policy correction is logically prior to and independent of any single content-parity fix; it governs how *every subsequent* point gets worked, so it earns its own ADR rather than riding along with an unrelated content fix. |

## Consequences

✅ The project guide's Clinical Feedback Integration Workflow no longer licenses silent SDC deferral; future feedback-integration passes implement both frontends together by default.

✅ The eleven affected ADRs keep their original historical text intact — nothing about what was decided in May–August 2026 is rewritten — while a future reader is pointed at the current stance via one added line each.

⚠️ None of the specific SDC gaps documented across those eleven ADRs (tendons-involved dual-content shape, multi-diagnosis, sports participation, Condition-status-update, tear-size intra-operative context, the six round-2 patient-history refinements, the diagnosis-step duplicate-laterality item, encounter/procedure postcoordination points 12–14, the not-done marker, surgical-event timing, the fixed-diagnosis-label conversion, single-incision closure time) is closed by this ADR. Each remains open, individually trackable via the cross-frontend parity audit, and should be picked up as ordinary parity work going forward.

✅ Consistent with the parity work already underway this session (ADR-0100, ADR-0101, ADR-0141, ADR-0142, ADR-0143) — this ADR formalizes in policy what practice had already started doing.

## Sources

- the cross-frontend parity audit — the live end-to-end cross-frontend parity exercise (2026-08-02/03) that surfaced the measured content gap (9 missing Observation types, empty reverse diff) motivating this policy change.
- The project guide, §Clinical Feedback Integration Workflow, step 3.4 — the policy text corrected by this ADR.
- ADR-0064 (origin of the deferral precedent), ADR-0077, ADR-0083, ADR-0093, ADR-0104, ADR-0105, ADR-0106, ADR-0108, ADR-0109, ADR-0110, ADR-0111, ADR-0121 (the eleven ADRs citing it as standing precedent).
- ADR-0048 → ADR-0049 and ADR-0071/ADR-0079 → ADR-0080 — this project's established convention for amending a superseded stance in place rather than rewriting history.
- ADR-0100, ADR-0101, ADR-0141, ADR-0142, ADR-0143 — recent same-session parity-closing work this policy change formalizes.
