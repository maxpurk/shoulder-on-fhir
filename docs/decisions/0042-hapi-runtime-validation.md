# ADR-0042: HAPI gates inbound POSTs against `meta.profile`

**Date:** 2026-05-19
**Status:** Reverted (per ADR-0044). The runtime-gate decision below was accepted on 2026-05-19; the same afternoon, end-to-end testing showed (1) HAPI Starter `v8.8.0-1`'s validator chain recurses infinitely on any SD whose snapshot generation chases a versioned canonical (every R5-backport extension), affecting both `requests_enabled=true` and `Bundle/$validate`, and (2) HAPI's own docs recommend `RepositoryValidatingInterceptor` (not `RequestValidatingInterceptor`) for production runtime gating anyway. ADR-0044 reverts the runtime-gate decision and frames "HAPI as storage tier, FHIR Validator CLI as the authoritative conformance gate" as the deliberate architectural choice (the ADR-0031 stance, restored). This ADR remains in the record because (a) the EU-base / xver-r5 seed loader and the HAPI image pin it introduced are still in force, and (b) the runtime-gate analysis here documents what was attempted and why it was unwound.
**Supersedes (in part):** ADR-0031 (originally amended HAPI to act as a runtime validation tier). Now reverted by ADR-0044; ADR-0031's storage-only stance is again the operative posture. ADR-0042's design-time analysis (the Validator CLI rationale, the EU-base / xver-r5 SD loaders, the HAPI image pin) remains in force.
**Builds on:** ADR-0024 (FHIR Validator CLI), ADR-0031 (three-tier rationale + TERM stage + base R4 SD loader), ADR-0038 (HL7 Europe Base + Core alignment), ADR-0034 (three-bundle architecture)

## Context

ADR-0031 chose a three-tier deployment shape (storage / terminology / validation) and configured HAPI as a storage-only server with `requests_enabled=false`. The four frontends called `Bundle/$validate` as an advisory pre-flight; the authoritative conformance gate was `tools/validate.sh` (Validator CLI) in CI. The intent was to mirror production registries that separate storage from validation.

Two facts surfaced after ADR-0038 (HL7 Europe Base + Core alignment, 2026-05-17) that pushed this revisit:

1. **The validator chain stack-overflows on missing canonical URLs.** ADR-0038 added `ShoulderPatient.address only Address-eu` and an R5-backport extension on `ShoulderProcedure.recorded`. The corresponding canonicals — `http://hl7.eu/fhir/base/StructureDefinition/Address-eu` and `http://hl7.org/fhir/5.0/StructureDefinition/extension-Procedure.recorded` — live in `hl7.fhir.eu.base@2.0.0` and `hl7.fhir.uv.xver-r5.r4@0.1.0` respectively. Neither package is in `hl7.fhir.r4.core@4.0.1` (the only package `seed/load-base-profiles.sh` uploads). When the validator walks the Patient → Address-eu chain or the Procedure → extension chain and misses, HAPI Starter's `VersionedUrlFallbackValidationSupport` retries the lookup with the version stripped — but when the unversioned form *also* misses, it re-queries `ValidationSupportChain.fetchStructureDefinition` instead of returning `null`. The chain iterates back into the same fallback module, and the loop closes. The JVM exhausts its stack and the request returns HTTP 500 with `HAPI-0389: java.lang.StackOverflowError`. Reproduced with `POST /Bundle/$validate?profile=…/shoulder-surgery-bundle` on a two-entry surgery bundle (2026-05-19, stack trace captured in `: fhir-requests/fhir-request-test.http` notes).

2. **Storage-only HAPI accepts non-conformant bundles silently.** ADR-0031 rested on "the frontends are typed FHIR builders, the bundles are conformant by construction." That holds for the unified and SDC frontends as they exist today, but it gives no protection against (a) the SDC `$extract` logic regressing on a future Questionnaire change, (b) third-party clients or manual `curl` POSTs, (c) future frontends that aren't typed-builders. A demo that claims to enforce a published IG should not leave conformance enforcement up to client trust. The user (2026-05-19) explicitly preferred "the server refuses bundles that don't conform" over "the client is asked nicely."

