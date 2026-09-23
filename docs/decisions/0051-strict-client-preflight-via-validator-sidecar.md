# ADR-0051: Strict client pre-flight via a custom FHIR Validator sidecar

**Date:** 2026-05-20
**Status:** Accepted; concurrency/timeout model superseded by ADR-0071 (footprint/memory findings below unchanged)
**Builds on:** ADR-0024 (FHIR Validator CLI as authoritative gate), ADR-0031 (three-tier separation; advisory client pre-flight), ADR-0044 (HAPI as pure storage tier), ADR-0049 (`tx.fhir.org/r4` as the validator's default TX server)
**Amends:** ADR-0031 §Decision row for *Validation* — the "frontends additionally run `Bundle/$validate` as an advisory call; submission proceeds regardless" stance is reversed. Pre-flight is now strict on errors and uses the validator sidecar instead of HAPI's `$validate`. The three-tier separation (storage / terminology / validation) is preserved; HAPI's `$validate` is no longer called by the frontends.

## Context

The frontends' pre-flight on submit was advisory: every wizard wrapped `fhirClient.validateBundle` (which POSTed to HAPI's `Bundle/$validate`) in a `try/catch` and proceeded regardless of the response. This had two problems:

1. **Wrong validator.** HAPI's instance validator is known to drift from the FHIR Validator CLI used by `tools/validate.sh` (ADR-0044 Finding 2 quotes HAPI's own docs on `RequestValidatingInterceptor` gaps; HAPI's Instance Validator runs the same engine code but through a different support chain with `VersionedUrlFallbackValidationSupport` and other adapters that the CLI does not). Net effect: HAPI says "OK" on bundles that CI then flags with real errors.

2. **No blocking gate.** Because pre-flight feedback was advisory, a frontend bug or a wizard step that produces a conformance-violating bundle would silently land in HAPI and only surface days later when `tools/validate.sh` ran in CI.

This ADR closes both gaps in one move: run the same validator engine the CI gate uses, as a sidecar the frontends call, and make pre-flight strict on `error` / `fatal` severity at submit time.

**The wrapper choice.** Two off-the-shelf paths were investigated:

- The HL7-maintained `markiantorno/validator-wrapper:1.0.77` (Kotlin/Ktor) is the validator-as-a-service powering `validator.fhir.org`. Empirical test on the development host (an 8 GB laptop with a ~3.8 GB Docker memory budget) confirmed engine parity (both 6.9.7) and confirmed `cliContext.igs: ["/ig/resources"]` accepts a mounted local IG. But: amd64-only image (runs under emulation on arm64), OOM-killed at a 4 GB limit, realistic floor 6–8 GB, ~1 min cold start, per-session re-loads of core packages. **Does not fit within that budget** and rules out the published wrapper for this project.
- `validator_cli.jar -server`: confirmed by `java -jar tools/validator_cli.jar -help` to **not exist**. `-watch-mode` is folder-based and not a fit for request/response.

**Chosen:** a custom thin Java HTTP wrapper that uses the same `tools/validator_cli.jar` as a classpath dependency. The fat jar already contains all of `org.hl7.fhir.validation.*`; a single 150-line Java file embeds the JDK's built-in `com.sun.net.httpserver.HttpServer` and calls `ValidationService.initializeValidator(...)` once at startup, then `engine.validate(bytes, FhirFormat.JSON, profiles, messages)` per request. Multi-arch (Eclipse Temurin JRE on Ubuntu jammy). Footprint observed: image ~500 MB, memory ~1.2–1.7 GB RSS, cold start 30–60 s, warm validation ~2–3 s. Fits the host budget.

**Engine parity is exact.** The sidecar runs literally the same JAR — bit-for-bit — as `tools/validate.sh`. Verified empirically against the unmodified seed bundle: `tools/validate.sh --only=ExampleShoulderRegistration` reports `0 errors, 9 warnings`; the sidecar reports `0 errors, 9 warnings` on the same input. Same IGs loaded (`hl7.fhir.eu.base#2.0.0`, `hl7.fhir.uv.xver-r5.r4#0.1.0` plus the local project IG via mounted `ig/fsh-generated/resources/` or `ig/output/package.tgz`). Same TX server (`https://tx.fhir.org/r4`, ADR-0049). Same `tools/.tx-cache/` shared via mount.

## Decision

