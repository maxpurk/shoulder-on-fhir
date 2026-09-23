# ADR-0008: Abstract base plus one derived child profile per Observation type

> **Profile count.** This ADR established a pattern, not a fixed number. The family has grown
> with the IG: 27 profiles at authoring, 34 by May 2026 (ADR-0027), 37 later that month
> (ADR-0047), **57 today** — verify with `ls ig/input/fsh/profiles/observations/*.fsh | wc -l`.
> Counts appearing in the body below are the figures current when each section was written and
> are left as historical record; the filename likewise preserves the original count.

**Date:** 2026-04-16 (originally for 27 profiles); 2026-05-11 expanded to 34 (see ADR-0027); 2026-05-19 ROM profiles renamed to `Shoulder…Observation` convention (see ADR-0045); 2026-05-19 grew to 37 with `SubscapularisStrengthObservation` and `TearSizeClassificationObservation` (see ADR-0047)
**Status:** Accepted; §Alternatives Considered row on "FSH slicing on `code`" corrected by ADR-0160 (2026-08-05) — the claim "slicing does not allow per-slice `value[x]` type constraints" is false as stated (verified against the FHIR R4 spec and empirically via SUSHI); the real limitation is that no slicing discriminator can correlate a *sibling* element (`code`) with which type is required. §Consequences "US Core / IPS base + derived pattern" bullet corrected by ADR-0177 (2026-08-23) — IPS's own Observation profiles derive directly from core `Observation` with no shared abstract intermediate, so IPS is not a precedent for the *abstract-base* half of this design; the US Core half of the claim holds. The decision itself (57 derived profiles) is unaffected by either correction.

> **Update 2026-06-07 (ADR-0066):** The abstract base `ShoulderObservation` and all 37 derived Observation profiles keep their `Shoulder*` names — they are anatomy-region measurements (ROM, MMT, provocation tests) or already-pathology-named (TearSize, Patte, Goutallier, TendonsInvolved). The layered architecture this ADR established is now also the precedent cited by ADR-0066 for the partial rename of pathology-specific profiles in other resource families.

## Context

The IG must represent a wide variety of clinical observations for rotator cuff assessment:

- **ROM angles** (forward flexion, abduction, external/internal rotation — active and passive): numeric values in degrees
- **Strength measurements**: numeric Quantity values
- **Provocation tests** (Jobe, Bear Hug, Belly Press, Hornblower, Lift-Off): coded result (positive/negative)
- **Imaging classifications** (Goutallier, Patte, tear size): coded values from custom CodeSystems
- **PROM scores** (Constant, ASES, DASH, QuickDASH, SSV, SANE, WORC): `value[x] only Quantity` with UCUM unit `{score}`
- **Patient-reported outcomes** (satisfaction, return-to-activity): coded values

The original design used a single generic `ShoulderObservation` profile with a polymorphic `value[x]` that could be Quantity, CodeableConcept, or integer. This meant HAPI could not enforce the correct value type for a given observation code.

## Decision

Use an **abstract base profile** (`ShoulderObservation`) that constrains shared elements only (status, category, code, subject, effective[x], value[x], bodySite, method, interpretation), plus **34 concrete derived child profiles** — one per observation type — each fixing `code` to a single concept and constraining `value[x]` to exactly one type.

Pattern per derived profile (local CodeSystem variant):
```fsh
Profile: BearHugTestObservation
Parent: ShoulderObservation
* code = ShoulderObservationCodes#bear-hug-test
* value[x] only CodeableConcept
* valueCodeableConcept from PositiveNegative (required)
```

Pattern per derived profile (standard LOINC/SNOMED variant — added in May 2026 per ADR-0027):
```fsh
Profile: PainSeverityObservation
Parent: ShoulderObservation
* code = http://loinc.org#72514-3
* value[x] only Quantity
* valueQuantity.code = #{score}
```

The base profile's `code` element is bound `extensible` to `ShoulderObservationCode`, so derived profiles may fix `code` to a standard LOINC or SNOMED CT concept without enumerating it in the local CodeSystem. This is exercised by the seven profiles added in May 2026 (SmokingStatus, PainSeverity, Occupation, SleepDisturbance, FunctionalLimitations, SportsParticipation, Inspection) — five fix LOINC/SNOMED codes directly; two use new local codes (`#inspection`, `#sports-participation`) because no standard equivalent exists.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Single generic profile with polymorphic `value[x]` | HAPI cannot enforce value type per observation code; frontend must guess the correct type at runtime; commit 2ab5e71 changed this |
| Profile per FHIR `Observation.category` (not per code) | Category grouping (exam, imaging, survey) is too coarse; does not enforce value type |
| FHIR Questionnaire + QuestionnaireResponse for all observations | Appropriate for structured PROMs (covered by `ShoulderQuestionnaireResponse`) but not for machine-readable ROM/strength/provocation data that must be queryable as individual Observations |
| FSH slicing on `code` within a single profile | ~~Slicing does not allow per-slice `value[x]` type constraints in R4~~ — **corrected by ADR-0160:** per-slice `value[x]` type constraints are legal FHIR (both component-slicing and `value[x]` type-slicing, per the FHIR R4 spec's own `Observation.value[x] \| type \| $this` example). The actual limitation: no slicing discriminator can correlate a *sibling* element (`code`) with which type is required — that correlation is what 57 codes each needing a specific type actually requires, and only separate profiles or a 57-branch FHIRPath invariant can express it. |

## Consequences

✅ HAPI validates the correct `value[x]` type for each observation code (e.g., Quantity for ROM, CodeableConcept for provocation tests)  
✅ Frontend selects the correct profile URL from `OBSERVATION_PROFILE_URLS` map by observation type  
✅ Each profile is independently documented in the IG HTML output with its own differential and snapshot  
✅ Follows the US Core base + derived pattern (`us-core-vital-signs` → `us-core-blood-pressure` etc.) — standard and recognizable — ~~and IPS~~ **corrected by ADR-0177:** IPS's own Observation profiles derive directly from core `Observation` with no shared abstract intermediate, so IPS is not a precedent for this half of the design  
✅ Extensible: adding a new observation type requires one new FSH file without touching the base profile (validated again in May 2026 when seven new profiles were added without modifying the base — ADR-0027)  
✅ Supports a mix of local-CS codes and standard LOINC/SNOMED codes per derived profile, since the base `code` binding is `extensible`  
⚠️ 34 FSH files in `ig/input/fsh/profiles/observations/` — significant file count, though each file is small  
⚠️ Frontend `observationMetadata.ts` and `OBSERVATION_CODINGS` configs must stay in sync with FSH profile URLs and `Observation.code` system+code pairs  

## Sources

- git commit `2ab5e71` — "changed design decision regarding number of profiles" — introduced the 27-profile pattern
- git commit `e61c2ac` — expanded `OBSERVATION_CODES` from 9 to 29 entries; added `OBSERVATION_PROFILE_URLS` map
- `ig/input/fsh/profiles/observations/` — all 34 derived profile FSH files
- `ig/input/fsh/profiles/ShoulderObservation.fsh` — abstract base profile
- `frontend/src/config/observationMetadata.ts` — per-code metadata including profile URLs
- `frontend/src/types/fhir.ts` — `OBSERVATION_CODINGS` map (added May 2026) carrying system+code+display per profile key
- ADR-0027 — Complete SECEC element coverage via standard terminologies (May 2026 expansion from 27 to 34 derived profiles)
