# ADR-0057: ShoulderPatient parents from `patient-eu-core`; instances additionally claim `Patient-uv-ips` via `meta.profile[]`

**Date:** 2026-05-22
**Status:** Accepted

## Context

The 2026-05-22 walkthrough of the SECEC mapping CSV produced ADR-0055 (comorbidity / IPS VS binding) and ADR-0056 (smoking / IPS VS binding + IPS package loader). Both ADRs declared *terminology-level* alignment with IPS — VS canonicals reused, codes inherited — but stopped short of *profile-level* conformance claims. The thesis-defense question that ADR-0056 explicitly deferred was: "having loaded the IPS package, why don't we also claim profile conformance to `Observation-tobaccouse-uv-ips`?"

The blocker, surfaced during ADR-0055's authoring and confirmed empirically against the IPS source: IPS's `Observation-tobaccouse-uv-ips.subject only Reference(PatientUvIps)`. Multi-profile conformance via `meta.profile[]` would fail validation unless `ShoulderPatient` instances also satisfy PatientUvIps. Today they do not — `ShoulderPatient` parents from base `Patient` (ADR-0008-era choice).

This ADR closes the gap, but takes a half-step that the walkthrough surfaced as architecturally more honest: rather than declaring IPS as the primary upstream realm, **EU Core 2.0.0** is. The IG already declared soft alignment with HL7 Europe Base + Core (ADR-0038: Address-eu, condition-assertedDate, Procedure.recorded). EU Core 2.0.0 (April 2026) ships a fuller catalog now — `patient-eu-core`, `condition-eu-core`, `procedure-eu-core`, plus several others. EU is the realm match (German jurisdiction, EHDS context); IPS is the secondary upstream that supplies social-history Observation profiles EU does not author.

The empirical audit (2026-05-22, three Explore agents + direct file reads against `seed/.fhir-eu-base-cache/extracted/package/`) produced four anchors that frame this decision:

1. **`patient-eu-core` is thin.** It declares `name 1..*`, `birthDate 1..1`, and the invariant `eu-pat-1`: `family.exists() or given.exists() or text.exists() or extension('http://hl7.org/fhir/StructureDefinition/data-absent-reason').exists()` (4 disjuncts). It inherits 7 optional extension slots from `patient-eu` (birthPlace, sexParameterForClinicalUse, genderIdentity, pronouns, citizenship, nationality, birthTime). `patient-eu` also pins `Patient.address only Address-eu` — the constraint the IG today redeclares locally (ADR-0038).

2. **IPS `PatientUvIps` is mostly MS flags + obligation extensions, plus the IPS `ips-pat-1` invariant**: `family.exists() or given.exists() or text.exists()` (3 disjuncts, strictly tighter than `eu-pat-1` because it excludes the data-absent-reason escape). A `data-absent-reason`-only Patient satisfies EU but violates IPS — but this is a summary-IG corner case (emergency patient summary with unknown name). It does not apply to elective shoulder surgery, where every patient has a known family name.

3. **ShoulderPatient already requires `name.family 1..1 MS`.** This single constraint structurally satisfies BOTH `eu-pat-1` and `ips-pat-1` for every conformant registry instance. The multi-profile claim is therefore "free" — no additional constraints needed beyond what ShoulderPatient already declares.

4. **Empirical proof-of-concept**: a test Patient instance with both profiles in `meta.profile[]` validates clean against `validator_cli.jar 6.9.7+` with `-ig hl7.fhir.eu.base#2.0.0 -ig hl7.fhir.uv.ips#1.1.0` (verified 2026-05-22 against the running stack; only a `dom-6` best-practice narrative warning, unrelated).

The thesis-defense sentence that this ADR enables is:

> *Shoulder on FHIR is a scoped HL7 Europe IG. Its `ShoulderPatient` profile derives from HL7 Europe Core `patient-eu-core`, providing EHDS realm alignment by construction. Instances additionally claim conformance to IPS `Patient-uv-ips` via `meta.profile[]`; the cross-resource reference chain to IPS Observation/Condition profiles holds because our `name.family 1..1 MS` requirement structurally satisfies both `eu-pat-1` and `ips-pat-1` invariants.*

