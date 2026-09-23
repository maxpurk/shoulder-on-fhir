# ADR-0105: Registration patient-history refinements (round-2 surgeon feedback, points 1-6)

**Date:** 2026-07-27
**Status:** Accepted

## Context

A second clinical validation pass by the reviewing shoulder surgeon produced ~15 feedback points spanning every layer of the IG. Per the project's Clinical Feedback Integration Workflow (the project guide), each point was classified against the Hurley/SECEC consensus mapping before implementation. This ADR covers the first six points, all touching the Registration wizard's "Patient History" card (`StepPatient.tsx`) and all Q1 patient-history elements:

1. **Smoking** — add pack-years alongside current smoking status.
2. **Occupation** — the existing `OccupationalPhysicalDemand` axis (ADR-0082) folds "overhead-repetitive" in as a fourth intensity tier; an occupation can be simultaneously heavy AND overhead (e.g. a roofer), so the single enum forced an artificial either/or choice. Requested: split into two independent axes.
3. **Workers' compensation** — remove the German "Durchgangsarzt-Verfahren" clinical-jargon parenthetical from the user-facing option label.
4. **Functional limitations** — surgeon requested outright removal, because the existing `valueString` free-text realisation cannot be analyzed across the registry.
5. **Prior physical therapy** — bucket session counts (≤10 / 11-20 / >20) instead of an approximate date (judged clinically unhelpful); make explicit that the PT was for the condition being registered, not an unrelated complaint.
6. **Prior shoulder injection** — bucket injection counts (1-3 / >3) instead of an approximate date.

