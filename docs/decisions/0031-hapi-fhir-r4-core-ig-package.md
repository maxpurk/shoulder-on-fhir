# ADR-0031: FHIR three-tier architecture — HAPI as storage server, CLI as conformance gate

**Date:** 2026-05-12
**Status:** Accepted; one line in §Alternatives Considered corrected by ADR-0080 (2026-07-17) — the "503 during validation" observation cited there was later traced to a local VPN/MTU issue on the developer's machine, not `tx.fhir.org` itself. Does not change the decision: the independent reason given alongside it (`tx.fhir.org` doesn't host the IG's local CodeSystems) still fully justifies not making it HAPI's hard TX dependency.
**Builds on:** ADR-0002 (HAPI FHIR JPA Server), ADR-0017 (ShoulderRegistrationBundle), ADR-0024 (FHIR Validator CLI), ADR-0030 (ShoulderFollowUpBundle)

## Context

The Shoulder on FHIR demonstration system uses a single open-source HAPI FHIR JPA server (ADR-0002) for FHIR resource storage. Originally we configured HAPI to also do request-time profile + terminology validation (`hapi.fhir.validation.requests_enabled=true`), so that every POST or PUT was checked against the IG's `meta.profile` declarations before being persisted. That setup worked for the existing single-patient seed bundle (10 entries) and for the three registration frontends.

When ADR-0030 added `ShoulderFollowUpBundle` and the `followup-frontend` (port 3003), we exercised the validator end-to-end with `example_bundle.json` — a 66-entry longitudinal case (Anna Müller across 24 months of follow-up). Two HAPI infrastructure gaps surfaced:

1. **HAPI's `StructureDefinition` lookup table is missing the FHIR R4 base types** at startup. The validator walks profile chains by URL (e.g. `ShoulderPatient → baseDefinition Patient → resolve Patient|4.0.1`); it falls back to the in-memory `FhirContext` for some paths but not for transaction-bundle validation, where it queries the JPA store directly.

2. **HAPI's pre-expander silently saves `0 concepts` to `trm_valueset_concept`** for IG ValueSets whose concepts are listed inline in `compose.include[].concept[]`. Postgres `trm_concept` has the codes, `$lookup` returns them correctly, but `$expand` returns `expansion.total = 0`. Root cause (verified by inspecting `docker-compose.yml:42` and the HAPI logs): HAPI's Lucene fulltext index is mounted on **tmpfs** (`/lucene-index`), so it is wiped on every container restart. The build pipeline restarts HAPI immediately after `load-profiles.sh` to refresh the validator support chain — at that moment, postgres-side terminology survives but the in-memory Lucene index is empty. HAPI's `TermDeferredStorageSvcImpl` (5 s tick) hasn't yet had a chance to re-populate Lucene from postgres when the pre-expander fires, so each IG ValueSet's pre-expansion is cached as `EXPANDED, total_concepts = 0` and never retried.

   **Fix:** after the post-load HAPI restart, run `POST /$reindex-terminology` to rebuild Lucene from postgres, then `POST /ValueSet/{id}/$invalidate-expansion` for every IG ValueSet. This is wired into `build-and-deploy.sh` as the `TERM` stage, which runs only when the preceding stages actually changed state (`ΔSD≠0 || ΔCS≠0 || --reload-ig`). The canary verification expects `goutallier-classification` to expand to ≥1 concept within 60 s. With this stage in place, `$expand` returns the correct concepts for all 14 IG ValueSets, frontend dropdowns populate, and HAPI does the terminology work HAPI is supposed to do.

With the TERM stage in place, HAPI's request-time validation actually works for this IG. Empirically verified on 2026-05-12: `POST /Bundle/$validate` with `example_bundle.json` (66 entries) returns HTTP 200 with `0 errors / 169 warnings / 1 information` — and crucially **zero `code-not-in-valueset` errors**, the original failure mode. Remaining warnings are display-string variance against SNOMED canonical text and LOINC codes that can't be re-checked because we only load the SNOMED fragment locally. So the question is no longer "can HAPI validate?" (it can) but "should HAPI validate at request time, or should validation live elsewhere in a production-shaped pipeline?"

## Decision

**Keep HAPI as a storage server (`requests_enabled=false`) and adopt the standard FHIR three-tier deployment pattern.** Not because HAPI cannot validate — it now can, as shown above — but because the three-tier separation is the pattern real registries deploy and the one this thesis wants to demonstrate.

