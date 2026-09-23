# ADR-0114: Coding.display conformance fix + single canonical wording for supraspinatus strength (amends ADR-0107 point 3)

**Date:** 2026-07-29
**Status:** Accepted

## Context

`tools/validate.sh`-class validation on a submitted registration bundle surfaced two `[error]`-level "Wrong Display Name" failures:

```
Wrong Display Name 'Abduction Strength (Janda) — Supraspinatus' for
.../CodeSystem/shoulder-observation#supraspinatus-strength.
Valid display is 'Supraspinatus Strength'

Wrong Display Name 'Abduction Strength (Dynamometry) — Supraspinatus' for
.../CodeSystem/shoulder-observation#supraspinatus-strength-dynamometry.
Valid display is 'Supraspinatus Strength (Dynamometry)'
```

Root cause: ADR-0107 (round-2 surgeon feedback, point 10) relabeled these two tests in both frontends' UI as "Abduction Strength (Janda)" / "Abduction Strength (Dynamometry)" — a clinician-facing wording clarification, explicitly scoped as *not* touching profile/code identifiers. The implementation, however, also overwrote the `display` field of `OBSERVATION_CODINGS['supraspinatus-strength']` / `['supraspinatus-strength-dynamometry']` in `frontend/src/types/fhir.ts` — a lookup table whose entries are spread directly into `Observation.code.coding[]` at submission time (`observationBuilder.ts`, `StepClinicalAssessment.tsx`). `Coding.display` is required to mirror the CodeSystem's own canonical display for that code; a UI relabeling has no business overwriting it.

## Investigation

A first pass fixed only the `Coding.display` regression and additionally proposed publishing "Abduction Strength (Janda)" as a `CodeSystem.concept.designation` — a structured synonym alongside the canonical display, so the wording would be machine-discoverable by any external IG implementer rather than living only in this project's frontend source. On further scrutiny (user request: "be a shoulder expert"), the `shoulder-surgeon` subagent was consulted twice, in increasing depth:

**Biomechanics.** Shoulder abduction is a force couple. At 0–15° (initiation), supraspinatus is the dominant torque generator (classic EMG literature — Inman, Saunders & Abbott 1944; Wickham et al. 2010) — this is why a torn supraspinatus produces a positive drop-arm sign even with an intact deltoid. From ~15–90° and above, the deltoid rapidly becomes the prime mover; supraspinatus remains active but mainly as a humeral-head stabilizer/compressor, not the main force generator. So "abduction strength" unqualified, in the biomechanics literature, most naturally denotes deltoid-dominant gross elevation strength — a materially different clinical construct from an isolated cuff test.