That sentence is honest, realm-correct, defensible against "did you run the validator?", and unlocks subsequent ADR-0058 (Condition family → condition-eu-core), ADR-0059 (Procedure → procedure-eu-core), and ADR-0060 (smoking Observation IPS multi-profile).

## Decision

1. **Reparent `ShoulderPatient`** in `ig/input/fsh/profiles/ShoulderPatient.fsh`:
   - `Parent: Patient` → `Parent: http://hl7.eu/fhir/base/StructureDefinition/patient-eu-core`
   - Remove the now-redundant `* address only http://hl7.eu/fhir/base/StructureDefinition/Address-eu` declaration — inherited from `patient-eu` via the new parent chain.
   - Keep `name.family 1..1 MS` (load-bearing — the structural satisfier of both invariants).
   - Keep `gender 1..1 MS`, `birthDate 1..1 MS`, `identifier 1..* MS` (all FHIR-legal tightenings of the inherited cardinalities).
   - Keep the `recordedSexOrGender` extension slice (ADR-0053). The slice coexists with EU's inherited `genderIdentity` / `pronouns` slices because the underlying extension URLs differ (`url`-discriminated slicing).
   - Add documentation in the profile Description explaining the EU-primary + IPS-secondary multi-profile architecture and pointing at this ADR.

2. **Claim IPS conformance via `meta.profile[]`** on every `ShoulderPatient` instance:
   - FSH examples (`examples/ShoulderPatient.fsh`, `examples/ShoulderBundle.fsh`) — add `* meta.profile[+] = "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips"` after the `InstanceOf:` declaration.
   - JSON examples (`example_data/anna_mueller_01_registration.json`, `seed/bundles/example-patients.json`) — append `"http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips"` to the existing `meta.profile` array on every Patient resource. 4 resources updated.

3. **Pin IPS in the validator CLI script** (`tools/validate.sh`):
   - Add `-ig "hl7.fhir.uv.ips#1.1.0"` to the validator command. Without this pin, the validator resolves `current-smoking-status-uv-ips` against `tx.fhir.org`'s IPS 2.0.0-ballot, which uses different codes — every smoking observation fails. Empirically observed and fixed during this ADR's implementation.

4. **Update the SECEC mapping CSV** `mapping/SECEC_FHIR_Mapping.csv`:
   - L3.A.1 (identifier) Notes — add EU Core / IPS multi-profile statement.
   - L3.A.2 (name) Notes — call out `name.family 1..1 MS` as the load-bearing constraint that satisfies both invariants.
   - L3.A.4 (address) Notes + IG-Implementation — note that `Address-eu` is now inherited rather than locally declared.

5. **No frontend changes.** Both frontends (port 3000 unified, port 3001 SDC) construct Patient resources from typed builders / SDC extractors; the FHIR shape they produce satisfies both ShoulderPatient and the inherited patient-eu-core constraints. The added `meta.profile[]` entry could be added to the builders if instance-level IPS claims are desired in submitted bundles — deferred. Example bundles are the authoritative carriers of the multi-profile claim.

## Why EU Core, not IPS, as the primary parent

The first instinct in the walkthrough was to reparent ShoulderPatient from `PatientUvIps` directly — make IPS the upstream and inherit its constraints. Rejected on four grounds:

