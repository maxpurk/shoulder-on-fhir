# ADR-0083: Sports participation redesigned as a 4-tier level ordinal, replacing free text

**Date:** 2026-07-18
**Status:** Accepted

## Context

Next point in the same surgeon review that produced ADR-0081 (sleep disturbance) and ADR-0082 (occupation):

> Sports participation: [peer registries] only ask yes or no. Do you have an idea how we could model that in the best case? interoperable? fitting the purpose.

The surgeon observes that peer registries reduce sports to a plain yes/no flag and asks for the best interoperable, purpose-fit model. The IG's prior state, `SportsParticipationObservation`, was a free-text `valueString` ("sport(s) practised, frequency, and competitive level" as a description) — richer than yes/no in principle, but not comparable or aggregable across patients, the same low-analytical-value problem the free-text Occupation field had before ADR-0082.

Checked the consensus paper directly: Q1's unanimous-consensus list names only "j) Sports," with no mechanism specified. Per this project's clinical-feedback classification workflow this is a **Refinement**: Hurley is silent on the mechanism, so the IG has design freedom without touching the `Full` status on `Q1.j`.

**Registry comparison** (materials already curated in this repo, per the surgeon's explicit ask for an "analysis of the other registries"): DART's `DEM-08` "Activity level (pre-injury)" (the DART data-element inventory) is a coded ordinal `{sedentary; light; moderate; competitive sport; professional sport}`, Tegner-mappable — already noted at `cross_registry_comparison.csv` row `C-15`. DART proves the coded-ordinal approach is the registry norm, not free text, and gives a comparability anchor to align against. No other registry in the matrix (EPRD/IRD/SEPR) captures a structured pre-injury sport axis at all.

**Terminology verification** (LOINC FHIR terminology server + SNOMED MCP tools, checked directly — not guessed):

- SNOMED `social_context` returns zero matches for "sports participation" or "competitive sport."
- SNOMED `observable_entity` has candidate axis codes (`68130003` Physical activity, `4751000` Leisure physical activity, `256235009` Exercise) but no precoordinated ordinal *value* codes for a participation-level grade.
- LOINC has an answer-list `LL6103-7` ("Physical activity levels") but no corresponding bindable FHIR ValueSet in this stack, and no sports-specific question code.
- Conclusion: no standard value enumeration exists for this axis — the same "verified absent" situation as `SleepDisturbanceSeverity` (ADR-0081) and `OccupationalPhysicalDemand` (ADR-0082).

## Decision

**Redesign `SportsParticipationObservation` in place.** Profile Id and `Observation.code` (local `ShoulderObservationCodes#sports-participation`) are unchanged, preserving fidelity to Hurley's "Sports." `value[x]` changes from free-text `string` to `valueCodeableConcept`, `required`-bound to a new local **`SportsParticipationLevel`** ValueSet — a 4-tier ordinal:

- `none` — does not participate in sport
- `recreational` — recreational / leisure sport
- `competitive` — competitive / organized (club or amateur-league) sport
- `professional` — professional / elite sport

This is the standard sports-medicine return-to-sport stratification. It is strictly more informative than the plain yes/no flag used by peer registries — the `none` grade already subsumes that binary distinction — comparable across sites, and coarsely alignable with DART's `DEM-08` and the Tegner Activity Scale without importing Tegner's lower-limb-oriented item descriptors (irrelevant to a shoulder registry). Structurally this mirrors ADR-0081 exactly: same profile retained, local `Observation.code` kept, `value[x]` moved from an unstructured/loose shape to a local bound ordinal.

**No `Condition.evidence.detail` wiring** — pre-treatment sport level is patient-history/social context, not diagnostic evidence for the tear, correctly scoped the same way as `EmploymentStatusObservation`/`OccupationalPhysicalDemandObservation` (ADR-0082) and consistent with ADR-0074 excluding social-history items from `bodySite`.

**Single axis, not two.** Unlike Occupation (ADR-0082, which needed both an employment-status axis and a physical-demand axis to capture two clinically distinct surgeon concerns), Sports needs only participation level. A second "shoulder-loading sport type" axis was considered and rejected — see Alternatives.

**Frontend** (`StepPatient.tsx`, unified frontend only): the free-text `<input>` (placeholder "e.g., recreational tennis 2x/week") is replaced with a `<select>` fetched via `useValueSet(VALUESET_URLS.SPORTS_PARTICIPATION_LEVEL)`, same pattern as the adjacent sleep-disturbance/occupational-physical-demand fields added this session. `handleSubmit` emits `valueCodeableConcept` instead of `valueString`.

**SDC Questionnaire**: no change. The hand-authored SDC registration Questionnaire (`sdc-frontend/src/questionnaire/ShoulderRegistration.ts`) renders no sports item at all today — confirmed by inspection, not just assumed — so there is nothing to update there; the `extractor.ts` `sports-participation-observation` metadata entry (code + category only) stays valid unchanged. SDC parity is a separate call per this project's clinical-feedback workflow (precedent: ADR-0064 deliberately skipped SDC parity too).
*Amended by ADR-0144 (2026-08-03): the "SDC parity is a separate call" precedent invoked here is retired going forward. The missing SDC sports item remains open, tracked as an ordinary parity item in the cross-frontend parity audit.*

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep free-text `valueString` | Directly the problem the surgeon flagged — not comparable or aggregable across patients |
| Plain yes/no boolean, matching peer registries | Strictly less informative than the chosen ordinal; the `none` grade of the 4-tier scale already reproduces this distinction at no added cost |
| Bind `Observation.code` to SNOMED `68130003` "Physical activity" instead of the local code | Broadens "Sports" to all physical activity generally, less faithful to Hurley's specific "Sports" wording; the local code is retained instead, matching how `#sleep-disturbance`/`#occupational-physical-demand` keep local codes even when a related-but-broader SNOMED/LOINC axis code exists |
| Import the Tegner Activity Scale (0–10) verbatim | Tegner's item descriptors are lower-limb/knee-oriented (e.g. "soccer," "downhill skiing," "jogging on uneven ground") and do not transfer cleanly to a shoulder registry; the chosen ordinal is coarsely Tegner-mappable without inheriting its irrelevant specificity |
| Adopt DART's 5-tier `DEM-08` enum verbatim (`sedentary/light/moderate/competitive/professional`) | Conflates general activity intensity (sedentary/light/moderate — not sport-specific) with sport participation level; the chosen scale keeps the axis specifically about *sport* participation, which is what Hurley's "Sports" names |
| Add a second "shoulder-loading sport type" axis alongside participation level | Would duplicate the overhead/repetitive-loading concept `OccupationalPhysicalDemand` (ADR-0082) already captures, and adds data-collection burden against the surgeon's explicit "make it rather slim" framing carried over from the sleep-disturbance note |

## Consequences

✅ `Q1.j` remains `Full` in `mapping/SECEC_FHIR_Mapping.csv` — no denominator or percentage change; realisation notes updated to describe the new shape.

✅ Sports participation is now a coded, comparable variable instead of free text, closing the same class of analytical-value gap ADR-0082 closed for Occupation.

⚠️ Breaking `value[x]` type change (`string` → `CodeableConcept`) on `SportsParticipationObservation` — acceptable given the profile's `draft`/pre-1.0 status (bumped 0.1.0 → 0.1.1); this is a pre-production research registry with no external consumers yet, same precedent as ADR-0081/ADR-0082.

⚠️ SDC frontend intentionally not updated (no sports item exists there today) — documented, not silently skipped.

## Sources

- Clinical review by the reviewing shoulder surgeon
- the consensus paper (Hurley et al. 2024, Q1 patient-history list)
- the DART data-element inventory (`DEM-08`), `cross_registry_comparison.csv` (row `C-15`)
- LOINC FHIR terminology server (`fhir.loinc.org`) — `$expand` queries for "physical activity level," "sports participation," "exercise level," "Tegner" (2026-07-18)
- SNOMED CT MCP lookup/related-concept queries (2026-07-18) — no pre-coordinated sports-participation-level ordinal found
- `ig/input/fsh/profiles/observations/SportsParticipationObservation.fsh`, `codesystems/ShoulderObservation.fsh`, `codesystems/SportsParticipationLevel.fsh` (new), `valuesets/SportsParticipationLevel.fsh` (new)
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`
- `frontend/src/components/wizard/StepPatient.tsx`, `frontend/src/config/observationMetadata.ts`, `frontend/src/types/fhir.ts`
- ADR-0081 (near-identical sibling redesign — sleep disturbance, same shape of change)
- ADR-0082 (occupation redesign — DART comparison methodology, "verified absent" terminology documentation style)
- ADR-0074 (social-history/`bodySite` scoping precedent — why this Observation gets no laterality and no evidence-linkage)
- ADR-0064 (SDC-parity-as-separate-call precedent)
- ADR-0080 (server-only TX-dependent testing policy — followed for this ADR's own verification)
