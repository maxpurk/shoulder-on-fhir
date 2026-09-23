# ADR-0088: ROM rotation redesign — vertebral-level Internal Rotation, 90°-abduction axes, permissive rotation bounds

**Date:** 2026-07-19
**Status:** Accepted

## Context

Next point in the same surgeon review as ADR-0083 through ADR-0087:

On range of motion: state everything up to 360°; capture internal and external rotation at 90° abduction; and internal rotation is not given in degrees.

Three distinct sub-asks:

1. **"Internal Rotation is not given in degrees."** The existing `ShoulderInternalRotationObservation`/`ShoulderPassiveInternalRotationObservation` (LOINC `41391-4`/`41392-2`) were generic, position-unspecified quantitative degree measurements. LOINC's own metadata confirms `SCALE_TYP: Qn`, no position qualifier.
2. **"Internal Rotation and External Rotation in 90° Abduction."** The existing IR/ER fields did not specify arm position at all.
3. **"State everything up to 360°"** — read initially as a general rotation-measurement instruction.

**Classification against Hurley**: `Q2.b`/`Q2.c`/`Q9.b`/`Q9.c` ("Active/Passive ROM") are each a single Hurley element covering all rotation planes with no mechanism, plane, or position specified — a **Refinement** (category a). Adding new measurement positions is a richer realisation of the same Hurley elements, not a new one; `Full` status is unaffected for all four. The 90°-abduction addition specifically was flagged and routed through an explicit go/no-go per category (d) of this project's clinical-feedback workflow (new data-collection burden) — the user confirmed **"Add as new additional fields"** over the alternative of treating it as documentation-only wording clarification.

## Terminology verification

Checked LOINC (`fhir.loinc.org` `$expand`/`$lookup`) for "external rotation 90," "rotation abducted," "shoulder rotation 90 degrees," and a vertebral-level internal-rotation scale: no precoordinated concept exists for either a position-specific ("at 90° abduction") rotation measurement or a vertebral-level IR ordinal. Checked SNOMED CT (`observable_entity` domain): no match either. Both axes require local codes — same pattern as every other context-specific decomposition this session.

## Clinical verification

