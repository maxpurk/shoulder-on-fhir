# ADR-0146: Port Passive ROM battery and Subscapularis Strength to the SDC Follow-Up Questionnaire

**Date:** 2026-08-03
**Status:** Accepted

## Context

The same end-to-end parity test that found ADR-0145's gap also diffed the post-op exam Observation set between a maximally-filled patient built through each frontend. `ShoulderFollowUpQuestionnaire` (SDC) captured only Active ROM (6 items) at every visit; it never asked for any of the 6 Passive ROM measures the unified frontend's Follow-Up wizard captures at every visit (`shoulder-passive-{abduction,flexion,external-rotation,internal-rotation,external-rotation-90-abduction,internal-rotation-90-abduction}-observation`). The diff showed exactly 5 fewer Observations per visit per passive-ROM profile (present once, at Registration, in the SDC-built patient — never at any of its 5 follow-up visits).

Separately, `Subscapularis Strength` (`subscapularis-strength-observation`) was present in `ShoulderRegistrationQuestionnaire` but absent from `ShoulderFollowUpQuestionnaire` — ADR-0089 had already flagged this profile as "absent from both SDC-facing Questionnaire instances" at the time it was written; this closes the Follow-Up half of that note (Registration already carries it).

## Decision

Add all 6 Passive ROM leaf items and the Subscapularis Strength leaf item to `ShoulderFollowUpQuestionnaire.fsh`'s `postOpExam` group (`item[1]`), directly mirroring the field definitions, bounds (`maxValue`/`minValue` extensions), and profile targets already used for these exact profiles in `ShoulderRegistrationQuestionnaire.fsh` and the unified frontend's `followupObservationMetadata.ts`.

This required renumbering `item[1].item[6]` through `item[1].item[19]` (strength/pain/provocation/inspection) up to make room — done as a single full-section rewrite rather than incremental insertion, to keep the final index sequence contiguous and legible. New logical order: Active ROM (0–5) → Passive ROM (6–11, new) → Strength incl. Subscapularis (12–16, one new) → Pain (17–20) → Provocation (21–23) → Inspection (24–26).

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Append new items at the end of the group instead of renumbering | Would separate Passive ROM from Active ROM in the rendered form, a worse UX than the small renumbering cost |
| Leave Subscapularis Strength Follow-Up-absent, treat as a separate future item | The gap was already flagged once (ADR-0089) and directly confirmed by this session's diff — no reason to defer a straightforward port a second time |

## Consequences

✅ SDC Follow-Up now captures the same 17 post-op exam Observation types per visit as the unified frontend (excluding the deliberately-scoped-down provocation-test set, ADR-0093, and the N/A marker mechanism, ADR-0147).
✅ No mapping/coverage change: every added profile already exists and is already Full/Partial-mapped via the unified frontend's equivalent capture.

## Sources

- `frontend/src/config/followupObservationMetadata.ts` (`passive-*` and `subscapularis-strength` field metadata, source of truth for labels/units mirrored here)
- ADR-0088 (Passive ROM profile set + 360° rotation ceiling), ADR-0089 (Subscapularis Strength gap first noted)
- Live diff: `Patient/$everything` for a matched pair of exhaustively-filled patients, one per frontend, 2026-08-03 — showed 5 missing Observations per passive-ROM profile, consistently absent from all 5 follow-up visits
