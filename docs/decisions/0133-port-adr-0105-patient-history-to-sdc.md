# ADR-0133: Port ADR-0105's registration patient-history redesign to the SDC frontend

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** the cross-frontend parity audit, items #5 and #12 — a cross-frontend content-parity audit (SDC vs unified) that built one identical complete patient through each frontend and diffed the resulting `$everything` output.

## Context

ADR-0105 (2026-07-27) redesigned six Registration "Patient History" elements in the unified frontend, and explicitly flagged in its own Consequences section: "⚠️ SDC frontend (port 3001) parity not implemented for any of the six points." This ADR closes that gap.

Auditing the current SDC Questionnaire against each of ADR-0105's six points found the actual gap was narrower than "all six":

| Point | ADR-0105 decision | SDC state found |
|---|---|---|
| 1. Smoking pack-years | New `SmokingPackYearsObservation` sibling to smoking status | **Missing** — no item anywhere in SDC |
| 2. Occupation split | Trim `OccupationalPhysicalDemand` to 3 concepts; add new `OccupationalOverheadExposureObservation` axis | Physical-demand item already correct (the VS is a shared IG canonical resource both frontends bind by URL, so the trim applied automatically); overhead-exposure axis **missing** |
| 3. Workers'-comp wording | Drop "Durchgangsarzt-Verfahren" jargon from the option label | **Already correct** — SDC's item text and `extractor.ts`'s `WORKERS_COMP_DE_LABEL`-equivalent never had the jargon to begin with |
| 4. Functional limitations redesign | `valueString` → `required`-bound `CodeableConcept` | **Already ported** — `obs.functional-limitations` already targets the redesigned profile/VS |
| 5. Prior PT count buckets | Bucketed session count replaces exact date | **Missing** — SDC still asked for an exact `priorTreatment.date`, no count item at all |
| 6. Prior injection count buckets | Bucketed injection count replaces exact date | Same as point 5 |

So the real remaining work was points 1, 2 (overhead axis only), 5, and 6 — plus, independently, the cross-frontend parity audit, item #12: SDC's `priorTreatment.type` item bound to the full `RotatorCuffProcedureType` ValueSet (18 codes, including surgical procedures like "Reverse total shoulder arthroplasty") for a question explicitly scoped to *non-surgical* treatment. The bundle-level `priorTreatment.category` binding (`PriorTreatmentCategory`, SNOMED `91251008`/`18629005` only) already prevents an invalid *bundle* — a surgical-category Procedure cannot land in `RotatorCuffRegistrationBundle` — but does not prevent a semantically nonsensical code/category combination (category = "Physical therapy", code = "Reverse total shoulder arthroplasty") on an otherwise validly-shaped bundle.

Point 5/6's porting subsumes item #12: replacing the exact-date question with bucketed counts required touching the same `priorTreatment` group anyway, and the type-VS narrowing is a one-line companion fix in the same group. Both are handled together here rather than as separate ADRs.

Per the Clinical Feedback Integration Workflow: classification **(b) structural gap fix** throughout — ADR-0105 already made every clinical/terminology decision (which SNOMED code, which local CodeSystem, which bucket boundaries); this ADR only ports that decision into SDC's declarative Questionnaire/extractor architecture. Nothing here revisits ADR-0105's clinical content.

## Decision