| Concern | Detail |
|---|---|
| **Scope mismatch** | IPS is *international patient summary* — designed for cross-border patient summary documents. Shoulder on FHIR is a German jurisdiction surgical registry with European stakeholders. ADR-0022 + ADR-0038 already commit to European-EHDS scope. Picking IPS over EU as the primary parent would contradict that direction. |
| **IPS obligation noise** | PatientUvIps inherits ~30 obligation extensions (`SHALL:populate-if-known` / `SHALL:handle` / `SHOULD:display` targeting IPS Creator and Consumer actors). These are documentation annotations, not structural constraints — but they explicitly target IPS's cross-border-summary actor framework. Useless for a surgical registry. |
| **Inheritance asymmetry** | If ShoulderPatient parents from IPS, then `condition-eu-core.subject only Reference(patient-eu-core)` becomes the blocker — we'd need to claim patient-eu-core conformance via `meta.profile[]` to satisfy the EU Condition reference chain. Symmetric to the smoking-Observation blocker but in the opposite direction. EU-primary + IPS-secondary is the same shape but with the realms in their natural priority. |
| **Thesis framing** | The thesis already frames the IG as European-scoped (Bikkanuri-2024 SECEC benchmark, EHDS context, ADR-0022 European EHDS scope, ADR-0038 soft alignment with EU Base). "Shoulder on FHIR is a scoped HL7 Europe IG" is the natural cover sentence. Inverting to "Shoulder on FHIR is an IPS-conformant IG with EU extensions" would be technically possible but undermines the realm narrative. |

