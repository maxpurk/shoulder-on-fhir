# ADR-0040: HL7 SDC IG conformance and three-Questionnaire split

**Date:** 2026-05-19
**Status:** Accepted
**Builds on:** ADR-0017 (original Registration Questionnaire), ADR-0018 (SDC frontend as separate paradigm), ADR-0021 (Questionnaire as IG artifact), ADR-0030 (ShoulderFollowUpBundle), ADR-0034 (three-bundle architecture), ADR-0035 (unified registry frontend)
**Refines:** ADR-0018, ADR-0021 — the SDC pattern is upgraded to formal SDC IG conformance with bundle-aware Questionnaire artifacts

> **Update 2026-06-07 (ADR-0066):** The three bundle profiles the Questionnaires extract into were renamed `Shoulder{Registration,Surgery,FollowUp}Bundle` → `RotatorCuff{Registration,Surgery,FollowUp}Bundle`. The Questionnaire instances themselves (`shoulder-registration`, `shoulder-surgery`, `shoulder-follow-up`) and the SDC extraction pattern below are unchanged. The `item.definition` URLs targeting the renamed profiles were updated to the new `rotator-cuff-*` canonicals.
>
> **Update 2026-07-26 (ADR-0102):** The `hl7.fhir.uv.sdc` dependency this ADR adopted at `3.0.0` was bumped to `4.0.0` in commit `e425f1c` (2026-05-19, same day as this ADR) — a real, substantive upgrade (STU4 also changed `item.definition` URL conventions, which this project's FSH already follows) — but that bump never got its own ADR, and the surrounding prose here, in `sushi-config.yaml`, and in the project guide kept saying "3.0.0" for over two months. ADR-0102 retroactively documents the bump, fixes the stale version-label prose everywhere, and records a further finding: the STU4 `sdc-questionnaire-extr-defn` profile now documents `definitionExtract`/`definitionExtractValue`/`extractAllocateId` as its extraction mechanism, not the `itemExtractionContext` extension this project's FSH actually uses throughout (STU3-era, retained for backward compatibility, not migrated — see `docs/future_work_items/0003/`).

## Context

The IG honestly demonstrated the SDC *pattern* (fetch Questionnaire → render → client-side extract → Bundle) but did not formally conform to the HL7 Structured Data Capture IG. Concretely:

- `ig/sushi-config.yaml` declared no SDC dependency. Its dependencies were `hl7.terminology.r4`, `hl7.fhir.eu.base`, and `hl7.fhir.uv.xver-r5.r4` — none of them SDC.
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` used only core R4 extensions (`maxValue`, `minValue`). It had no `itemExtractionContext`, no `itemPopulationContext`, no `calculatedExpression`, no `launchContext`, no `initialExpression` — i.e., none of the SDC machinery that makes a Questionnaire formally SDC-conformant.
- `sdc-frontend/src/lib/extractor.ts` (692 lines) was a hand-coded linkId-driven switch with 35+ hardcoded resource-builder cases plus a 35-entry `OBSERVATION_PROFILE_URLS` map in `sdc-frontend/src/types/fhir.ts`. The Questionnaire's `item.definition` URLs were carried but ignored by the extractor.
- The Questionnaire and frontend both still targeted the **pre-ADR-0034 single-bundle Registration shape**: surgical procedures conflated with prior PT/injection, no Surgery or Follow-Up coverage. ADR-0034 §Consequences and ADR-0035 §Consequences explicitly named this as an open limitation: *"Two demonstration paradigms (SDC at 3001, LHC-Forms at 3002) still target the old single-bundle Registration shape."*

Two design tensions had to be resolved before adopting SDC formally:

1. **One Questionnaire vs. three.** A single mega-Questionnaire driving all three bundle profiles would re-create the registration / surgery / follow-up conflation ADR-0034 had already split apart. The three-bundle architecture exists at the FHIR layer; the form layer should mirror it so each Questionnaire's `itemExtractionContext` declares exactly one bundle's target resources.
2. **Server-side `$extract` vs. client-side.** SDC defines `POST Questionnaire/$extract` as the canonical extraction operation. Stock HAPI JPA Server 6.x/7.x does not ship a working `$extract` provider; enabling it would require Spring bean registration and a custom Maven dependency. ADR-0031 already placed HAPI in storage-server-only mode; routing extraction through HAPI contradicts that posture.

The user-confirmed scope (2026-05-19) is to adopt SDC v3.0.0 with three Questionnaires aligned to ADR-0034, keep extraction client-side (definition-driven, parsing `item.definition` URLs and `itemExtractionContext`), and demonstrate two SDC dynamic features that earn their keep: `calculatedExpression` for the Constant-Murley composite total and `itemPopulationContext` for follow-up pre-fill.

## Decision

1. **Declare `hl7.fhir.uv.sdc: 3.0.0` as a dependency** in `ig/sushi-config.yaml`. Append the SDC alignment statement to the IG description so the dependency is reflected in published metadata.

2. **Three Questionnaire artifacts**, each parented from `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extr-defn` (SDC 3.0.0 "Extractable Questionnaire - Definition", the definition-based extraction profile) via `meta.profile`, each targeting one bundle profile from ADR-0034:

   | Questionnaire | URL | Target bundle |
   |---|---|---|
   | `shoulder-registration` (refactored, v0.2.0) | `…/Questionnaire/shoulder-registration` | `ShoulderRegistrationBundle` |
   | `shoulder-surgery` (new, v0.1.0) | `…/Questionnaire/shoulder-surgery` | `ShoulderSurgeryBundle` |
   | `shoulder-follow-up` (new, v0.1.0) | `…/Questionnaire/shoulder-follow-up` | `ShoulderFollowUpBundle` |

3. **Group-level `itemExtractionContext`** on every group that maps to a single resource: `patient`, `condition`, `priorTreatment` (Registration); `encounter`, `procedure` (Surgery); `encounter` (Follow-Up). The Expression's `language` is `application/x-fhir-query` and `expression` is the target profile canonical URL. Groups whose items map to *multiple* resources (per-leaf extraction — `clinicalAssessment`, `outcomeScores`, `patientHistory`, `postOpExam`, `intraOpObservations`) do **not** carry `itemExtractionContext`; the leaf `item.definition` URLs drive extraction one Observation at a time.

4. **Surgical procedure portion removed from the Registration Questionnaire.** Replaced by a `priorTreatment` group (Hurley Q1.f), `repeats=true`, mapping to `ShoulderProcedure` with `Procedure.category` from `PriorTreatmentCategory`. The Registration bundle's required-binding rejects any surgical-category procedure submitted via this path, closing the ADR-0034 gap at the form layer too.

5. **Definition-based extraction on the client.** Every leaf item retains `item.definition = <profile canonical URL>#<element path>` (already 100% coverage in the prior Questionnaire). The refactored `extractor.ts` parses these and applies the answer at the element path; cross-resource references (`subject`, `encounter`, `reasonReference`) are wired by the bundle assembler post-extraction, reusing the Encounter-as-anchor pattern from ADR-0037.

6. **`calculatedExpression` for the Constant-Murley composite.** Both Registration and Follow-Up Questionnaires capture the Constant score as four sub-items (pain 0–15, ADL 0–20, ROM 0–40, strength 0–25). The total `obs.constant-score` is `readOnly` and computed via:

   ```text
   %resource.repeat(item).where(linkId.startsWith('obs.constant-score.')).answer.valueDecimal.sum()
   ```

   The extractor reads the computed answer when assembling `ConstantScoreObservation`, so the bundle carries the correct 0–100 composite without the user being able to enter an inconsistent total.

7. **`itemPopulationContext` for follow-up and surgery pre-fill.** Both bundles' Questionnaires declare a `launchContext` slot for the `patient` resource (resolved by the frontend's `PatientLookup` step) and an `itemPopulationContext` on the encounter group that runs `Condition?subject={{%patient.id}}&_profile=…rotator-cuff-condition` so `Encounter.reasonReference` and Observations' `subject` references can be filled without asking the user.

