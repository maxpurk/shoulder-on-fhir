# ADR-0082: Occupation redesigned as two coded axes — employment status + occupational physical demand

**Date:** 2026-07-17
**Status:** Accepted

## Context

The prior "Occupation" field (`OccupationObservation`, LOINC `85658-3`, free-text `valueString`, e.g. "construction worker") has low analytical value for a shoulder registry — a free-text job title isn't systematically comparable across patients. The surgeon's notes suggested two concrete axes instead: physical demand type ("Körperliche Arbeit, Überkopfarbeit, Schreibtischtätigkeit") and employment status ("Selbständigkeit vs angestellt"), and asked whether free-text occupation is worth keeping at all, plus wanted a documented comparison against other registries.

Checked the consensus paper directly: Q1 names only "k) Occupation," with zero mechanism specified — the same mechanism-silent pattern as "Sports" (Q1.j, already decomposed into level/type by this thesis) and "Sleep disturbance" (Q1.i, redesigned earlier this session, ADR-0081). Per this project's clinical-feedback classification workflow, this is a **Refinement**: full design freedom, `Full` status on `Q1.k` unaffected by re-decomposing it.

**Registry comparison** (using materials already curated in this repo, per the user's explicit request, rather than fresh research):
- the DART data-element inventory (`DEM-07`): DART — the closest comparable German shoulder-arthroscopy registry — captures **Work status** as a coded enum `{employed; self-employed; unemployed; retired; student; homemaker}`, baseline + follow-up, mandatory. Not a job-title free text.
- **No comparable registry** (DART, EPRD, IRD, SEPR — per the cross-registry comparison matrix, concept `C-14`) captures occupational **physical demand level** at all. DART's only adjacent field, `DEM-08` "Activity level (pre-injury)," measures sport/exercise intensity (Tegner-mappable), not occupational physical demand.

**Terminology verification** (LOINC FHIR terminology server + SNOMED MCP tools, both checked directly):
- **Employment status**: LOINC `67875-5` "Employment status - current" is a real, standard code. Its official answer list `LL1901-9` expands to 8 clean LOINC answer (`LA`) codes: `Unemployed / Employed full time / Employed part time / Homemaker / Retired due to age-preference / Retired due to disability / Medical leave of absence / Student`. No self-employed distinction exists in this or any other LOINC employment-status answer list found via `$expand` search. This mirrors the exact situation `RotatorCuffEtiology` already solved (ADR-0046): SNOMED/LOINC covers most of the axis but is missing one clinically-needed value.
- **Occupational physical demand**: `snomed_lookup` (domains `observable_entity` and `social_context`) checked for "occupational physical demand level," "physically demanding occupation," "sedentary occupation" — no matching concept found. No LOINC match for "physical demand" either. Confirmed no standard exists for this axis.

## Decision

**Retire `OccupationObservation`** entirely (delete the FSH profile) — matching the established full-removal precedent (ADR-0054 fully removed ASES/WORC/DASH/QuickDASH rather than leaving them deprecated-in-place) rather than soft-deprecating an unused free-text field.

**Add two new Observation profiles**, both `Parent: ShoulderObservation`, both `valueCodeableConcept`. Neither is wired into `Condition.evidence.detail` — deliberately different from ADR-0081's sleep-disturbance linkage, since employment status and occupational demand are patient-history/demographic context, not diagnostic evidence for the tear itself.

1. **`EmploymentStatusObservation`** — `code = LOINC#67875-5` (fixed, standard). New hybrid `EmploymentStatus` ValueSet: the 8 inlined `LL1901-9` LOINC answer codes plus one new local code `EmploymentStatusSupplement#self-employed` (new 1-concept CodeSystem, exact `ShoulderEtiology.fsh` template). `required` binding — the hybrid VS is the IG's complete, controlled enumeration, same rationale as `RotatorCuffEtiology`.

2. **`OccupationalPhysicalDemandObservation`** — `code = ShoulderObservationCodes#occupational-physical-demand` (new local catalog entry). New fully-local `OccupationalPhysicalDemand` CodeSystem/ValueSet (4 concepts, exact `SleepDisturbanceSeverity.fsh` template from ADR-0081), `required`-bound:
   - `sedentary` "Sedentary / desk-based work" (Schreibtischtätigkeit)
   - `light-manual` "Light manual work"
   - `heavy-manual` "Heavy manual work" (Körperliche Arbeit)
   - `overhead-repetitive` "Overhead / repetitive shoulder-loading work" (Überkopfarbeit) — modeled as its own category rather than "the heaviest tier," since overhead reaching is a qualitatively distinct rotator-cuff risk factor independent of raw lifting weight (e.g. a hairdresser or painter is low-lift but high overhead-exposure)

**Frontend** (`StepPatient.tsx`, unified frontend only): the free-text occupation `<input>` is replaced with two `useValueSet`-backed `<select>`s, same pattern used for sleep disturbance this session. `stepFormData.ts`'s `occupation: string` is replaced with `employmentStatus`/`occupationalPhysicalDemand`.

**Generic `ObservationForm.tsx` fix**: this change is the first hybrid-ValueSet field exposed through the patient-detail page's generic "add/edit any observation" form. That form derived `Coding.system` from a single static per-field `codeSystem` default rather than the selected option's own system — silently correct for every previously-existing field (all single-system), but would have mis-stamped the local `self-employed` code with `http://loinc.org` when selected there. Fixed to look up the selected option's own `system` first, falling back to the field default only if absent — small, general, and not specific to this axis.

**SDC Questionnaire** (`ShoulderRegistrationQuestionnaire.fsh`): `item[5].item[1]` (`obs.occupation`, string) replaced with two `#choice` items with `answerValueSet`; trailing item indices renumbered. No `sdc-frontend` rendering code changes needed (schema-driven), only `extractor.ts`'s `PROFILE_METADATA` fixed-code entries — its answer capture (`valueCoding` carried through verbatim) was already correct for hybrid VS.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep free-text occupation, only reword | User explicitly opted for the structured redesign after reviewing the DART comparison and terminology verification |
| One combined Observation for both axes | Employment status (contract type) and occupational physical demand (task-level exposure) are two clinically distinct questions with independent value sets — matches this IG's established one-axis-per-Observation convention (e.g. `TearLocation` vs `TendonsInvolved`) |
| Import the full 5-tier US DOL/O*NET lifting-capacity scale | Doesn't name overhead work as its own dimension — the specific, well-documented rotator-cuff risk factor the surgeon raised. A lifting-weight scale alone would misclassify a low-lift, high-overhead-exposure occupation (e.g. hairdresser, painter) |
| Bind employment status `required` to `LL1901-9` alone, without the local self-employed addition | Drops the exact concept the surgeon explicitly asked to capture ("Selbständigkeit vs angestellt") |

## Consequences

✅ `Q1.k` remains `Full` in `mapping/SECEC_FHIR_Mapping.csv` — no denominator or percentage change; realisation notes updated to describe the new decomposition.

✅ Occupational physical demand is a genuinely novel contribution relative to the comparable-registry landscape surveyed in the surveyed registry landscape material — none of DART, EPRD, IRD, or SEPR capture it.

✅ Employment status now exceeds DART's own granularity (adds the self-employed distinction DART's proprietary enum also lacks) while carrying a formal LOINC binding DART's field never had.

