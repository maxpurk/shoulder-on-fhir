# ADR-0058: Condition family parents from `condition-eu-core`; `ShoulderComorbidityCondition` instances additionally claim `Condition-uv-ips` via `meta.profile[]`

**Date:** 2026-05-22
**Status:** Accepted

## Context

ADR-0057 reparented `ShoulderPatient` from base `Patient` to HL7 Europe Core `patient-eu-core` and claimed IPS `Patient-uv-ips` conformance on instances via `meta.profile[]`. That ADR explicitly noted three downstream consequences it unblocked, of which this ADR closes one: the Condition family (both `RotatorCuffCondition` and `ShoulderComorbidityCondition`) was parenting from base `Condition`, leaving the IG with no Condition-level realm alignment despite ADR-0055 having already adopted IPS terminology bindings for the comorbidity profile.

EU Core's `condition-eu-core` is structurally aligned with the IG's needs:

- **`code` is `1..1` preferred-bound to `http://hl7.org/fhir/uv/ips/ValueSet/problems-uv-ips`** plus a secondary preferred binding to `eHDSIIllnessandDisorder`. Inheriting these as the substrate is materially better than parenting from base `Condition` and re-declaring everything: every consumer of an IG-produced Condition now sees the EU + IPS terminology layers explicitly.
- **`subject` is typed `Reference(patient-eu-core)`.** ADR-0057 made this satisfied: `ShoulderPatient` is now a derived profile of `patient-eu-core`. The reference chain holds without further work.
- **`condition-assertedDate` extension is declared as a named slice** at `Condition.extension[assertedDate]`. ADR-0038 had already adopted this extension locally on `RotatorCuffCondition`; the local declaration becomes redundant once the parent supplies it.
- **No structural conflicts with `RotatorCuffCondition`'s tighter constraints.** Required clinicalStatus / verificationStatus, fixed `category = encounter-diagnosis`, extensible binding to `RotatorCuffDiagnosis`, `bodySite 1..* MS`, `evidence.detail` typed to `Reference(ShoulderObservation)` — all FHIR-legal derivations on top of `condition-eu-core`. The `condition-dueTo` extension (ADR-0046) is IG-specific and not in EU Core; it remains added on top.
- **No structural conflicts with `ShoulderComorbidityCondition`'s constraints either.** ADR-0055's `extensible` binding to `problems-snomed-absent-unknown-uv-ips` sits on top of EU Core's inherited `preferred` binding to `problems-uv-ips` (different but compatible VSs in the IPS family; the IG's binding is the stricter one and dominates conformance).

