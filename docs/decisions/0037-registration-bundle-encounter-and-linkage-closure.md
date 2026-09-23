# ADR-0037: Registration Bundle Encounter and Cross-Resource Linkage Closure

**Date:** 2026-05-18
**Status:** Accepted — `reasonReference` type relaxed by ADR-0066 (2026-06-07); bundle renamed by ADR-0066

> **Update 2026-06-07 (ADR-0066):** `ShoulderEncounter.reasonReference` was relaxed from `Reference(RotatorCuffCondition)` to `Reference(Condition)` so `ShoulderEncounter` stays anatomy-region and reusable by sibling shoulder IGs. The cardinality (`1..1 MS`) and the Encounter-as-anchor pattern this ADR established are unchanged. The pathology guarantee inside the three RC bundles is preserved by the bundle Condition slice (`only RotatorCuffCondition`). The bundle profile referenced here was also renamed `ShoulderRegistrationBundle` → `RotatorCuffRegistrationBundle`.

## Context

`Patient/{id}/$everything` against the demonstration HAPI instance exposed a structural gap in registration submissions: the Patient, Condition, prior Procedures, and Observations all landed under a shared `subject = Patient`, but **nothing tied them together within the visit**. Concretely:

- `ShoulderRegistrationBundle.fsh` (v0.2.0) was the only one of the three named bundle profiles without an `encounter` slice. `ShoulderSurgeryBundle` (ADR-0034) and `ShoulderFollowUpBundle` (ADR-0030) already required a 1..1 Encounter as their cross-resource anchor.
- Observations carried only `subject` — no `encounter` reference — making it impossible to query "all findings recorded at this registration visit" without date+bodySite heuristics.
- Prior PT / injection Procedures carried no `reasonReference → Condition`, even though the same wiring is routine in surgery/follow-up bundles.
- `RotatorCuffCondition.evidence.detail` was already MS-typed to `ShoulderObservation` but never populated.

The original deferral was intentional: ADR-0034 split the monolithic registration bundle into Registration / Surgery / Follow-Up but left the Encounter on the surgery and follow-up bundles only, on the grounds that the registration consultation could live without it. Live data and first-hand inspection of a test patient registered through the unified frontend (May 2026) showed that this deferral cost more than it saved — queries against the resulting data shape are awkward and the three bundle profiles diverge from each other for no semantic reason.

## Decision

1. **`ShoulderRegistrationBundle`** — add a new required slice `entry[encounter] 1..1 → ShoulderEncounter`. Bumped to v0.3.0.
2. **`ShoulderEncounter`** — promote `reasonReference` from `MS` (0..1) to `1..1 MS`. Title renamed from `"Shoulder Encounter (Follow-up)"` → `"Shoulder Encounter"`; description rewritten to cover all three contexts (registration consultation, surgical admission, routine follow-up). Bumped to v0.2.0.
3. **`ShoulderEncounterType`** (renamed from `FollowUpEncounterType`) — same SNOMED CT codes, kept extensible binding. Documentation broadened so reviewers can pick `185349003` (Encounter for check up) for the registration consultation, `390906007` (Follow-up encounter) for post-op visits, `308335008` (Patient encounter procedure) as a generic fallback. Bumped to v0.2.0.
4. **Unified frontend (`frontend/`, port 3000)** — `RegistrationWizard.handleSubmit` now:
   - Generates a stable `encounterUuid` and builds a `ShoulderEncounter` via a new `buildRegistrationEncounter` helper in `lib/encounterBuilder.ts`.
   - Passes `encounterUuid` and `conditionUuid` to every step component (`StepPatient`, `StepCondition`, `StepImaging`, `StepClinicalAssessment`, `StepOutcomeScores`) so each emitted `Observation` carries `encounter`, each prior `Procedure` carries `encounter` + `reasonReference → Condition`, and the `Condition` carries `encounter` (FHIR R4 §Condition.encounter — "Encounter during which this Condition was first asserted").
   - Walks the assembled entries to extract imaging-classification observations (`patte-observation`, `goutallier-observation`, `tear-size-observation`) and folds their UUIDs into `Condition.evidence.detail`.
   - A new pure assembler `lib/registrationBundleBuilder.ts` orders the entries Patient → Encounter → Condition → priorProcedures → observations.
