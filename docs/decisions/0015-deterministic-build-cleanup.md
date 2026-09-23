# ADR-0015: Deterministic build cleanup before each full build

**Date:** 2026-04-16
**Status:** Accepted

## Context

The build pipeline involves multiple tools that each produce cached or generated output:

- **SUSHI** → `ig/fsh-generated/` (FHIR JSON from FSH source)
- **IG Publisher** → `ig/output/` (HTML IG + snapshots)
- **ValueSet expansion cache** → `/tmp/fsh-expanded/` (pre-computed expansions)

When FSH artifact IDs are renamed or removed, SUSHI and IG Publisher leave stale files in their output directories. These stale files were causing IG Publisher to include outdated StructureDefinitions in the published IG and HAPI to validate against mismatched snapshots. The problem was discovered after ValueSet ID changes (removing `-vs` suffix from canonical URLs) resulted in orphaned files that continued to appear in the IG output.

## Decision

Add **Step 0** to `build-and-deploy.sh` — a full clean of all generated and cached state before each build run:

```bash
docker compose down -v --remove-orphans  # Stop containers + remove data volumes
rm -rf ig/fsh-generated                  # SUSHI output
rm -rf ig/output                         # IG Publisher output
rm -rf /tmp/fsh-expanded                 # ValueSet expansion cache
```

This step runs unconditionally before SUSHI compilation, IG Publisher, and Docker startup.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Incremental builds (trust SUSHI/IG Publisher cache) | Stale artifacts caused silent validation inconsistencies; cache invalidation is not reliable when artifact IDs change |
| Manual cleanup when build fails | Error-prone; requires developer awareness of which cache is stale |
| Pinned artifact IDs (never rename) | Not practical — ID corrections are necessary (e.g., removing `-vs` suffix from ValueSet IDs) |
| Separate `clean.sh` script | Would need to be remembered and run separately; Step 0 in `build-and-deploy.sh` makes cleanup automatic |

## Consequences

✅ Fully reproducible builds — output depends only on current FSH source, not on prior build state  
✅ Eliminates stale StructureDefinition or ValueSet artifacts after ID renames  
✅ No orphaned HAPI validations from mismatched snapshots  
⚠️ Full build is slower — IG Publisher cannot reuse cached snapshots  
⚠️ `docker compose down -v` drops the PostgreSQL data volume — seed data must be reloaded on each full build  
⚠️ Not needed for profile-only iteration: `load-profiles.sh` can be run directly without Step 0  

## Sources

- git commit `4ea7aa9` — "fix(ig): resolve all IG Publisher errors; pipeline builds clean (0 errors)" — introduced Step 0 clean
- `build-and-deploy.sh` — Step 0 implementation
- The project guide — "Add Step 0 to `build-and-deploy.sh`: full clean of generated state before each build"
