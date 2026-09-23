# ADR-0149: Close seed-data gaps in passive ROM, pain axes, and SANE score

**Date:** 2026-08-03
**Status:** Accepted

## Context

Comparing an exhaustively-filled test patient's `$everything` bundle against the two longitudinal reference patients (Anna Müller, Kemal Demir — `seed/bundles/`) found that, across their combined 14 visits, only `Passive Forward Flexion` was ever recorded (never the other 5 passive-ROM profiles), only `Pain — On Average` was ever recorded (never the other 3 pain-axis profiles, ADR-0087), and `SANE Score` was never recorded at all (only SSV, despite `Q12-SSV-SANE` being documented as one paired consensus instrument). These are real authoring gaps in the reference walkthrough, not clinically-justified omissions — there is no story reason either patient's passive ROM or full pain-axis set or SANE score would never once be worth recording.

## Decision

Add the missing measurements to 4 of the 14 visits — Anna's and Kemal's 3-month and 12-month Follow-Up bundles — rather than every visit. This closes the gap (every profile type is now demonstrated at least twice, across two independent patient narratives) without turning the reference walkthrough into an artificially exhaustive form-fill at every timepoint, which would work against its actual purpose (a realistic "clinician judgment — only fill applicable fields" demonstration, the same instruction both frontends show above the form).

Values are derived from each visit's own already-existing active-ROM/pain/SSV numbers rather than invented independently, so the visit stays internally consistent:
- Passive ROM = active ROM + 10° (mirrors the physiologically-expected passive-exceeds-active pattern); passive internal rotation set one rung above the visit's own active rung on the vertebral-level ladder.
- The 3-month visits (which test only 4 of 6 active-ROM angles at that point in both real bundles) get the matching 4 passive counterparts only — not the two 90°-abduction passive angles, since neither patient's own bundle tests those actively at 3 months either, and adding an untested-actively passive-only pair would read as an inconsistent exam.
- The 12-month visits (which already test all 6 active-ROM angles) get the full 6-item passive battery.
- Pain axes derived proportionally from that visit's own `Pain — On Average` value (active-movement ≥ average ≥ passive-movement ≥ rest, matching the physiological ordering already implicit in how these four axes relate).
- SANE set close to that visit's own SSV value (a few points apart, not identical — two distinct instruments that usually agree but aren't definitionally the same number).

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Add every missing measurement to every one of the 14 visits | Defeats the "clinician judgment, not everything applies every time" narrative both frontends explicitly instruct; the exhaustively-filled test patient already serves as the "everything filled" reference, these two patients don't need to duplicate that role |
| Add to only 1 visit total (minimum to "close the gap") | Doesn't demonstrate the passive/pain-axis capture pattern more than once, weaker as a reference for someone reading the seed data to understand the data model |
| Independently invented (not derived from the visit's own other values) | Risks visit-internal inconsistency (e.g. passive ROM less than active, or pain axes contradicting the average) that a careful reader of the reference data would notice |

## Consequences

✅ Every Observation profile this IG defines for the Follow-Up post-op exam is now exercised at least twice in the combined reference walkthrough — a genuine completeness property a reader can rely on.
✅ Values are internally consistent with each visit's pre-existing data, not arbitrary.
⚠️ Only 4 of 14 visits carry the passive ROM / full pain-axis / SANE data — a reader scanning a *different* visit (e.g. the 6-week ones) still won't see these fields, by design.

## Sources

- ADR-0087 (four pain-context axes), ADR-0088 (passive ROM profile set)
- `frontend/src/lib/constantScore.ts`'s `INTERNAL_ROTATION_LADDER` (vertebral-level rung ordering used to pick the "one rung better" passive code)
- Live diff: `Patient/$everything` for Anna Müller / Kemal Demir vs. an exhaustively-filled test patient, 2026-08-03
