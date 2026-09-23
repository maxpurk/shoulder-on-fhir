# ADR-0197: The generic form filler holds no server address of its own

**Date:** 2026-09-17
**Status:** Accepted
**Relates to:** ADR-0192 (template extraction as the mechanism of record), ADR-0122 (spec-generic extraction in the guide-aware frontend)

## Context

The guide-agnostic form filler exists to support one claim: a client that reads
only published artifacts can capture conformant data for a guide it has never
seen. Its source carries a single mention of this guide, in a comment, and every
profile canonical, element path and value set it works with arrives at runtime
from a Questionnaire or a StructureDefinition.

The address it asked did not. `fhirClient.ts` resolved one constant against the
document base, and `profileTypes.ts` carried the same path a second time, spelled
absolutely, so the one module that fetches StructureDefinitions bypassed the
base-relative resolution every other call used. Pointing the filler at a
different FHIR server meant editing two files and rebuilding.

That made the claim unfalsifiable rather than false. Nothing about the engines
was tied to this deployment, but there was no way to point them at another one
and find out, so the property could be asserted and not demonstrated.

## Decision

**One module owns every address, and resolves each per call.** `src/lib/config.ts`
is the only place in the application where a server address exists. Three
endpoints are named — the FHIR server, the terminology server, and the validator
— and each resolves through the same chain, most specific first:

1. `?fhir=` / `?tx=` / `?validate=` in the page URL, so a server travels as a link
2. `localStorage`, which is what the Server panel writes
3. `VITE_FHIR_BASE` / `VITE_TX_BASE` / `VITE_VALIDATE_URL` at build time, so a
   deployment can pin its own without a query string
4. the built-in default, unchanged from before

A configured value may be absolute (`https://hapi.fhir.org/baseR4`) or relative to
the page, so the build still works mounted under a path prefix. Resolution happens
on each call rather than once at module load, so changing an address takes effect
without a reload.

**The StructureDefinition cache is keyed by server and canonical together.** The
cache previously keyed on the canonical alone, which was correct only while there
was one server. A canonical is a name, not an address: the same canonical resolves
to a different definition on a different server, and a cache that cannot tell them
apart serves the first server's answer to the second. Changing an address also
clears the cache outright, because a stale snapshot is worse than a refetch.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Leave the address compiled in | The property the filler exists to demonstrate stays undemonstrable |
| A build-time environment variable alone | Correct for a deployment, useless for a demonstration: pointing the filler somewhere else becomes a rebuild and a redeploy, so in practice nobody does it |
| A runtime field with no persistence | The address is lost on every reload, which makes a multi-step capture against a foreign server tedious enough to abandon |
| Read the address from a served config document | A second network round-trip before the first useful one, and a document that is itself fetched from an address that has to be known |

## Consequences

✅ The filler can be pointed at any FHIR R4 server serving Questionnaires without
a rebuild, which turns "holds no knowledge of any implementation guide" from an
assertion about the source into something a reader can check in a browser.

✅ The terminology endpoint is repointable at runtime. The default route reaches a
public terminology server, and when that server is slow or unavailable an operator
can substitute another without touching the deployment.

✅ One inconsistency is removed: `profileTypes.ts` no longer carries an absolute
path that ignored the base-relative resolution the rest of the client used, so the
whole application now behaves the same way under a path prefix.

⚠️ A server can now be set from the page URL, so a link carries an address. The
filler reads and writes whatever that server serves, which is the point, and is
also worth knowing before pasting a link from elsewhere.

⚠️ The panel offers no connectivity check. An address that answers nothing yields
an empty form list, which reads the same as a server holding no Questionnaires.

## Sources

- `sdc-generic-frontend/src/lib/config.ts` — the resolution chain
- `sdc-generic-frontend/src/lib/fhirClient.ts` — `BASE` as a call, not a constant
- `sdc-generic-frontend/src/lib/profileTypes.ts` — cache key, and the absolute path removed
- `sdc-generic-frontend/src/App.tsx` — the Server panel and the cache clear on change
