# ADR-0025: Canonical HPI-Namespaced Patient Identifier System

**Date:** 2026-05-06
**Status:** Accepted

## Context

FHIR `Identifier.system` must be an absolute URI that is globally unique and controlled by the assigning authority (FHIR R4 §2.3). The example patient instances and the seed bundle used `http://hospital.example.org/patients` — a throwaway placeholder that signals "this is a fake example" and does not belong to the IG publisher.

For the thesis demonstration system this matters in two ways:

1. **Conformance**: The `ShoulderPatient` profile does not constrain the identifier system, so any URI is technically conformant — but using an `example.org` URI would be highlighted by the FHIR Validator as a suspicious system and breaks the expectation that an IG's example data is realistic.
2. **Query correctness**: The seed-loading script issues conditional PUT requests keyed on the identifier system+value (e.g. `Patient?identifier=<system>|PAT-001`). The system URI in the query must match exactly what is stored in the resource; a temporary placeholder becomes a maintenance liability if ever corrected in only one place.

## Decision

Replace `http://hospital.example.org/patients` with `https://maxpurk.github.io/shoulder-on-fhir/identifier/patient` in all example instances, seed bundles, and conditional PUT URLs.

This URI follows the same canonical base as the IG itself (`https://maxpurk.github.io/shoulder-on-fhir`) and is owned by the thesis project. The `https` scheme (vs the placeholder's `http`) matches FHIR's recommendation for canonical URIs.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep `http://hospital.example.org/patients` | Not owned by the IG publisher; misleading in a thesis artifact |
| Use `urn:oid:...` (OID-based system) | OIDs require registration; appropriate for production but over-engineered for a demo system |
| Suppress the identifier entirely | `Identifier` on `Patient` is required in several realistic workflows; removing it weakens the example |
| Use a German identifier system (e.g. GKV `kvid-10`) | Would re-introduce a `de.basisprofil.r4` dependency, contradicting ADR-0022 (European scope) |

## Consequences

✅ Identifier system URI is owned by the IG publisher and consistent with the IG canonical base  
✅ Conditional PUT URLs in `seed/load-seed-data.sh` and example-patients.json stay in sync  
✅ FHIR Validator no longer flags the identifier system as an unrecognized `example.org` placeholder  
⚠️ Existing HAPI instances that already hold resources with the old system URI will not be migrated automatically; a fresh `docker compose down -v` + rebuild is required  

## Sources

- `ig/input/fsh/examples/ShoulderPatient.fsh` — identifier system updated
- `seed/bundles/example-patients.json` — system and conditional PUT URLs updated
- FHIR R4 Specification §2.3 — Identifier system requirements
- ADR-0022 — removal of `de.basisprofil.r4` and European scope rationale
