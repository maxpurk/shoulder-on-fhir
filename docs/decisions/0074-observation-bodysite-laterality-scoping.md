# ADR-0074: `Observation.bodySite` laterality — physically-anchored scoping, applied consistently across both frontends

**Date:** 2026-07-12
**Status:** Accepted

## Context

A demo review surfaced: "the ROM [observations] miss a side information (at least in the frontend)." Investigation found three related gaps, all variations on the same root question — which Observations should carry `Observation.bodySite`, and where does the laterality value come from when a flow doesn't ask the user directly?

1. **Unified frontend (`frontend/`, port 3000), Follow-Up flow.** `FollowUpWizard.tsx` builds every Observation through the shared typed builders in `lib/observationBuilder.ts` (`buildQuantityObservation` / `buildCodedObservation` / `buildStringObservation` → `baseObservation`). None of those builders accepted a `bodySite` at all, so every follow-up ROM, strength, provocation, inspection, and PROM Observation was submitted with no laterality — even though the follow-up flow already knows the shoulder: `PatientLookup` resolves the patient's `RotatorCuffCondition`, whose `bodySite` (`1..1`, bound to `ShoulderLaterality` per ADR-0064) is right there in `LookupResult.condition`.
2. **Unified frontend, Registration flow.** The inverse problem: `StepOutcomeScores.tsx` stamped `bodySite` on **every** PROM Observation it built, including Constant-Murley, SSV, SANE, patient satisfaction, and return-to-activity — aggregate/survey scores that have no physical measurement site. `Observation.bodySite` is defined as "the site on the subject's body where the observation was made"; a self-reported composite score isn't made *at* a site.
3. **SDC frontend (`sdc-frontend/`, port 3001).** A larger version of gap #1: `bundleAssembler.ts` never set `Observation.bodySite` in *any* of the three flows (Registration, Surgery, Follow-Up) or on any Observation type. Its `LaunchContext` (populated by `PatientLookup.tsx` for Surgery/Follow-Up) already fetches the full `Condition` to resolve `conditionId`, but discarded everything except the ID.

## Decision

Apply `Observation.bodySite` only where the observation is physically anchored to an anatomical site, per its FHIR R4 definition:

- **Gets `bodySite`:** active/passive ROM, muscle strength (MMT), provocation tests (Jobe / lift-off / belly-press / bear-hug / hornblower), visual inspection, pain severity (a shoulder-localized symptom — this is how registration already records it, under `category=exam`), and imaging classifications (Patte, Goutallier, tear size, Cofield tear-size bucket, tendons involved).
- **Does not get `bodySite`:** aggregate/survey PROM totals (Constant-Murley, SSV, SANE), patient satisfaction, return-to-activity, and social-history items (smoking, occupation, hand dominance, sleep disturbance, sports participation). These have no physical target site; laterality is conveyed by the `Condition`/`Encounter` context instead.

**Unified frontend** (`frontend/`):
- `lib/observationBuilder.ts` — `BuildObsBase` gains an optional `bodySite?: CodeableConcept`; `baseObservation` includes it only when provided, so existing callers are unaffected.
- `components/followup/FollowUpWizard.tsx` — `buildObservationsFromState` takes a `bodySite` parameter; a small predicate (`ObservationGroup` ∈ `{rom-active, rom-passive, strength, provocation, exam-finding}`, or the field key is `pain-severity`) decides which fields actually receive it. The value itself is `lookup.condition.bodySite?.[0]` — reused directly from the already-fetched Condition, not reconstructed from `SHOULDER_LATERALITY` constants.
- `components/wizard/StepOutcomeScores.tsx` — removed the `bodySite` construction and its five call sites (Constant/SSV/SANE/satisfaction/return-to-activity); the now-unused `laterality` prop was dropped from the component and its call site in `RegistrationWizard.tsx`. `StepClinicalAssessment.tsx` (ROM/strength/provocation/inspection/pain) already matched this rule and was left unchanged.