1. **New `validator-service` container** in `docker-compose.yml`. Built from `validator-service/Dockerfile` (multi-stage: `eclipse-temurin:17-jdk-jammy` to compile, `eclipse-temurin:17-jre-jammy` for runtime). Single Java source file `validator-service/src/ValidatorServer.java`. Exposes `:3500` with `POST /validate` (accepts a Bundle as `application/fhir+json`, returns an `OperationOutcome` JSON) and `GET /health`. CORS open (`Access-Control-Allow-Origin: *`) — the service has no auth and is local-only.

2. **`validateBundle` in both frontends targets the sidecar**, not HAPI. The bundle's `meta.profile` drives validation (mirrors `tools/validate.sh`, which does not pass `-profile`). On network failure the client throws a new `ValidatorUnavailableError`, distinct from `FhirError`, so callers can fail-open.

3. **Strict pre-flight helper** `preflightValidate(entries, bundleProfile)` returns a discriminated union:
   - `{kind:'ok'}` — proceed silently
   - `{kind:'warnings', issues}` — proceed; surface issues to the user
   - `{kind:'blocked', issues}` — do **not** submit; show issues; let user fix and retry
   - `{kind:'unavailable', message?}` — proceed; show the yellow `ValidatorBanner` ("Validator service unavailable; submission accepted but not pre-checked. CI gate remains authoritative."). One short retry (1.5 s) before declaring unavailable handles the cold-start race.

4. **Four call sites converted to strict-on-errors:**
   - `frontend/src/components/RegistrationWizard.tsx` → `StepSummary` renders errors in red and blocks Submit; warnings in yellow and allow Submit; banner above on unavailable.
   - `frontend/src/components/SurgeryWizard.tsx` → `SurgeryReview` same shape.
   - `frontend/src/components/followup/ReviewSubmit.tsx` → `runSubmit` runs strict pre-flight. The manual "Advisory validate" button is renamed to **"Run pre-flight check"** and now routes through the same sidecar (no longer HAPI `$validate`). Copy on lines 116/137 rewritten.
   - `sdc-frontend/src/components/FlowPage.tsx` → strict pre-flight before `submitBundle`; banner + issues panel rendered above the `QuestionnaireForm`.

5. **HAPI keeps `Bundle/$validate`** (no config change). The frontends just stop calling it. The endpoint remains available for any external consumer that wants it. The storage-tier stance from ADR-0044 is unchanged.

6. **`build-and-deploy.sh` integration:**
   - Non-blocking wait loop for `:3500/health` after HAPI is ready. If the sidecar doesn't come up, the script continues (fail-open is the design).
   - When the IG-related restart fires (sushi / publisher / `--clean`), the script also restarts `validator-service` so the new `package.tgz` is loaded. Same fail-open behaviour.
   - New `--rebuild-validator` flag for rebuilding the image (e.g., after bumping the pinned `validator_cli.jar` in `tools/` or editing `validator-service/`). Implicit on `--clean`.

7. **`tools/reload-validator.sh`** — standalone helper to restart the sidecar + wait for `/health`. Reused by `build-and-deploy.sh`.

## Consequences

✅ **Drift between pre-flight and CI is closed at the artifact level.** Same JAR, same bind-mounted `tools/.tx-cache/`, same IG mount. If `tools/validate.sh` is green, the sidecar will return the same green; if CI flags an error, the sidecar will flag the same error pre-submit.

✅ **Wrong data can no longer reach HAPI from the frontends.** Errors block submit; users see what to fix and retry.

✅ **Warnings remain allowed.** Extensible-binding misses, terminology-server hints, and other low-signal noise don't punish the user — they're displayed but don't block.

✅ **Sidecar outage is graceful.** Connection refused / 5xx → one short retry → yellow banner → submission proceeds. Demoing or developing while the sidecar restarts doesn't bring the whole system down.

✅ **Footprint fits the development host.** ~1.2–1.7 GB resident, comfortably within the ~3.8 GB Docker memory budget alongside HAPI (650 MB) and Postgres (65 MB).

⚠️ **Cold start ~30–60 s.** First user submit immediately after `--clean` may hit the banner; one retry usually catches the second-attempt window. Same cost the CI run-time amortises across `--batch` mode (commit `a32d82e`); here it's per container lifetime.

⚠️ **Memory tail of ~1.7 GB.** Higher than HAPI. The Docker `mem_limit: 2g` is the visible cap; if it grows past that the sidecar gets OOM-killed and the banner shows — the deploy is not blocked, but the gate is degraded until the container restarts.

⚠️ **Sidecar must restart to pick up IG changes.** `build-and-deploy.sh` does this automatically when the SUSHI / publisher restart cascade fires. Manual reload via `tools/reload-validator.sh`.

