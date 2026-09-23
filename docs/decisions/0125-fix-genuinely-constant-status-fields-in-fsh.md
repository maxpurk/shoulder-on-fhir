# ADR-0125: Fix genuinely-constant status fields directly in FSH

**Date:** 2026-08-01
**Status:** Accepted
**Builds on:** ADR-0103 (`Observation.category` fixed the same way), ADR-0122/ADR-0124 (the audit of `submissionDefaults` that surfaced this)

## Context

ADR-0122's `submissionDefaults` table in `extractor.ts` supplies a handful of required-but-not-fixed fields no Questionnaire item ever asks about: `Observation.status`, `Procedure.status`, `Encounter.status`, `Encounter.class`, and `Condition.category`/`clinicalStatus`/`verificationStatus`/`recordedDate`. ADR-0124's investigation into `Encounter.class` (which turned out to genuinely vary by case for Surgery, and needed a real question — not a fix) prompted auditing the rest of that table field by field: which of these are workflow-dependent like `class` was, and which are simply always the same value, safe to fix directly in the profile the same way `Observation.category` already is (ADR-0103)?

An exhaustive `grep` across every example instance (`ig/input/fsh/examples/`) and every seed bundle (`seed/bundles/*/*.json`) found **zero deviations**: every `Observation.status` is `final`, every `Procedure.status` is `completed`, every `Encounter.status` is `finished`, across all three bundle contexts (Registration, Surgery, Follow-Up) and both longitudinal patient cases. `Condition.category` was already fixed to `encounter-diagnosis` from an earlier pass — no work needed there.

Unlike `Encounter.class` (ADR-0124), none of these three needed a per-context profile split: each is invariant across *all* the contexts the shared profile serves, not just some of them, so a plain fix on the existing profile is correct and sufficient.

## Decision

Fixed directly in FSH, mirroring the `Observation.category` pattern (a bare `* element = #value` line, no separate binding statement needed):

- `ShoulderObservation.status = #final` — on the **abstract base profile**, cascading to all 57+ derived Observation profiles at once (unlike `category`, which needed per-derived-profile values since it varies by profile — `exam`/`survey`/`social-history`/`imaging` — `status` is the same everywhere, so one fix on the shared base suffices).
- `RotatorCuffProcedure.status = #completed` — covers both the index surgery and prior-treatment Procedures; both are retrospective by construction.
- `ShoulderEncounter.status = #finished` — covers all three bundle contexts; genuinely invariant, unlike `class` (ADR-0124), which stays open on this same profile.

`extractor.ts`'s `submissionDefaults()` keeps these three values (plus `Condition.category`, already fixed) as a literal, duplicated copy — not removed. The resolver's fixed-value reading (`resolveObservationFixedValues`) is currently hardcoded to exactly `Observation.code`/`category`, not a general "read any fixed primitive off any resource type" mechanism; extending it to close this duplication for real is a legitimate, separate follow-up, out of scope here. The duplication is explicitly commented in the code as a known, low-risk redundancy (values are stable, `sushi .`/`tools/validate.sh` would catch drift immediately, unlike the old `PROFILE_METADATA` gap where 18/39 displays had already silently drifted for years before anyone checked).

## Classification (Clinical Feedback Integration Workflow)

**(a) Refinement.** All four fields are FHIR-required resource scaffolding (Layer 2), never named by the SECEC expert consensus — no `% Full`/`% Partial` impact.

## Consequences

✅ An independent SDC engine reading only the published IG package now knows the correct value for `Observation.status`/`Procedure.status`/`Encounter.status`/`Condition.category` — closing that part of the interoperability question this whole line of investigation started from.
✅ Zero example or seed bundle needed changing — confirmed by exhaustive grep before touching FSH, and confirmed again by a clean `sushi .` (0 errors, 0 warnings) after.
✅ `Condition.category` required no change; already fixed from an earlier pass.
⚠️ `extractor.ts` still hardcodes these four values rather than reading them back from the resolved profile — a known, commented, low-risk duplication, not closed by this ADR. A future ADR could extend `profileMetadataResolver.ts`'s fixed-value reading to be fully generic (any primitive `patternCode`/`fixedCode` on any resource type) and remove the redundancy for real.
⚠️ `Condition.clinicalStatus`/`verificationStatus`/`recordedDate` and `Encounter.class` (Registration/Follow-Up) remain unpromoted app-level defaults — deliberately, per the same reasoning as ADR-0124 (workflow-dependent or genuinely dynamic, can't be a single fixed value on a shared profile). Logged in `docs/limitations_items/`.

## Sources

- `grep` sweep of `ig/input/fsh/examples/*.fsh` and `seed/bundles/*/*.json` for every `status`/`category` value present — zero deviations found, the empirical basis for calling these "genuinely constant."
- `ig/input/fsh/profiles/ShoulderObservation.fsh`, `RotatorCuffProcedure.fsh`, `ShoulderEncounter.fsh` — the three edited profiles.
- `ig/input/fsh/profiles/observations/ShoulderFlexionObservation.fsh` — the existing `* category = ...` convention this ADR's `status` fixes match exactly (bare assignment, no separate binding line).
- ADR-0103 — the original precedent for fixing an administrative field directly in FSH.
- ADR-0124 — the `Encounter.class` investigation that prompted this broader audit, and the contrasting case where a field turned out *not* to be safe to fix.