8. **Encounter type defaults via core `Questionnaire.item.initial[0].valueCoding`** (not an SDC extension): Surgery defaults to SNOMED `308335008` (Patient encounter procedure); Follow-Up defaults to `390906007` (Follow-up encounter).

9. **Server-side `$extract` deliberately not adopted.** HAPI ships no `$extract` provider; enabling one is non-trivial and contradicts ADR-0031's storage-server posture. Extraction stays client-side, where the SDC IG explicitly permits it (SDC §extract.html), and the production upgrade path (production registry + dedicated form server) is documented but out of scope.

10. **ADR-0041 supersedes ADR-0023** (LHC-Forms frontend) in a parallel deprecation. With three SDC Questionnaires + one definition-driven extractor demonstrating SDC end-to-end, the LHC-Forms frontend (which posted a bare `QuestionnaireResponse` against the old single-bundle shape) no longer carries demonstrative weight justifying its container. It is moved to the archive directory per the project's archive convention.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **Server-side `$extract` via HAPI custom provider** | Stock HAPI has no working `$extract`; adding one is a Spring/Maven workstream of multiple days, against the ADR-0031 storage-server posture. SDC explicitly allows client-side extraction. |
| **Single mega-Questionnaire annotated with `bundle-target` per item** | Re-creates the ADR-0034 conflation at the form layer; one Questionnaire would have to carry surgery-only and registration-only fields side-by-side and rely on extraction logic to slice them. Brittle and undoes ADR-0034's clarity gain. |
| **StructureMap-based extraction** | SDC's heaviest extraction option. Requires FHIR Mapping Language artifacts and a Mapping execution engine; overkill for a single-anatomy thesis IG when definition-based extraction reads the same `item.definition` URLs the IG already maintains. |
| **Layer-1-only adoption (declaration without dynamic features)** | Cheaper but weakens the defence claim — "we depend on SDC" reads worse than "we use SDC features that earn their keep." `calculatedExpression` + `itemPopulationContext` are small, real, and demonstrate SDC doing work the typed-builder frontend cannot easily replicate. |
| **Drop SDC entirely, keep the typed-builder paradigm only** | The IG would lose its SDC-pattern demonstration entirely. The unified frontend (port 3000) already demonstrates the typed-builder paradigm; the SDC frontend's reason to exist is to demonstrate SDC. |
| **Keep `obs.constant-score` as a single user-entered decimal** | The current Questionnaire shape; works but does not demonstrate `calculatedExpression`. With the sub-score decomposition the form encodes a real clinical aggregation rule (Constant-Murley definition: pain + ADL + ROM + strength) and the IG gains an SDC feature with real semantics. |

