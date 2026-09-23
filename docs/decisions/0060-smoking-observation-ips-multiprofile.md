# ADR-0060: Smoking Observation instances additionally claim `Observation-tobaccouse-uv-ips` via `meta.profile[]`

**Date:** 2026-05-22
**Status:** Accepted

## Context

Final ADR in the 2026-05-22 four-ADR realm-alignment sequence (0057 Patient, 0058 Condition family, 0059 Procedure, 0060 social-history Observation). The earlier three reparented their respective Shoulder profiles from EU Core 2.0.0 and layered IPS multi-profile claims via `meta.profile[]`. This ADR closes the same pattern for the social-history Observation sub-family — specifically smoking, the element where ADR-0056 had already adopted IPS terminology bindings but deliberately stopped short of profile-level conformance because the Patient-reference chain was not yet unblocked.

ADR-0056 ended Q1.d (Smoking) with:
- `SmokingStatusObservation` profile, `code = LOINC#72166-2`, `valueCodeableConcept` extensible-bound to IPS `current-smoking-status-uv-ips` (LOINC LA codes per IPS 1.1.0)
- IPS package loaded into HAPI via `seed/load-ips-package.sh` (canary VS resolves; 8 LOINC LA concepts returned by `$expand`)
- Example data migrated from SNOMED to LOINC LA encoding (5 instances)

What ADR-0056 explicitly deferred was the IPS profile-level conformance claim. The blocker, surfaced and documented in that ADR's §"The HAPI runtime-resolution discovery" and §"Why not multi-profile yet": IPS `Observation-tobaccouse-uv-ips.subject only Reference(PatientUvIps)`. Multi-profile validation would fail because `ShoulderPatient` instances were not claiming PatientUvIps.

ADR-0057 resolved the blocker by:
- Reparenting ShoulderPatient from `patient-eu-core`
- Adding `Patient-uv-ips` to every ShoulderPatient instance's `meta.profile[]`
- Empirically verifying that the `name.family 1..1 MS` constraint satisfies both `eu-pat-1` and `ips-pat-1` invariants

With the Patient layer addressed, this ADR's claim becomes straightforward: every smoking observation instance is structurally PatientUvIps-compatible at its subject reference, and the smoking observation's own constraints (LOINC `72166-2` code, LOINC LA value codes, encounter linkage, social-history category) all satisfy IPS's `Observation-tobaccouse-uv-ips` profile.

The thesis-defense sentence after this ADR: *"Smoking observation instances claim both `SmokingStatusObservation` (IG profile with encounter linkage) and IPS `Observation-tobaccouse-uv-ips` (international patient summary alignment) via `meta.profile[]`. The cross-resource patient reference chain holds because `ShoulderPatient` is multi-profile-claimed against both `patient-eu-core` and `Patient-uv-ips` (ADR-0057)."*

## Decision

