# ADR-0053: Retain FHIR base administrative gender; adopt R4-backported `individual-recordedSexOrGender` (RSG) for sex at birth; defer German `gender-other-de`

**Date:** 2026-05-22
**Status:** Accepted

## Context

Hurley et al. (2024) SECEC consensus statement A1(b) names ``Gender'' as part of the unanimous Q1 patient-history factors, without further specification. The HL7 Gender Harmony Implementation Guide splits the historically-overloaded "sex/gender" concept into five separable concerns:

1. **Administrative gender** — clerical/registration value (how the system addresses the patient). FHIR R4 `Patient.gender` is this concept, bound `required` to the 4-code ValueSet `http://hl7.org/fhir/ValueSet/administrative-gender` (male / female / other / unknown).
2. **Recorded sex or gender (RSG)** — a recorded sex/gender value from a specific source (birth certificate, legal registration, etc.) with provenance metadata (`type`, `effectivePeriod`, `source`, `genderElementQualifier`). The HL7-blessed pattern for **research stratification** in registries: carries the *patient-level* demographic researchers actually `GROUP BY`.
3. **Gender identity** — distinct from both administrative gender and recorded sex.
4. **Sex for clinical use (SFCU)** — a *runtime directive to a clinical-decision-support system*: "reader, apply female-typical reference ranges to this observation." HL7's own definition: *"a parameter that provides guidance on how a recipient should apply settings or reference ranges."* Cardinality 0..* exists because one patient can simultaneously need different SFCU values for different clinical contexts (cardiac reference range ≠ renal reference range). **Not a patient-level demographic.**
5. **Pronouns** — separate extension addressing how to address the patient.

The IG must also operate under EU jurisdictions. **German Personenstandsgesetz §22 Abs. 3** (in force since 2018) recognises `divers` as a third gender option; the `http://fhir.de/StructureDefinition/gender-other-de` extension expands FHIR's `other` into `D` (divers) and `X` (unbestimmt). This is required for German clinical deployment but not for the EHDS-scope EU Base alignment the IG targets per ADR-0038.

The IG is a **clinical research registry** (rotator cuff surgery outcomes). The primary downstream consumer is a researcher running cohort analyses — "recovery in female vs male patients at 1 year post-op", "stratify MMT scores by sex assigned at birth". It is not an EHR and not a CDS engine.

This ADR is the gender counterpart to the broader "honesty class" of ADRs (ADR-0036, ADR-0039, ADR-0046, ADR-0054) that explicitly document where this thesis narrows, decomposes, or extends single-word Hurley elements.

## Decision

1. **Keep `ShoulderPatient.gender 1..1 MS`** bound to the FHIR base `administrative-gender` ValueSet (`required`). No change from current state. Matches Hurley A1(b) wording verbatim and matches the field every comparable registry IG (mCODE, US Core, IPS, EU Base) stratifies on.
2. **Adopt HL7 Gender Harmony's `individual-recordedSexOrGender` (RSG) extension** as `ShoulderPatient.extension[recordedSexOrGender] 0..1 MS`, profile `http://hl7.org/fhir/StructureDefinition/individual-recordedSexOrGender`. R4-backported via `hl7.fhir.uv.extensions.r4@5.3.0` (already a transitive dependency of HL7 EU Base). The slice constrains:
   - `extension[type].valueCodeableConcept.coding` fixed-pattern to LOINC `76689-9` "Sex assigned at birth" — every RSG instance in this registry uniformly represents sex at birth, eliminating the per-record interpretation overhead.
   - `extension[value].valueCodeableConcept` `required`-bound to `http://hl7.org/fhir/ValueSet/administrative-gender` (same 4 codes as `Patient.gender`).
   - Cardinality 0..1 (not the HL7 default 0..*) — with `type` pinned, multiple instances would be contradictory.
   - `genderElementQualifier` is intentionally omitted: both frontends collect `Patient.gender` and `Patient.extension[recordedSexOrGender]` as two independent user inputs, so we cannot claim either was derived from the other.
   - Tracked in the mapping CSV as row `L3.A.6`.
