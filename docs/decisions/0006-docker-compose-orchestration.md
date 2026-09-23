# ADR-0006: Docker Compose for service orchestration

**Date:** 2026-04-16
**Status:** Accepted; the `profile-loader` service is gone and the service list has grown (see §Amendment). Compose itself, the `shoulder-network` bridge, the health-check ordering, and the named-volume persistence are unchanged and still in force.

## Amendment (2026-09-18) — what the stack looks like now

Three statements below describe a shape the repository has left behind. They are
kept as written for the audit trail; this note carries the current state.

1. **There is no `profile-loader` service and no `Dockerfile.loader`.** Profiles are
   loaded by `seed/load-profiles.sh`, which `build-and-deploy.sh` invokes as a
   pipeline stage against the already-running HAPI. The one-shot container was
   removed because it could only ever run on first `docker compose up`, while every
   FSH edit needs a reload — so the manual step it was meant to eliminate had to be
   taken anyway, and the container added a second, silently stale path to the same
   operation. The `⚠️` note below about re-running `load-profiles.sh` after an FSH
   change therefore now describes the only mechanism, not a caveat on an automatic one.
2. **The stack is no longer three runtime components plus a frontend.** It runs
   PostgreSQL, HAPI, the `validator-service` sidecar (port 3500), and four
   frontends — `frontend` (3000), `sdc-frontend` (3001), `sdc-generic-frontend`
   (3002), and `sdc-lforms-frontend` (3003). All of them bind to `127.0.0.1` only.
3. **The floating image tags were pinned.** `hapiproject/hapi:v8.8.0-1` and
   `postgres:15-alpine`, so the `⚠️` about floating tags is closed.

## Context

The system has three runtime components that must start in the correct order and communicate over a shared network:

1. **PostgreSQL** — must be healthy before HAPI starts
2. **HAPI FHIR JPA Server** — must be ready before profile-loader runs
3. **Profile-loader** (one-shot) — uploads IG artifacts to HAPI on first startup
4. **React Frontend** — built into an nginx container; served independently

These components must be runnable locally by a thesis evaluator with a single command, without cloud accounts or manual service wiring.

## Decision

Use **Docker Compose** (`docker-compose.yml`) to orchestrate all services, with a `shoulder-network` bridge network and health checks controlling startup order. A `profile-loader` service (Alpine + curl/jq) runs once on `docker compose up` to upload profiles automatically.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Kubernetes (Helm chart) | Massive operational overhead for a 3-service local thesis artifact; requires cluster setup |
| Manual startup scripts | Error-prone; order-dependent; no health checking; not reproducible for evaluators |
| Single monolithic container | HAPI JPA + PostgreSQL + nginx in one image violates container best practices and complicates rebuilds |
| Docker Swarm | Overkill for local development; same Compose syntax but adds swarm management complexity |

## Consequences

✅ Single command (`docker compose up -d`) starts all services in correct order  
✅ Reproducible for thesis evaluators — no host dependencies beyond Docker  
✅ Named volumes persist PostgreSQL data across restarts  
✅ `profile-loader` service eliminates manual `load-profiles.sh` on first run  
✅ `VITE_FHIR_SERVER_URL` env var and nginx proxy config (`/fhir/*` → `localhost:8080`) handle CORS in both dev and prod  
⚠️ Profile-loader runs once; FSH changes require manual `load-profiles.sh` re-run after sushi recompile  
⚠️ `hapiproject/hapi:latest` and `postgres:15` use floating tags — pin versions for reproducible thesis evaluation  
⚠️ `docker compose up -d --build frontend` required when frontend code changes (not automatic)  

## Sources

- `docker-compose.yml` — full service definitions, health checks, network, volumes
- `Dockerfile.loader` — profile-loader image (Alpine 3.19 + bash/curl/jq)
- git commit `c1642f1` — "feat: auto-load IG profiles on docker compose up" — introduced profile-loader service
- git commit `9849e3b` — "refactor(wizard): submit all resources as atomic FHIR transaction bundle" — fixed healthcheck by removing curl dependency from distroless frontend image
