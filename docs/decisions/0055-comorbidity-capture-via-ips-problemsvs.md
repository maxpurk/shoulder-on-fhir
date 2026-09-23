# ADR-0055: Comorbidity capture via ShoulderComorbidityCondition profile, extensible-bound to IPS ProblemsSnomedAbsentUnknownUvIps

**Date:** 2026-05-22
**Status:** Accepted

## Context

SECEC Hurley Q1.c "Comorbidities" was previously claimed **Full** in `mapping/SECEC_FHIR_Mapping.csv`, `mapping/SECEC_FHIR_Mapping.md`, and the thesis appendix chapter(s) (status `F`) on the basis that the FHIR R4 `Condition` base resource is unprofiled in this IG and that `ShoulderRegistrationBundle.entry` uses an `#open` slicing rule. In practice this was **structurally vacuous**:

- `ShoulderRegistrationBundle.fsh` declared no `comorbidity` slice. The `condition` slice was `1..1 RotatorCuffCondition` (the index encounter diagnosis only).
- `frontend/src/components/wizard/StepPatient.tsx` captured every other Hurley Q1 sub-element (smoking, sleep, occupation, sports, hand dominance, prior PT/injection, functional limitations) but **no comorbidity input**.
- `example_data/anna_mueller_01_registration.json` contained exactly one `Condition` — the index rotator-cuff tear.
- The CSV note even read "SNOMED CT or ICD-10-GM in Condition.code; **no constrained ValueSet**" — i.e. no guidance to clinicians on how to code.

In short: a registry running this IG today had no operational way to record comorbidities. The "Full" claim was indistinguishable from "Missing" in any downstream conformance audit.

The fix required choosing a profiling pattern. Four reference IGs in the vendored reference IGs were audited (the audit ran 2026-05-22 against the cached packages):

| IG | Profile | `code` binding | VS canonical | Strength | Notes |
|---|---|---|---|---|---|
| IPS 1.1.0 | `Condition (IPS)` | `from ProblemsSnomedAbsentUnknownUvIps` | `http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips` | `preferred` | composes SNOMED ECL `< 404684003 \|Clinical finding\|` + `< 243796009 \|Situation\|` + `< 272379006 \|Event\|`, excluding `< 71388002 \|Procedure\|`; typeahead-friendly via `$expand?filter=…` |
| EU Base v2.0.0 | `Condition (EU Core)` | preferred-bound to `problems-uv-ips` + additional preferred eHDSI ICD-10/Orphanet | `http://hl7.org/fhir/uv/ips/ValueSet/problems-uv-ips` (not resolvable in IPS 1.1.0 — see note below) | `preferred` | extends IPS pattern for cross-border use |
| mCODE | `Comorbidities` (Observation-based) | via `RelatedCondition` extension | — | — | outlier; comorbidities as Observation + extension, no `Condition.code` binding |
| SenologieOnFHIR (DE) | `Senologie_Diagnose_Benigne` | `code.coding` sliced for `icd10gm`, `sct`, `icd11`, `senologie-local` | — | none per slice | explicit multi-coding pattern; no closed VS |

The convergent pattern is **IPS + EU Base**: a binding to a SNOMED-ECL-backed problem-list VS. Both reference IGs use `preferred` strength; this IG tightens to `extensible` for the reasons in §"Why extensible, not preferred" below. mCODE's Observation-based approach is an outlier driven by oncology-specific use cases; SenologieOnFHIR's multi-coding pattern is heavier scaffolding than this IG needs in v1.

**IPS version nuance.** EU Base v2.0.0 references `http://hl7.org/fhir/uv/ips/ValueSet/problems-uv-ips`, a canonical that does **not** exist in stable IPS 1.1.0 (the IPS package contains `ProblemsSnomedAbsentUnknownUvIps`, `ProblemsSnomedUvIps`, etc., but not `ProblemsUvIps`). The `problems-uv-ips` canonical appears in IPS 2.0.0-ballot. Until IPS 2.0.0 is fully released, this IG binds to the resolvable IPS 1.1.0 canonical `ProblemsSnomedAbsentUnknownUvIps` — semantically equivalent (also SNOMED ECL `< 404684003` and the absent/unknown subset), structurally stable. Upgrade path when IPS 2.0.0 is released: swap the canonical URL in one place (this profile) and bump the dependency version.

The IG already declares soft alignment with HL7 Europe Base v2.0.0 (ADR-0038), so adopting the IPS / EU Base problem-list binding is the lightest defensible extension of that direction. HAPI delegates SNOMED resolution to `tx.fhir.org` (ADR-0050), and `tx.fhir.org` publishes IPS — so server-side `$expand?filter=…` typeahead against `ProblemsSnomedAbsentUnknownUvIps` works out of the box.

## Decision