3. **Two-field UI** in both frontends. Existing "Gender" dropdown (administrative gender) is unchanged; a new "Sex assigned at birth" dropdown captures the RSG value (same 4 admin-gender codes, different semantic). Both are optional from the user's perspective; the registry treats them as distinct concepts.
4. **Do not add the German `gender-other-de` extension** in the IG. Deferred to deployment-time customisation when a German clinic adopts the IG. (Out of EU Base scope; DE-namespaced.)
5. **Do not add `individual-genderIdentity` or `individual-pronouns`** (the other two sex/gender extensions Gender Harmony provides). These address gender identity and pronouns, not sex at birth; Hurley A1(b) gives no warrant for them; scope creep beyond consensus.
6. **Document the decomposition explicitly** in:
   - the SECEC→FHIR mapping CSV (Q1.b Notes column points to L3.A.6; L3.A.6 carries the RSG implementation row) and
   - the thesis Discussion §6.1 (Feedback to Hurley Consensus, bullet list) as a single-word-decomposition observation alongside Q1.h Pain and Q1.j Sports.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **Adopt the EU Base SFCU extension** (`patient-sexParameterForClinicalUse`) | Initially adopted in an earlier draft of this ADR and reverted on the same day after best-practice research. SFCU is, by HL7's own definition, *"a parameter that provides guidance on how a recipient should apply settings or reference ranges"* — a runtime directive to a CDS engine, not a patient-level demographic. Its `0..*` cardinality permits simultaneous context-specific values (cardiac reference range ≠ renal reference range), which makes `GROUP BY sex` analyses incoherent. The Gender Harmony IG itself states that RSG information *"is known **NOT** to represent a gender identity, **sex parameter for clinical use**, or attributes related to sexuality"* — i.e., HL7 explicitly partitions the two concepts. SFCU is the right tool for an EHR/CDS system; RSG is the right tool for a research registry. |
| Add `gender-other-de` extension now | Out of EU Base scope; defers cleanly to German deployment customisation. Adds DE-namespaced dependency the EHDS-scoped IG does not need. |
| Add a separate `BirthSexObservation` profile (Observation with male/female/intersex/unknown VS) | The US Core / mCODE pattern (`us-core-birthsex`). Adds a whole resource per patient where an extension suffices, doubles query complexity for stratification, and creates a local profile Hurley does not name. RSG is the FHIR-canonical pattern for this concept and avoids an Observation round-trip. |
| Adopt `us-core-birthsex` extension on Patient | US-namespaced extension in a European IG; awkward provenance. RSG is the HL7-international Gender Harmony equivalent and is what mCODE-equivalent EU registries are converging on. |
| Adopt all three Gender Harmony sex/gender extensions (RSG + gender-identity + pronouns) | Goes well beyond Hurley A1(b). Gender identity and pronouns address different real-world needs than rotator-cuff outcomes research; adding them creates operational surface area without a Hurley element justifying it. |
| Drop the RSG extension entirely and stratify on `Patient.gender` alone | Defensible and clean (this is what IPS does). Rejected because for a research registry, separating *administrative gender* (how to address the patient) from *sex at birth* (the biological stratification variable) gives downstream researchers an auditable answer to the IRB question "what does `Patient.gender = female` mean in your dataset?" — without that separation the question is ambiguous. |

## Consequences