Routed through the `shoulder-surgeon` subagent before implementation (clinical-terminology-sensitive design, per this project's workflow). Verdict, applied below:

- The "hand behind back" functional reach scale is the clinically correct realisation of at-side IR, and matches the Constant-Murley score's own IR grading (already modeled in this IG). **Two corrections to the initially drafted scale**: (1) `greater-trochanter` (lateral thigh) is the standard *lowest scored* rung — an earlier draft wrongly folded it into an undifferentiated "unable" floor, losing the most common low grade; (2) `L1` was dropped from the ladder — rarely a distinctly palpable landmark in practice, so the reproducible ladder is buttock/sacrum/L5/L3/T12/T7-or-above (coarser, more reproducible across examiners than a full lumbar-vertebra-by-vertebra scale).
- IR/ER measured at 90° abduction is correctly degree-valued (a controlled, goniometer-reliable position, unlike at-side IR) — confirmed clinically sound.
- The real defect in the "up to 360°" instruction is the **90° hard ceiling**, which silently rejected legitimate ER values above 90° (e.g. ~100–110° in throwers). No single shoulder rotation measurement actually reaches 360° — the surgeon's instruction is read as "don't cap me," not a physiological claim. 360° is adopted as a **permissive validation bound**, explicitly documented as such (not a physiological maximum) so a later reader does not misread it.
- Flexion/Abduction correctly stay capped near 180° (anatomically capped; a 360° ceiling there would let data-entry errors through) — surgeon-endorsed, unaffected by this ADR.

## Decision

### 1. At-side Internal Rotation → vertebral-level ordinal (redesign existing profiles)

`ShoulderInternalRotationObservation`/`ShoulderPassiveInternalRotationObservation` retarget `code` from LOINC `41391-4`/`41392-2` to local `ShoulderObservationCodes#internal-rotation`/`#passive-internal-rotation`, and `value[x]` from `Quantity` to `CodeableConcept` bound `required` to a new local `InternalRotationVertebralLevel` ValueSet (8 concepts, worst → best): `unable` → `greater-trochanter` → `buttock` → `sacrum` → `l5` → `l3` → `t12` → `t7-or-above`. Profile names/Ids unchanged (in-place redesign, same pattern as Sleep Disturbance, ADR-0081).

### 2. Rotation at 90° abduction — 4 new profiles

`ShoulderExternalRotation90AbductionObservation` / `ShoulderPassiveExternalRotation90AbductionObservation` / `ShoulderInternalRotation90AbductionObservation` / `ShoulderPassiveInternalRotation90AbductionObservation` — all `value[x] only Quantity`, UCUM `deg`, new local `ShoulderObservationCodes` codes. Distinct measurement position from the existing at-side rotation fields; IR at 90° abduction is degree-valued (unlike the vertebral-level at-side IR), since the abducted position is scapula-stabilised and goniometer-reliable.

### 3. Rotation ceilings widened 90° → 360° (permissive bound)

Applied to `ShoulderExternalRotationObservation`/`ShoulderPassiveExternalRotationObservation` (existing at-side ER) and all 4 new 90°-abduction profiles — consistently, so no rotation field retains the defective 90° clamp. At-side IR is no longer degree-valued, so the bound question does not apply to it. Flexion/Abduction (180° cap) unchanged.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep at-side IR in degrees | Doesn't address the surgeon's explicit clinical-accuracy complaint; goniometric IR at the side is confounded by scapulothoracic substitution and is not what is actually recorded in practice |
| Treat "90° Abduction" as a documentation-only clarification of the existing fields, not new fields | Explicitly considered and rejected via user confirmation (AskUserQuestion) — at-side and 90°-abduction rotation assess clinically distinct things (capsular/GIRD vs. rotator-cuff-specific), and collapsing them into one field would lose that distinction |
| Widen Flexion/Abduction bounds to 360° too, for uniformity | Rejected — anatomically capped near 180°; surgeon-endorsed; a 360° ceiling there would let data-entry errors through unchecked |
| Use a strict 180° physiological ceiling for rotation instead of 360° | Considered (180° is the honest physiological maximum per the `shoulder-surgeon` review) but rejected in favor of honoring the surgeon's literal "up to 360°" instruction as a permissive/uncapped bound — the caveat that 360° is not a physiological claim is documented explicitly instead |
| Include `L1` as a separate rung in the vertebral-level ladder | Rejected per `shoulder-surgeon` review — rarely a distinctly palpable landmark; the coarser sacrum/L5/L3/T12/T7 ladder is more reproducible across examiners |
| Fold `greater-trochanter` into an undifferentiated "unable" floor | Rejected per `shoulder-surgeon` review — loses the most clinically common low grade; lateral thigh/greater trochanter is the standard lowest *scored* rung, distinct from a genuine inability to reach |

## Consequences

✅ `Q2.b`, `Q2.c`, `Q9.b`, `Q9.c` all remain `Full` — no denominator or percentage change; mapping rows rewritten to describe the six-axis mechanism.

✅ Both Registration (`StepClinicalAssessment.tsx`) and Follow-Up (`Q9_FIELDS`) flows updated; Follow-Up required no `ObservationField.tsx`/`Q9ExamForm.tsx` component changes (generic rendering from metadata) beyond the metadata entries themselves.

⚠️ Breaking: `value[x]` type change on the 2 existing at-side IR profiles (`Quantity` → `CodeableConcept`) and retirement of LOINC `41391-4`/`41392-2` from this IG — acceptable given `draft`/pre-1.0 status, same precedent as every prior redesign this session (ADR-0081, ADR-0082, ADR-0086, ADR-0087).

⚠️ 4 new data-entry fields per visit (ER/IR × active/passive at 90° abduction) — a real, confirmed increase in clinician workload, flagged as a category-(d) out-of-consensus addition and explicitly accepted via user confirmation rather than assumed.

⚠️ 360° rotation ceiling is a permissive data-entry bound, not a physiological range claim — documented explicitly here and in each profile's Description to prevent a future reader from treating 360° as an achievable clinical maximum.

⚠️ **Deploy-process gap found during live verification**: `load-profiles.sh` prefers `ig/output/` (the IG Publisher's snapshot-bearing build) over `ig/fsh-generated/resources/` whenever `ig/output/` exists — see the "Empty-`$expand` resilience" note in the top-level project guide for the general precedence, which doesn't call out this specific trap. A `--reload-ig`-only deploy right after a stale `ig/output/` (left over from an earlier `--genonce` run, before this ADR's FSH changes) silently served the *old* StructureDefinitions to HAPI even though `sushi .` and the seed script both reported success — `maxValueQuantity` stayed `90` and at-side IR stayed `Quantity`-typed on the live server for a full deploy cycle, caught only by directly `curl`-ing the StructureDefinition rather than trusting the "OK" load-log lines. Running `--genonce` alone afterward regenerated `ig/output/` but did **not** push it into HAPI (`load-profiles.sh` runs unconditionally but only `FORCE_RELOAD`s when `--reload-ig` is also passed — without it, the idempotence canary short-circuits the reload entirely). The fix requires **both** flags across two invocations, in order: `--genonce` first (regenerate `ig/output/`), then `--reload-ig` (force-push the now-fresh directory into HAPI) — or a single `--genonce --reload-ig` invocation together. Belongs as a general callout in `build-and-deploy.sh --help` / the project guide for any future profile change following a prior `--genonce` run; not fixed here since it's a pre-existing script-precedence design, not something ADR-0088 introduced.

✅ SDC frontend (`sdc-frontend/lib/extractor.ts`) `PROFILE_METADATA` updated for the 2 changed + 4 new profile keys; the SDC follow-up Questionnaire's narrower scope (no passive ROM rendered there at all, a pre-existing asymmetry — see ADR-0064's precedent of not mirroring every unified-frontend change to SDC) is preserved: only the 2 new *active* 90°-abduction items were added to `ShoulderFollowUpQuestionnaire.fsh`, matching its existing active-only scope, while the unified frontend's Follow-Up flow gets the full active+passive set.

## Sources

- Clinical review by the reviewing shoulder surgeon
- `shoulder-surgeon` subagent clinical review (2026-07-19) — validated the overall design, corrected the vertebral-level ladder (added `greater-trochanter`, dropped `L1`), corrected the 360°-as-permissive-bound framing
- LOINC FHIR terminology server (`fhir.loinc.org`) `$expand`/`$lookup` — `41387-2`/`41391-4`/`41392-2` metadata, and searches for "external rotation 90," "rotation abducted," "shoulder rotation 90 degrees," and a vertebral-level IR scale — no matches
- SNOMED CT MCP lookup — `observable_entity` domain, no match for either axis
- Constant-Murley IR grading convention (already modeled in this IG via `ConstantScoreObservation`)
- `ig/input/fsh/codesystems/InternalRotationVertebralLevel.fsh`, `valuesets/InternalRotationVertebralLevel.fsh`
- `ig/input/fsh/profiles/observations/Shoulder{,Passive}InternalRotationObservation.fsh`, `Shoulder{,Passive}{External,Internal}Rotation90AbductionObservation.fsh`, `Shoulder{,Passive}ExternalRotationObservation.fsh`
- `ig/input/fsh/codesystems/ShoulderObservation.fsh`, `valuesets/ShoulderObservationCode.fsh`
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`, `ShoulderFollowUpQuestionnaire.fsh`
- `frontend/src/components/wizard/StepClinicalAssessment.tsx`, `stepFormData.ts`, `config/observationMetadata.ts`, `config/followupObservationMetadata.ts`, `types/fhir.ts`
- `sdc-frontend/src/lib/extractor.ts`
- ADR-0008 (one-profile-per-code convention), ADR-0045 (original LOINC ROM migration), ADR-0081 (in-place profile redesign precedent), ADR-0087 (freshest sibling redesign, deploy/grep-sweep lessons)
