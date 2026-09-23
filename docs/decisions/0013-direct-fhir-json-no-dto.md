# ADR-0013: Direct FHIR JSON construction (no intermediate DTO)

**Date:** 2026-04-16
**Status:** Accepted

## Context

Frontend data-entry applications commonly use an intermediate data model (DTO, ORM, or domain object) between the form state and the wire format. This allows the UI to be decoupled from the persistence format. However, in this project:

- The target format is FHIR R4 JSON — a well-specified, stable wire format
- Each form maps 1:1 to a FHIR resource type (PatientForm → Patient, ConditionForm → Condition, etc.)
- An intermediate DTO would require maintaining a transformation layer that must stay in sync with both form state and FHIR profile constraints

## Decision

**No intermediate DTO.** `handleSubmit()` in each form component directly constructs the FHIR JSON resource from React form state and calls `fhirClient.create()` or `fhirClient.update()`. TypeScript interfaces in `src/types/fhir.ts` provide compile-time type safety for FHIR JSON.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| DTO layer (form state → DTO → FHIR JSON) | Extra indirection without benefit; form already maps 1:1 to FHIR resource; DTO would need its own type definitions |
| fhirclient npm package | The package's abstraction layer adds complexity without benefit for a HAPI-specific integration; not a dependency of this project |
| Auto-generated FHIR types (`@types/fhir`, generated from the R4 spec) | Generated types follow base-spec cardinality, so an element a profile requires is still optional and every `value[x]` choice is still permitted — they cannot reject what a profile forbids. Hand-written interfaces in `types/fhir.ts` carry this IG's own shape: `subject` is required on every resource and only the five `value[x]` variants the guide uses exist. Not a dependency of this project |
| GraphQL federation layer | Overkill; FHIR REST is the standard interface and HAPI implements it natively |

## Consequences

✅ Each form component is self-contained — form state IS the FHIR resource  
✅ No transformation bugs between a DTO and FHIR JSON  
✅ TypeScript interfaces in `src/types/fhir.ts` catch structural errors at compile time  
✅ Minimal dependencies — only a custom `fhirClient.ts` fetch wrapper  
⚠️ `src/types/fhir.ts` is hand-written and may drift from the R4 spec — not generated from the official FHIR JSON schema  
✅ `frontend/package.json` carries no FHIR-specific dependency at all: `fhirClient.ts` and `types/fhir.ts` are the whole FHIR layer  
⚠️ `src/lib/questionnaireExtractor.ts` (`extractResources()`) is a stub returning `[]` — not yet implemented  

## Sources

- `frontend/src/lib/fhirClient.ts` — `read`, `search`, `create`, `update`, `delete`, `metadata`, `submitBundle` — minimal fetch wrapper
- `frontend/src/types/fhir.ts` — hand-written FHIR R4 type interfaces
- `frontend/package.json` — no `fhirclient` and no `@types/fhir` entry
