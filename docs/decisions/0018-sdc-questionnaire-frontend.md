# ADR-0018: SDC Questionnaire-based frontend as a separate Docker service

**Date:** 2026-04-16
**Status:** Accepted

## Context

The primary frontend (`frontend/`) uses a 7-step registration wizard that builds FHIR resources directly in React and submits them as a transaction bundle. This is a valid FHIR implementation but does not follow the HL7 Structured Data Capture (SDC) Implementation Guide pattern.

The SDC IG defines a standardized approach for form-based clinical data capture:
1. A FHIR `Questionnaire` resource defines the form structure, question types, and terminology bindings
2. A `QuestionnaireResponse` stores the completed form data
3. An extraction step (`$extract`) converts the `QuestionnaireResponse` into discrete FHIR resources (Observation, Condition, etc.) conforming to domain profiles

Adding SDC support to the existing frontend would mix two data-entry paradigms in one UI, confusing the demonstration. A separate service makes the comparison explicit.

## Decision

Implement a second data-entry frontend as a separate Docker service (`sdc-frontend/`, port 3001) that:

1. **Defines a FHIR Questionnaire** (`ShoulderRegistration`) covering the full registration dataset: patient demographics, diagnosis (including tendons involved as a `repeats: true` choice item backed by `TendonsInvolved`), procedure, clinical assessment (ROM + provocation tests), outcome scores (PROMs), patient satisfaction, and return-to-sport/work. The Questionnaire uses `answerValueSet` references to the IG's canonical ValueSet URLs — the same ValueSets used by the primary frontend.

2. **Renders the Questionnaire as a form** — items of type `string`, `date`, `decimal`, and `choice` (with both `answerOption` and `answerValueSet`). Repeating `choice` items (`repeats: true`) render as checkbox groups with a separate `multiFormState` to track multiple selections; single-answer `choice` items render as dropdowns. Dynamic options are populated via `terminologyService.expandValueSet()` against HAPI, identical to the primary frontend.

3. **Client-side extraction** — on submit, the frontend:
   - Builds a `QuestionnaireResponse` from the form state (single-value `formState` + multi-value `multiFormState`)
   - Extracts discrete FHIR resources by mapping `linkId` answers to FHIR element paths: ShoulderPatient, RotatorCuffCondition (with `bodySite[]` entries for laterality + individual tendons via `flattenAllAnswers()`), ShoulderProcedure, ROM/test/score/satisfaction/return-to-activity Observation child profiles
   - Sets `meta.profile` on each extracted resource to the correct IG profile URL
   - Submits the `QuestionnaireResponse` + all extracted resources in a single `ShoulderRegistrationBundle` transaction

4. **Shared HAPI server** — connects to the same HAPI FHIR server (port 8080) and PostgreSQL database. No duplication of backend infrastructure.

### Why client-side extraction (not server-side `$extract`)

HAPI FHIR supports the `$extract` operation but requires either:
- **Definition-based extraction**: Questionnaire items annotated with `item.definition` pointing to StructureDefinition element paths (complex to author, not supported by SUSHI)
- **Template-based extraction**: `itemExtractionContext` extension on each item (HAPI-specific, non-standard)

Client-side extraction is equivalent in outcome, simpler to implement, and keeps the extraction logic explicit and testable. It aligns with the SDC IG's statement that extraction "MAY be performed by the server or by the client."

### Why a separate Docker container (not a route in the existing frontend)

A separate container makes the two paradigms independently deployable and clearly separates the demonstration. It also avoids coupling the SDC pattern to the existing frontend's routing and state management. The shared utilities (fhirClient, terminologyService, useValueSet, FHIR types) are copied — not linked — to maintain independence.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Add SDC route to existing frontend | Mixes paradigms in one UI; couples the demonstration to the primary frontend's architecture. |
| Server-side `$extract` via HAPI | Requires Questionnaire annotation with HAPI-specific extensions; adds complexity without benefit since the extraction logic is already well-specified. |
| Store QuestionnaireResponse only (no extraction) | QuestionnaireResponse is not searchable or interoperable as a discrete data source; would not demonstrate IG profile conformance. |
| Full SDC workflow with `$populate` pre-fill | Out of scope for this thesis; adds significant complexity. Documented as future work. |

## Consequences

✅ Demonstrates the SDC-aligned capture path alongside the wizard-based path  
✅ Same HAPI server and profiles — both frontends produce resources conforming to the same IG  
✅ Questionnaire `answerValueSet` references prove the IG's ValueSets are usable as SDC answerSets  
✅ `repeats: true` on the tendons item demonstrates multi-select SDC capture → multiple `bodySite[]` entries in `RotatorCuffCondition`  
✅ Patient satisfaction and return-to-sport/work captured in both frontends, producing `PatientSatisfactionObservation` and `ReturnToActivityObservation`  
✅ Each submitted bundle includes a `ShoulderQuestionnaireResponse` linked to the extracted resources  
✅ The `ShoulderRegistrationBundle` profile (ADR-0017) is used as the submission unit  
✅ HAPI 422 (constraint violation) and 400 (bad request) surface as a single user-friendly validation message  
⚠️ Shared utilities duplicated (not linked) between `frontend/` and `sdc-frontend/` — divergence possible  
⚠️ Client-side extraction logic must be kept in sync with profile changes manually  
⚠️ SDC `$populate` (pre-filling from existing FHIR data) not implemented — future work  
⚠️ Full multi-item PROM instruments (e.g. per-question ASES) not modelled — composite scores only  

## Sources

- HL7 SDC IG v4.0.0 — `extraction.html` (client vs. server extraction)
- HL7 SDC IG v4.0.0 — `workflow.html` (Questionnaire-based capture pattern)
- CREDS IG — registry submission via transaction bundle
- ADR-0017 — ShoulderRegistrationBundle profile
- ADR-0008 — observation base + derived pattern (used in extracted Observations)
