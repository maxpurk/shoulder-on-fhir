# ADR-0044: Revert ADR-0042; HAPI is pure storage by design; FHIR Validator CLI is the authoritative conformance gate

**Date:** 2026-05-19
**Status:** Accepted
**Reverts (in part):** ADR-0042 (HAPI as runtime conformance gate via `requests_enabled=true`). The seed loaders, image pin, and design-time-validation rationale ADR-0042 introduced remain in force; only the runtime-gate decision is rolled back.
**Restores:** ADR-0031's three-tier separation (storage / terminology / validation) as the operative architecture.
**Builds on:** ADR-0024 (FHIR Validator CLI), ADR-0031 (three-tier rationale), ADR-0038 (EU Core soft alignment)

## Context

ADR-0042 (2026-05-19) amended ADR-0031's storage-only stance by flipping `hapi.fhir.validation.requests_enabled=true`, intending that HAPI's `RequestValidatingInterceptor` would gate inbound POSTs against `meta.profile` and reject non-conformant bundles with HTTP 422. The same afternoon, end-to-end testing surfaced two related findings that together made the runtime-gate route untenable on this stack — and, on closer reading of HAPI's own docs, *also* off-pattern for production deployments. This ADR collapses both findings into one architectural decision: revert ADR-0042, frame HAPI as a pure storage tier by deliberate choice, and document the FHIR Validator CLI as the authoritative conformance gate.

### Finding 1 — HAPI Starter `v8.8.0-1` has an unfixed validator recursion bug

