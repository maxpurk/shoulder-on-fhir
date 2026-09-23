# ADR-0059: `ShoulderProcedure` parents from `procedure-eu-core`; instances additionally claim `Procedure-uv-ips` via `meta.profile[]`

**Date:** 2026-05-22
**Status:** Accepted — profile renamed by ADR-0066 (2026-06-07)

> **Rename update (2026-06-07, ADR-0066):** The profile referenced throughout this ADR was renamed `ShoulderProcedure` → `RotatorCuffProcedure` (kebab id `shoulder-procedure` → `rotator-cuff-procedure`). The EU Core / IPS inheritance and multi-profile claim story below are unchanged; only the profile name on this IG's side moved.

## Context

Third in the four-ADR sequence that closes the realm-alignment work surfaced during the 2026-05-22 SECEC mapping walkthrough. ADR-0057 reparented `ShoulderPatient` from base `Patient` to EU Core `patient-eu-core` and added IPS `Patient-uv-ips` via `meta.profile[]`. ADR-0058 did the analogous work for the Condition family. This ADR closes the Procedure layer.

`ShoulderProcedure` (introduced in the original IG; refined by ADR-0032 / ADR-0033 / ADR-0046) covers two semantically distinct cases:

1. **Index surgical procedures** — the rotator cuff repair and concomitant procedures (biceps tenodesis, subacromial decompression, etc.), carried in `ShoulderSurgeryBundle.entry[procedure]` with category bound to `387713003 Surgical procedure` (via `ShoulderProcedureCategory` and the surgical sub-VS).
2. **Prior non-surgical treatments** — Hurley Q1.f's "physical therapy / injections", carried in `ShoulderRegistrationBundle.entry[priorTreatment]` with category bound to `PriorTreatmentCategory`. ADR-0033 documents the category-based discrimination.

Both are clinical-fact Procedures from the patient's perspective and both are legitimate "patient summary" candidates under the IPS Procedure-uv-ips semantic. The IG should claim IPS profile-level conformance on both.

The plan file for this ADR sequence (`zoom-out-take-what-spicy-acorn.md`) originally said "No IPS multi-profile claim needed at this layer (no IPS shoulder-specific procedure profile exists)" — that note was wrong on a literal reading. IPS does publish a Procedure profile: `http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips`. The plan's correct intent was "no shoulder-specific IPS Procedure exists" — true, but the generic IPS Procedure is the natural multi-profile target. This ADR adopts it.

Empirical audit (2026-05-22):