The empirical anchor for this ADR (verified 2026-05-22):
- EU Core's `assertedDate` slice has the same `sliceName` and the same underlying extension URL as the local declaration in `RotatorCuffCondition`. Sushi warned (one warning) on the redundant slice declaration; removing the local one resolves it without functional change.
- The post-reparenting validator run (seed bundle + Anna's longitudinal bundle + IG examples) produced **0 errors** and no new Condition-related warnings.

## Decision

1. **Reparent `RotatorCuffCondition`** in `ig/input/fsh/profiles/RotatorCuffCondition.fsh`:
   - `Parent: Condition` → `Parent: http://hl7.eu/fhir/base/StructureDefinition/condition-eu-core`
   - Remove the locally-declared `assertedDate` slice — inherited from `condition-eu-core` (sushi warning resolved).
   - Keep the `dueTo` slice (ADR-0046) as the only locally-added extension.
   - Keep all existing constraints (clinicalStatus / verificationStatus required, category = encounter-diagnosis, extensible binding to RotatorCuffDiagnosis, bodySite, evidence.detail).
   - Update Description to document the new parent chain and the relationship to the inherited preferred IPS binding.
   - Bump `^date` to 2026-05-22.

2. **Reparent `ShoulderComorbidityCondition`** in `ig/input/fsh/profiles/ShoulderComorbidityCondition.fsh`:
   - `Parent: Condition` → `Parent: http://hl7.eu/fhir/base/StructureDefinition/condition-eu-core`
   - Keep ADR-0055's `extensible` binding to `problems-snomed-absent-unknown-uv-ips` — sits on top of the inherited preferred binding to `problems-uv-ips`.
   - Keep `category = problem-list-item` (distinguishes from RotatorCuffCondition's encounter-diagnosis).
   - Update Description to document the new parent chain and the IPS multi-profile pattern on instances.

3. **Claim IPS `Condition-uv-ips` conformance via `meta.profile[]`** on every `ShoulderComorbidityCondition` instance:
   - `example_data/anna_mueller_01_registration.json` — 2 comorbidity Condition resources (Anna's hypertension + T2DM). Both updated.
   - `seed/bundles/example-patients.json` — no comorbidity instances at present (the seed bundle predates ADR-0055). Documented; future additions should follow the multi-profile pattern.
   - **Important asymmetry**: `RotatorCuffCondition` instances do NOT claim IPS `Condition-uv-ips` conformance via `meta.profile[]`. The Hurley Q1.c semantic is "problem-list comorbidity" (IPS's intended Condition use case); RotatorCuffCondition is an encounter-diagnosis (the index surgical indication), which IPS does not directly model. Claiming IPS Condition conformance on `RotatorCuffCondition` would be semantically suspect.

4. **Update the SECEC mapping CSV** `mapping/SECEC_FHIR_Mapping.csv`:
   - Q1.c Notes — extend with the new EU Core parent claim, the multi-profile `Condition-uv-ips` instance-level claim, and the binding-strength stacking (`preferred` inherited from EU Core, `extensible` declared locally as a sub-binding).
   - Q1.c IG Implementation — note the new `Parent: condition-eu-core` for ShoulderComorbidityCondition + the `meta.profile[]` IPS claim on instances.

5. **No validator script changes.** The IPS package pin added by ADR-0057 (`-ig hl7.fhir.uv.ips#1.1.0`) already covers `Condition-uv-ips` resolution.

6. **No frontend changes.** Both frontends construct Conditions from typed builders / SDC extractors; the FHIR shape they produce satisfies the new parent chain transparently. Adding `Condition-uv-ips` to submitted comorbidity bundles would require frontend changes — deferred (the example bundles are the carriers of the multi-profile claim).

## Why RotatorCuffCondition does NOT claim IPS `Condition-uv-ips`

Asymmetry that deserves explicit documentation:

| | Hurley semantic | FHIR category | IPS scope match | IPS multi-profile claim |
|---|---|---|---|---|
| `RotatorCuffCondition` | Index encounter diagnosis (the surgical indication) | `encounter-diagnosis` | IPS does not model encounter-scoped surgical indications — IPS Condition is for patient-summary problem lists | **No claim.** Claiming would be semantically suspect. |
| `ShoulderComorbidityCondition` | Pre-existing comorbidity (the patient's other conditions) | `problem-list-item` | IPS Condition profile is designed for exactly this use case | **Yes — claimed.** Genuine semantic match. |

Both profiles still parent from `condition-eu-core` because EU Core makes no such IPS-scope distinction — it's a generic European Condition profile suitable for both encounter and problem-list semantics. Only the IPS multi-profile claim is conditional on the semantic match.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep `Parent: Condition` (status quo) | Leaves the realm-alignment gap unfilled. ADR-0057 set the precedent for EU Core profile-level conformance on Patient; not following through on Condition would be inconsistent. EU Core 2.0.0's Condition profile fits structurally; the cost is one parent change + one redundant slice removal per profile. |
| Reparent only `ShoulderComorbidityCondition`, leave `RotatorCuffCondition` on base Condition | Inconsistent inheritance pattern across the two Condition profiles. Both share `subject only Reference(ShoulderPatient)` and the same downstream consumers; both should share the realm parent. The IPS multi-profile claim is the dimension on which they differ (per the semantic-match table above), not the EU parent. |
| Drop ADR-0055's `extensible` binding override on `ShoulderComorbidityCondition` and rely on the inherited preferred binding from EU Core | Weakens the registry's structural-comparability claim. ADR-0055's §"Why extensible, not preferred" rationale still holds: a single-jurisdiction surgical registry benefits from validator enforcement on SNOMED-coded comorbidities (where one exists), not just from "encouraged" SNOMED. EU Core's preferred binding is the safer cross-IG default; the IG can legitimately tighten it. |
| Claim IPS Condition-uv-ips on `RotatorCuffCondition` instances too | Semantic mismatch (see §"Why RotatorCuffCondition does NOT claim IPS"). Tempting for the rhetorical symmetry but dishonest — would invite the obvious thesis-defense question "is a surgical-indication Condition really an IPS-summary problem-list Condition?" |
| Wait for IPS 2.0.0 (which is in ballot) and use the unified problems VS | IPS 2.0.0 is not yet stable. ADR-0055's discussion noted the version-management trade-off and pinned on 1.1.0. Upgrade path remains a future swap of one canonical URL when 2.0.0 is finalized. |

## Consequences

✅ **Profile-level EU Core conformance** on both Condition family members. The thesis Discussion gains: "RotatorCuffCondition and ShoulderComorbidityCondition both derive from HL7 Europe Core `condition-eu-core`."

✅ **IPS `Condition-uv-ips` conformance** on comorbidity instances (where the semantic match is honest). The validator runs against both profiles; both pass empirically (validated 2026-05-22 against Anna's longitudinal bundle).

✅ **Inherited preferred IPS binding** to `problems-uv-ips` is now declarative (in the parent), not redundantly redeclared. ADR-0055's `extensible`-strength `problems-snomed-absent-unknown-uv-ips` sub-binding sits on top — both bindings coexist FHIR-legally.

✅ **`condition-assertedDate` extension** is now inherited from EU Core rather than locally redeclared. Single source of truth.

✅ **Patient reference chain** for cross-resource validation works: `condition-eu-core.subject only Reference(patient-eu-core)` is satisfied because ShoulderPatient parents from patient-eu-core (ADR-0057). `Condition-uv-ips.subject only Reference(PatientUvIps)` is satisfied because every ShoulderPatient instance claims PatientUvIps via `meta.profile[]` (ADR-0057).

✅ **`RotatorCuffCondition` vs `ShoulderComorbidityCondition` semantic distinction is now explicit**: same EU Core parent, IPS multi-profile claim only on the semantically-IPS-aligned one.

⚠️ **Sushi emits a `Slice named X already exists` warning** if we redeclare an inherited slice. Resolved for `assertedDate` in this ADR; future additions to either Condition profile should check the EU Core parent's slice list before declaring locally.

⚠️ **EU Core's secondary `eHDSIIllnessandDisorder` preferred binding** is now inherited — it lives in the SD chain but our local extensible binding to `problems-snomed-absent-unknown-uv-ips` dominates for conformance. The eHDSI binding is documented in CSV Notes but not exercised by our example data. Future German-jurisdiction integration projects (per ADR-0055 §6 deferral) may want to add ICD-10-GM `coding[]` siblings; the inherited binding doesn't block that.

⚠️ **The example bundles carry the multi-profile `Condition-uv-ips` claim manually** — every new comorbidity instance must remember to declare both profiles. Same trade-off as ADR-0057's Patient instances. Mitigated by example-as-template consistency.

## Sources

- `seed/.fhir-eu-base-cache/extracted/package/StructureDefinition-condition-eu-core.json` — `code` binding, `subject` type, `assertedDate` slice (verified 2026-05-22)
- the IPS package's `StructureDefinition-Condition-uv-ips.json` — IPS Condition profile canonical
- ADR-0055 (IPS comorbidity VS binding — preserved; extensible-strength override unchanged), ADR-0046 (condition-dueTo extension — preserved), ADR-0038 (condition-assertedDate adoption — now inherited rather than locally declared), ADR-0057 (Patient EU Core parent + IPS multi-profile — the structural prerequisite for this ADR)
- Empirical validation transcripts: `tools/validation-output/_batch-Seed_bundle.json` (post-ADR-0058 = 0 errors), a validator run over the longitudinal example bundle (post-ADR-0058 = 0 errors)