## Consequences

✅ **Formal HL7 SDC IG v3.0.0 conformance** — the IG declares the dependency, three Questionnaires parent from `sdc-questionnaire-extr-defn`, and SDC extensions are used wherever they apply. Thesis defence can cite SDC adoption with artifact backing instead of pattern reference only.

✅ **ADR-0034 closure at the form layer** — the SDC frontend now covers Registration, Surgery, and Follow-Up via three distinct Questionnaires, matching the three-bundle architecture. The "two demonstration paradigms still target the old shape" caveat (ADR-0034 §Consequences, ADR-0035 §Consequences) is closed.

✅ **Definition-driven extraction** — the 35+ hardcoded linkId-keyed resource builders in `extractor.ts` are replaced by a generic dispatcher that drives off `item.definition` URLs and `itemExtractionContext`. The Questionnaire becomes the actual contract; the extractor is generic.

✅ **`calculatedExpression` demonstrates in-form computation** — Constant-Murley sub-scores sum to the total via FHIRPath, evaluated in the renderer. The typed-builder frontend would need explicit JavaScript glue to do the same; SDC makes it declarative.

✅ **`itemPopulationContext` demonstrates SDC's real workflow advantage** — follow-up forms pre-fill Patient and Condition references from launch context, removing redundant data entry.