1. **Add a thin `ShoulderComorbidityCondition` profile** at `ig/input/fsh/profiles/ShoulderComorbidityCondition.fsh`:
   - Parent: base FHIR R4 `Condition` (not `Condition-uv-ips`, not EU Core — see Alternatives table for the four IPS-specific reasons and the EU Core inheritance-chain rejection)
   - `code 1..1 MS from http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips (extensible)` — strength tightened from IPS's `preferred`; see §"Why extensible, not preferred"
   - `category 1..* MS` fixed to `http://terminology.hl7.org/CodeSystem/condition-category#problem-list-item` — distinct from `RotatorCuffCondition.category=encounter-diagnosis`
   - `subject 1..1 MS only Reference(ShoulderPatient)`
   - `clinicalStatus 1..1 MS`, `verificationStatus 1..1 MS` (FHIR-required, made explicit)
   - `recordedDate MS`

2. **Add `comorbidity 0..*` slice** to `ShoulderRegistrationBundle.fsh` between `condition` and `priorTreatment`. Constrained `only ShoulderComorbidityCondition`.

3. **Add `hl7.fhir.uv.ips: 1.1.0`** as a non-parenting dependency in `sushi-config.yaml` so the IG Publisher can resolve the `ProblemsSnomedAbsentUnknownUvIps` canonical at build / validation time. EU Base v2.0.0 does not declare IPS transitively (verified against the cached `package.json`).

4. **Frontend (port 3000) only**: ship a `SnomedTypeahead` component (`frontend/src/components/shared/SnomedTypeahead.tsx`) backed by a new `useSnomedTypeahead` hook (`frontend/src/hooks/useSnomedTypeahead.ts`, debounced 250 ms, min 2 chars) that calls `fhirClient.expand()` with a new optional `filter` parameter. Bound to `VALUESET_URLS.IPS_PROBLEMS`. Multi-select chip UI in StepPatient at the bottom of the Q1 history section. Each selected SNOMED code is emitted as one `ShoulderComorbidityCondition` resource.

5. **SDC frontend (port 3001) deferred**. Stock SDC item-renderers cannot typeahead a SNOMED ECL VS — they would attempt to expand the whole VS (~thousands of clinical findings). Implementing this needs a custom item-renderer extension and warrants its own ADR.

6. **ICD-10-GM dual-coding deferred**. Under FHIR R4 binding semantics, `extensible` requires at least one `coding[]` entry to come from the bound VS; additional `coding[]` siblings (e.g. `coding[1] = { system: "http://fhir.de/CodeSystem/bfarm/icd-10-gm", code: "I10", … }`) are unrestricted. So the dual-coding pattern works without a structural change. This mirrors the SenologieOnFHIR pattern but doesn't force the German payer-side dependency now. Q1.l Workmen's compensation has an analogous deferral for German payer-type ValueSets.

## Why extensible, not preferred

Mirroring IPS's `preferred` strength exactly is the safer alignment claim, and it's what the first draft of this ADR proposed. On a second pass:

- **IPS uses `preferred` because IPS is a summary IG.** IPS receives heterogeneous data from upstream EHRs that may not have SNOMED at all; a strict binding would reject conformant-but-legacy data. That constraint does not apply to a new single-jurisdiction surgical registry that captures its own data.
- **`preferred` produces no validator pushback.** A clinician who records a comorbidity as plain ICD-10-GM with no SNOMED equivalent will pass validation. For a registry whose value proposition is structured comparability across European sites (the explicit Bikkanuri-2024 / SECEC framing of this thesis), that is the wrong signal. The `Full` coverage claim becomes rhetorical.
- **`extensible` is the right semantic match.** FHIR R4 §4.9.3: "extensible — to be conformant, the concept in this element SHALL be from the specified value set if any of the codes within the value set can apply to the concept being communicated." For comorbidities, a SNOMED concept exists for virtually every clinically relevant case (the VS spans `< 404684003 |Clinical finding|` plus situations and events) — so `extensible` effectively says "use SNOMED when one applies, which is almost always."
- **Dual-coding is preserved.** `extensible` constrains "at least one of the `coding[]` entries must be from the VS" — additional codings can be anything. ICD-10-GM as `coding[1]` remains permitted; the SNOMED `coding[0]` satisfies the binding.
- **Thesis framing benefits.** "We adopt IPS's VS and tighten the binding strength to match a single-jurisdiction registry's structured-comparability requirement" is a stronger IG-craftsmanship story than "we rubber-stamped IPS exactly."