1. **New ValueSet** `PriorNonSurgicalTreatmentType` (`ig/input/fsh/valuesets/PriorNonSurgicalTreatmentType.fsh`) — the 3 non-surgical codes already listed at the bottom of `RotatorCuffProcedureType` (Physical therapy procedure, Intra-articular injection, Injection into shoulder joint). `ShoulderRegistrationQuestionnaire.fsh`'s `priorTreatment.type` item now binds here instead of the full 18-code `RotatorCuffProcedureType` — closes the clinical review #12.
2. **`priorTreatment.date` removed** from the Questionnaire (was `item[2].item[2]`, optional, never actually required by the form even though the underlying `RotatorCuffProcedure.performed[x]` is FHIR-required 1..1 — a latent gap this port also closes). `laterality` renumbered down to fill the slot.
3. **`extractor.ts`'s `submissionDefaults('Procedure')`** now seeds `performedDateTime: <today>` alongside the existing `status: 'completed'`. This is the same "required-but-not-collected" escape hatch already documented for `Condition.clinicalStatus`/`recordedDate` (module's own doc comment, point 1) — safe for Surgery's own Procedure group too, since `procedure.date` stays `required = true` there and `assignByPath` always overwrites the seeded default with the real answer before the resource is returned (verified by reading `buildResourceForExtractionGroup`'s seed-then-overwrite order).
4. **Four new per-leaf items added to `patientHistory` (item[5])**, all following the codebase's existing generic per-leaf-extraction pattern (zero `extractor.ts` changes needed beyond point 3 — ADR-0103/ADR-0122's runtime profile resolution already handles a new `item.definition` pointing at an existing profile):
   - `obs.smoking-pack-years` — `#decimal`, targets `SmokingPackYearsObservation#Observation.valueQuantity`, `minValue` 0 (no `maxValue`, matching the unified frontend's own unbounded number input).
   - `obs.occupational-overhead-exposure` — `#choice`, targets `OccupationalOverheadExposureObservation#Observation.valueCodeableConcept`, bound to `OccupationalOverheadExposure` VS.
   - `obs.prior-physical-therapy-session-count` — `#choice`, targets `PriorPhysicalTherapySessionCountObservation#Observation.valueCodeableConcept`, bound to `PriorPhysicalTherapySessionCount` VS.
   - `obs.prior-injection-count` — `#choice`, targets `PriorInjectionCountObservation#Observation.valueCodeableConcept`, bound to `PriorInjectionCount` VS.

   These could not be nested inside the `priorTreatment` group itself: `buildResourceForExtractionGroup` resolves every leaf's element path against *that group's own* resolved profile (`RotatorCuffProcedure`), silently dropping (`continue`) any leaf whose `item.definition` targets a different profile. Since the count Observations are genuinely separate top-level resources (per ADR-0105's own description: "emitted only alongside the existing prior-PT `RotatorCuffProcedure`... [not] nested" — no formal FHIR reference from the count Observation to the Procedure), they belong in a per-leaf-extraction group instead — `patientHistory`, alongside the other Q1 items, immediately before the existing `coverage.workersCompensation` loose leaf.
5. **`Questionnaire.version`** bumped `0.3.0` → `0.4.0`.
6. Points 2 (physical-demand trim), 3 (wording), 4 (functional-limitations redesign) required no changes — already correct in SDC, as the table above shows.

No `bundleAssembler.ts` changes were needed: prior-treatment Procedures already flow through the existing generic `extracted.procedures` loop (subject/encounter/reasonReference wiring is per-resource, not per-item, and already handles an arbitrary count of repeating Procedure entries).

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Mirror the unified frontend's exact UI mechanism — two fixed Yes/No gates (`priorPhysicalTherapy`/`priorInjection`) instead of SDC's existing repeatable free-category-and-type group | SDC's repeatable-group model is a legitimate, more general realization of the same Q1.f element (it can represent multiple distinct PT episodes or combined PT+injection in one submission, which the unified frontend's two-boolean model cannot) — not a bug to eliminate. The goal is comparable *FHIR data* between frontends (matching `Procedure.category`/`code`/`performedDateTime` shape and the sibling count Observations), not literal UI-mechanism parity; clinical-review item #13 already established that mechanism differences between the two paradigms are expected and separately documented, not automatically gaps to close. |
| Give the two new count items an `enableWhen` gate tied to the priorTreatment group's answers | SDC's Questionnaires don't use `enableWhen` anywhere in this codebase; introducing it for one case would be new architecture for a single field pair. The existing "Clinician judgment required — only fill fields that apply" convention (already the operative pattern across every Registration step) covers this without new mechanism. |
| Add a resource-type-and-context-aware default (only seed `performedDateTime` for the `priorTreatment` group specifically, not all Procedures) | `submissionDefaults()` is deliberately a flat resourceType-keyed dispatcher with no group-context parameter threaded through; adding one for a single field, when the existing seed-then-overwrite order already makes the blanket default safe (verified above), would be unnecessary complexity. |

## Consequences

✅ Closes clinical-review items #5 and #12 together — SDC's prior-treatment modeling now matches ADR-0105's decision (count buckets, no exact date) and its type dropdown can no longer offer a surgical code for a non-surgical question.
✅ Closes 2 of clinical-review item #1's 9 listed content gaps (Smoking Pack-Years, Occupational Overhead Exposure) as a side effect of the same port.
✅ `sushi .`: 0 errors / 0 warnings. `sdc-frontend` `npm run build` (tsc + vite): compiles cleanly.
✅ No mapping status change — Q1.d/Q1.f/Q1.k all stay `Full`, matching ADR-0105's own "no headline regression" consequence.
⚠️ `RotatorCuffProcedure.performed[x]` for SDC's prior-treatment Procedures now carries a placeholder (submission date) rather than a clinically asserted date — the same accepted tradeoff ADR-0105 already made for the unified frontend, now doubled across both frontends' codebases (duplication, not a new risk).

## Sources

- ADR-0105 — sole clinical/terminology authority for every field this ADR ports; nothing here revisits its decisions.
- the cross-frontend parity audit, items #5, #12.
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — `item[2]` (priorTreatment), `item[5]` (patientHistory), both edited.
- `ig/input/fsh/valuesets/PriorNonSurgicalTreatmentType.fsh` — new.
- `sdc-frontend/src/lib/extractor.ts` (`submissionDefaults`, `buildResourceForExtractionGroup`) — the seed-then-overwrite order this ADR's default relies on.
- `frontend/src/components/wizard/StepPatient.tsx` — the reference implementation this ADR ports (lines ~302–367, ~570–726).
- ADR-0103/ADR-0122 — the generic runtime profile-resolution mechanism that let 4 of the 6 new fields be added as pure Questionnaire FSH with zero `extractor.ts` code.
- ADR-0131 — same-session-family precedent for porting a unified-only field to SDC via a loose-leaf/generic-group pattern.
