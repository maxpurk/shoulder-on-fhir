# ADR-0003: PostgreSQL 15 as HAPI persistence layer

**Date:** 2026-04-16
**Status:** Accepted

## Context

HAPI FHIR JPA Server supports multiple persistence backends: H2 (in-memory, default), MySQL, and PostgreSQL. For this project:

- Data must survive container restarts (research registry data is not ephemeral)
- The database must be accessible for direct SQL analysis during thesis research (`fhir-queries.sql` exists)
- PostgreSQL 15 is the most recent stable version at time of development

## Decision

Use **PostgreSQL 15** (`postgres:15`) as the HAPI JPA persistence backend, with a named Docker volume (`hapi-postgres-data`) for data persistence.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| H2 in-memory (HAPI default) | Data lost on container restart; not suitable for a persistent registry |
| MySQL 8 | PostgreSQL preferred in the HAPI community; `HapiFhirPostgresDialect` is explicitly configured; no functional advantage |
| SQLite | Not supported by HAPI JPA |
| External managed PostgreSQL (e.g., AWS RDS) | Adds cloud dependency; thesis artifact must be self-contained and locally runnable |

## Consequences

✅ Data persists across `docker compose down` / `docker compose up` cycles  
✅ Enables direct SQL analysis of FHIR resource storage via `fhir-queries.sql`  
✅ Production-grade ACID guarantees  
✅ Well-documented `HapiFhirPostgresDialect` in HAPI  
⚠️ PostgreSQL 15 is unpinned at patch level (e.g., `15` not `15.6`) — minor version drift possible  
⚠️ Requires `docker compose down -v` to fully reset the database (volume must be explicitly removed)  

## Sources

- `docker-compose.yml` — `image: postgres:15`, `volume: hapi-postgres-data`
- `hapi/application.yaml` — `spring.jpa.properties.hibernate.dialect: ca.uhn.fhir.jpa.model.dialect.HapiFhirPostgresDialect`, `spring.datasource.url: jdbc:postgresql://db:5432/hapi`