The investigation also confirmed that HAPI's request-time validation, once the missing canonicals are loaded, works correctly for this IG — the same empirical result ADR-0031 §Context noted on 2026-05-12 (`example_bundle.json` validates with 0 errors / 169 warnings, all display-string variance). The blocker was never that HAPI couldn't validate; it was that ADR-0031 chose not to ask it to.

## Decision

1. **Enable HAPI request-time validation.** `hapi.fhir.validation.enabled=true` and `hapi.fhir.validation.requests_enabled=true` in both `hapi/application.yaml` and `docker-compose.yml`. `responses_enabled` stays `false` (validating outbound reads adds latency for no real-world benefit on a demo). Non-conformant inbound POSTs now return HTTP 422 with an `OperationOutcome` before any rows are written.

2. **Load the EU base + xver-r5 StructureDefinitions into HAPI** so the validation support chain can resolve every canonical the IG references. A new seed script — `seed/load-eu-base-profiles.sh` — mirrors `seed/load-base-profiles.sh`: downloads `hl7.fhir.eu.base@2.0.0` and `hl7.fhir.uv.xver-r5.r4@0.1.0` from `packages.fhir.org`, caches them under `seed/.fhir-eu-base-cache/` and `seed/.fhir-xver-r5-cache/`, and uploads every `StructureDefinition-*.json` via PUT-by-id over a keep-alive HTTP connection. Idempotence canary: direct GET on `StructureDefinition/Address-eu`; `FORCE_RELOAD=true` honoured (so `--reload-ig` re-uploads). `build-and-deploy.sh` calls it between `load-base-profiles.sh` and `load-snomed-fragment.sh`. With the SDs in HAPI, `VersionedUrlFallbackValidationSupport` resolves on the first lookup and the recursion never fires.

3. **Pin the HAPI image** to `hapiproject/hapi:v8.8.0-1` in `docker-compose.yml` (was `:latest`). The bug in `VersionedUrlFallbackValidationSupport` is Starter-version-specific; pinning prevents a future `:latest` update from regressing the loader-package set or introducing a worse fallback shape without notice.

4. **Frontends keep `Bundle/$validate` as advisory pre-flight.** The two demonstrator frontends already render `OperationOutcome` warnings as inline UX feedback and submit regardless. That behaviour stays — it gives users early structural feedback without coupling the UX to HAPI's specific validator quirks (display-string variance, LOINC-not-loaded). The **authoritative** gate is now HAPI's own request-time validation: the actual POST returns 422 if the bundle is non-conformant, regardless of what the pre-flight said.

5. **`tools/validate.sh` (FHIR Validator CLI) remains the CI / design-time gate** for examples and seed data. Its role is unchanged — it gates *artefacts* in the repo; HAPI gates *runtime submissions*. Both validations target the same `package.tgz` so the conformance verdict is consistent across tiers.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **Keep ADR-0031 unchanged; just load the missing packages so `$validate` stops crashing** | The smallest possible patch — but leaves the trust-the-client architecture in place. The user (2026-05-19) explicitly preferred a server-side gate after seeing the crash trace. Half-fixing the validator without changing the policy invites the next regression. |
| **Disable `VersionedUrlFallbackValidationSupport` instead of loading the missing packages** | Treats the symptom, not the cause. The same missing-canonical condition would surface elsewhere in the validator chain (e.g. snapshot generation, element type resolution) as "profile not found" errors — useless to the user. Loading the packages is the FHIR-correct path. |
| **Make the frontend pre-flight `$validate` a hard gate (block submit on error)** | Doesn't protect against non-frontend clients; couples the UX to HAPI's display-string warnings. Was rejected in ADR-0031 §Decision row 1 for the same reason; the reasoning still holds. The server-side gate doesn't have this drawback because HAPI's 422 is structural, not advisory. |
| **Put a Validator CLI service in front of HAPI as a proxy** | Real engineering work (containerise the CLI, route every POST through it, handle async). The right shape for a production registry deployment, but disproportionate for a thesis demonstrator. Documented here as the next-step upgrade path; not built. |
| **Run Snowstorm + a separate validation tier in compose** | Snowstorm needs a full licensed SNOMED distribution and Elasticsearch — multi-day setup, multi-GB binary, off-thesis-scope. ADR-0031 §Alternatives already rejected this for the same reasons; the reasoning is unchanged. |

## Consequences

