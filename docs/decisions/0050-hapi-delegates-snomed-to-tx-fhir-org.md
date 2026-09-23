# ADR-0050: HAPI delegates SNOMED resolution to `tx.fhir.org`; local SNOMED fragment retired

**Date:** 2026-05-20
**Status:** Accepted
**Builds on:** ADR-0011 (HAPI as runtime `$expand` server), ADR-0019 (terminology server strategy), ADR-0044 (HAPI as pure storage), ADR-0049 (validator default flips to `tx.fhir.org/r4`)
**Amends:** ADR-0049 §Decision §4 (the empirical "keep the fragment because HAPI's `$expand` collapses without it" sub-decision is reversed via a different mechanism — HAPI now delegates SNOMED to `tx.fhir.org` instead of carrying a local fragment); ADR-0019 §Decision (HAPI's runtime SNOMED resolution is no longer self-contained for the demonstrator — production guidance unchanged)

## Context

ADR-0049 flipped the FHIR Validator CLI's default TX target from `-tx n/a` to `https://tx.fhir.org/r4` to close the SNOMED-in-Questionnaire-answer bind-check gap. As part of that change, an attempt was made to drop `seed/load-snomed-fragment.sh` from the deploy pipeline on the reasoning that HAPI's `$expand` would enumerate IG ValueSet members directly. The empirical `--clean` showed otherwise: `rotator-cuff-etiology/$expand` collapsed from 4 → 1 (only the local `mixed` survived; the 3 SNOMED codes were dropped), and `tendons-involved/$expand` returned an empty expansion. HAPI's `$expand` requires the referenced SNOMED concepts to be resolvable in a CodeSystem at runtime, even when those codes appear verbatim in `compose.include.concept[]`. The fragment was retained as a workaround in ADR-0049 §Decision §4.

The cleaner path — and the one the HAPI JPA Server Starter is purpose-built for — is to configure HAPI to delegate any SNOMED-system code lookups to `tx.fhir.org` via the `hapi.fhir.remote_terminology_service` block. With that wired, HAPI no longer needs to carry a local SNOMED fragment for its `$expand` operations on SNOMED-bound IG ValueSets; it forwards the relevant calls to `tx.fhir.org`'s `$validate-code` / `$lookup` / expansion endpoints and returns the real SNOMED concepts to the frontend.

HAPI continues to host the IG's own ValueSets and custom CodeSystems (Goutallier, Patte, Cofield, ShoulderEtiology, etc.). `tx.fhir.org` has no knowledge of the IG; only the SNOMED-system path is delegated. Local-CS expansions (e.g., `cofield-tear-size-classification`) are unaffected.

## Decision

1. **Add `hapi.fhir.remote_terminology_service.snomed` to `hapi/application.yaml`**, pointing at `https://tx.fhir.org/r4/`. HAPI's `RemoteTerminologyServiceValidationSupport` chain receives the entry and routes SNOMED-system code lookups to the public TX server. Scope is SNOMED only; LOINC isn't used as a ValueSet member in the current IG and needs no delegation. Trivial to add later if a future IG ValueSet requires it.

2. **Retire the local SNOMED fragment infrastructure.** Specifically:
   - Delete `seed/load-snomed-fragment.sh` (HAPI seed loader).
   - Delete `seed/generate-snomed-fragment.sh` (CodeSystem generator).
   - Remove the `==> LOAD   SNOMED fragment CodeSystem` block from `build-and-deploy.sh`. Three seed scripts run at deploy time instead of four (`load-base-profiles.sh`, `load-eu-base-profiles.sh`, `load-profiles.sh`).
   - Remove the vestigial `SNOMED_FRAGMENT="$(mktemp …)"` block and `-ig "$SNOMED_FRAGMENT"` flag from `tools/validate.sh`. The validator default per ADR-0049 is `tx.fhir.org/r4` — it gets SNOMED resolution directly and doesn't need the `-ig snomed_fragment.json` workaround.
   - The deleted scripts are recoverable from git history if a future closed-network deployment needs to revive the workaround.

3. **HAPI now requires outbound network access to `tx.fhir.org`** for SNOMED resolution. If `tx.fhir.org` is unreachable, SNOMED-bound `$expand` calls degrade — the frontends' `useValueSet` hook catches the failure and shows "Could not load options" in the affected dropdown. HAPI itself stays up; local-CS dropdowns (Goutallier, Patte, Cofield, satisfaction, return-to-activity) continue to populate. The startup path is not blocking.

4. **Production guidance unchanged.** ADR-0019's "no public TX as default for production" stance still applies. A production registry deployment should point `remote_terminology_service.snomed.url` at a national / institutional TX server (Snowstorm, Ontoserver) — one config line change.

## Verification (run 2026-05-20)

`./build-and-deploy.sh --clean --no-logs` runs end-to-end. `CodeSystem/snomed-fragment-shoulder` returns 404 (the fragment is gone). The three SNOMED-bound IG ValueSets expand correctly through the delegation:

- `rotator-cuff-etiology/$expand` → `contains[]` lists all 4 codes (SCT `773760007` "Traumatic event", SCT `362975008` "Degenerative disorder", SCT `54690008` "Unknown (origin)", local `mixed` "Mixed (acute-on-chronic) etiology").
- `tendons-involved/$expand` → `contains[]` lists all 4 SNOMED tendon codes (`5580002`, `59713001`, `80108009`, `700027005`).
- `cofield-tear-size-classification/$expand` → `contains[]` lists all 4 local Cofield buckets (regression coverage — local CodeSystem expansion unaffected by the delegation).

Note: HAPI's `expansion.total` field reports `1` or omits the field for partial expansions that route through a remote TX server. The frontend reads `expansion.contains[]` (`frontend/src/lib/terminologyService.ts:44`), not `total`, so dropdowns populate correctly.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep both the fragment AND the delegation (belt-and-braces) | Redundant; the fragment becomes inert under the delegation; cleanup intent is lost; the design hides which path is actually serving a given query. |
| Keep the fragment, drop only the delegation | This is the ADR-0049 §Decision §4 state. It works but adds a maintenance burden (regenerate the fragment whenever the IG adds new SNOMED codes) and gives only the 54 hand-listed codes — no real SNOMED display strings, no hierarchy queries. |
| Spin up Snowstorm or Ontoserver locally | ~4–8 GB RAM, SNOMED CT RF2 import, license. ADR-0019 already documents this as the production path; over-engineered for a thesis demonstrator. |
| Frontend bypasses HAPI and calls `tx.fhir.org` directly for SNOMED-bound VSes | `tx.fhir.org` doesn't host the IG's ValueSets (they're IG-namespaced); frontend would need routing logic and the IG ValueSets' local-code members (e.g., `ShoulderEtiology#mixed`) would be lost. Rejected. |

## Consequences

✅ **Stack simplifies by two scripts + one seed step + ~12 lines in `validate.sh`.** Four seed scripts → three.
✅ **HAPI returns real SNOMED display strings** (the IG's hand-curated displays are still valid; the FSH compose entries provide them, and HAPI overlays TX-server displays where preferred). Closer to a production-grade demonstrator.
✅ **Closer to production pattern.** A real deployment swaps `tx.fhir.org` for a national/institutional TX server with one config line change — no other changes to the stack.
✅ **No frontend / IG / seed-bundle changes.** Same `.fsh`, same TS, same JSON.
⚠️ **HAPI now needs outbound internet to `tx.fhir.org` for SNOMED dropdowns to populate.** If `tx.fhir.org` is down: SNOMED-bound dropdowns show "Could not load options"; local-CS dropdowns (Cofield, Goutallier, Patte, satisfaction, return-to-activity) continue to populate. HAPI itself stays up. Recovery: when `tx.fhir.org` returns or when offline mode is needed, revive the fragment from git history and add a one-line invocation in `build-and-deploy.sh`.
⚠️ **HAPI startup latency may include initial TX server contact.** Not measured in this round; subjectively unchanged.
⚠️ **`tx.fhir.org`'s display strings may differ from the IG's `compose` displays** for some codes, surfacing as validator warnings rather than errors. ADR-0049 §Consequences already documents acceptable warning behavior.
❌ **Reverses ADR-0049 §Decision §4 the day after it was made.** ADR-0049 stays Accepted in the audit trail; only the fragment-retention sub-decision is amended by this ADR. The honest framing is: ADR-0049 §Decision §4 was a "we tried dropping the fragment by literal removal; empirical check showed HAPI's `$expand` collapses, so we kept it." ADR-0050 is "we then tried the proper mechanism — HAPI config delegation — and empirical check showed it works." Both ADRs side-by-side make the audit trail honest.

## Sources

- `hapi/application.yaml` — `hapi.fhir.remote_terminology_service.snomed` block.
- `tools/validate.sh` — fragment plumbing removed; `-tx tx.fhir.org/r4` default per ADR-0049.
- `build-and-deploy.sh` — fragment seed block removed.
- Empirical `$expand` results (2026-05-20): `rotator-cuff-etiology`, `tendons-involved`, `cofield-tear-size-classification` all return their expected `contains[]` arrays after `--clean`.
- HAPI JPA Server Starter [`application.yaml`](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/blob/master/src/main/resources/application.yaml) — `remote_terminology_service` configuration key reference.
- HAPI FHIR [RemoteTerminologyServiceValidationSupport](https://hapifhir.io/hapi-fhir/apidocs/hapi-fhir-validation/org/hl7/fhir/common/hapi/validation/support/RemoteTerminologyServiceValidationSupport.html) — class invoking `ValueSet/$validate-code` against the remote server.
- ADR-0019 — terminology server strategy (amended for the demonstrator's runtime SNOMED path).
- ADR-0049 §Decision §4 — fragment-retention sub-decision amended by this ADR.