| Tier | Responsibility | Implementation in this thesis |
|---|---|---|
| **Storage** | Persist FHIR resources, serve search, enforce referential integrity | HAPI FHIR JPA Server with `requests_enabled=false` (validation off at write time, by choice) |
| **Terminology** | Resolve CodeSystems / ValueSets, validate codes, $expand, $lookup | Locally: HAPI itself, repaired by the TERM stage (`$reindex-terminology` + per-VS `$invalidate-expansion`) so `$expand` returns correct concepts for all 14 IG ValueSets. Production: route to Snowstorm, Ontoserver, or `tx.fhir.org` for SNOMED hierarchy walks and licence-aware concept handling. |
| **Validation** | Check conformance of bundles + per-resource artefacts against IG profiles | FHIR Validator CLI via `tools/validate.sh` (ADR-0024), run in CI / before commits / before demo loads. The four frontends additionally run `Bundle/$validate` as an **advisory** call — feedback surfaced as warnings, submission proceeds regardless. The bundle is conformant by construction (typed FHIR builders), so the advisory framing matches the production design where request-time validation lives at a separate tier. |

This separation is how production FHIR servers are deployed. HL7 publishes `tx.fhir.org` *because* registries typically split storage and terminology, even when storage software is capable of doing both. The IG is conformant; the chosen tools match the tiers they're designed for.

### Configuration mapping

- `docker-compose.yml` sets `hapi.fhir.validation.requests_enabled=false`. HAPI persists incoming resources as-is.
- `hapi/application.yaml` has no `implementationguides` block and no `pre_expand_value_sets` flag — both were trial paths that did not survive.
- `build-and-deploy.sh` runs the `TERM` stage after the HAPI restart (`$reindex-terminology` + per-VS `$invalidate-expansion` + canary wait) so HAPI's `$expand` returns correct concepts for all 14 IG ValueSets despite the tmpfs Lucene wipe.
- `seed/load-base-profiles.sh` still loads the FHIR R4 core StructureDefinitions into HAPI's JPA store, so search by canonical URL works (frontends can look up profiles for documentation, the Wizard's $expand of ValueSets returns the pre-baked expansion field, etc.). Loading the base profiles is cheap insurance even with validation off.
- `seed/load-snomed-fragment.sh` still loads the 54 SNOMED codes the IG references, so `CodeSystem/$validate-code` on demand works for any frontend that wants to verify a code interactively. This is independent of the bundle validator path.
- `tools/validate.sh` (ADR-0024) is the authoritative conformance gate. It uses the FHIR Validator CLI's own in-memory terminology resolution, which correctly accepts our IG ValueSets when invoked with `-version 4.0.1`. Verified: `example_bundle.json` returns 0 errors / 23 best-practice warnings under the CLI.
- HAPI's own `Bundle/$validate` operation also accepts `example_bundle.json` cleanly post-TERM (verified 2026-05-12: HTTP 200, 0 errors, 169 warnings — all display-string variance and LOINC-not-loaded warnings; none are conformance-blocking).
- The four frontends call `Bundle/$validate?profile=…` in **advisory mode**: try, render any returned `OperationOutcome` issues as warnings, allow submit regardless. This matches the production three-tier model (request-time validation lives at a separate tier, not at storage). HAPI's structural / cardinality / slicing / terminology feedback is still useful UX; making it non-blocking keeps the frontend usable when this stack is later pointed at a TX-server tier instead.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| **Flip `requests_enabled=true` after the TERM stage and let HAPI validate every POST** | Technically viable — post-TERM, `$validate` accepts `example_bundle.json` cleanly. Not chosen because the three-tier separation (storage / terminology / validation) is the production target this thesis wants to demonstrate. Coupling submit-time validation to a single storage implementation locks the frontends to HAPI's specific validator behaviour and the warnings it surfaces (display-string variance, LOINC-not-loaded), neither of which a real registry's frontend should be blocked on. |
| **Run a Snowstorm / Ontoserver terminology server in the demo compose stack** | Snowstorm requires a full SNOMED CT distribution (multi-GB licence-encumbered files) plus Elasticsearch; Ontoserver is non-open-source. Either is several days of work outside the thesis scope, and not necessary to demonstrate the IG. Documented in this ADR as the production upgrade path. |
| **Point HAPI at `tx.fhir.org` as an external TX server** | We hit a 503 during validation in this session, at the time read as `tx.fhir.org` being rate-limited/frequently unavailable — corrected by ADR-0080: later sessions traced this class of symptom to a local VPN tunnel silently stalling longer-lived connections, not the server. Independent of that: `tx.fhir.org` does not know the IG's local CodeSystems (Goutallier, Patte, SatisfactionScale), which alone is enough reason it's not acceptable as the demo's hard dependency. |
| **Switch IG `required` bindings to `extensible`** | Changes the IG's semantics. `required` is the correct strength for finite enumerations like Patte stages (I/II/III) and Goutallier grades (0–4); relaxing it for tooling convenience would be a regression. |
| **Use HAPI's `implementationguides` IG auto-installer for base profiles** | Crashes the server at boot via HAPI-1315 on `NamingSystem` resources in the FHIR R4 core package (tested; reproducible). Replaced by `seed/load-base-profiles.sh`. |
| **Strip `meta.profile` from incoming resources** | Hides the IG contract from downstream consumers, breaks `_profile=…` searches, and forces every frontend to embed the profile contract twice (in builder code and in HAPI). |

