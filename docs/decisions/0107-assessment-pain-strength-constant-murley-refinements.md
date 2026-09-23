# ADR-0107: Assessment refinements — pain scale wording, strength labels, Constant-Murley reference display (round-2 surgeon feedback, points 9-11)

**Date:** 2026-07-27
**Status:** Accepted; the Constant-Murley no-derivation conclusion is superseded by ADR-0112, and the supraspinatus-strength wording is amended by ADR-0114. The remaining points stand.

## Context

Continuing the round-2 surgeon feedback ( see ADR-0105 for points 1-6, ADR-0106 for points 7-8), three points concerned the Assessment/Outcomes sections of both wizards:

**Point 9 — Assessment.** "Pain, was ist die Skala, add the description" (add an explanation of the 0-10 pain scale) and "ROM All the values to max. 360 (in the frontend currently it still sometimes shows 0-180)."

**Point 10 — Muscle Strength.** Surgeon's shorthand list — "Abduktion nach Janda / Außenrotation nach Janda / Innenrotation nach Janda / Abduction in kg" — reconciled against the current 5-axis strength model (supraspinatus / external-rotation / subscapularis / internal-rotation MMT grades, plus supraspinatus dynamometry, all added/confirmed by ADR-0089). The list omitted subscapularis, raising the question of whether it should be dropped from the battery. **User decision: keep subscapularis** (treat the list as shorthand, not exhaustive) — rename the supraspinatus ordinal/dynamometry pair to "Abduction" since Jobe/empty-can is tested in a scapular-plane abduction position.

**Point 11 — Baseline Outcome Scores.** "Find out exactly how the Constant-Murley score is calculated... make the calculations and prefill also from before" (data collected earlier in the same flow).

## Investigation findings

**ROM 360° ceiling:** a full audit of every rendering surface (`observationMetadata.ts`, `followupObservationMetadata.ts`, both frontends' FSH-derived bounds, the SDC Questionnaire) found the 360° ceiling from ADR-0088 already correctly propagated everywhere — no stale 90°/180° cap exists in the current codebase for any rotation axis, and Flexion/Abduction correctly stay capped near 180° (ADR-0088's own stated exception, not a bug). **Conclusion: not a code defect.** If the surgeon is still seeing a 0-180 ceiling on the live demo, ADR-0088 itself documents the likely cause — a stale `ig/output/` from an earlier `--genonce` predating that ADR's FSH edits, silently served to HAPI. Fix (if reproduced live) is a redeploy (`--genonce` + `--reload-ig`), not a code change; to be verified on the deployment server after this batch of changes ships, per this project's standing "test on the deployment server only" convention for anything requiring a live server.

**Constant-Murley formula:** the surgeon's reference article (PMC6132990) was fetched and its breakdown (100 = Subjective 35 [Pain 15 + ADL 20] + Objective 65 [ROM 40 + Strength 25]) matches ADR-0090's existing implementation exactly — no discrepancy. The article's age/sex-normalized "relative CMS" (raw ÷ a healthy-reference-population value) is not modeled in this IG; noted as a `docs/limitations_items/` candidate, out of scope for this feedback point. "Prefill from before" was clarified (user decision) to mean **read-only reference display**, not a numeric auto-fill/conversion — ADR-0090 already established that Constant's ROM (banded functional milestones on active painless motion) and Strength (single dynamometer reading at 90° abduction) sub-scores use grading mechanisms clinically distinct from this IG's degree-valued ROM and 5-axis MMT/dynamometry Observations, so no legitimate numeric derivation exists between them.

## Decision