⚠️ **The validator_cli.jar is pinned implicitly by what's in `tools/`.** Today it is version **6.9.7** (commit `1ab4fece`, built 2026-04-23). When `--update-validator` bumps it in `tools/`, the sidecar should be rebuilt (`--rebuild-validator` or `--clean`). The two JARs must be the same file for engine parity to hold; if they diverge this ADR's central claim is no longer true.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep HAPI `$validate` advisory (status quo) | Doesn't close the validator drift; bad data can still reach HAPI silently. |
| Make HAPI `$validate` strict at the client (no sidecar) | Cheaper but still wrong validator; ADR-0044 Finding 2 explicitly documents the drift. |
| Use `markiantorno/validator-wrapper` Docker image | Engine parity confirmed; OOM at 4 GB; needs 6–8 GB; amd64-only (emulated on arm64); ~1 min cold start. Does not fit within the development host's memory budget. |
| `validator_cli.jar -server` | Verified by `-help` dump: no such mode exists. |
| `validator_cli.jar -watch-mode` | Folder-based, fragile under concurrent submissions; not a request/response shape. |
| Fork `java -jar validator_cli.jar` per request | Cold-start ~10 s every click; unusable as a submit gate. |
| Re-enable HAPI's `RequestValidatingInterceptor` (ADR-0042 reversal) | ADR-0044 explicitly rejected this with HAPI's own production guidance. Re-opening it would re-introduce known gaps and the runtime perf cost. |
| Strict CI-only, no client gate at all | Bad data still reaches HAPI; errors only surface in PR pipelines. The demo would silently accept invalid bundles. |

## Verification

1. **Sidecar boots and answers a known-good bundle (registration example):**
   `curl -X POST -H 'Content-Type: application/fhir+json' --data-binary @ig/fsh-generated/resources/Bundle-ExampleShoulderRegistrationBundle.json http://localhost:3500/validate` returns an `OperationOutcome` with 0 errors / 9 warnings.

2. **Engine parity sanity check (run 2026-05-20):** `./tools/validate.sh --only=ExampleShoulderRegistration` → `OK (9 warning(s))`. Sidecar on same file → `Severity: {'warning': 9}`. Match.

3. **Strict-on-errors end-to-end:**
   - Open the frontend, run through any wizard, deliberately leave a required field out (or break a required-slice via dev tools).
   - Click Submit. Expected: red issues panel populated, no Patient created in HAPI (`curl http://localhost:8080/fhir/DEFAULT/Patient?_count=0 | jq '.total'` unchanged).
   - Fix the field. Submit succeeds.

4. **Warnings allow:** trigger a warning-only outcome (e.g., extensible-binding miss). Submit proceeds; yellow issues panel shows warning(s).

5. **Fail-open banner:** `docker stop shoulder-validator`. Submit any wizard. Expected: yellow `ValidatorBanner` rendered, submission still succeeds, Patient created in HAPI.

6. **Cold-start tolerance:** `docker compose restart validator-service`. Submit immediately. Expected: one 1.5 s retry → either success (sidecar warmed) or banner (still cold). Bundle is created either way.

7. **CI still green:** `./tools/validate.sh` — same 23/23 OK, 0 errors, ~1:05 wall time. No regression on the design-time gate.

8. **Lint clean:** `npm run lint && npm run build` in both `frontend/` and `sdc-frontend/`.

## Sources

- `validator-service/src/ValidatorServer.java` — the custom wrapper (single file, ~150 lines).
- `validator-service/Dockerfile` — multi-stage build, multi-arch via Temurin jammy.
- `frontend/src/lib/fhirClient.ts:14` — `VALIDATOR_URL` env wiring; `validateBundle` rewritten.
- `frontend/src/lib/preflightValidate.ts`, `sdc-frontend/src/lib/preflightValidate.ts` — strict helper with one-retry on cold-start.
- `frontend/src/components/ValidatorBanner.tsx`, `sdc-frontend/src/components/ValidatorBanner.tsx` — yellow fail-open banner.
- `docker-compose.yml` `validator-service:` block; `VITE_VALIDATOR_URL` env on both frontends.
- `build-and-deploy.sh` — non-blocking `/health` wait; restart on IG change; `--rebuild-validator` flag.
- `tools/reload-validator.sh` — standalone reload script.
- Empirical: `java -jar tools/validator_cli.jar -help` — confirms no `-server` mode; `docker run markiantorno/validator-wrapper:1.0.77` — confirms 6.9.7 engine + OOM on M1 8 GB.