## Consequences

✅ **Each layer does what it's good at.** HAPI handles persistence and search at full speed. The CLI handles conformance with the complete reference implementation. The frontends construct conformant bundles by design (typed builders) and surface advisory feedback when HAPI provides it.

✅ **`example_bundle.json` POSTs cleanly** — HTTP 200, 66-entry transaction-response, all longitudinal queries (Constant trajectory, VAS pain trajectory, follow-up Encounters) return the expected time series.

✅ **The IG itself is unchanged.** No binding strength relaxed, no profile diluted, no FSH file edited to accommodate a tooling gap. Future deployments that have a real TX server flip `requests_enabled=true` and everything tightens back up.

✅ **Operationally simpler than running a TX server.** A real Snowstorm / Ontoserver deployment would add 10–20 GB of state, an Elasticsearch dependency, and SNOMED licence management. None of that is on the critical path for demonstrating the IG.

✅ **Aligned with FHIR community practice.** The "storage server + terminology server + validator CLI" separation is what real registries deploy. The thesis can frame this as an architectural decision, not a HAPI bug confession.

⚠️ **Frontends do not block on submit-time validation by design** — not because they can't (HAPI's `$validate` is now functional), but because the production target has validation at a separate tier from storage. The bundles the frontends construct come from typed FHIR builders (`encounterBuilder.ts`, `observationBuilder.ts`, `followUpBundleBuilder.ts`, etc.), so the shape is correct by construction. The advisory `Bundle/$validate` call tightens the user experience with HAPI's structural / cardinality / slicing / terminology feedback, but submit proceeds either way. CI-time CLI validation remains the hard gate.

⚠️ **A user who edits resource JSON by hand** (e.g. via the HAPI UI at `/`) loses the request-time check that would have caught a wrong `meta.profile`. The interactive frontends construct correct bundles; the hand-edit path is not a supported workflow.

⚠️ **`tools/validate.sh` is the build-time gate; the team must run it.** Continuous-integration enforcement of this is out of scope here, but the ADR documents the expectation. A CI step that fails on `tools/validate.sh --deep` would close the loop.

## Sources

- `docker-compose.yml` — HAPI service `requests_enabled=false`, with comments matching this ADR
- `hapi/application.yaml` — no `implementationguides`, no `pre_expand_value_sets`, multitenancy enabled via `partitioning` block
- `seed/load-base-profiles.sh` — loads FHIR R4 core SDs into HAPI's JPA store for search-by-canonical
- `seed/load-snomed-fragment.sh` — loads the SNOMED codes the IG references as a fragment CodeSystem (enables `CodeSystem/$validate-code` and `$lookup` on demand)
- `seed/load-profiles.sh` — loads IG-specific profiles, CodeSystems, ValueSets
- `tools/validate.sh` — FHIR Validator CLI integration (ADR-0024); the conformance gate
- `build-and-deploy.sh` — wires the loaders, restarts HAPI, runs the seed-data load; idempotent across re-invocations. The `TERM` stage (`$reindex-terminology` + per-VS `$invalidate-expansion` + canary wait) is the operational evidence that HAPI's terminology can be repaired post-restart, falsifying this ADR's original premise.
- HL7 FHIR R4 spec, §5 "Terminology Module" — separation of storage, terminology, and validation concerns
- `tx.fhir.org`, Snowstorm, Ontoserver — community references for production terminology servers
- ADR-0024 — FHIR Validator CLI as offline conformance gate (the gate this ADR makes authoritative)
- ADR-0017 — `ShoulderRegistrationBundle`
- ADR-0030 — `ShoulderFollowUpBundle`
