# ADR-0001: FHIR R4 (4.0.1) as specification version

**Date:** 2026-04-16
**Status:** Accepted

## Context

The project requires a FHIR specification version that is:

1. Aligned with the European Health Data Space (EHDS) regulatory horizon: EHDS implementing acts are due March 2027, with mandatory primary-use compliance from March 2029. The EHDS technical specification targets FHIR R4 / IPS.
2. Supported by the chosen server (HAPI FHIR JPA) and IG toolchain (SUSHI, IG Publisher) in stable releases.
3. Broadly adopted by European national FHIR initiatives, enabling future conformance layer derivation without re-profiling from scratch.

FHIR R5 was released in March 2023 but had not been adopted by major European national FHIR initiatives at the time this IG was authored, and EHDS technical specifications explicitly target R4.

## Decision

Use FHIR R4 (version **4.0.1**) as the specification version for all profiles, CodeSystems, ValueSets, and the IG itself.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| FHIR R5 (5.0.0) | EHDS technical specs target R4/IPS; no major European national base profiles published for R5 at time of authoring; adoption effectively zero across target ecosystem |
| FHIR STU3 | Outdated; no active German base profiles; HAPI support diminishing |
| FHIR R4B | Interim patch release; same ecosystem gap as R5; no base profile support |

## Consequences

✅ Full compatibility with `hl7.terminology.r4 6.1.0` and the broader European FHIR ecosystem  
✅ Aligned with EHDS compliance requirements (March 2027 horizon)  
✅ Stable HAPI FHIR JPA and SUSHI toolchain support  
✅ Interoperable with DVSE/SECEC target registries currently evaluating FHIR R4  
⚠️ Cannot use R5-only features (e.g., improved subscription framework, new resources like `PermissionResource`)  
⚠️ Will require a future migration to R5 as German ecosystem evolves  

## Sources

- `ig/sushi-config.yaml` — `fhirVersion: 4.0.1`
- `hapi/application.yaml` — `fhir_version: R4`
- `docker-compose.yml` — `hapi.fhir.fhir_version: R4`
- the FHIR landscape analysis — EHDS regulatory timeline and German FHIR stack analysis
- the thesis design notes — scope constraint and DSRM framing
