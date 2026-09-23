# ADR-0007: React 18 + TypeScript + Vite as frontend stack

**Date:** 2026-04-16
**Status:** Accepted — rationale reconstructed

> This decision predates the ADR log: no commit message records why React + TypeScript
> + Vite was chosen over the alternatives. The rationale below was reconstructed from
> the resulting configuration and the constraints in force at the time, and is stated
> as such.

## Context

The project requires a data-entry frontend that:

- Constructs FHIR R4 JSON resources directly from form state (no intermediate DTO/ORM layer)
- Calls HAPI FHIR REST endpoints with `Content-Type: application/fhir+json`
- Fetches ValueSet expansions dynamically from the terminology server
- Is bundled into a static nginx container for Docker deployment
- Provides type safety for FHIR JSON construction (preventing malformed resources at compile time)

## Decision

Use **React 18** with **TypeScript 5.4**, built by **Vite**, styled with **Tailwind CSS 3**, and deployed via **nginx** in a Docker container.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Vue 3 + TypeScript | React is more widely adopted; both are valid — no specific disqualifying reason found in git history |
| Angular | Higher ceremony/boilerplate for a single-purpose data-entry app |
| Plain HTML + vanilla JS | No component reuse; building a multi-step wizard without a component model would be impractical |
| Next.js | SSR not needed; adds deployment complexity without benefit for a FHIR client-only app |
| Svelte/SvelteKit | Less mature ecosystem at time of authoring; less TypeScript integration maturity |

## Consequences

✅ TypeScript catches malformed FHIR JSON at compile time (e.g., wrong `value[x]` type, missing required fields)  
✅ ESLint with zero-warnings enforcement (`npm run lint`) gates all changes  
✅ Vite dev server proxies `/fhir/*` → `localhost:8080` to avoid CORS in development  
✅ Static build output (`dist/`) deployable in any nginx container  
✅ `@/` path alias configured in both `tsconfig.json` and `vite.config.ts`  
✅ No `fhirclient` dependency; the custom `fhirClient.ts` wrapper is the only FHIR REST client  
⚠️ Local hand-written FHIR type definitions in `src/types/fhir.ts` (not generated from spec) — may drift from R4 spec  
❌ No automated test suite — validation relies on TypeScript + ESLint + HAPI server-side validation only  

## Sources

- `frontend/package.json` — dependencies: React 18.3.1, TypeScript 5.4.5, Vite, Tailwind CSS 3.4.4, ESLint
- `frontend/tsconfig.json` — TypeScript strict mode, `@/` path alias
- `frontend/vite.config.ts` — proxy configuration, path alias
- `frontend/nginx.conf` — static file serving and `/fhir/` proxy for production container