1. **Add `Observation-tobaccouse-uv-ips` to `meta.profile[]`** on every smoking observation instance:
   - `example_data/anna_mueller_01_registration.json` — 1 smoking observation (Anna's former-smoker LOINC encoding `LA15920-4`). Updated.
   - `seed/bundles/example-patients.json` — 3 smoking observations across 3 example patients (LA18976-3 Current every day smoker, LA18978-9 Never smoker, LA15920-4 Former smoker per ADR-0056). All 3 updated via `replace_all`.
   - Total: 4 smoking observation instances now declare both `SmokingStatusObservation` and `Observation-tobaccouse-uv-ips` in `meta.profile[]`.

2. **No profile change.** Unlike ADRs 0057–0059, this ADR does NOT reparent `SmokingStatusObservation`. The profile remains parented to `ShoulderObservation` (the abstract base for all 37 derived Observation profiles per ADR-0008). The IPS conformance is purely instance-level. Rationale: ADR-0008 + ADR-0037 establish ShoulderObservation as the single point where encounter-cardinality, bodySite-laterality, and subject-as-ShoulderPatient constraints are added. Reparenting one of the 37 derived profiles from a different abstract parent would break the one-place-to-add-things discipline. See ADR-0056 §"Why LOINC-only" for the broader trade-off framing inherited here.

3. **No CSV restructuring.** Q1.d (Smoking) row already references ADR-0056 in the Notes. Append "Per ADR-0060, smoking observation instances additionally claim IPS Observation-tobaccouse-uv-ips conformance via meta.profile[] — the patient-reference chain holds via ADR-0057 (ShoulderPatient claims PatientUvIps)." to that row.

4. **No validator script changes.** The IPS package pin from ADR-0057 (`-ig hl7.fhir.uv.ips#1.1.0`) covers `Observation-tobaccouse-uv-ips` resolution.

5. **No frontend changes.** Both frontends produce smoking observations from typed builders / SDC extractors; the FHIR shape they emit (LOINC `72166-2` code, LOINC LA value coding, encounter reference, subject reference to a ShoulderPatient which now declares PatientUvIps) satisfies the IPS Observation-tobaccouse profile without further work. Adding the multi-profile claim to bundles submitted by the frontends would be a small future enhancement; the example bundles carry the claim today.

## Why instance-level IPS, not profile-level reparenting

Three options were considered in the underlying plan:

| Option | Profile parent | Instance claim | Result |
|---|---|---|---|
| **A: Reparent SmokingStatusObservation from `Observation-tobaccouse-uv-ips`** | `Observation-tobaccouse-uv-ips` (IPS) | inherent | Single-inheritance forces a 36+1 split in the abstract-parent architecture: one profile leaves the ShoulderObservation tree, all others stay. Loses the load-bearing encounter-cardinality consistency from ADR-0037. |
| **B: Instance-level multi-profile only** (this ADR) | `ShoulderObservation` (unchanged) | `meta.profile += Observation-tobaccouse-uv-ips` | Same conformance claim, no structural disruption. The 37 derived profiles continue to share the abstract parent. |
| **C: Status quo** (ADR-0056 stop) | `ShoulderObservation` (unchanged) | no IPS claim | Leaves the conformance value unrealised after ADR-0057 unblocked it. Weakest defense for "why didn't you take the easy IPS profile claim?" |

Option B wins because the marginal cost is zero (4 `meta.profile` edits), the architectural disruption is zero (no parent change), and the conformance claim is the same as Option A.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Status quo (ADR-0056 final state, no IPS multi-profile) | After ADR-0057 unblocks PatientUvIps reference, leaving the smoking IPS claim un-taken sends the wrong defensive signal ("why did you load IPS for terminology but skip the profile claim once you could?"). |
| Reparent `SmokingStatusObservation` from `Observation-tobaccouse-uv-ips` (Option A above) | Breaks the abstract-parent architecture (ADR-0008). Forces 36+1 inheritance asymmetry. Same conformance outcome as Option B but at structural cost. |
| Reparent ALL 37 derived Observation profiles from `Observation-tobaccouse-uv-ips` | Nonsense — `Observation-tobaccouse-uv-ips` is smoking-specific. ROM angles, MMT strength, PROM scores, etc. don't fit. |
| Reparent `ShoulderObservation` (the abstract parent) from an IPS Observation profile | Tried in plan exploration. IPS has no generic Observation profile; `Observation-results-uv-ips` is lab-result-scoped (similar shape limitation to EU's `medicalTestResult-eu-core`). Plus, ADR-0008 anticipates `ShoulderObservation` as the IG-specific abstraction — IPS doesn't model the IG's encounter-cardinality requirements (ADR-0037) anyway. |
| Multi-profile claim on other social-history Observations (sleep, occupation, sports, functional limitations, hand dominance) too | Out of scope for this ADR. IPS doesn't publish profiles for those Observations. The pattern remains: claim IPS multi-profile per Observation where IPS publishes a matching profile; otherwise leave the instance at ShoulderObservation-only conformance. Future Q-element walkthroughs (Q1.i sleep, Q1.j sports, Q1.k occupation, Q1.m hand dominance, Q1.n functional limitations) will not have an IPS profile to claim against — they stop at terminology reuse where applicable. |

## Consequences

✅ **IPS profile-level conformance** on smoking observations. The thesis Discussion gains: "Smoking Observation instances claim both `SmokingStatusObservation` (IG profile) and IPS `Observation-tobaccouse-uv-ips` via `meta.profile[]`."

✅ **The 2026-05-22 four-ADR sequence closes cleanly.** EU Core profile-level conformance on Patient, Condition family, Procedure. IPS instance-level multi-profile claims on Patient, Comorbidity Condition, all Procedures, and smoking Observation. Each cross-resource patient-reference chain validated empirically.

✅ **The ADR-0008 abstract-parent architecture** for the 37 derived Observation profiles is preserved. No 36+1 inheritance asymmetry.

✅ **Encounter-cardinality invariant from ADR-0037** (Observation.encounter 1..1 MS via ShoulderObservation parent) continues to apply uniformly to all 37 derived profiles including the smoking variant.

✅ **The validator pin from ADR-0057** (`-ig hl7.fhir.uv.ips#1.1.0`) plus the runtime IPS package load (from ADR-0056) together provide both design-time and runtime resolution of `Observation-tobaccouse-uv-ips`.

⚠️ **4 smoking observation instances now carry a manual multi-profile claim.** Same trade-off as ADRs 0057-0059. The pattern is now consistent across all four ADRs in the sequence: profile parent change for primary realm (EU Core where applicable, ShoulderObservation otherwise); instance-level multi-profile claim for IPS conformance.

⚠️ **No mechanism in the frontend bundle builders to auto-populate the IPS multi-profile claim on submitted bundles.** The example bundles carry the claim; production-submitted bundles from the unified or SDC frontends do not. This is a deliberate scope limitation — the IG's example bundles are the authoritative carriers of the multi-profile architecture. Frontend-builder enhancement is a candidate for a future ADR if a deploying registry wants to emit multi-profile-claimed bundles from the wizard.

⚠️ **Other social-history Observations (sleep, occupation, sports, functional limitations) have no IPS profile to claim against.** The IG's IPS conformance story is "Where IPS publishes a matching Observation profile, we claim it via meta.profile[]." Smoking is currently the only social-history element that satisfies this condition. Sleep / occupation / etc. remain ShoulderObservation-only — this is the truthful scope statement.

## Sources

- the IPS package's `StructureDefinition-Observation-tobaccouse-uv-ips.json` — IPS Observation Tobacco Use profile canonical + constraints
- ADR-0008 (abstract ShoulderObservation parent; 37 derived profiles — preserved), ADR-0037 (encounter-cardinality invariant via ShoulderObservation — preserved), ADR-0056 (IPS package loader + LOINC encoding + ADR's "Why LOINC-only" framing — directly extended by this ADR), ADR-0057 (Patient EU Core parent + PatientUvIps multi-profile — the structural prerequisite that unblocks the IPS Observation reference chain), ADRs 0058–0059 (Condition and Procedure realm alignment — companion ADRs in the same 2026-05-22 sequence)
- Empirical validation transcripts: `tools/validation-output/_batch-Seed_bundle.json` (post-ADR-0060 = 0 errors, no smoking-specific warnings); a validator run over the longitudinal registration bundle (post-ADR-0060 = 0 errors on Anna's registration bundle with smoking observation multi-profile claim)