⚠️ Breaking change: `OccupationObservation` is removed entirely — acceptable given the profile's `draft`/pre-1.0 status, same precedent as ADR-0054's PROM removals. Any existing conformant data referencing it would need remediation, but this is a pre-production research registry with no external consumers yet.

⚠️ SDC frontend (`sdc-frontend/`, port 3001) is expected to render the two new `#choice` items correctly via its generic schema-driven rendering — spot-checked rather than assumed during verification.

## Sources

- Clinical review by the reviewing shoulder surgeon (2026-07-17)
- the consensus paper (Hurley et al. 2024, Q1 patient-history list)
- the DART data-element inventory (`DEM-07` Work status, `DEM-08` Activity level), the cross-registry comparison matrix (`C-14`)
- LOINC FHIR terminology server queries (2026-07-17): `$lookup`/`$expand` for `67875-5`, `LL1901-9`, "physical demand"
- SNOMED CT MCP `snomed_lookup` queries (2026-07-17): "occupational physical demand level," "physically demanding occupation," "sedentary occupation" — no matching concept
- `ig/input/fsh/profiles/observations/EmploymentStatusObservation.fsh`, `OccupationalPhysicalDemandObservation.fsh` (new); `codesystems/EmploymentStatusSupplement.fsh`, `OccupationalPhysicalDemand.fsh` (new); `valuesets/EmploymentStatus.fsh`, `OccupationalPhysicalDemand.fsh` (new); `codesystems/ShoulderObservation.fsh`, `valuesets/ShoulderObservationCode.fsh`
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`
- `frontend/src/components/wizard/StepPatient.tsx`, `stepFormData.ts`, `types/fhir.ts`, `config/observationMetadata.ts`, `components/ObservationForm.tsx`
- `sdc-frontend/src/lib/extractor.ts`
- ADR-0046 (`ShoulderEtiology`/`RotatorCuffEtiology` hybrid-ValueSet precedent), ADR-0065 (enumerated-hybrid `ShoulderObservationCode` convention), ADR-0054 (full-removal precedent for out-of-scope content), ADR-0081 (freshest sibling redesign, same session — local-CodeSystem-when-no-terminology-exists pattern, `observationMetadata.ts` fix precedent)