The cost is a small deliberate divergence from IPS's strength choice, documented here. The frontend typeahead behaviour does not change (it already returns SNOMED codes from the VS expansion). The example data (Anna Müller's two SNOMED-coded comorbidities) remains valid under either strength.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep the unprofiled `Condition` claim and add only a frontend input | The bundle slice would still be unnamed, the binding still implicit, the validator gain nothing. The "Full" claim would remain vacuous. |
| Local SNOMED `isa/64572001 \|Disease\|` ValueSet | Narrower than IPS chose (Disease excludes clinical findings like chronic pain, mobility limitations that are reasonable comorbidities). IPS already settled this boundary at `< 404684003 \|Clinical finding\|`; reinventing it weakens the alignment claim and adds an IG artifact for no benefit. |
| Parent (or bundle-slice `only`) `Condition-uv-ips` directly, no local profile | The most obvious middle path — rejected on four IPS-specific constraints visible only in the IPS FSH: (1) `subject only Reference(PatientUvIps)` would force `ShoulderPatient` references to be re-typed or fail validation (substantial knock-on, would need a `PatientUvIps`-parented `ShoulderPatient` bridge); (2) `clinicalStatus` / `code` / `category` constrained to `CodeableConceptIPS` adds an IPS datatype-profile dependency the rest of the IG doesn't use; (3) IPS ships ~30 Creator/Consumer obligation extensions (SHALL:populate-if-known, SHALL:handle, SHOULD:display) targeting IPS's actor framework — irrelevant noise for a single-jurisdiction surgical registry; (4) IPS's own `category` binding is `extensible` to `ProblemTypeUvIps`, while our profile pins `category` to a fixed `problem-list-item` (stricter than IPS itself requires). The thin local profile gets the same VS alignment without inheriting any of these. |
| `Condition (EU Core)` as profile parent | Inherits IPS binding + EU's preferred eHDSI ICD-10/Orphanet additional binding for free. Rejected for v1 — pulls in the full EU Core inheritance chain (`condition-assertedDate`, `Procedure.recorded` cross-version, etc.) when we only need the binding. Can be revisited if/when the IG migrates from soft (ADR-0038) to hard EU Core alignment. |
| SenologieOnFHIR slice-based multi-coding (`coding[icd10gm]` + `coding[sct]` + `coding[icd11]`) | Overkill for v1 — locks ICD-10-GM into the structure now; the `extensible` binding already permits the same multi-coding via additional `coding[]` siblings without slicing. SenologieOnFHIR has a different operational requirement (German oncology registry that must mirror tumour registry exports). |
| mCODE Observation + extension pattern | Outlier; not how IPS / EU Base model problem-list Conditions. Adds an Observation profile we don't otherwise need. Comorbidities really are problem-list Conditions semantically. |
| Keep IPS's `preferred` binding strength | Mirroring IPS exactly is defensible but weak. `preferred` produces no validator pushback if a clinician records a comorbidity in plain ICD-10-GM with no SNOMED at all — undermining the registry's structured-comparability value proposition. IPS chose `preferred` because IPS receives heterogeneous legacy data; a new single-jurisdiction registry does not have that constraint. See §"Why extensible, not preferred" below. |

## Consequences

✅ Q1.c becomes legitimately Full — backed by a profile, a named bundle slice, an `extensible` VS binding (the validator now enforces it, no longer just "encouraged"), a UI component, and example data.

✅ IPS / EU Base alignment extends from EU Base + EU Core (ADR-0038) into problem-list coding. Defensible claim for the thesis Discussion: "Shoulder on FHIR adopts IPS's `ProblemsSnomedAbsentUnknownUvIps` ValueSet and tightens the binding from `preferred` to `extensible` to match a single-jurisdiction registry's structured-comparability requirement."

✅ Typeahead works against `tx.fhir.org` with **zero** new seed-loader plumbing. The frontend hits `$expand?url=http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips&filter=hyper&count=20`; HAPI proxies to `tx.fhir.org` (per ADR-0050) which serves the IPS VS by SNOMED expansion.

✅ ICD-10-GM dual-coding remains a deployment-time customisation (`coding[]` additions), not a structural blocker.

⚠️ Adds `hl7.fhir.uv.ips: 1.1.0` to the IG dependency chain (one more non-parenting package the IG Publisher must download — small, well-cached at `tx.fhir.org`).

⚠️ SDC frontend now has a coverage gap: the Registration Questionnaire does not include a comorbidity item. Needs a follow-up ADR + custom item-renderer (SDC `extension` annotations for typeahead).

❌ The example bundle file `anna_mueller_01_registration.json` grows by ~80 lines (two new Condition entries). One-time cost; future longitudinal examples (other patients) follow the same pattern.

## Sources

- the vendored IPS reference IG (` — `ConditionUvIps.fsh` line 62
- `: seed/.fhir-eu-base-cache/extracted/package/StructureDefinition-Condition-eu-core.json` — `Condition.code` binding
- the vendored SenologieOnFHIR reference IG (` — `bih-pr-seno-diagnose-benigne.fsh` (multi-coding pattern, rejected)
- the vendored mCODE reference IG (` — `SD_ComorbidCondition.fsh` (Observation pattern, rejected)
- ADR-0038 (EU Base soft alignment), ADR-0050 (HAPI delegates SNOMED to tx.fhir.org), ADR-0046 (precedent for adding a new Condition extension), ADR-0047 (precedent for thin profile additions)
- HL7 IPS canonical: `http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips`