**SDC frontend** (`sdc-frontend/`):
- `lib/bundleAssembler.ts` — new `isLateralizedObservation(o)` checks `o.category` for `exam` or `imaging`, reusing the category classification `PROFILE_METADATA` (in `extractor.ts`) already assigns per profile — no new taxonomy introduced. `attachBodySite(o, bodySite)` applies conditionally.
- `LaunchContext` gains `conditionBodySite?: CodeableConcept`.
- Registration: `bodySite` is read straight off the in-bundle `Condition` (the extractor already populates `Condition.bodySite` from the Questionnaire's own `Condition.bodySite` leaf).
- Surgery / Follow-Up: `components/PatientLookup.tsx` already fetches the full `Condition` to resolve `conditionId`; it now also forwards `condition.bodySite?.[0]` as `conditionBodySite`.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Stamp `bodySite` on every Observation (registration's prior behavior) | Semantic misuse for aggregate scores — Constant/SSV/SANE/satisfaction are patient-reported composites with no physical measurement site, even though the element is `0..1` and validates without complaint |
| Hardcode a per-flow allowlist of profile keys that get `bodySite` | Rejected in favor of deriving eligibility from `category` (`exam`/`imaging` vs. `survey`/`social-history`), which both frontends already assign per profile — avoids a second, driftable classification that has to be kept in sync with the first |
| Reconstruct `bodySite` from `SHOULDER_LATERALITY` constants at the point of use, as the registration steps already do | Follow-up (both frontends) and SDC Surgery/Follow-Up have no `laterality` prop or user-facing side selector; the Condition is already fetched by `PatientLookup` with its `bodySite` intact, so reusing it avoids adding a redundant laterality-selection step to flows that already know the shoulder |
| Defer SDC to a later ADR, as ADR-0064 did for the tendons-involved migration | The gap here (100% of SDC Observations lacking `bodySite`) is broader and the fix is structurally identical to the unified-frontend fix, so it was done in the same pass rather than deferred |

## Consequences

✅ Follow-up ROM/strength/provocation/inspection/pain Observations (unified frontend) now carry laterality — closes the reported gap.

✅ Both frontends now apply the same physically-anchored-only rule, derived from the pre-existing `category` taxonomy rather than a new one.

✅ SDC's Registration, Surgery, and Follow-Up flows all gained `bodySite` on exam/imaging Observations — previously absent in all three.

✅ No profile change required — `Observation.bodySite` was already `0..1` on the base and every derived child profile; this is a client-side data-completeness fix, not a conformance change.

⚠️ Registration's PROM-score Observations (unified frontend) changed shape going forward — `bodySite` no longer appears on newly-submitted Constant/SSV/SANE/satisfaction/return-to-activity Observations. Since the element was always optional, no validator regression; only future submissions are affected.

⚠️ Pre-existing, unrelated inconsistency left as-is: in the unified frontend's `followupObservationMetadata.ts`, `pain-severity` is grouped under Q12 (submitted with `category=survey`), while registration's `StepClinicalAssessment.tsx` submits the same concept under `category=exam`. `bodySite` attachment is unaffected (the follow-up predicate checks the field key explicitly), but the `category` mismatch itself is a separate, pre-existing gap not addressed here.

## Sources

- `frontend/src/lib/observationBuilder.ts`
- `frontend/src/components/followup/FollowUpWizard.tsx`
- `frontend/src/components/wizard/StepOutcomeScores.tsx`
- `frontend/src/components/wizard/StepClinicalAssessment.tsx` (reference pattern, unchanged)
- `frontend/src/components/RegistrationWizard.tsx`
- `sdc-frontend/src/lib/bundleAssembler.ts`
- `sdc-frontend/src/components/PatientLookup.tsx`
- ADR-0064 (`Condition.bodySite` = laterality only; tendons-involved relocated to a dedicated Observation) — the laterality source this ADR reads from
- ADR-0073 (Observation-to-Condition three-bucket linkage; the `exam`/`imaging`/`survey`/`social-history` category classification reused here predates and is shared with that ADR)
