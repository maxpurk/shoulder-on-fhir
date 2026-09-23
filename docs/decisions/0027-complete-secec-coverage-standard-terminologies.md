# ADR-0027: Complete SECEC element coverage via standard terminologies

**Date:** 2026-05-11
**Status:** Accepted — refined by ADR-0034 (2026-05-13); coverage statistics **superseded by ADR-0036 (2026-05-18) and re-baselined again by ADR-0039 (2026-05-19)**; `FunctionalLimitationsObservation` terminology binding corrected 2026-05-19 (see status update below); **ROM terminology regression closed by ADR-0045 (2026-05-19)** — 8 shoulder ROM `Observation.code` bindings migrated from `ShoulderObservationCodes` to verified LOINC codes; broader LOINC sweep documented in the same ADR confirms no further migrations are possible; the per-element **Full/Partial "coverage status" classification this ADR originated was replaced by the two-facet code/value terminology-provenance axis in ADR-0178 (2026-08-25)**.

> **Status update (2026-08-25, ADR-0178):** The per-element Full/Partial "coverage status" classification this ADR originated (and that ADR-0036 / ADR-0039 / ADR-0054 re-baselined) was replaced by a two-facet code/value **terminology-provenance** axis (`Reused` / `Local` / `Numeric`) in `mapping/SECEC_FHIR_Mapping.csv`. Representability (0 Missing) and the two-layer (Consensus / IG-Operational) accounting remain in force; only the per-element status column changed. Body below unedited for audit trail.

> **Terminology correction (2026-05-19):** The §2 table below binds `FunctionalLimitationsObservation.code` to SNOMED CT `21134002` (Disability — finding). On review, `21134002` denotes the categorical/administrative "disability" finding (parent: `105719004` Body disability AND/OR failure state; sibling concepts: Handicap, Invalidism, Registered disabled, Disability percentage) — i.e., the ICIDH "handicap" / participation-restriction sense, not Hurley's ICF-aligned "functional limitations". Replaced with **LOINC `10158-4` "History of Functional status Narrative"** as the primary `Observation.code.coding[0]` (scale Nar — designed for free-text functional-status narratives, matching the existing `valueString` data type) and **SNOMED CT `248536006` "Finding of functional performance and activity"** (synonyms: "Observation of functional performance and activity", "Skill and ability") recommended as a translation coding. The profile's pattern requires only the LOINC primary; the SNOMED translation is documented in the profile description and demonstrated in the canonical example. Mapping CSV rows Q1.n and Q12.c, the longitudinal example bundle, both frontend code constants (`frontend/src/types/fhir.ts`, `sdc-frontend/src/lib/extractor.ts`), and the IG `index.md` / `profiles.md` / `README.md` references updated accordingly. The SNOMED fragment CodeSystem (`seed/generate-snomed-fragment.sh`) re-derives automatically from the FSH output.

> **Status update (2026-05-19, ADR-0039):** A second-pass word-by-word audit caught two further inflation errors and one accounting gap that ADR-0036 did not close: `Q12-SSV` + `Q12-SANE` collapsed into one `Q12-SSV-SANE` per Hurley's slashed dual-name notation; Q7 ultrasound (60% — no consensus) removed from the Hurley denominator and relocated to a new **Layer 3** (IG-operational completeness) that enumerates 37 elements the IG carries beyond what Hurley names (patient identity, temporal anchors, laterality, status fields, transaction bundles, etc.). Current figures: **42 Full + 16 Partial + 0 Missing of 58 Hurley elements (100% Full+Partial; 72.4% Full)**. Audit trail intact; structural work this ADR documents remains valid.