All six points map to existing Hurley unanimous-consensus Q1 elements (Q1.d Smoking, Q1.k Occupation, Q1.l Workers' compensation, Q1.n Functional limitations, Q1.f Prior treatment) that name no mechanism — classification (a) Refinement in every case, free to change without affecting the Full/Partial claim.

Point 4 was the one exception requiring an explicit go/no-go: Hurley names "Functional limitations" as a unanimous-consensus element, so deleting the field outright would move it from Full to Missing (45/58 → 44/58, 77.6% → 75.9% headline). The user chose to redesign rather than delete, mirroring the precedent already set by Q1.i sleep disturbance (ADR-0081) and Q1.j sports participation (ADR-0083), both of which faced the identical "free text can't be analyzed" complaint and were redesigned into coded ordinals rather than dropped.

For points 4 (functional-limitation severity tiers) and the fixation-technique axis of a later point (ADR to follow), the `shoulder-surgeon` subagent was consulted for clinical accuracy of the new scale design, per the workflow's step 2 (route terminology/scale decisions through clinical review). It confirmed a 5-tier functional-ceiling ordinal (no limitation / overhead-limited / at-shoulder-level-limited / below-shoulder-limited / unable to use the arm) matches how rotator cuff patients are already triaged clinically, is strictly monotonic (each tier a functional subset of the one above), and is deliberately distinct from the Constant-Murley score's own ADL sub-component (already implemented, ADR-0090) rather than a duplicate instrument.

Live terminology verification (LOINC FHIR terminology server + SNOMED CT lookup) found:
- No LOINC pack-years code exists (`8663-7` is packs/day, not pack-years; `74011-8`/`88029-4` are generic lifetime-use-per-period, not the packs-per-day × years product). SNOMED CT `782516008` "Number of calculated smoking pack years" (observable entity) is the correct precoordinated concept.
- No SNOMED CT or LOINC concept exists for occupational overhead-exposure, functional-limitation severity, or bucketed prior-treatment counts — all four new axes use local CodeSystems, consistent with this IG's established pattern (`OccupationalPhysicalDemandCodes`, `SleepDisturbanceSeverity`, `SportsParticipationLevel`).

## Decision

1. **Smoking pack-years**: new sibling profile `SmokingPackYearsObservation` (code SNOMED `782516008`, `valueQuantity` UCUM `{pack-years}`), not a modification of `SmokingStatusObservation` — keeps the IPS-conformant status code intact.
2. **Occupation split**: `OccupationalPhysicalDemandCodes`/`OccupationalPhysicalDemand` trimmed from 4 to 3 concepts (sedentary/light-manual/heavy-manual — `overhead-repetitive` removed); new sibling CodeSystem/ValueSet/profile `OccupationalOverheadExposureCodes`/`OccupationalOverheadExposure`/`OccupationalOverheadExposureObservation` (yes/no/unknown), so intensity and overhead exposure are captured independently.
3. **Workers' compensation wording**: `StepPatient.tsx` option label changed from `"Yes — care under workers'-comp regime (BG, Durchgangsarzt-Verfahren)"` to `"Yes — care under workers'-comp regime (BG)"`. No FHIR/FSH change — `ShoulderCoverage.fsh`'s Description block is IG maintainer documentation, not the reviewed frontend surface, and stays accurate as-is.
4. **Functional limitations redesign**: `FunctionalLimitationsObservation.value[x]` changed from `string` to `CodeableConcept`, `required`-bound to new `FunctionalLimitationSeverity` (5-tier ordinal per the shoulder-surgeon subagent's design, above). `Observation.code` moved off LOINC `10158-4` (whose `Nar` scale type no longer matches a coded value) to a new local `ShoulderObservationCodes#functional-limitation-severity` entry.
5. **Prior PT buckets**: new sibling profile `PriorPhysicalTherapySessionCountObservation` (local `PriorPhysicalTherapySessionCount` VS: `le-10`/`11-20`/`gt-20`), emitted only alongside the existing prior-PT `RotatorCuffProcedure` (which already carries `reasonReference` → the index `RotatorCuffCondition` — the "because of this disease" linkage the surgeon asked for was already structurally present; the frontend now also surfaces this explicitly as UI copy). The approximate-date field is removed from the UI; `RotatorCuffProcedure.performed[x]` (FHIR-required 1..1) defaults to the registration date as a placeholder, since the surgeon judged the exact date clinically unhelpful and it is no longer collected.
6. **Prior injection buckets**: new sibling profile `PriorInjectionCountObservation` (local `PriorInjectionCount` VS: `1-3`/`gt-3` — deliberately no zero-count member, since "no injections" is already represented by the existing yes/no gate). Same date-removal treatment as point 5.

No `RotatorCuffRegistrationBundle` profile changes were needed — all six new Observation profiles fit the bundle's existing generic `entry[observation] 0..* only ShoulderObservation` slice.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Delete `FunctionalLimitationsObservation` entirely (point 4) | Regresses the Hurley headline from 45/58 Full to 44/58 (77.6% → 75.9%) for an element the consensus explicitly names; the free-text complaint is fully addressed by redesign, matching the ADR-0081/ADR-0083 precedent, without sacrificing coverage. |
| Keep occupational overhead exposure folded into the physical-demand enum (point 2) | Cannot represent an occupation that is simultaneously heavy-manual AND overhead-exposed (e.g. roofer) — the stated surgeon complaint. |
| Reuse LOINC `10158-4` as `Observation.code` for the new coded functional-limitation value (point 4) | That code's own `SCALE_TYP` is `Nar` (narrative) — using it for a `CodeableConcept` value misrepresents the code's defined scale, the same reasoning already applied when Q1.i/Q1.j moved off narrative/binary codes. |
| Keep an approximate-date field alongside the new session/injection-count buckets (points 5, 6) | Surgeon explicitly judged the date clinically unhelpful ("date doesn't matter, remove it"); keeping both would add UI burden without analytical benefit. |
| Add a "0 injections" member to `PriorInjectionCount` (point 6) | Redundant with the existing prior-injection yes/no gate — the count buckets are only shown/asked when the gate is "yes". |

## Consequences

✅ All six Hurley Q1 elements (Q1.d, Q1.f, Q1.k, Q1.l, Q1.n) remain Full — no headline coverage regression.
✅ Functional limitations, occupational overhead exposure, and prior-treatment counts are now research-analyzable coded/quantitative fields instead of free text or unstructured dates.
✅ `sushi .` compiles with 0 errors / 0 warnings; frontend `npm run build` (tsc + vite) compiles cleanly.
⚠️ `RotatorCuffProcedure.performed[x]` for prior-treatment Procedures now carries a placeholder (registration date) rather than a clinically asserted treatment date — acceptable since the field is FHIR-structurally required (1..1) but the surgeon judged the actual date clinically unhelpful for this data element specifically (distinct from the index surgical Procedure, where `performedDateTime`/`performedPeriod` remains load-bearing for Q11 timepoint computation).
⚠️ SDC frontend (port 3001) parity not implemented for any of the six points, consistent with this IG's standing precedent (ADR-0064, ADR-0081, ADR-0082, ADR-0083 all deferred SDC parity) — a separate call per point, not automatic.
*Amended by ADR-0144 (2026-08-03): this standing precedent is retired going forward. These six SDC gaps remain open, tracked as ordinary parity items in the cross-frontend parity audit.*
❌ Seed bundles (`seed/bundles/{anna-mueller,kemal-demir}/`) and their narrative stories not yet updated to reflect the new fields — tracked as follow-up work alongside the remaining points from this same feedback round.

## Sources

- Clinical review by the reviewing shoulder surgeon (round 2), points 1-6
- LOINC FHIR terminology server (`fhir.loinc.org`) — live `$lookup`/`$expand` verification, 2026-07-27
- SNOMED CT MCP lookup — `782516008` verification, 2026-07-27
- `shoulder-surgeon` subagent review — functional-limitation severity tier design, 2026-07-27
- ADR-0081 (sleep disturbance redesign), ADR-0082 (occupation original split), ADR-0083 (sports participation redesign) — precedent for free-text-to-coded-ordinal redesigns
- `ig/input/fsh/profiles/observations/{SmokingPackYears,OccupationalOverheadExposure,FunctionalLimitations,PriorPhysicalTherapySessionCount,PriorInjectionCount}Observation.fsh`
- `mapping/SECEC_FHIR_Mapping.csv` rows Q1.d, Q1.f, Q1.k, Q1.n