1. **Pain scale description**: added `"0 = no pain, 10 = worst pain imaginable."` under each of the four pain inputs (Registration's `StepClinicalAssessment.tsx`, inline; Follow-Up's `Q9_FIELDS`/`Q12_FIELDS` via the existing `helpText` mechanism in `followupObservationMetadata.ts`) — a pure UI-text addition, no FSH/mapping change.
2. **ROM 360°**: no code change (already correct); flagged for post-deploy verification on the deployment server.
3. **Strength relabeling**: `SupraspinatusStrengthObservation`/`SupraspinatusStrengthDynamometryObservation` FSH `Title`/`Description` updated to note the clinical "Abduction" synonym (profile IDs/URLs unchanged — display clarification, not a new test); both frontends' labels changed from "Supraspinatus Strength" → "Abduction Strength (Janda)" and "Supraspinatus Strength (Dynamometry)" → "Abduction Strength (Dynamometry)", each keeping a "Supraspinatus, tested at the empty-can/Jobe position" sub-label so the anatomical basis stays visible. External/Internal Rotation strength labels gained an explicit "(Janda)" suffix for consistency. Subscapularis strength is unchanged and stays in the battery.
4. **Constant-Murley reference display**: `Q12PromForm.tsx`'s `ConstantMurleyFields` now accepts the already-collected Step 3 (`Q9FormState`) values as a prop and renders a `"Reference (Step 3): Flexion: 140deg, Abduction: 130deg, ..."`-style line under the ROM and Strength component inputs — read-only text, not wired into the input's value or any calculation. The existing component-sum auto-calculation (ADR-0090) is unchanged.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Rename the `supraspinatus-strength`/`supraspinatus-strength-dynamometry` profile IDs to `abduction-strength`/`abduction-strength-dynamometry` | Breaking change to canonical StructureDefinition URLs already referenced by `meta.profile` on submitted/seeded Observations; the ask is a display-label clarification, not a new test — a Title/Description update plus frontend relabeling achieves the same clinician-facing outcome without the migration cost. |
| Drop `SubscapularisStrengthObservation` from the battery since it wasn't in the surgeon's shorthand list | Explicit user decision to keep it — it's a currently Full Hurley-mapped test (Q2.d/Q9.d/Q12.b), and the shorthand list is more plausibly incomplete recall than a deliberate removal request. |
| Auto-fill the Constant ROM/Strength component inputs from Q9's values (numeric prefill) | Rejected per explicit user decision — would require inventing a conversion formula with no basis in the original Constant & Murley (1987) methodology (ROM is banded milestones on active painless motion, not a linear degrees-to-points map; Strength is a single spring-balance reading, not derived from 5-axis MMT). Reference-display-only avoids fabricating clinical data while still addressing the "don't make me scroll back" convenience motivation behind the ask. |
| Implement a ROM-ceiling code fix speculatively, in case the audit missed something | The audit was exhaustive (every rendering surface, both frontends, the SDC Questionnaire, the underlying FSH `maxValueQuantity` constraints) and found the 360° value fully and consistently propagated — a speculative "fix" with no identified defect would just be noise. Verifying on the live deployment is the correct next step, not further local code changes. |

## Consequences

✅ Q2.d/Q9.d/Q12.b (strength) and Q12-Constant stay Full — no headline coverage change; both are pure display/UX refinements.
✅ Pain 0-10 scale anchors are now explicit in both frontends.
✅ Clinicians no longer need to scroll back to Step 3 to recall ROM/strength values while filling in Constant-Murley — without the IG asserting a numerically unfounded derivation.
✅ `sushi .` compiles with 0 errors / 0 warnings; frontend `npm run build` (tsc + vite) compiles cleanly.
⚠️ The ROM-360° complaint remains unverified against the live server deployment — must be checked after this batch of changes is deployed; if it reproduces live, the fix is a redeploy sequence (`--genonce` + `--reload-ig`), documented already in ADR-0088, not a further code change.
❌ The age/sex-normalized "relative CMS" from the surgeon's reference article is not modeled — logged as a candidate for `docs/limitations_items/`, not implemented here (out of scope for this feedback point; no explicit ask to add it).

## Sources

- Clinical review by the reviewing shoulder surgeon (round 2), points 9-11
- ADR-0088 (ROM rotation redesign, incl. the 360° ceiling and its own documented stale-deploy failure mode), ADR-0089 (muscle strength redesign), ADR-0090 (Constant-Murley component capture)
- PMC6132990 (Constant score literature review), fetched and cross-checked against ADR-0090's existing breakdown
- `ig/input/fsh/profiles/observations/{SupraspinatusStrength,SupraspinatusStrengthDynamometry}Observation.fsh`
- `frontend/src/components/{wizard/StepClinicalAssessment.tsx,followup/Q12PromForm.tsx,followup/FollowUpWizard.tsx}`
- `frontend/src/config/followupObservationMetadata.ts`
- `mapping/SECEC_FHIR_Mapping.csv` rows Q2.d, Q12-Constant