- **`procedure-eu-core`**: `code 1..1` preferred-bound to `http://hl7.org/fhir/uv/ips/ValueSet/procedures-uv-ips`; `subject` typed `Reference(patient-eu-core)`; `performed[x] 1..1`; R5 `Procedure.recorded` extension declared as named slice (`sliceName: recorded`). The `subject` chain is satisfied because ShoulderPatient parents from patient-eu-core (ADR-0057).
- **`Procedure-uv-ips`**: `code 1..1 MS` preferred-bound to `http://hl7.org/fhir/uv/ips/ValueSet/procedures-snomed-absent-unknown-uv-ips` (SNOMED-ECL variant, different VS from EU Core's preferred); `subject 1..1 MS only Reference(Patient-uv-ips)` — satisfied via ShoulderPatient's `meta.profile[]` IPS claim (ADR-0057); `performed[x] 1..1 MS` — already enforced locally. All other IPS Procedure constraints are MS flags or compatible cardinality requirements.
- **`ShoulderProcedure`'s tighter local constraints** (extensible to `ShoulderProcedureType`, `bodySite from ShoulderLaterality (required)`, `reasonReference only Reference(RotatorCuffCondition)`, `performed[x] only dateTime or Period`) all sit on top of both parents without conflict. The IG's local binding dominates conformance.

The thesis-defense sentence after this ADR: *"`ShoulderProcedure` derives from HL7 Europe Core `procedure-eu-core` and inherits its preferred binding to IPS `procedures-uv-ips`; instances additionally claim IPS `Procedure-uv-ips` conformance via `meta.profile[]`."*

## Decision

1. **Reparent `ShoulderProcedure`** in `ig/input/fsh/profiles/ShoulderProcedure.fsh`:
   - `Parent: Procedure` → `Parent: http://hl7.eu/fhir/base/StructureDefinition/procedure-eu-core`
   - Remove the locally-declared `recorded` extension slice — inherited from `procedure-eu-core` (sushi would otherwise warn on slice-name collision, same pattern as ADR-0058 for `assertedDate`).
   - Keep all other local constraints unchanged: status 1..1 MS, category 1..1 MS extensible to ShoulderProcedureCategory, code 1..1 MS extensible to ShoulderProcedureType, subject 1..1 MS only Reference(ShoulderPatient), performed[x] 1..1 MS only dateTime or Period, bodySite 1..1 MS required to ShoulderLaterality, reasonReference MS only Reference(RotatorCuffCondition).
   - Bump `^date` to 2026-05-22.
   - Update Description to document the new parent chain + the IPS multi-profile pattern + the patient-reference chain.

2. **Claim IPS `Procedure-uv-ips` conformance via `meta.profile[]`** on every `ShoulderProcedure` instance — both index surgical procedures AND prior PT/injection procedures, per the symmetric semantic argument above:
   - FSH examples (`examples/ShoulderProcedure.fsh`, `examples/ShoulderSurgeryBundle.fsh`) — add `* meta.profile[+] = "http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips"` after the `InstanceOf:` declaration. 3 instances updated.
   - JSON examples — append `"http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips"` to the `meta.profile` array on every Procedure resource:
     - `example_data/anna_mueller_01_registration.json` — 2 prior-treatment Procedures (PT + injection)
     - `example_data/anna_mueller_02_surgery.json` — 1 index surgical Procedure
     - `seed/bundles/example-patients.json` — 7 Procedures across 3 example patients (mix of index surgery + prior treatment)
   - Total: 13 Procedure instances now declare both profiles.

3. **No CSV update at this layer.** The CSV's Q1.f (prior treatment) and the L3.B (surgical procedure) rows already reference `ShoulderProcedure` by name; the profile change is transparent to the Path column. The IG-Implementation column for the relevant rows could optionally be enriched later — deferred.

4. **No validator script changes.** The IPS package pin from ADR-0057 (`-ig hl7.fhir.uv.ips#1.1.0`) covers `Procedure-uv-ips` resolution.

5. **No frontend changes.** Both frontends construct Procedure resources from typed builders / SDC extractors; the FHIR shape they produce continues to validate. Adding IPS multi-profile to submitted bundles is a future enhancement (the example bundles carry the claim today).

## Why IPS multi-profile on BOTH index and prior-treatment Procedures

The semantic question: does it make sense to claim IPS Procedure-uv-ips conformance on a "patient had physical therapy six months ago" record?

Answer: yes. IPS Procedure-uv-ips is the profile for "a procedure performed for, with, or on a patient as part of the provision of care" (FHIR core wording, preserved by IPS). It's deliberately broad — IPS uses it for surgical procedures, diagnostic procedures, and rehabilitation activities alike. Physical therapy and corticosteroid injection are both within IPS's intended scope.

The category-based discrimination introduced by ADR-0033 (surgical vs prior-treatment) is an IG-internal distinction for bundle slicing and workflow; it's not a semantic boundary that IPS recognises. From IPS's perspective, both are Procedures. Both warrant the same multi-profile claim.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep `Parent: Procedure` (status quo) | Same realm-alignment-gap argument as ADR-0058. Inconsistent with the EU Core direction the surrounding ADRs (0057, 0058) committed to. |
| Reparent only, no IPS multi-profile claim | Loses the IPS conformance signal that ADR-0057's Patient enables. The patient-reference chain is unblocked; not exploiting it costs nothing to add. |
| IPS multi-profile claim only on index surgical procedures (not prior-treatment) | Asymmetric. The semantic case for "PT was a procedure" is exactly as strong as "the rotator cuff repair was a procedure." Skipping prior-treatment would be an arbitrary distinction. |
| Tighten the IG's `ShoulderProcedureType` extensible binding to match IPS's `procedures-snomed-absent-unknown-uv-ips` preferred binding | Our `ShoulderProcedureType` VS is shoulder-specific (surgical + PT + injection codes); IPS's VS is the universal SNOMED-ECL `procedures` set. Different scopes; both bindings coexist FHIR-legally without further work. Tightening would lose shoulder-domain specificity. |
| Wait for IPS 2.0.0 (in ballot) | Same reasoning as ADR-0058's deferral. IPS 1.1.0 is the stable version; upgrade path is a one-line dependency bump when 2.0.0 finalises. |

## Consequences

✅ **Profile-level EU Core conformance** for the Procedure layer. The thesis Discussion gains: "ShoulderProcedure parents from HL7 Europe Core `procedure-eu-core`, inheriting the preferred binding to IPS procedures and the R5-backport `recorded` extension."

✅ **IPS `Procedure-uv-ips` conformance** declared on every Procedure instance (13 across the IG examples + seed bundle + longitudinal example data). The validator runs against both profiles; both pass empirically (validated 2026-05-22 against the full validator batch and the Anna registration + surgery bundles).

✅ **`Procedure.recorded` extension** is now inherited from EU Core rather than locally redeclared. Single source of truth (parallels ADR-0058's pattern for `condition-assertedDate`).

✅ **Patient reference chain works** for both layers: `procedure-eu-core.subject → patient-eu-core` (satisfied via ShoulderPatient's EU Core parent), and `Procedure-uv-ips.subject → Patient-uv-ips` (satisfied via ShoulderPatient instance-level `meta.profile[]` IPS claim).

✅ **EU Core's preferred IPS terminology binding** to `procedures-uv-ips` is now inherited. Combined with ADR-0058's parallel inheritance on Condition, the IG now declares IPS terminology bindings on three of its core resource types (Patient inherits patient-eu's extensions; Condition inherits problems-uv-ips; Procedure inherits procedures-uv-ips).

✅ **Three ADRs (0057-0059) form a coherent realm-alignment story.** EU Core is the structural parent across Patient + Condition family + Procedure; IPS multi-profile is the instance-level interop claim on every resource where IPS publishes a matching profile. The fourth ADR in the sequence (ADR-0060) closes the same pattern for the Observation layer's social-history sub-family.

⚠️ **Two different IPS Procedure VSs are now in play.** EU Core inherits the preferred binding to `procedures-uv-ips` (broad). IPS Procedure-uv-ips's own preferred binding is to `procedures-snomed-absent-unknown-uv-ips` (SNOMED-ECL with absent/unknown extension). Both are "preferred" — neither blocks our local extensible binding to ShoulderProcedureType. Documented but not enforced as a structural distinction.

⚠️ **13 Procedure instances now carry a manual multi-profile claim.** Same trade-off as ADRs 0057 and 0058. Mitigated by example-as-template consistency.

⚠️ **The "no shoulder-specific IPS Procedure" note in the plan file was a misreading.** Updated in this ADR's §Context. The plan file is preserved as historical record of the planning step; this ADR is the authoritative documentation of what was actually done.

## Sources

- `seed/.fhir-eu-base-cache/extracted/package/StructureDefinition-procedure-eu-core.json` — `code` binding, `subject` type, `recorded` slice (verified 2026-05-22)
- the IPS package's `StructureDefinition-Procedure-uv-ips.json` — IPS Procedure profile canonical + constraints
- ADR-0032 (ShoulderProcedureType VS — extensible binding preserved), ADR-0033 (ShoulderProcedureCategory — surgical vs prior-treatment distinction; preserved), ADR-0038 (Procedure.recorded extension — now inherited rather than locally declared), ADR-0057 (Patient EU Core parent + IPS multi-profile — the structural prerequisite), ADR-0058 (Condition family EU Core parent + IPS multi-profile — same sequencing precedent)
- Empirical validation transcripts: `tools/validation-output/_batch-Seed_bundle.json` (post-ADR-0059 = 0 errors), a validator run over the longitudinal registration + surgery bundles (post-ADR-0059 = 0 errors across both registration + surgery bundles)