✅ **All existing `item.definition` URLs preserved** — extraction migration is incremental: the linkId-based extractor and the definition-based extractor both read the same FSH; the migration is in `extractor.ts` only.

✅ **No re-parenting cascade** — base profiles (`ShoulderPatient`, `RotatorCuffCondition`, etc.) are unchanged. SDC dependency adds only the Questionnaire conformance contract; the data-side profiles continue to parent from FHIR R4 base resource types.

✅ **No HAPI configuration change** — `requests_enabled=false` stays (ADR-0031). The TERM stage stays. No `$extract` provider is enabled. The three-tier architecture (storage / terminology / validation) is preserved.

⚠️ **`extractor.ts` requires a meaningful refactor** — ~692 lines reorganise into a ~150-line dispatcher + ~250 lines of typed setters and a small profile-keyed category fallback. This is the bulk of the Phase 2 effort.

⚠️ **`fhirClient.ts` must learn three bundle profiles** — the hardcoded `shoulder-registration-bundle` profile on lines 102 and 126 becomes a parameter routed from the active Questionnaire's URL.

⚠️ **`sdc-frontend/` adds `react-router-dom`** — required to expose the three routes (`/register`, `/surgery`, `/follow-up`) and a shared landing page. The unified frontend already uses this package; the SDC frontend adopts it for the first time here.

⚠️ **SDC v3.0.0 pinned exactly** — future minor releases (v3.x, v4.x) require manual review. The dependency line carries a comment to that effect.

⚠️ **The LHC-Forms frontend is deprecated in parallel** (ADR-0041). Two running paradigms (unified at 3000, SDC at 3001) replace the previous three. Thesis claim narrows from "three paradigms" to "two paradigms" with the LHC-Forms demonstration preserved under the archive directory as historical reference.

⚠️ **`launchContext` is declared on Surgery and Follow-Up only** — Registration starts from scratch and does not need a pre-resolved Patient. This is correct per the SDC pattern but means the three Questionnaires are not structurally identical.

❌ **A frontend that hardcoded the old `shoulder-registration` Questionnaire URL** (line 21 of `QuestionnaireForm.tsx`) must now route by flow. This is a strict-improvement breaking change for anyone running the SDC frontend at the previous URL pattern.

## Sources

- `ig/sushi-config.yaml` — `hl7.fhir.uv.sdc: 3.0.0` added; description amended
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — refactored, version 0.2.0
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh` — new
- `ig/input/fsh/instances/ShoulderFollowUpQuestionnaire.fsh` — new
- `sdc-frontend/src/lib/extractor.ts` — definition-driven refactor (Phase 2)
- `sdc-frontend/src/lib/fhirClient.ts` — bundle profile router (Phase 2)
- `sdc-frontend/src/App.tsx` + new `Home.tsx` — three-route shell (Phase 2)
- `tools/validate.sh` — exercised against the three Questionnaires + their target bundles
- HL7 SDC IG v3.0.0 — https://hl7.org/fhir/uv/sdc/STU3/
- Hurley et al. (2024), JSES International 8(3):478–482 — SECEC consensus, anchor for Q11 timepoint enumeration and Q1.f prior-treatment scope
- ADR-0017 (original Registration bundle), ADR-0030 (Follow-Up bundle), ADR-0034 (three-bundle architecture), ADR-0035 (unified frontend), ADR-0037 (Encounter-as-anchor wiring), ADR-0031 (HAPI storage-server posture), ADR-0041 (LHC-Forms deprecation)