✅ **Server-side conformance enforcement.** A `curl` POST of a malformed bundle to `/fhir/DEFAULT` now returns HTTP 422 before postgres is touched. The IG's published profiles are enforced regardless of who is calling.

✅ **The stack-overflow bug is gone.** With `Address-eu` and `extension-Procedure.recorded` resolvable, `VersionedUrlFallbackValidationSupport` returns on the first lookup. The frontends' advisory pre-flight now produces meaningful `OperationOutcome`s instead of 500s.

✅ **Reproducibility improved.** Pinning the HAPI image to `v8.8.0-1` removes a class of "yesterday it worked" failures driven by silent `:latest` updates.

✅ **CI / design-time gate unchanged.** `tools/validate.sh` continues to validate examples and seed against the same `package.tgz`. The two gates (runtime + design-time) target the same conformance contract, so a bundle that validates locally also validates against HAPI, and vice versa.

⚠️ **~200–800 ms added per POST.** HAPI now resolves the full profile chain on every inbound write. Acceptable for the demo (single-user, occasional submission); in a high-throughput production registry the validation tier would more likely be a separate service that the storage tier consults asynchronously or pre-flight only.

⚠️ **Build-and-deploy cold-start is longer.** `load-eu-base-profiles.sh` adds a download (~30 MB total across both packages) plus an upload of ~50 EU + ~50 xver-r5 StructureDefinitions over keep-alive HTTP. Roughly 30–60 s on a clean run; the script is idempotent so warm restarts skip it entirely.

⚠️ **Frontends will now receive 422s instead of silent successes when they emit non-conformant bundles.** Today both demonstrators construct conformant bundles by design, so no behavioural change is expected. Any future regression in `lib/extractor.ts` or `encounterBuilder.ts` will surface immediately at submit time rather than landing bad data into HAPI.

❌ **The "HAPI is storage only" framing from ADR-0031 no longer holds verbatim.** ADR-0031's three-tier rationale survives — terminology lookups still live in HAPI repaired by the TERM stage, and the Validator CLI is still the design-time gate — but HAPI now also acts as the runtime validation tier. ADR-0031's headline is amended via this ADR's Status line; ADR-0031's body is preserved unedited per the project convention used for earlier supersession.

## Sources

- `seed/load-eu-base-profiles.sh` — new loader for `hl7.fhir.eu.base@2.0.0` + `hl7.fhir.uv.xver-r5.r4@0.1.0`
- `build-and-deploy.sh` — new `==> LOAD EU base + xver-r5 StructureDefinitions (ADR-0042)` stage inserted between Base R4 and SNOMED fragment loaders; help-text bullet added
- `hapi/application.yaml` lines 60–73 — `validation.enabled`, `validation.requests_enabled` flipped to `true`; rationale comment references this ADR
- `docker-compose.yml` line 9 — HAPI image pinned to `hapiproject/hapi:v8.8.0-1`; lines 28–38 — env override mirrors the YAML, rationale comment references this ADR
- `: fhir-requests/fhir-request-test.http` — the request that reproduced the stack overflow on `Bundle/$validate?profile=shoulder-surgery-bundle`
- HAPI stack trace (2026-05-19, captured in conversation): infinite recursion between `ca.uhn.fhir.jpa.starter.validation.VersionedUrlFallbackValidationSupport.fetchStructureDefinition` (line 69) and `org.hl7.fhir.common.hapi.validation.support.ValidationSupportChain.fetchStructureDefinition` (line 770)
- `ig/input/fsh/profiles/ShoulderPatient.fsh` — `.address only Address-eu` (ADR-0038)
- `ig/input/fsh/profiles/ShoulderProcedure.fsh` — R5-backport extension `extension-Procedure.recorded` (ADR-0038)
- `ig/sushi-config.yaml` — `hl7.fhir.eu.base: 2.0.0` and `hl7.fhir.uv.xver-r5.r4: 0.1.0` declared as SUSHI compile-time dependencies (the gap this ADR closes for HAPI's runtime side)
- ADR-0031 — three-tier rationale + TERM stage + base R4 SD loader; this ADR amends its headline policy but keeps the three-tier shape
- ADR-0038 — alignment with HL7 Europe Base + Core; the source of the two canonical URLs that triggered the missing-resource recursion