5. **Examples / seed** — `ig/input/fsh/examples/ShoulderBundle.fsh` (the canonical example exercised by `tools/validate.sh --deep`) gains a `BundleRegistrationEncounter` inline instance. `example_data/anna_mueller_01_registration.json` updated with the same shape so the longitudinal demo continues to round-trip.

## Hurley scope clarification (mandatory)

This change is **FHIR best-practice consistency, not Hurley closure**. The SECEC consensus (Hurley et al. 2024) requires the diagnosis link only for **Q10 follow-up Encounters** and **Q5/Q6 imaging ServiceRequests**, not for the registration Encounter and not for Observation→Condition linking. SECEC coverage figures in `mapping/SECEC_FHIR_Mapping.md` remain at the ADR-0036 baseline at the time this ADR was authored (43 Full + 17 Partial of 60 Hurley elements); under the subsequent ADR-0039 three-layer re-baseline the live figures are 42 Full + 16 Partial of 58. This ADR claims no coverage uplift under either accounting.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Leave Registration Encounter-less (status quo) | Forces date+bodySite heuristics for any "findings of this visit" query and keeps the three bundle profiles divergent for no semantic reason. |
| `entry[encounter] 0..1` (optional) | Optional cardinality doesn't enforce the linkage — half of submissions would still float, defeating the purpose. |
| New separate `ShoulderRegistrationEncounter` profile | Duplicates `ShoulderEncounter` constraints for no clinical distinction. The existing profile already covers all three contexts once the description is broadened. |
| Use `Observation.focus → Condition` for direct linkage | Spec-compliant but rarely indexed by FHIR servers; tooling support is weak. Encounter-as-anchor is the idiomatic and queryable pattern. |

## Consequences

✅ All three bundle profiles now share a uniform Encounter-as-anchor pattern — registration / surgery / follow-up are structurally consistent.
✅ Downstream analytics can query "every finding for this rotator cuff diagnosis" via the Encounter chain without date+bodySite heuristics.
✅ `Condition.evidence.detail` is populated with the imaging-derived classification observations, giving a direct semantic link from the diagnosis to the structural findings that support it.
⚠️ SDC frontend (port 3001) will produce advisory `$validate` warnings until it migrates to the three-bundle architecture. Accepted per ADR-0034 §Consequences and ADR-0031 (HAPI as storage server, validation advisory at runtime; conformance gated by `tools/validate.sh` only).
⚠️ The longitudinal seed loader is idempotent against the `PAT-LONG-001` identifier key (per the project guide). Re-seeding the patched `anna_mueller_01_registration.json` requires `./build-and-deploy.sh --clean` or `FORCE_RELOAD=true`.
⚠️ The follow-up bundle examples and surgery bundle example already populate `Encounter.reasonReference`, so the cardinality tightening on `ShoulderEncounter` did not break them — confirmed before merge.
❌ Any external consumers carrying their own copy of the legacy `FollowUpEncounterType` URL must update to `shoulder-encounter-type`. The IG is still pre-1.0 so this rename is acceptable.

## Sources

- `ig/input/fsh/profiles/ShoulderRegistrationBundle.fsh` — entry slicing v0.3.0
- `ig/input/fsh/profiles/ShoulderEncounter.fsh` — reasonReference 1..1, v0.2.0
- `ig/input/fsh/valuesets/ShoulderEncounterType.fsh` — renamed VS, v0.2.0
- `frontend/src/lib/encounterBuilder.ts` — `buildRegistrationEncounter`
- `frontend/src/lib/registrationBundleBuilder.ts` — new assembler
- `frontend/src/components/RegistrationWizard.tsx` — wizard wiring
- `example_data/anna_mueller_01_registration.json` — patched longitudinal example
- ADR-0017 (original registration bundle, scope narrowed by ADR-0034)
- ADR-0028 (ShoulderEncounter, follow-up Q10)
- ADR-0030 (ShoulderFollowUpBundle)
- ADR-0031 (validation responsibilities — storage server + advisory `$validate`)
- ADR-0034 (three-bundle architecture)
- ADR-0036 (SECEC coverage re-baseline — figures unchanged by this ADR)