> **Status update (2026-05-18, ADR-0036):** The coverage figures cited in this ADR — *"44 Full + 24 Partial + 0 Missing of 68 SECEC elements (100% Full+Partial, 64.7% Full)"* — were derived from a decomposition of Hurley A12 into ten sub-elements (Q12.1–Q12.10) that included ASES, WORC, DASH, and QuickDASH. A subsequent re-read of Hurley et al. (2024) established that those four instruments are **not named in the consensus paper**; only Constant, SSV, and SANE are A12 preferred instruments. ADR-0036 re-baselines the accounting to a faithful Hurley decomposition (**60** elements: 43 Full + 17 Partial + 0 Missing; 71.7% Full) and moves the four non-Hurley PROMs to a separate Supplementary section. The structural work this ADR documents (adding seven Observation profiles, expanding `ShoulderProcedureType`, adding `ShoulderServiceRequest` and `ShoulderEncounter`) remains valid and in place; only the headline statistics change. The body below is preserved unedited for audit trail.

> **Refinement (2026-05-13, ADR-0034):** §3 of this ADR places prior PT (Q1.6) and injections (Q1.7) in the existing `ShoulderProcedure` profile and accommodates them via the `ShoulderRegistrationBundle`'s open slicing. ADR-0034 makes that arrangement explicit: prior treatments now live in a dedicated `priorTreatment 0..*` slice with required binding to the new `PriorTreatmentCategory` — the validator now rejects surgical-category procedures in the Registration bundle, closing a gap this ADR left open.

## Context

The April 2026 SECEC coverage snapshot (see `mapping/SECEC_FHIR_Mapping.md`, prior revision) reported **82.6% Full+Partial** with **12 elements Missing**. The gaps clustered around:

- **Q1 (Patient History — unanimous consensus):** smoking status, prior physical therapy, prior injections, pain severity, sleep disturbance, sports participation, occupation, functional limitations
- **Q2.1 / Q9.1 (Physical Examination):** visual inspection
- **Q5.1 / Q6.1 (Imaging):** MRI / CT indication (ServiceRequest)
- **Q10.1 / Q10.2 (Follow-up):** scheduled and completed follow-up visit (Encounter)
- **Q12.6 (PROM):** VAS pain — flagged as "Full" but in fact no dedicated profile or LOINC code in `Observation.code` existed

Q1 reached **unanimous (100%) consensus** across 57 European shoulder surgeons. There was no academically defensible reason to omit any of its 14 sub-elements. The 17.4% gap was a profiling and terminology-binding omission, not a structural FHIR limitation.

A separate concern: the existing pattern (e.g. `HandDominanceObservation`) used local `ShoulderObservationCodes` codes even when an equivalent LOINC/SNOMED code existed. This worked but obscured interoperability claims and created mappings the IG had to maintain itself.

## Decision

1. **Close every Missing SECEC element.** Add the seven new Observation profiles, two new resource profiles (`ShoulderServiceRequest`, `ShoulderEncounter` — see ADR-0028, ADR-0029), and expand `ShoulderProcedureType` to cover prior PT and shoulder injection.

2. **Use standard terminologies directly in `Observation.code` where they exist.** Local `ShoulderObservationCodes` codes are reserved for domain-specific concepts with no international equivalent (Patte, Goutallier, satisfaction, return-to-activity, sports-participation, inspection). For the new profiles:

   | Profile | `Observation.code` | Rationale |
   |---------|--------------------|-----------|
   | `SmokingStatusObservation` | LOINC `72166-2` (Tobacco smoking status) | US Core pattern; value bound to the local smoking-status ValueSet (SNOMED) |
   | `PainSeverityObservation` | LOINC `72514-3` (Pain severity 0-10) | Single profile reused for Q1.8, Q8.1, Q12.6; differentiated by `effectiveDateTime` |
   | `OccupationObservation` | LOINC `85658-3` (Occupation) | `valueString` (ISCO-08 free text) |
   | `SleepDisturbanceObservation` | SNOMED `301345002` (Sleep disturbance) | `valueBoolean` |
   | `FunctionalLimitationsObservation` | SNOMED `21134002` (Disability — finding) | `valueString` |
   | `SportsParticipationObservation` | `ShoulderObservationCodes#sports-participation` | No suitable LOINC/SNOMED for pre-treatment sport (existing `#return-to-sport-work` covers post-treatment) |
   | `InspectionObservation` | `ShoulderObservationCodes#inspection` | No precoordinated SNOMED CT code for shoulder-specific visual inspection |

   The `ShoulderObservation` base profile already binds `code` with strength `extensible`, so LOINC/SNOMED codes are valid without enumerating them in `ShoulderObservationCode`.

