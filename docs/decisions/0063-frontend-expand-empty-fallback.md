# ADR-0063: Frontend `$expand` fallback triggers on empty result, not just throw

**Date:** 2026-05-24
**Status:** Accepted

## Context

Both frontends call `fhirClient.expand(canonical)` to populate coded
dropdowns. That call internally hits HAPI's
`GET /ValueSet/$expand?url=<canonical>`. For ValueSets whose
`compose.include[].system` references a **local IG CodeSystem** (Patte,
Goutallier, SatisfactionScale, CofieldTearSizeClassification,
ReturnToActivity — five user-facing dropdowns), HAPI's URL-form `$expand`
is unreliable after any HAPI restart: Lucene runs on tmpfs
(`docker-compose.yml`), so the index is wiped on restart, the scheduled
pre-expander caches "EXPANDED with 0 concepts" against an incompletely
rebuilt index, and the URL-form expansion returns `expansion.contains=[]`
indefinitely. ADR-0053 §Consequences captures this race. The TERM stage in
`build-and-deploy.sh` is the documented recovery path, but it only fires
when the script's restart was triggered through its own LOAD step — any
out-of-band restart (system reboot, Docker Desktop quit, manual
`docker compose restart hapi-fhir`, OOM) bypasses it, and the next warm
`./build-and-deploy.sh` idempotent-skips and the broken state persists.

The codebase already anticipated this failure mode in two places:

1. **`seed/generate-expansions.sh`** pre-computes `.expansion.contains` for
   every IG ValueSet before upload, deriving the codes from either
   `compose.include[].concept[]` (case 1: SNOMED-style explicit
   enumeration) or by walking the matching CodeSystem JSON (case 2:
   `include codes from system X`). Every IG VS that lands in HAPI's
   storage already carries a fully-populated `.expansion.contains` block,
   independent of HAPI's runtime Lucene index.

2. **`fhirClient.expand`** has a fallback path: try
   `/ValueSet/$expand?url=…`, and on failure read the VS resource directly
   via `/ValueSet?url=…` and return it as the expansion source.

The architecture was correct in design. The defect was the fallback's
trigger condition: it only fired on **throw**, but HAPI's actual failure
mode is **HTTP 200 with `expansion.contains=[]`**. The fallback never
fired for the failure it was written to handle, so empty dropdowns made it
through to the UI.

## Decision

In both frontends' `fhirClient.expand`, extend the existing fallback so
that **a primary `$expand` that returns `expansion.contains` empty (or
missing) also triggers the resource-read fallback**, not just an HTTP
throw. The fallback path is unchanged: read `/ValueSet?url=…` and return
the VS as the expansion source so the caller reads `.expansion.contains`
from the pre-computed block.

Guards:
- The `searchValueSet`/typeahead path (`options.filter` set) bypasses the
  fallback entirely — a legitimate filtered query returning zero matches
  is a valid result, not a failure.
- No change to `generate-expansions.sh`, no change to HAPI configuration,
  no change to the TERM stage. The pre-existing infrastructure is reused.

Files modified:
- `frontend/src/lib/fhirClient.ts` lines 277–308
- `sdc-frontend/src/lib/fhirClient.ts` lines 169–197

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Move HAPI Lucene off tmpfs to a persistent volume | Would address the underlying race globally, but requires changes to `docker-compose.yml`, persistent-volume management, and re-verification that no seed loader or validator path depends on the wipe-on-restart behavior. Higher blast radius than a frontend-only fix. |
| FSH-layer inlining of concepts in the affected ValueSets (`* PatteClassificationCodes#I "…"` instead of `* include codes from system PatteClassificationCodes`) | Empirically does not fix the URL-form `$expand` bug — instance-form returns the correct counts but URL-form (which `fhirClient.expand` uses) still returns 0 after restart. The inlining is kept as self-documentation (commits along with this ADR) but is not load-bearing. |
| Strengthen the TERM canary trigger in `build-and-deploy.sh` so any out-of-band HAPI restart triggers `$reindex-terminology` + `$invalidate-expansion` on next warm run | Treats the symptom one layer too high — the operator still has to re-run the script for the dropdown to populate, and an end user opening the page between a restart and the next script run still sees blanks. The fallback fix makes the UI self-healing without operator action. (The canary is retained as belt-and-suspenders.) |
| Switch the frontend to instance-form `POST /ValueSet/{id}/$expand` | Empirically more reliable than URL-form right now, but still depends on HAPI's runtime expansion + Lucene. Doesn't eliminate the failure class; future HAPI versions could regress instance-form behavior just as readily. |

## Consequences

✅ Dropdowns populate after any HAPI restart with no operator intervention.
   The fallback reads the VS resource (which holds the pre-computed
   expansion from `generate-expansions.sh`) whenever the primary `$expand`
   is empty.

✅ The defect class — "VS resource has the data, HAPI's runtime expansion
   doesn't surface it" — is closed for every IG VS that goes through the
   seed loader, not just the five user-facing ones reported in this
   incident.

✅ No change in network cost on the happy path: the primary `$expand`
   call is still made first. The fallback request only fires when the
   primary returned empty, which under normal operation is rare.

⚠️ The fallback returns the **stored** `.expansion` block. If a future
   change ever puts a stale expansion in `generate-expansions.sh`'s output
   (e.g. CodeSystem revised but VS not re-patched), the dropdown will
   silently show the stale data. Mitigation: `generate-expansions.sh`
   runs as part of every `load-profiles.sh` invocation and rebuilds the
   expansion from the current FSH-generated CodeSystem JSON, so any FSH
   edit that goes through the standard flow refreshes both sides.

⚠️ A *legitimately* empty expansion (a VS that includes all codes from a
   CodeSystem that itself has zero concepts) is no longer distinguishable
   from a HAPI failure — the fallback will fire and return the resource.
   Not a real concern in this IG (no zero-concept CodeSystems exist), but
   noted for future maintainers.

❌ The earlier layered workarounds (`tools/term-refresh.sh`, the
   build-and-deploy canary trigger, and this same note in its earlier
   wording) become belt-and-suspenders rather than
   primary recovery. Kept because they cost nothing to maintain and
   guard against a future VS slipping past `generate-expansions.sh`
   (e.g. someone adding a new VS without re-running the seed loader).

## Sources

- `frontend/src/lib/fhirClient.ts` lines 277–308 — primary fix.
- `sdc-frontend/src/lib/fhirClient.ts` lines 169–197 — same fix in the
  SDC demonstrator.
- `seed/generate-expansions.sh` — the pre-existing patcher this fix
  relies on (no edits).
- ADR-0053 §Consequences — the tmpfs Lucene race this fix bypasses.
- The diagnostic trail ran through three iterations (symptom → wrong root → real
  root); only the final root cause is recorded here.
