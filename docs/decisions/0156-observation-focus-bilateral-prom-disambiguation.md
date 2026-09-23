# ADR-0156: `Observation.focus` on aggregate PROMs, disambiguating a bilateral case

**Date:** 2026-08-05
**Status:** Accepted
**Found via:** `docs/limitations_items/` — "Aggregate PROM scores (Constant-Murley, SSV, SANE) can't be disambiguated between two conditions in a bilateral case," logged 2026-08-02 with a fully worked proposed solution already researched at the time (mCODE precedent).

## Context

ADR-0074 deliberately excludes `Observation.bodySite` from aggregate/survey PROM totals (Constant-Murley, SSV, SANE, satisfaction, return-to-activity) — a correct call, since `bodySite` means "the site where the observation was physically made," and a patient-reported composite score has no such site. But `RotatorCuffRegistrationBundle.condition` is `1..*` (ADR-0077), so a patient can legitimately have two `RotatorCuffCondition`s (a bilateral tear). Nothing previously disambiguated which side's Condition an aggregate PROM score belonged to in that case.

The original log entry already identified the fix precisely: `Observation.focus` (`0..* Reference(Any)`, distinct from `subject`) is the FHIR-sanctioned element for "this observation is about X" when X isn't the patient directly, and mCODE (the mCODE reference IG) uses this exact pattern — `SD_Staging.fsh`, `SD_RiskAssessment.fsh`, and `SD_PerformanceStatus.fsh` all bind `focus only Reference(PrimaryCancerCondition)` specifically to disambiguate which of a patient's possibly-multiple cancer conditions a composite assessment score belongs to.

## Decision

Add `focus 0..1 MS` bound to `Reference(RotatorCuffCondition)` on all five aggregate/survey PROM profiles: `ConstantScoreObservation`, `SsvScoreObservation`, `SaneScoreObservation`, `PatientSatisfactionObservation`, `ReturnToActivityObservation` — the same five ADR-0074 named as bodySite-excluded. Populated from the already-resolved Condition reference both frontends already have on hand for `evidence.detail`/`reasonReference` wiring elsewhere — no new lookup needed in either frontend.

**Unified frontend:** `observationBuilder.ts`'s shared `BuildObsBase` gained an optional `focus?: Reference` (wire format `[focus]`, matching FHIR's `0..*` even though this IG constrains it to `0..1`). Registration (`StepOutcomeScores.tsx`) needed a new `conditionUuid` prop threaded from `RegistrationWizard.tsx` (already computed there, just not previously passed down) since Registration's own hand-rolled `makeScoreObservation` closure doesn't go through the shared builder at all. Follow-Up (`FollowUpWizard.tsx`) already had `lookup.condition.id` in scope; added a `FOCUS_KEYS` set (mirroring the existing `LATERALIZED_KEYS`/`isLateralizedField` pattern) to apply focus to exactly the same five keys, threaded through `buildObservationsFromState` and `buildConstantScoreObservation`.

**SDC frontend:** new `attachFocus`/`isFocusEligibleObservation` pair in `bundleAssembler.ts`, mirroring the existing `attachBodySite`/`isLateralizedObservation` pair structurally but keyed on `Observation.code` (a `FOCUS_OBSERVATION_CODES` set of the five profiles' fixed codes) rather than `category` — `category=survey` also covers social-history facts (smoking, employment status) that are about the patient generally, not any one condition, so category alone isn't specific enough to invert the way `LATERALIZED_CATEGORY_CODES` is used. Called from `assembleRegistrationBundle` and `assembleFollowUpBundle` (Surgery doesn't build any of these five, so left untouched).

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Reuse `bodySite` with the Condition's laterality code instead of a real reference | Rejected outright, same as ADR-0074's own reasoning — `bodySite` means "where the observation was physically made," and repurposing it as a Condition-identity proxy would be exactly the semantic misuse ADR-0074 corrected. |
| A local extension instead of the standard `focus` element | Rejected — `focus` is already a first-class base-R4 `Observation` element built for precisely this use, with a direct, verified precedent in a sibling IG (mCODE); no reason to invent a local mechanism for something the spec already provides. |
| SDC: key `attachFocus` on `category` like `attachBodySite`, splitting `survey` into two sub-cases | Rejected — would require introducing a new discriminator anyway (something has to separate the five PROM totals from the other `survey`-category social-history Observations), so keying directly on `Observation.code` is no more complex and is more precise. |
| Populate `focus` unconditionally as `0..*` allowing multiple foci | Rejected — every real use case here is exactly one Condition per score; `0..1` is the honest cardinality for this IG's actual semantics, narrower than the unconstrained base element. |

## Classification (Clinical Feedback Integration Workflow)

**(c) IG-operational addition.** Not named by the expert consensus (Hurley says nothing about resource-level disambiguation mechanics); closes a genuine structural gap only relevant once a bilateral case exists in scope, which ADR-0077 already made possible. No SECEC/coverage-count impact — Layer 2 scaffolding.

## Verification

- `sushi .` — 0 errors/0 warnings across all five profile version bumps (`ConstantScoreObservation` 0.3.0→0.4.0, others 0.1.0→0.2.0).
- `npm run build`/`npm run lint` clean on both frontends.
- Not yet exercised against a real bilateral case (neither longitudinal seed patient, Anna Müller or Kemal Demir, is bilateral) — this ADR adds the structural capability; a worked bilateral example is future work, same status this gap already had before being closed structurally (see the original limitations-log entry's own framing: "worth implementing only if/when a bilateral scenario is actually added to scope" — the *capability* is what's being added now, not a new example).
- Not yet re-verified live against the deployment server `validator-service` — flagged for this session's batched server-side verification pass.

## Consequences

✅ A researcher querying a (future) bilateral patient's registry data can now correctly attribute a Constant-Murley/SSV/SANE/satisfaction/return-to-activity score to the specific Condition (and therefore side) it belongs to.
✅ ADR-0074's `bodySite` exclusion argument is preserved untouched — `focus` and `bodySite` answer different questions, and this ADR doesn't revisit that earlier decision.
✅ Direct, verified precedent from a sibling IG (mCODE) for the exact pattern used, not a novel invention.
⚠️ No unilateral behavior change for either existing longitudinal seed patient (both unilateral) — `focus` will simply always point at the patient's only Condition for them; the gap this closes only manifests once bilateral data exists.

## Sources

- `docs/limitations_items/` — "Aggregate PROM scores... can't be disambiguated between two conditions in a bilateral case," the entry this ADR closes, including its own prior mCODE research.
- mCODE's `SD_Staging.fsh`, `SD_RiskAssessment.fsh`, `SD_PerformanceStatus.fsh` — the precedent pattern (`focus only Reference(PrimaryCancerCondition)`).
- ADR-0074 — the bodySite-exclusion decision this ADR complements without revisiting.
- ADR-0077 — `RotatorCuffRegistrationBundle.condition 1..*`, the change that made a bilateral case (and therefore this ambiguity) possible in the first place.
- `ig/input/fsh/profiles/observations/{ConstantScoreObservation,SsvScoreObservation,SaneScoreObservation,PatientSatisfactionObservation,ReturnToActivityObservation}.fsh` — FSH changes.
- `frontend/src/lib/observationBuilder.ts`, `frontend/src/components/wizard/StepOutcomeScores.tsx`, `frontend/src/components/RegistrationWizard.tsx`, `frontend/src/components/followup/FollowUpWizard.tsx` — unified frontend.
- `sdc-frontend/src/lib/bundleAssembler.ts` (`attachFocus`, `isFocusEligibleObservation`), `sdc-frontend/src/types/fhir.ts` — SDC frontend.