- HAPI Starter PR [#911](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/pull/911) (jkiddo, merged 5 Feb 2026, commit `63256fe`) added `ca.uhn.fhir.jpa.starter.validation.VersionedUrlFallbackValidationSupport` to resolve `Resource|version` canonicals. The support module is constructed *with the entire `ValidationSupportChain` as its delegate*; on a cache miss it strips the version and re-queries `myChain::fetchStructureDefinition`. That re-query iterates back into the same fallback module with no recursion guard — `java.lang.StackOverflowError`.
- Issue [#938](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/issues/938) (17 Apr 2026) reports this verbatim; PR [#941](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/pull/941) (commit `9fe0b42`, merged 28 Apr 2026) adds a `ThreadLocal<Set<String>>` guard. The fix is on `master`; no released image carries it at the time of this ADR. Open issue [#946](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/issues/946) confirms the family — `$install` of any package whose contents carry `|4.0.1`-style canonicals also crashes on this image.
- The trigger fires on any inbound POST validation or on any `Bundle/$validate` call whose profile chain transitively touches a versioned canonical. In this IG that means anything referencing `shoulder-procedure` (ADR-0038's R5-backport `extension-Procedure.recorded` declares `baseDefinition: Extension|4.0.1`). Empirically reproduced: POST `example-patients.json` → HTTP 500; `POST Bundle/$validate` with `meta.profile = shoulder-registration-bundle` → HTTP 500; `POST Procedure/$validate` with `meta.profile = shoulder-procedure` → HTTP 500. The unversioned `Extension` SD is loaded and resolves via direct GET — the bug is in the resolver's recursion handling, not in resource availability.
- Loading the EU base + xver-r5 packages into HAPI (the seed loader added in ADR-0042) does not break the loop. Neither does the `bootstrap-then-flip` pattern attempted briefly during debugging — once validation is armed, the loop fires on every subsequent POST.

### Finding 2 — HAPI's own docs recommend AGAINST `RequestValidatingInterceptor` for production

Per HAPI's documentation:
- [Repository Validating Interceptor](https://hapifhir.io/hapi-fhir/docs/validation/repository_validating_interceptor.html): *"`RequestValidatingInterceptor` may miss validating data that is added or modified through Java API calls as opposed to through the HTTP endpoint […] may miss validating data that is added or modified through other interceptors."* The recommended production interceptor for runtime conformance enforcement is `RepositoryValidatingInterceptor`, registered programmatically with a *curated* `IValidationSupport` chain.
- [Instance Validator](https://hapifhir.io/hapi-fhir/docs/validation/instance_validator.html): *"It is always worth considering the performance implications of using the Instance Validator at runtime in a production system."*

`hapi.fhir.validation.requests_enabled=true` — what ADR-0042 enabled — is the HAPI Starter convenience wrapper around `RequestValidatingInterceptor` specifically. It's the interceptor HAPI tells you not to use in production. The community pattern across IGs that ship R5 backports (HL7 EU Core, mCODE, US Core 6.x) is to **publish the IG and leave runtime validation to the deployer**, who picks the appropriate interceptor for their environment.

### What this collapses to

The bug (Finding 1) is the proximate trigger; the architectural mismatch (Finding 2) is the substantive reason. Even if the upstream image fix shipped tomorrow, `requests_enabled=true` would still be the wrong wrapper for a production deployment of this IG. Reverting ADR-0042 is the correct architectural decision regardless of the HAPI Starter bug timeline.

## Decision

1. **Revert ADR-0042's runtime gate.** `hapi.fhir.validation.requests_enabled=false` in both `docker-compose.yml` and `hapi/application.yaml`. No bootstrap pattern, no SWAP stage, no env indirection.
2. **Frame HAPI as the storage tier by design.** This is the ADR-0031 stance, restored. The three-tier separation (storage / terminology / validation) is the deliberate architecture — not a workaround.
3. **The FHIR Validator CLI is the authoritative conformance gate.** `tools/validate.sh` runs against every example FHIR resource and the seed bundle in CI (`build-and-deploy.sh --validate`) and as the IG Publisher's internal validation (`--genonce`). Both gates target the same `package.tgz` clients ship against, so what passes CI is what conforms in production. Empirically verified on this IG: 73 conformance checks `OK` with warnings only, zero errors, including all three `Procedure-Example*` resources and the `example-patients` bundle (all of which carry `meta.profile = shoulder-procedure`, the R5-backport-bearing profile that fails inside HAPI). The Validator CLI lives in a different Maven project (`github.com/hapifhir/org.hl7.fhir.core`) and does not use the buggy `VersionedUrlFallbackValidationSupport` class.
4. **Frontends continue to call `Bundle/$validate` as an advisory pre-flight.** Already wired and already wrapped in `try/catch` blocks that log `'Advisory $validate failed; proceeding to submit.'` and continue to submission. The bundle is conformant by construction (typed builders for the unified frontend, definition-driven `$extract` for the SDC frontend); the advisory call surfaces construction regressions when it works and degrades silently when HAPI returns 500.
5. **`Procedure.recorded` (R5 backport) stays on `ShoulderProcedure`.** ADR-0038's EU Core soft alignment is intact end-to-end. No "Procedure.recorded was removed because of a HAPI bug" footnote.
6. **The EU base + xver-r5 seed loader stays.** Loading those SDs into HAPI is still useful for terminology operations and as preparatory work for the `tools/validate.sh` chain. Cost is one-time at `--clean`; warm restarts skip it.
7. **The HAPI image pin (`hapiproject/hapi:v8.8.0-1`) stays.** ADR-0042's reproducibility argument is independent of the runtime gate decision.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **A — Build a custom HAPI Starter image with PR #941 cherry-picked.** Multi-stage Dockerfile pulling `hapifhir/hapi-fhir-jpaserver-starter` source at commit `9fe0b42`, building with Maven + JDK 17, re-tagging locally. Keeps `requests_enabled=true` working. | Highest engineering complexity for a thesis deliverable: pinned upstream SHA, build-time JDK/Maven dependency, ~5–10 min added to `--clean` builds, maintenance liability with no story past thesis submission. And even if executed, it would still ship `RequestValidatingInterceptor` against HAPI's own production guidance (Finding 2). Correct for a production deployment of this IG; out of scope here. A future deployer who needs runtime gating should consider both this and Alternative B. |
| **B — Register `RepositoryValidatingInterceptor` programmatically with a curated `ValidationSupportChain` that excludes `VersionedUrlFallbackValidationSupport`.** HAPI's documented production recommendation. Same Docker-build burden as A plus an original Spring `@Configuration` class. | Best matches HAPI's docs but requires writing and maintaining custom Java that tracks HAPI Starter's evolving APIs. Out of scope for thesis; named here as the correct production path. |
| **C — Keep ADR-0042 in place but document `$validate` as the advisory contract; defer the runtime gate until a fixed HAPI image ships.** A briefer initial framing. | Doesn't actually work: `Bundle/$validate` ALSO crashes on this image (same recursion through a different entry point). Keeping ADR-0042 in place would mean no working HAPI-side validation at all *and* an open commitment to flip the gate back when upstream ships — a worse posture than the architectural revert. |
| **D — Drop the R5-backport extension `Procedure.recorded` from `ShoulderProcedure`.** Removes the recursion trigger and lets `requests_enabled=true` succeed. | Sacrifices an ADR-0038 commitment to dodge an upstream bug. Asymmetric (`Address-eu` and `condition-assertedDate` stay, only `Procedure.recorded` removed) and brittle (the next R5 backport would re-trigger the same path). Once the architectural choice (the present ADR) is made, the trigger doesn't matter — HAPI doesn't validate at all — so dropping a clinical-data-modeling decision to dodge it is unwarranted. |

## Upgrade path — re-enabling runtime gating in a future deployment

This ADR makes a deliberate architectural choice, not a temporary deferral; the IG itself does not depend on a future change. A future deployer who needs server-side runtime conformance enforcement has two paths:
1. **Upgrade HAPI to a tag containing PR #941 (commit `9fe0b42`)**, then flip `hapi.fhir.validation.requests_enabled=true` in `docker-compose.yml` + `hapi/application.yaml`. One-line change in each file. *Best for: thin-deployer use cases that accept HAPI's `RequestValidatingInterceptor` despite the gaps HAPI's docs flag.*
2. **Implement Alternative B above** — programmatic `RepositoryValidatingInterceptor` with a curated chain. *Best for: production multi-tenant registries where the gaps in (1) matter.*

Neither path requires changes to the IG, the FSH profiles, or the frontends. The conformance contract is already encoded in `package.tgz`; the only deployer-side decision is which interceptor (if any) enforces it at runtime.

## Consequences

✅ **No forked HAPI image, no custom Java, no upstream-release dependency in the thesis story.** The project ships the official `hapiproject/hapi:v8.8.0-1` image and the official FHIR Validator CLI; both are off-the-shelf tools.

✅ **The IG's full conformance posture is preserved.** Every example resource and the seed bundle are conformant against the IG's profiles, verified by the Validator CLI in CI. `Procedure.recorded` (R5 backport) is in place; ADR-0038 alignment intact.

✅ **The architecture matches HAPI's documented production guidance.** `RequestValidatingInterceptor` (the wrapper `requests_enabled=true` enables) is not the interceptor HAPI recommends for production runtime gating; this ADR doesn't use it.

✅ **End-to-end build runs green.** `./build-and-deploy.sh --clean --validate --no-logs` exits 0; all 73 Validator CLI checks pass; seed bundles POST cleanly; both frontends boot.

⚠️ **Runtime POST validation is not enforced by HAPI.** A `curl` POST or any non-frontend client can land non-conformant resources in storage. For the thesis demonstrator — where the frontends are the only realistic clients and they build bundles by typed construction — the design-time + advisory client gates are sufficient. For a multi-tenant production registry accepting POSTs from untrusted clients, server-side runtime validation would be required (see the Upgrade path above).

⚠️ **The follow-up wizard's user-initiated "Validate" button will show a HAPI `StackOverflowError` if clicked** (its bundle profile chain touches `shoulder-procedure`). Cosmetic UX wart; not blocking. The auto-`$validate` pre-flight on Submit handles the failure silently per the `try/catch` already in place. A future cleanup could route the button through a different validator endpoint or suppress the 500 — not in scope for thesis defence.

⚠️ **The `xver-r5` package's 1426 SDs are loaded into HAPI but contribute nothing at runtime** (HAPI isn't validating). Kept in place to keep the load idempotent and ready for any future re-enablement (Upgrade path option 1); the cost is a one-time ~3-minute load on `--clean`.

## Sources

- HAPI Starter PR [#911](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/pull/911) — introduced `VersionedUrlFallbackValidationSupport` (5 Feb 2026)
- HAPI Starter Issue [#938](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/issues/938) — community report of the recursion (17 Apr 2026)
- HAPI Starter PR [#941](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/pull/941) — recursion-guard fix on master (commit `9fe0b42`, 28 Apr 2026)
- HAPI Starter Issue [#946](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/issues/946) — confirms `$install` is similarly affected (7 May 2026)
- HAPI Validation docs — [Repository Validating Interceptor](https://hapifhir.io/hapi-fhir/docs/validation/repository_validating_interceptor.html), [Instance Validator](https://hapifhir.io/hapi-fhir/docs/validation/instance_validator.html)
- `docker-compose.yml` lines ~30–40 — `requests_enabled=false`, rationale comment references this ADR
- `hapi/application.yaml` lines ~60–75 — same setting + rationale
- `build-and-deploy.sh` — UP / RESTART stages in their pre-ADR-0042 shape; bash-3.2 fixes (`${label}…`, `${BUILD_ARGS[@]+…}`) and three-canary EU loader idempotence kept as independent improvements
- `seed/load-eu-base-profiles.sh` — three-canary idempotence; loader retained for terminology operations
- `ig/input/fsh/profiles/ShoulderProcedure.fsh` — `Procedure.recorded` slice preserved per ADR-0038
- `frontend/src/components/RegistrationWizard.tsx`, `SurgeryWizard.tsx`, `followup/ReviewSubmit.tsx`, `sdc-frontend/src/components/FlowPage.tsx` — all wrap `validateBundle()` calls in `try/catch` with `console.warn('Advisory $validate failed; proceeding to submit.', …)` — no edits needed
- `tools/validate.sh` — the authoritative design-time / CI gate (ADR-0024)
- ADR-0024 — FHIR Validator CLI as the design-time gate
- ADR-0031 — three-tier separation (restored by this ADR)
- ADR-0038 — EU Core soft alignment; `Procedure.recorded` R5 backport (preserved)
- ADR-0042 — the runtime-gate attempt, reverted by this ADR