The cost of this choice: the IPS multi-profile claim is declared on every Patient *instance* (3 in seed, 1 in Anna's longitudinal bundle, 2 in IG examples) rather than once on the profile. Six explicit declarations. Mechanical and FHIR-canonical; no maintenance burden beyond authoring each new example.

## The `data-absent-reason` edge case

`eu-pat-1` allows the disjunct `extension('http://hl7.org/fhir/StructureDefinition/data-absent-reason').exists()`. `ips-pat-1` does not. A theoretically-valid EU Patient with `name = [{ extension: [{ url: data-absent-reason, ... }] }]` would satisfy EU but violate IPS — and its `ShoulderPatient` instance would fail the IPS multi-profile claim.

This is impossible in practice because `ShoulderPatient.name.family 1..1 MS` forces `family.exists()` to be true on every conformant registry instance. Both invariants short-circuit on the family disjunct; the data-absent-reason disjunct is never reached.

**Documented but not validator-enforced as a separate invariant.** Adding a "name.family.exists()" invariant on ShoulderPatient would be redundant with the existing cardinality constraint. The cardinality alone is sufficient.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Status quo (base `Patient` parent + ADR-0038 soft alignment only) | Weakest interop claim. EU Core 2.0.0 exists, fits our scope, costs ~30 min to adopt at this layer. Leaving it untaken sends the wrong defensive signal in the thesis Discussion ("you depend on EU base but never claim conformance — why?"). |
| Direct IPS reparenting (`Parent: PatientUvIps`) | Scope mismatch + obligation noise + inverts the natural EU-primary, IPS-secondary realm priority. See §"Why EU Core, not IPS" above. |
| Reparent from `patient-eu` (the base, not Core) | `patient-eu-core` adds only two constraints over `patient-eu` (`name 1..*` and `birthDate 1..1`), both of which we already declare. Parenting from `patient-eu` would still get the extension slots + Address-eu, but `patient-eu-core` is the published profile-level entry point that the EU IGs (Patient Summary, Hospital Discharge Report, etc.) parent from. Aligning with `patient-eu-core` is the more conformant claim. |
| Multi-profile via `meta.profile[]` on instances without changing the profile parent | Same conformance claim as ours BUT loses the validator's automatic application of EU Core constraints during profile-derivation analysis. With the parent change, every derived profile in the IG benefits from EU Core's extension slots without having to re-declare them. Cleaner long-term. |
| Add explicit `name.family.exists()` invariant for ips-pat-1 defense | Redundant with `name.family 1..1 MS` cardinality. The cardinality already guarantees the property. |
| Reparent from `Patient-uv-ips` AND multi-profile-claim `patient-eu-core` (IPS primary, EU secondary) | Possible and symmetric. Rejected for scope-narrative reasons (§"Why EU Core, not IPS") and because the IPS profile's obligation noise propagates into every derived profile — heavier downstream cost. |

## Consequences

✅ **Profile-level EU Core conformance** for the primary patient resource. The thesis Discussion gains a defensible sentence: "ShoulderPatient parents from HL7 Europe Core `patient-eu-core`." The validator now applies EU Core constraints automatically.

✅ **IPS Patient conformance** declared on every Patient instance via `meta.profile[]`. The validator runs against both profiles; both pass empirically (validated 2026-05-22 against the seed bundle and Anna's longitudinal bundle).

✅ **Unblocks ADR-0058 (Condition family → condition-eu-core).** `condition-eu-core.subject only Reference(patient-eu-core)` — now satisfied because ShoulderPatient is a derived profile of patient-eu-core.

✅ **Unblocks ADR-0060 (smoking Observation → multi-profile IPS).** `Observation-tobaccouse-uv-ips.subject only Reference(PatientUvIps)` — now satisfied because every ShoulderPatient instance claims PatientUvIps in `meta.profile[]`.

✅ **`Address-eu` constraint is now inherited rather than redeclared.** Single source of truth. ADR-0038's intent realised cleanly.

✅ **`tools/validate.sh` IPS-version pin** added (`-ig hl7.fhir.uv.ips#1.1.0`) — closes a latent bug where the validator would resolve IPS VS canonicals against `tx.fhir.org`'s 2.0.0-ballot, producing spurious "code not in value set" errors for ADR-0056 smoking observations. Empirically confirmed; fix verified.

⚠️ **`meta.profile[]` IPS claim is manual on instances.** Every new Patient example must remember to declare both profiles. Mitigated by FSH `Instance` pattern + JSON copy-paste consistency. Acceptable for the IG's example scope; production-deployer instances would set the profile via their bundle builder (out of scope for the IG).

⚠️ **No validator-enforced invariant for ips-pat-1's family-vs-data-absent-reason edge case.** The `name.family 1..1 MS` cardinality enforces it structurally but the reasoning is by-construction rather than by-invariant. Documented in §"The data-absent-reason edge case" above.

⚠️ **IG Publisher build (`--genonce`) may emit warnings** about resolving `Patient-uv-ips` references in narratives — the package is loaded into HAPI by `seed/load-ips-package.sh` (ADR-0056) but the IG Publisher uses `tx.fhir.org` for terminology and may not always resolve IPS-canonical structure definitions cleanly. Not blocking — published HTML still renders.

❌ **EU 2.0.0 is "STU 2" status, not Final.** A future EU 3.0.0 could change `patient-eu-core` constraints. Upgrade path: bump the pin in `seed/load-eu-base-profiles.sh` and re-run validation. Pinning to a specific version (2.0.0) per the loader script is the standard mitigation.

## Sources

- `seed/.fhir-eu-base-cache/extracted/package/StructureDefinition-patient-eu-core.json` — `eu-pat-1` invariant text (verified 2026-05-22)
- `seed/.fhir-eu-base-cache/extracted/package/StructureDefinition-patient-eu.json` — extension slots + Address-eu pin
- the IPS package's `StructureDefinition-Patient-uv-ips.json` — canonical `http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips`, derivation = `constraint`, base = `http://hl7.org/fhir/StructureDefinition/Patient`
- IPS's `PatientUvIps.fsh` source — `ips-pat-1` invariant + obligation-extension authorship pattern
- ADR-0022 (European-EHDS scope), ADR-0038 (soft EU Base alignment — superseded for Patient by this ADR; remains in force for extension reuse on Condition / Procedure), ADR-0053 (RSG extension authorship — preserved), ADR-0055 (IPS Comorbidity VS binding — unblocks via this ADR), ADR-0056 (IPS package loader — prerequisite for runtime validation)
- Empirical validation transcripts: `tools/validation-output/_batch-Seed_bundle.json` (post-ADR-0057 = 0 errors), a validator run over the longitudinal example bundle (post-ADR-0057 = 0 errors)