✅ EU Base alignment preserved (ADR-0038): EU Base permits both `Patient.gender` and arbitrary patient extensions; neither RSG nor SFCU is required by EU Base. Our constraint (1..1 on `Patient.gender`, 0..1 on RSG) tightens EU Base appropriately for a research registry.
✅ Hurley A1(b) wording matched verbatim on `Patient.gender` — no fabricated decomposition of the consensus element.
✅ Sex-at-birth stratification (relevant for rotator-cuff outcomes research) is expressible via RSG at `L3.A.6` — no local Observation required, no per-patient interpretation overhead (because `type` is pinned to LOINC 76689-9).
✅ Q1.b remains `Full` coverage at `Patient.gender` 1..1 MS; RSG is enumerated as Layer 2 IG-Operational infrastructure (L3.A.6), not counted toward the Hurley denominator.
✅ Pattern matches every comparable registry IG: mCODE uses `Patient.gender 1..1` + `us-core-birthsex 0..1 MS`; US Core uses gender + birth sex + current sex; IPS uses gender only; we use gender + RSG (sex at birth). Stratification queries `GROUP BY Patient.gender` work across all of them.
✅ Documented in mapping CSV (Q1.b Notes + L3.A.6 row) and Discussion §6.1 so future readers see the deliberate decomposition.
⚠️ RSG is 0..1 — registries that want sex-at-birth stratification must enforce its population at the application/policy layer; the IG does not require it. This matches Hurley's silence on sex at birth.
⚠️ German clinics adopting the IG will still need to apply the `gender-other-de` extension at deployment time to comply with Personenstandsgesetz §22 Abs. 3.
⚠️ **HAPI seed-loader change required.** The RSG StructureDefinition is in `hl7.fhir.uv.extensions.r4`, and Sushi pulls that package at IG build time, but HAPI did not load it — runtime resolution of `Patient.extension[recordedSexOrGender]` would fail. Fixed by adding **`seed/load-uv-extensions.sh`** to the seed pipeline (step 3, between `load-eu-base-profiles.sh` and `load-profiles.sh`). The loader downloads `hl7.fhir.uv.extensions.r4` + `hl7.terminology.r4` (the terminology pack is loaded alongside to future-proof for any other UV extension that binds standard HL7 terminology VSs) and PUTs ~4200 resources into HAPI by id. Idempotent (canary: `StructureDefinition/individual-recordedSexOrGender`). RSG's `value` sub-extension binds to FHIR-core `administrative-gender` (already loaded by `load-base-profiles.sh`), so no post-load `$invalidate-expansion` is required — unlike SFCU, RSG has no terminology-pack VS on the critical path. **Build-script pagination fix:** the `build-and-deploy.sh` TERM stage now paginates HAPI's `/ValueSet` search via `Bundle.link[rel=next]` rather than relying on `?_count=200`; after the terminology pack load, the IG-namespaced VSs sit past page 1 alphabetically, and the old naive enumeration silently processed zero IG VSs, leaving subsets cached at 0 concepts. Two IG canaries (goutallier-classification + cofield-tear-size-classification) guard the regression. **Pre-expansion sweep eliminated (2026-05-22):** with `hl7.terminology.r4` loaded, HAPI's default scheduled background pre-expansion task grinds through ~2596 v3-* ValueSets on every cold start (each saving 0 concepts because their CodeSystems aren't loaded), taking 15–25 minutes and blocking the TERM stage canaries. The fix is **two** properties in `hapi/application.yaml`, not one: `hapi.fhir.enable_task_pre_expand_value_sets: false` kills the scheduled sweep; `hapi.fhir.pre_expand_value_sets: true` (HAPI default) is *kept* — without it HAPI's "in-memory expansion without parameters" fallback returns 0 concepts for local-CodeSystem-backed enumerated VSs (Goutallier, Cofield, …) even though `CodeSystem/$lookup` against the same CS works. With this combination HAPI computes and persists IG VS expansions on demand when the frontend POSTs `$expand`, the v3-* VSs we never touch stay un-expanded, and cold start drops to ~5 min. Setting only `pre_expand_value_sets: false` (the initial attempt) leaves the scheduled task running and breaks on-demand expansion — verified empirically.
❌ Gender identity and pronouns remain unmodelled. A future iteration could add `individual-genderIdentity` if a Hurley successor includes it.

## Sources

- Hurley et al. (2024) JSES International 8(3):478–482, A1(b)
- FHIR R4 `Patient.gender` — http://hl7.org/fhir/R4/patient.html#search:gender
- FHIR R4 administrative-gender VS — http://hl7.org/fhir/R4/valueset-administrative-gender.html
- HL7 Gender Harmony Implementation Guide — https://build.fhir.org/ig/HL7/fhir-gender-harmony/
- `individual-recordedSexOrGender` extension — http://hl7.org/fhir/extensions/StructureDefinition-individual-recordedSexOrGender.html
- `patient-sexParameterForClinicalUse` extension (alternative-not-chosen) — http://hl7.org/fhir/extensions/StructureDefinition-patient-sexParameterForClinicalUse.html
- `hl7.fhir.uv.extensions.r4@5.3.0` package — https://simplifier.net/packages/hl7.fhir.uv.extensions.r4/5.3.0
- LOINC 76689-9 "Sex assigned at birth" — verified against `https://fhir.loinc.org/CodeSystem/$lookup`
- HL7 Europe Base v2 Patient profile (`patient-eu`) — `seed/.fhir-eu-base-cache/extracted/package/StructureDefinition-patient-eu.json`
- mCODE CancerPatient profile (precedent for `Patient.gender` + birth-sex split) — https://hl7.org/fhir/us/mcode/StructureDefinition-mcode-cancer-patient.html
- `http://fhir.de/StructureDefinition/gender-other-de` (German Basisprofil)
- Personenstandsgesetz §22 Abs. 3 (in force 2018-12-22)
- ADR-0038 — EU Base alignment; sets the EHDS scope this decision sits in
- ADR-0046 — `condition-dueTo` precedent for explicit decomposition documentation
- Mapping CSV rows `Q1.b` and `L3.A.6`
- Thesis Discussion §6.1, Feedback to Hurley Consensus