**Terminology convention.** The empty-can/Jobe test is named as such (or "supraspinatus test") in the standard physical-exam literature (Jobe & Moynes 1982; Hoppenfeld; Magee's *Orthopedic Physical Assessment*). "Abduction" appears only as a subordinate descriptor of the test position ("resisted abduction in internal rotation"), never promoted to the primary/headline name. Hurley Q2.d's own consensus wording is muscle-specific — "strength of the different muscles of the rotator cuff" — not motion-specific, so a display leading with "Abduction" drifts from the wording that justifies this profile's Full mapping status.

**Terminology binding check** (SNOMED CT via MCP `snomed_lookup`, LOINC via `fhir.loinc.org`, both 2026-07-29): confirmed no observable-entity or LOINC concept exists for either "supraspinatus strength" or "abduction strength" specifically. SNOMED's `Empty can test` / `Jobe test` (1231437004) exists only as a **procedure** concept (the provocation-test maneuver itself), not a strength-grading observable — a different profile in this IG (`JobeTestObservation`, unrelated to strength grading). Only the generic, non-muscle-specific SNOMED#249956007 ("MRC grade - muscle power") and LOINC#80322-1 ("Muscle strength") exist, both already known from ADR-0089 and rejected there as too non-specific to bind. This confirms the naming choice is a pure local-code editorial decision, not constrained by any external terminology binding.

Given both findings, keeping two parallel wordings (canonical CodeSystem display vs. designation-published UI synonym) was rejected in favor of collapsing to **one wording, used identically everywhere** — CodeSystem, generated IG output, and both frontends.

## Decision

1. **Single canonical wording, no designation.** `ShoulderObservationCodes` concepts `#supraspinatus-strength` / `#supraspinatus-strength-dynamometry` keep display `"Supraspinatus Strength"` / `"Supraspinatus Strength (Dynamometry)"` — no `concept.designation` synonym added (the earlier draft of this ADR added one; removed after the deeper clinical review below).
2. **Frontend UI labels reverted to match.** `StepClinicalAssessment.tsx` and `followupObservationMetadata.ts` now show `"Supraspinatus Strength (Janda)"` / `"Supraspinatus Strength (Dynamometry)"` — this **amends ADR-0107 point 3**, which had relabeled these to "Abduction Strength (Janda)" / "Abduction Strength (Dynamometry)". The "(Janda)" qualifier is retained (it correctly names the grading *scale*, mirroring the sibling "External Rotation Strength (Janda)" / "Internal Rotation Strength (Janda)" labels) — only the misleading "Abduction" lead-in is removed. Help text under each field still names the empty-can/Jobe test position for clinicians who want the mechanical detail.
3. **FSH `Description` blocks** for both profiles (`SupraspinatusStrengthObservation.fsh`, `SupraspinatusStrengthDynamometryObservation.fsh`) updated to drop the "surfaced to clinicians as 'Abduction Strength...'" language and the embedded `See ADR-0107.`/`See ADR-0089.` sentences (published-IG `Description` text should not carry ADR references, per this project's standing convention — a pre-existing violation fixed while these blocks were already being edited).
4. **`frontend/src/types/fhir.ts`** (`OBSERVATION_CODINGS`) already carried the correct canonical `display` values from the first pass; stale comments referencing the now-removed "UI label only" framing were updated to point at this ADR instead.
5. **Sibling strength profiles audited** (external-rotation, subscapularis, internal-rotation, Constant-Murley strength sub-score): confirmed via `shoulder-surgeon` subagent that none carry the same ambiguity — resisted external/internal rotation strength is tested at one standardized position (0° abduction, elbow flexed 90°) with no competing alternate-position construct, unlike abduction's arc-dependent deltoid/supraspinatus split, so `"External Rotation Strength (Composite: Infraspinatus + Teres Minor)"` / `"Internal Rotation Strength (Composite)"` needed no renaming. `Coding.display` in `fhir.ts` already matched the CodeSystem for all four — the regression this ADR fixes was isolated to the two supraspinatus profiles. One cosmetic UI-only inconsistency was closed while auditing: `"Subscapularis Strength"` was the only one of the five strength UI labels missing the `"(Janda)"` suffix its siblings carry (ADR-0089 established Janda grading applies to all three ordinal profiles including subscapularis) — added for consistency in both frontends.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep "Supraspinatus Strength" as canonical `Coding.display`, publish "Abduction Strength (Janda)" as a `CodeSystem.concept.designation` synonym (first draft of this ADR) | Rejected on deeper clinical review: the UI label is the only text a clinician actually sees at data-entry time — the canonical FHIR display is invisible plumbing to them. Having the designation "available" doesn't stop the UI from showing the ambiguous term as the headline label a user trusts. |
| Promote "Abduction Strength (Janda)" to the canonical `CodeSystem.concept.display` and use it everywhere | Rejected per shoulder-surgeon subagent: ambiguous with deltoid-dominant gross abduction strength testing, a genuinely different clinical construct; not supported as a primary/first-line name by the physical-exam textbook convention (Hoppenfeld, Magee, Jobe & Moynes all subordinate "abduction" to a descriptive clause, never the headline term). |
| Rename the CodeSystem concept codes to `abduction-strength`/`abduction-strength-dynamometry` | Rejected for the same reason ADR-0107 rejected renaming the StructureDefinition IDs: breaking change to already-referenced canonical identifiers, for what would only be a display-label change. |

## Consequences

✅ Both `[error]`-level "Wrong Display Name" validator failures are closed.
✅ One wording, used identically in the CodeSystem, the generated IG HTML, and both frontend UI surfaces — no more split between an "official" FHIR name and a different UI-facing name.
✅ Terminology binding re-verified (SNOMED + LOINC, 2026-07-29): confirms ADR-0089's original finding that no external code exists for either wording — this remains a local code by necessity, not by omission.
✅ `sushi .` compiles with 0 errors / 0 warnings; frontend `npm run build` compiles cleanly.
✅ No mapping/coverage change — Q2.d/Q9.d/Q12.b (strength) stay Full; this is a pure naming/conformance correction, not a new data element.
❌ Not generalized: other local-CodeSystem concepts in this IG that may have acquired a UI-facing colloquial label distinct from their canonical display were not audited in this pass — this ADR fixes the two concepts found via the validator error and the follow-up clinical review, not a systematic sweep.

## Sources

- Validator output (`tools/validate.sh`-class run) surfacing the two `Wrong Display Name` errors
- ADR-0089 (introduces the two strength profiles), ADR-0107 (introduces the UI relabeling this ADR amends)
- `shoulder-surgeon` subagent, two rounds (2026-07-29): naming-only verdict, then a deeper biomechanics/terminology-convention review
- SNOMED CT via MCP `snomed_lookup`/`snomed_get_by_code` (2026-07-29): no observable entity for supraspinatus- or abduction-specific strength; `Empty can test`/`Jobe test` (1231437004) exists only as a procedure concept
- LOINC via `fhir.loinc.org` (2026-07-29): no shoulder- or supraspinatus-specific strength code; only generic LOINC#80322-1 "Muscle strength"
- `frontend/src/types/fhir.ts`, `frontend/src/components/wizard/StepClinicalAssessment.tsx`, `frontend/src/config/followupObservationMetadata.ts`
- `ig/input/fsh/codesystems/ShoulderObservation.fsh`, `ig/input/fsh/profiles/observations/{SupraspinatusStrength,SupraspinatusStrengthDynamometry}Observation.fsh`
