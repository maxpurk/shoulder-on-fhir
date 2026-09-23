# ADR-0002: HAPI FHIR JPA Server as runtime

**Date:** 2026-04-16
**Status:** Accepted — rationale reconstructed

> This decision predates the ADR log: no commit message records why HAPI was chosen
> over the alternatives. The rationale below was reconstructed from the resulting
> configuration and the constraints in force at the time, and is stated as such.

## Context

The IG requires a FHIR-conformant REST server that:

- Enforces profile validation against uploaded StructureDefinitions
- Supports multitenancy (separate data partition per registry/study)
- Persists resources in a production-grade SQL database
- Is self-hosted (no external cloud dependency for a thesis artifact)
- Supports FHIR R4 and the FHIR terminology operations (`$expand`, `$validate-code`) needed for the frontend

## Decision

Use **HAPI FHIR JPA Server** (`hapiproject/hapi:latest`) as the runtime FHIR server, deployed via Docker.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Firely Server (formerly Vonk) | Commercial license required for full validation features; adds external dependency |
| Azure API for FHIR / Google Cloud Healthcare API | Cloud-hosted; requires credentials and external network for a local thesis demo; not self-contained |
| IBM LinuxOne FHIR Server | Less community adoption; Java-based but less documentation for profile validation workflow |
| Blaze (Clojure-based FHIR server) | Less mature; limited profile validation support at time of authoring |

## Consequences

✅ Open-source (Apache 2.0), widely used Java reference implementation  
✅ Full FHIR R4 conformance including profile validation via `hapi.fhir.validation.requests_enabled`  
✅ Multitenancy enabled (`/fhir/DEFAULT` partition)  
✅ JPA-backed persistence swappable between H2 (dev) and PostgreSQL (production)  
✅ Built-in terminology server supports `$expand` for ValueSet-driven frontend dropdowns  
⚠️ `hapiproject/hapi:latest` is an unpinned image tag — builds may silently pick up breaking changes  
⚠️ Validation is computationally expensive; disabled by default in `hapi/application.yaml`, overridden to `true` in `docker-compose.yml`  
❌ Validation errors reported as HTTP 500 (not 422) when `meta.profile` cannot be resolved — requires profiles to be loaded before POSTing resources  

## Sources

- `docker-compose.yml` — `image: hapiproject/hapi:latest`, `hapi.fhir.validation.requests_enabled: true`
- `hapi/application.yaml` — full HAPI JPA configuration
- Local toolchain configuration — `docker compose` as the sanctioned way to manage HAPI
