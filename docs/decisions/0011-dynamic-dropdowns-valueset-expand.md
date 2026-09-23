# ADR-0011: Dynamic dropdowns via FHIR ValueSet $expand

**Date:** 2026-04-16
**Status:** Accepted

## Context

The frontend forms contain many dropdown fields whose options correspond to FHIR ValueSets defined in the IG (e.g., laterality, rotator cuff diagnosis, procedure type, hand dominance, Goutallier grade, provocation test results). In the original implementation, these options were hardcoded as TypeScript arrays in each form component.

This created a coupling problem: whenever a ValueSet was updated in the IG (new concept added, display label changed), the frontend code also had to be updated manually. The two could silently drift.

## Decision

Replace all hardcoded dropdown option arrays with **server-driven ValueSet `$expand` queries** against the HAPI FHIR terminology server.

Implementation:
- `frontend/src/lib/terminologyService.ts` — `expandValueSet(url)` with session-level in-memory cache (one round-trip per ValueSet URL per page session)
- `frontend/src/hooks/useValueSet.ts` — React hook returning `{ options, loading, error }`
- `frontend/src/config/observationMetadata.ts` — static per-code metadata (`valueSetUrl`, `unit`, `min`, `max`, etc.)
- `frontend/src/types/fhir.ts` — `VALUESET_URLS` constants map

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Hardcoded TypeScript arrays | Cannot stay in sync with IG changes without manual updates; ValueSet is not the source of truth |
| Bundle ValueSet expansions at build time (static JSON) | Still requires a rebuild when ValueSets change; loses the "single source of truth in HAPI" property |
| FHIR `$lookup` per form field | Per-field lookup is too fine-grained; `$expand` for the whole ValueSet and cache it is more efficient |
| GraphQL layer with caching | Unnecessary complexity for a thesis artifact |

## Consequences

✅ Frontend reflects IG terminology changes automatically after `load-profiles.sh` + page refresh  
✅ Single source of truth: HAPI is the authoritative terminology server  
✅ Session-level cache prevents redundant network calls within a single browser session  
✅ `loading` / `error` states allow graceful degradation if HAPI is not reachable  
⚠️ Frontend requires HAPI to be running and profiles to be loaded before dropdowns populate  
⚠️ ValueSet `$expand` adds latency on first page load per ValueSet (mitigated by session cache)  
⚠️ If HAPI is unavailable, dropdowns are empty — no offline fallback  

## Sources

- git commit `1f3852c` — "feat: make all frontend dropdowns dynamic via FHIR ValueSet $expand"
- `frontend/src/lib/terminologyService.ts` — `expandValueSet()` implementation
- `frontend/src/hooks/useValueSet.ts` — React hook
- `frontend/src/config/observationMetadata.ts` — per-observation `valueSetUrl` mapping