3. **Use the existing `ShoulderProcedure` profile for prior PT and injections.** Expand `ShoulderProcedureType` with SNOMED `91251008` (Physical therapy procedure), `27813003` (Intra-articular injection), `290035003` (Injection into shoulder joint). The `ShoulderRegistrationBundle` keeps `procedure 1..1` for the index surgery; additional `ShoulderProcedure` resources representing prior treatments are accommodated by the bundle's open slicing rules.

4. **All LOINC codes verified against the official LOINC FHIR Terminology Server** before being added to FSH, using local credentials.

Resulting coverage: **44 Full + 24 Partial + 0 Missing of 68 SECEC elements (100% Full+Partial, 64.7% Full).**

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep the local-code pattern (add `#smoking-status`, `#pain-severity`, `#occupation`, etc. to `ShoulderObservationCodes`) | Contradicts the FHIR principle and the project rule of "standard codes first" — would require maintaining mappings the IG cannot uniquely contribute |
| Mark Q1 sub-elements as "out of scope" | Q1 reached unanimous consensus across 57 European shoulder surgeons; no defensible academic reason to omit any item |
| Define full Questionnaire instruments for each PROM (ASES, Constant, EQ-5D) instead of new profiles | A separate (larger) workstream tracked in the Partial bucket; orthogonal to closing the Missing gaps |
| Expand `ShoulderRegistrationBundle` slicing to formally name `prior-procedure` slices | The existing open slicing already permits additional `ShoulderProcedure` entries — explicit slicing buys no validation benefit at the bundle level |

## Consequences

✅ 100% SECEC addressability — every element from Hurley et al. (2024) has a profile, code, and value path  
✅ Standard terminologies dominate (LOINC, SNOMED CT, DICOM); local CodeSystems are limited to truly specialty-specific concepts  
✅ A single `PainSeverityObservation` profile covers three SECEC consensus elements (Q1.8 / Q8.1 / Q12.6) — no profile duplication  
✅ Q12.6 status corrected from misleading "Full" to genuinely Full with a dedicated profile and verified LOINC code  
✅ Coverage substantially exceeds the Bikkanuri et al. (2024) literature average of 80% for registry-to-FHIR conversions  
⚠️ `ShoulderObservationCodes` is no longer the single namespace for observation codes — readers must inspect each derived profile to learn its `code` system  
⚠️ 24 Partial elements remain (terminology verification for provocation tests, full Questionnaire definitions for PROM instruments, German payer ValueSet, RADLEX) — characterised as terminology/instrument gaps, not architectural blockers

## Sources

- `mapping/SECEC_FHIR_Mapping.csv`, `mapping/SECEC_FHIR_Mapping.md` — element-level coverage table and prose summary
- `ig/input/fsh/profiles/observations/SmokingStatusObservation.fsh`, `PainSeverityObservation.fsh`, `OccupationObservation.fsh`, `SleepDisturbanceObservation.fsh`, `FunctionalLimitationsObservation.fsh`, `SportsParticipationObservation.fsh`, `InspectionObservation.fsh`
- `ig/input/fsh/valuesets/SmokingStatus.fsh`, `ShoulderProcedureType.fsh` (expanded)
- `ig/input/fsh/codesystems/ShoulderObservation.fsh` — added `#inspection`, `#sports-participation` (28 → 30 codes)
- Hurley et al. (2024) "European Society for Surgery of the Shoulder and Elbow (SECEC) rotator cuff tear registry Delphi consensus", _JSES International_ 8(3):478-482
- Bikkanuri et al. (2024) — referenced in `mapping/SECEC_FHIR_Mapping.md` for the 80% literature benchmark
- LOINC FHIR Terminology Server (`https://fhir.loinc.org`) — used to verify all LOINC codes
- ADR-0010 — Custom CodeSystem principles; this ADR refines when to use the local CS vs. standard codes
