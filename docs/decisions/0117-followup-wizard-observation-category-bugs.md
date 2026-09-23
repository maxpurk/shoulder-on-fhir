# ADR-0117: Fix Follow-Up wizard `Observation.category` bugs — wrong casing + wrong code on the four pain axes

**Date:** 2026-07-30
**Status:** Accepted

## Context

A `tools/validate.sh`-class run against a fully-populated Follow-Up visit bundle (one Observation per Q9/Q12 field, i.e. every profile the Follow-Up wizard can emit) surfaced two distinct, compounding `[error]`s on nearly every entry, plus a cascading bundle-level failure:

```
The pattern [system http://terminology.hl7.org/CodeSystem/observation-category, code exam,
and display 'Exam'] ... not found. Value is 'exam' but is fixed to 'Exam' in the profile
.../atrophy-observation|0.1.0#Observation]
...
The pattern [system ..., code survey, and display 'Survey'] ... not found.
Value is 'survey' but is fixed to 'exam' in the profile .../pain-average-observation|0.1.0#Observation]
...
Slice 'Bundle.entry:observation': a matching slice is required, but not found
(from .../rotator-cuff-follow-up-bundle|0.1.0)
```

Root-caused to two separate bugs in `frontend/` (unified frontend, port 3000), both isolated to the Follow-Up flow (ADR-0035) — the Registration/Surgery flows (`StepClinicalAssessment.tsx`, `StepImaging.tsx`, `StepOutcomeScores.tsx`, `StepPatient.tsx`) hardcode `category` inline with correct casing per call site and were unaffected:

1. **Wrong display casing, every Follow-Up Observation.** `frontend/src/lib/observationBuilder.ts`'s `CATEGORY_DISPLAYS` map — the single shared helper (`baseObservation()`) that every `build*Observation()` function in this module routes through — used lowercase `exam`/`survey` as the `Coding.display` string instead of the FHIR-fixed `Exam`/`Survey`. Every derived Observation profile in this IG fixes `category` to a `system`+`code`+`display` **pattern** (not just a code), so a display-casing mismatch alone is a hard `[error]`, not a warning.
2. **Wrong category code, the four pain axes only.** `frontend/src/components/followup/FollowUpWizard.tsx` built Q9 and Q12 Observations via one call each to a shared `buildObservationsFromState()` helper, passed a single blanket `category` argument per call — `'exam'` for the whole Q9 bucket, `'survey'` for the whole Q12 bucket. `PainAverageObservation`/`PainActiveMovementObservation`/`PainPassiveMovementObservation`/`PainRestObservation` (ADR-0087) are UI-grouped under Q12 (asked alongside Constant-Murley/SSV/SANE in "Step 4 — Patient-reported outcomes") but their profiles fix `category` to `#exam`, matching Registration's own pain fields (`StepClinicalAssessment.tsx`) — UI grouping and FHIR category are two independent axes that the blanket-argument design conflated.

The bundle-level `Slice 'Bundle.entry:observation': a matching slice is required, but not found` plus 30× `This element does not match any known slice` INFO messages are a downstream cascade of (1)+(2): `RotatorCuffFollowUpBundle.entry` slices by `type`+`profile` discriminator against `resource only ShoulderObservation`; an entry whose declared `meta.profile` (the derived child profile) itself fails to validate is not recognized as matching, regardless of how unrelated the failing constraint is to the slice discriminator itself. Not a separate defect — expected to clear once (1) and (2) are fixed.

This is not a cosmetic issue, same reasoning as ADR-0116: because `category` is a *fixed pattern* on every derived profile, **every real Follow-Up submission through the live frontend** would fail the same checks via the `validator-service` client pre-flight (ADR-0051, which blocks on errors), not just in CI. The atrophy `Observation.code` SNOMED error visible in the same validator run (`Unknown code '1119438000'`) is unrelated and already closed by ADR-0116 (confirmed: `frontend/src/types/fhir.ts` already carries the reverted local code) — the run that surfaced this ADR's bugs predates that fix reaching the terminal output shown, but the fix itself was independently verified already in place.

## Decision

1. **`observationBuilder.ts`**: `CATEGORY_DISPLAYS` corrected to `{ exam: 'Exam', survey: 'Survey' }`.
2. **`followupObservationMetadata.ts`**: `ObservationMeta` gains a required `category: 'exam' | 'survey'` field, set per field to match its target profile's fixed category — all Q9 fields `'exam'` (inspection, ROM, strength, provocation — verified against every `profiles/observations/*.fsh` `category =` line), all Q12 fields `'survey'` **except** the four pain axes, which get `'exam'`.
3. **`FollowUpWizard.tsx`**: `buildObservationsFromState()` no longer takes a blanket `category` parameter — it reads `def.category` per field from the metadata map instead. The two call sites (Q9, Q12) simplified accordingly. `buildConstantScoreObservation()`'s separate hardcoded `category: 'survey'` is untouched (correct — Constant-Murley total is genuinely a survey-category PROM).

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep the blanket per-call-site category argument, special-case the 4 pain keys with an `if` inline in `FollowUpWizard.tsx` | Works, but re-creates exactly the kind of implicit, easy-to-miss special-casing that caused this bug; the metadata table already carries a `category` field's worth of information for every other axis (unit, valueSetUrl, etc.) and Registration's own `observationMetadata.ts` already uses this per-field-category design — extending the same pattern here is more consistent, not more code. |
| Derive category at runtime from the compiled StructureDefinition, matching the SDC frontend's `profileMetadataResolver.ts` (ADR-0103) | Rejected as disproportionate for this fix — the unified frontend is a typed-builder architecture by design (ADR-0035), not definition-driven; introducing a runtime profile-metadata fetch here would be a bigger architectural change than a bug fix warrants. Noted as the reason the SDC frontend was never exposed to this bug class at all. |

## Consequences

✅ Closes the `[error]`-level "Wrong Display Name"-class category pattern mismatches on every Q9/Q12 Follow-Up Observation.
✅ Closes the category-code mismatch on the four pain axes specifically.
✅ Expected to close the cascading `Bundle.entry:observation` slice-matching failure (not independently re-verified against `tx.fhir.org` per ADR-0080 — TX-dependent validation runs on the deployment server, not locally).
✅ `npm run build` (tsc + vite) and `npm run lint` (zero-warnings) both clean.
✅ SDC frontend (port 3001) independently confirmed unaffected — `extractor.ts` resolves `category` from the live compiled StructureDefinition via `profileMetadataResolver.ts` (ADR-0103), not a hardcoded table.
❌ Not yet re-validated end-to-end against `tx.fhir.org` (would require the server deploy loop, out of scope for this investigation pass) — the fix is verified by code/type-level review and successful `tsc`/`lint`, not by a fresh `tools/validate.sh` run.

## Sources

- Validator output (pasted by user, 2026-07-30) showing the category pattern/slice-matching errors on a full Follow-Up bundle
- `frontend/src/lib/observationBuilder.ts`, `frontend/src/config/followupObservationMetadata.ts`, `frontend/src/components/followup/FollowUpWizard.tsx`
- `ig/input/fsh/profiles/observations/*.fsh` (`category =` fixed-pattern lines, cross-checked for every Q9/Q12 profile)
- ADR-0087 (introduces the 4 pain axes), ADR-0090 (Constant-Murley component pattern), ADR-0035 (unified frontend architecture), ADR-0103 (SDC's runtime profile-metadata resolution, confirmed as the reason it wasn't exposed to this bug), ADR-0114 (same bug class precedent — `Coding.display` conformance), ADR-0116 (unrelated atrophy SNOMED fix visible in the same validator run)
