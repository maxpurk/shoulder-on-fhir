# ADR-0089: Muscle strength testing redesign — Supraspinatus dynamometry, Janda labeling, new Internal Rotation strength axis

**Date:** 2026-07-19
**Status:** Accepted

## Context

Next point in the same surgeon review as ADR-0088:

On muscle strength: supraspinatus cannot be measured the current way — instead measure at 90° abduction using a spring scale, in kg. External and internal rotation should be graded by force grades according to Janda.

**Classification against Hurley**: Q2.d/Q9.d/Q12.b name only "Strength of the different muscles of the rotator cuff" ("Strength" for the Q12 PROM component) with zero mechanism specified in any Delphi round — a **Refinement** (category a). All three sub-asks stay Full; no Hurley-element-count impact, and (unlike ADR-0088's 90°-abduction ROM fields) none of these three sub-asks required a category-(d) out-of-consensus go/no-go, since strength testing per se is already a named Hurley element and these are refinements of its mechanism.

**Prior implementation**: three sibling `valueQuantity` `{score}` 0–5 ordinal profiles, described generically as "MMT 0–5" — `SupraspinatusStrengthObservation` (empty-can/Jobe position), `ExternalRotationStrengthObservation` (composite infraspinatus + teres minor, 0° abduction/90° elbow flexion), `SubscapularisStrengthObservation` (lift-off/belly-press isolation). No dynamometer/kg axis anywhere; Subscapularis was the IG's only internal-rotator strength profile.

## Clinical verification

Routed through the `shoulder-surgeon` subagent before implementation (per this project's standing workflow for clinically-sensitive modeling), which also checked Hurley's exact Q2.d/Q9.d/Q12.b wording for any implied mechanism (none found — pure design freedom).

1. **Supraspinatus dynamometry.** A spring-scale reading in kg at 90° abduction is generic handheld/spring dynamometry at the scapular-plane abduction (empty-can/Jobe) position — not a distinct eponymous test. Clinically real: ordinal MMT grading is well documented as insensitive to partial supraspinatus weakness (grades 4–5 span a wide force range and are examiner-dependent), while dynamometry at a single reproducible position gives a reliable continuous kg reading. Verdict: **add as a dual-encoding sibling, not a replacement** — the ordinal grade remains the faster, no-equipment-needed default for cross-site comparability.

2. **Force grades according to Janda.** Janda's manual muscle testing system uses the identical six 0–5 anchor definitions (0 = no contraction … 5 = full resistance) already implemented here as "MMT 0–5" — same lineage as MRC/Daniels-Worthingham, simply the version most commonly taught and cited by name in German-language orthopedic/physiotherapy practice. No SNOMED concept named "Janda" exists (only the generic observable entity `249956007` "MRC grade - muscle power"). Verdict: **labeling/citation fix only** — no structural or terminology-binding change.

3. **Internal Rotation strength.** The surgeon pairs external and internal rotation as mirror-image tests at the same position, but the IG's only internal-rotator profile (`SubscapularisStrengthObservation`) is a lift-off/belly-press *isolation* test at a deliberately different position (unloading secondary internal rotators to isolate the subscapularis tendon specifically) — which is also why Hurley separately names "f) Lift off test, g) Belly press test" alongside "d) Strength." Resisted IR at neutral (0° abduction, elbow flexed 90° — the true mirror of the existing ER profile) screens *global* internal-rotator weakness, a different clinical question from subscapularis-tendon-specific competence. Verdict: **add as a new sibling profile**, not folded into the existing Subscapularis profile.

## Decision

### 1. New profile: `SupraspinatusStrengthDynamometryObservation`
`value[x] only Quantity`, UCUM `kg`, bounds 0–50. New local code `ShoulderObservationCodes#supraspinatus-strength-dynamometry`. Tested at 90° scapular-plane abduction (same position as the existing ordinal grade). The 50 kg ceiling is a technical-implementation judgment call (no literal number given by the surgeon, unlike ADR-0088's "up to 360°") — chosen to comfortably exceed realistic handheld-dynamometer readings even for strong healthy patients at an isolated weak-lever position, applying the same "permissive, not restrictive" ceiling philosophy established in ADR-0088 rather than repeating that ADR's original too-tight-bound mistake.

### 2. New profile: `InternalRotationStrengthObservation`
`value[x] only Quantity`, UCUM `{score}`, bounds 0–5 — exact structural mirror of `ExternalRotationStrengthObservation`. New local code `ShoulderObservationCodes#internal-rotation-strength`.

### 3. Janda labeling
`Description` text updated on `SupraspinatusStrengthObservation`, `ExternalRotationStrengthObservation`, `SubscapularisStrengthObservation` to name Janda grading explicitly (equivalent to MRC/Daniels-Worthingham 0–5). No `value[x]`, `code`, or binding change; version bump only.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Replace the ordinal Supraspinatus grade with dynamometry only | Loses the no-equipment-needed fallback and cross-site comparability the ordinal grade still provides; per the `shoulder-surgeon` review, dual encoding (mirroring Q4.a tear-size cm/Cofield) is the clinically correct pattern |
| Treat "Janda" as requiring a new, distinct local ValueSet/CodeSystem | Rejected — confirmed via the `shoulder-surgeon` subagent that Janda's grading uses the same six 0–5 anchor definitions already implemented as generic MMT; no material grade-definition divergence exists |
| Fold Internal Rotation strength into the existing `SubscapularisStrengthObservation` instead of a new sibling | Rejected — different clinical questions (global internal-rotator weakness vs. subscapularis-tendon-specific competence), and Hurley's own text already separately names lift-off/belly-press alongside general "Strength," supporting treating them as independent axes |
| Bind `Observation.code` to SNOMED `249956007` "MRC grade - muscle power" for the ordinal profiles | Rejected — this IG's existing local axis-per-muscle codes (`#supraspinatus-strength`, etc.) are more clinically specific than the generic MRC observable; noted in profile Descriptions as the nearest standard concept for cross-reference only |

## Consequences

✅ `Q2.d`, `Q9.d`, `Q12.b` all remain `Full` — no denominator or percentage change; mapping rows rewritten to describe the five-axis mechanism.

✅ Both Registration (`StepClinicalAssessment.tsx`) and Follow-Up (`Q9_FIELDS`) flows updated; Follow-Up required no component code changes (generic rendering from metadata, same `strength` group — no `isLateralizedField`-style hardcoded-key carve-out needed, unlike ADR-0087's pain-key regression, since these fall under the existing group-based lateralization).

✅ Non-breaking: unlike every prior redesign this session (ADR-0081/82/86/87/88), this one adds 2 new sibling profiles and updates 3 Description texts only — no existing `value[x]` type or `Observation.code` changes on any profile, no retirement, no example-data conversion needed.

⚠️ Pre-existing gap noticed but not fixed: `SubscapularisStrengthObservation` is absent from both `ShoulderRegistrationQuestionnaire.fsh` and `ShoulderFollowUpQuestionnaire.fsh` (the SDC-facing Questionnaire instances) — present only in the unified frontend. Consistent gap in both files, predates this session's work, unrelated to this ADR's scope; flagged for a future point rather than fixed here.

⚠️ 2 new optional data-entry fields per visit (Internal Rotation strength, Supraspinatus dynamometry) — a modest workload increase, but since both are Refinements of an already-named Hurley element (not out-of-consensus additions like ADR-0088's 90°-abduction ROM fields), no category-(d) go/no-go was required before implementing.

⚠️ **Real bug caught only by live Playwright verification, not by build/lint/sushi**: the Supraspinatus dynamometry `<input type="number">` in `StepClinicalAssessment.tsx` was initially missing `step="any"`, defaulting HTML5's native `step` to `1` (integer-only). A dynamometer reading like `7.5` kg silently failed the browser's native constraint validation on the "Next: Outcome Scores" submit button — no console error, no visible error banner, no exception; the form simply did not advance, indistinguishable from a hung network call. Diagnosed by bisecting which of the two new fields caused a live smoke test to hang (isolated to the dynamometry field specifically, since decimal test values are the only realistic input for a kg reading — the ordinal 0–5 strength fields are correctly integer-only by design, and `ObservationField.tsx`, the Follow-Up flow's generic renderer, already had `step="any"` — only the hand-written Registration input was missing it). Fixed by adding `step="any"`. A reminder that this project's "test in a real browser, not just build/lint" discipline (top-level project guide) catches a class of silent native-HTML failure that TypeScript, ESLint, and `sushi .` cannot see at all.

## Sources

- Clinical review by the reviewing shoulder surgeon
- `shoulder-surgeon` subagent review (2026-07-19) — dynamometry clinical rationale (MMT insensitivity to partial supraspinatus weakness), Janda-scale equivalence to MRC/Daniels-Worthingham confirmation, IR/subscapularis clinical distinction, Hurley Q2.d/Q9.d/Q12.b exact-wording check (no mechanism specified)
- LOINC FHIR terminology server (`fhir.loinc.org`) `$expand` queries (2026-07-19) — "shoulder abduction force," "dynamometer," "manual muscle testing," "muscle strength shoulder," "Janda" — no shoulder-strength or Janda-eponym matches (dynamometer matches were generic hand-grip codes; "Janda" matched only an unrelated bacterial species)
- SNOMED CT MCP lookup (2026-07-19) — `procedure` domain "manual muscle testing" (generic, not axis-specific), `observable_entity` domain "muscle strength grade" (`249956007` MRC grade — noted, not bound)
- `ig/input/fsh/profiles/observations/SupraspinatusStrengthDynamometryObservation.fsh`, `InternalRotationStrengthObservation.fsh`, `SupraspinatusStrengthObservation.fsh`, `ExternalRotationStrengthObservation.fsh`, `SubscapularisStrengthObservation.fsh`
- `ig/input/fsh/codesystems/ShoulderObservation.fsh`, `valuesets/ShoulderObservationCode.fsh`
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`, `ShoulderFollowUpQuestionnaire.fsh`
- `frontend/src/components/wizard/StepClinicalAssessment.tsx`, `stepFormData.ts`, `config/observationMetadata.ts`, `config/followupObservationMetadata.ts`, `types/fhir.ts`
- `sdc-frontend/src/lib/extractor.ts`
- ADR-0008 (one-profile-per-code convention), ADR-0047 (tear-size cm/Cofield dual-encoding precedent this ADR mirrors), ADR-0088 (freshest sibling redesign, permissive-bound philosophy, deploy-verification lesson)
