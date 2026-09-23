# ADR-0052: IG Publisher build-time TX flips from `-tx na` to `https://tx.fhir.org/r4`

**Date:** 2026-05-20
**Status:** Accepted; §Consequences' "no SLA / if down" line lightly corrected by ADR-0080 (2026-07-17) — the load-bearing reason for this ADR's decision (published-IG HTML rendering quality) is unaffected and unrelated to that correction. §Decision 2 is **no longer applicable**: the CI workflow it configures no longer exists (see the correction inline).
**Builds on:** ADR-0019 (terminology server strategy), ADR-0049 (validator CLI default TX flipped to `tx.fhir.org/r4`), ADR-0050 (HAPI delegates SNOMED resolution to `tx.fhir.org` via `remote_terminology_service`), ADR-0051 (strict client pre-flight via the validator sidecar)
**Amends:** ADR-0019's §Alternatives row that lists `tx.fhir.org` as rejected — qualified for one more role (IG Publisher build-time HTML rendering), in the same spirit as ADR-0049's earlier amendment of that row for the validator CLI

## Context

`./build-and-deploy.sh --genonce` runs the HL7 IG Publisher inside Docker (`hl7fhir/ig-publisher-base:latest`) to render the static IG site under `ig/output/`. Until this ADR, the invocation passed `-tx na` (no terminology server), inherited from ADR-0014b's offline-first stance for `ig/_genonce.sh` and never revisited when the broader project shifted toward online TX in ADRs 0049/0050/0051.

**The symptom.** Each `--genonce` run emits a long stream of `Expanding {ValueSet} : No server available` lines — one per ValueSet that includes codes from a CodeSystem the Publisher cannot resolve locally. The build still completes (`Installing shoulder-on-fhir#dev done.`); the cost is on the published HTML site. SNOMED-bound ValueSets (`HandDominance`, `RotatorCuffEtiology`, `TendonsInvolved`, `RotatorCuffDiagnosis`, `ShoulderProcedureType`, the smoking-status ValueSet, and any other VS whose `compose.include` references `http://snomed.info/sct`) render without their concept tables — just the raw code list, no display strings, no hierarchy context. That makes the published IG harder for examiners and reviewers to read.

**Four actors talk to a TX server in this project; three were already on `tx.fhir.org`.** The IG Publisher is the only remaining holdout:

| Actor | Default TX | Set by |
|---|---|---|
| Validator CLI (`tools/validate.sh`) | `https://tx.fhir.org/r4` | ADR-0049 |
| HAPI runtime SNOMED `$expand` | `https://tx.fhir.org/r4` (via `hapi.fhir.remote_terminology_service.snomed`) | ADR-0050 |
| Validator sidecar (`validator-service/`) | `https://tx.fhir.org/r4` (inherits validator-engine default) | ADR-0051 |
| IG Publisher (`build-and-deploy.sh --genonce`) | **`-tx na`** ← addressed by this ADR | — |

**The fix is identical to ADR-0049 in shape.** Same TX endpoint, same env-var fallback ergonomics (`IG_TX_SERVER=n/a`), same reasoning about `tx.fhir.org` being the textbook fit for IG-authoring / validation / development. The Publisher caches TX responses under `${HOME}/.fhir-ig-publisher` (already bind-mounted by `build-and-deploy.sh`), so the network cost amortizes after the first build the same way `tools/.tx-cache/` does for the validator side per ADR-0049.

**Why a separate env var (`IG_TX_SERVER`) rather than reusing `TX_SERVER`?** They target different actors. A future deployer running `tools/validate.sh` offline (`TX_SERVER=n/a`) for the documented SNOMED-in-QR-answer limitation should not be forced into rebuilding the IG site offline as well, and vice versa. Naming them separately preserves independent control without adding any new code paths.

## Decision

1. **`build-and-deploy.sh` IG Publisher invocation uses `IG_TX_SERVER`, defaulting to `https://tx.fhir.org/r4`.** Override via `IG_TX_SERVER=n/a ./build-and-deploy.sh --genonce` for offline / air-gap / `tx.fhir.org`-down scenarios. The value flows into the Docker-invoked `java -jar publisher.jar … -tx "$IG_TX_SERVER"` line. The startup log line is augmented to echo the active TX endpoint so the choice is visible at the start of every run.

2. **`.github/workflows/build-publish-ig.yml` hardcodes `-tx https://tx.fhir.org/r4`.** CI is always online; no env-var indirection is needed there. This keeps CI builds consistent with local `--genonce` runs.

   > **Correction (2026-09-08): this item is void — the workflow it configures does not exist.** It was removed in commit `44b7600` (2026-08-15), whose message records that it *"targeted the 'main' branch but the repo only has 'master', so the GitHub Actions workflow never fired"* — so this decision item never took effect at any point. The project has no CI pipeline; both design-time gates (`tools/validate.sh` and the IG Publisher's QA pass via `--genonce`) are run on demand, on the deployment server for the TX-dependent ones (ADR-0080). Decision items 1, 3 and 4 are unaffected and remain in force.

3. **`ig/_genonce.sh` is intentionally not modified.** Comment at `build-and-deploy.sh` lines 192–194 documents that `_updatePublisher.sh -y` refreshes `_genonce.sh` and `_updatePublisher.sh` themselves from the upstream HL7 IG template — any local edits would be silently clobbered on the next jar update. The upstream script's built-in adaptive logic (`curl -sSf tx.fhir.org` → `""` or `-tx n/a`) is already correct for users invoking it directly outside of `build-and-deploy.sh`.

4. **ADR-0019 §Amendments gains a second-role entry.** The original `tx.fhir.org` rejection in ADR-0019's §Alternatives table — already qualified by ADR-0049 for the validator's design-time gate — is now also qualified for the IG Publisher's build-time HTML rendering. Production guidance (Snowstorm / Ontoserver / national server) for runtime `$expand` remains unchanged. ADR-0014b is not amended: its `-tx na` reference is specifically to `ig/_genonce.sh`, which this ADR explicitly leaves untouched.

5. **the project guide validation-responsibilities header is extended.** The existing line "client gate tightened by ADR-0051" gains "; IG Publisher TX aligned by ADR-0052". A one-line note in the "Full Build & Deploy" section documents the new `IG_TX_SERVER` env var and its `n/a` override.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep `-tx na`, accept an ugly published IG | The thesis defense and reviewer-facing IG site benefit from full SNOMED expansion. ValueSet HTML tables without display strings are objectively worse documentation. The fix is one line plus an env-var declaration. |
| Adaptive online/offline detection in `build-and-deploy.sh` (mirror `_genonce.sh`'s `curl -sSf tx.fhir.org` check) | Over-engineering for an opt-in stage (`--genonce` is not part of the default `build-and-deploy.sh` run). The env-var override is simpler, matches ADR-0049's pattern, and an explicit `IG_TX_SERVER=n/a` documents intent clearer than auto-detection. |
| ADR-0050-style delegation (IG Publisher → HAPI → `tx.fhir.org`) | The IG Publisher does not delegate TX through another FHIR server — it talks to whatever URL is in `-tx` directly. Pattern N/A. |
| Pin the IG Publisher to a version where `-tx na` silently warned instead of refusing to expand | The behavior is not version-specific; the Publisher genuinely cannot expand without a TX server when the CodeSystem isn't bundled locally. Pinning would not fix the rendering. |
| Bundle a SNOMED CodeSystem locally for the Publisher (analogous to the retired `seed/load-snomed-fragment.sh`) | The fragment was retired by ADR-0050 for HAPI; reintroducing it for the Publisher reverses that simplification. `tx.fhir.org` is the documented HL7 path for IG authoring. |

## Consequences

✅ **Published IG site renders cleanly.** SNOMED-bound ValueSet pages show their concept tables with display strings, hierarchy context, and definitions. Examiners and reviewers see what the IG actually means, not just opaque code numbers.
✅ **Consistency across all four TX-talking actors.** Validator CLI, HAPI runtime, validator sidecar, and IG Publisher all default to `https://tx.fhir.org/r4`. Mental model collapses to one URL.
✅ **Aligned with how the broader FHIR community works.** Every IG built on `build.fhir.org` and every reference IG (mCODE, US Core, IPS) uses `tx.fhir.org` for the IG Publisher's TX role.
✅ **Offline fallback preserved.** `IG_TX_SERVER=n/a ./build-and-deploy.sh --genonce` reverts to the prior behavior for air-gap / plane / `tx.fhir.org`-down builds. The startup log line echoes the active endpoint so the choice is visible.
✅ **No new dependencies, no new caches, no new code paths.** The Publisher already mounts `${HOME}/.fhir-ig-publisher` for its FHIR cache; TX responses cache there automatically.
⚠️ **First `--genonce` build is ~1–3 minutes slower** while the Publisher round-trips to `tx.fhir.org` for every SNOMED concept referenced by the IG ValueSets. Subsequent builds hit the cache and run at near-baseline speed.
⚠️ **`tx.fhir.org` has no SLA** — if genuinely down, or the build is running from a network path that can't reach it cleanly (ADR-0080: a local VPN tunnel was later found responsible for stalls previously attributed to `tx.fhir.org` itself, including a specific ~10-minute stall on this exact `--genonce` step), the `IG_TX_SERVER=n/a` override produces the prior (degraded but functional) build, or run `--genonce` on a network path without that constraint (the deployment server, per ADR-0080's policy). Same risk profile as ADR-0049.
⚠️ **CI gains an external network dependency.** The GitHub Actions workflow now requires `tx.fhir.org` reachability. The trade-off matches ADR-0049's analysis: the value of a clean published IG outweighs the risk of a transient TX outage breaking CI, especially because CI is gated on PRs and re-runs are cheap.
❌ **None.** Purely additive — does not reverse or contradict any prior ADR. Closes the consistency gap left after ADR-0051 by addressing the fourth and last TX-talking actor.

## Sources

- `: build-and-deploy.sh` — `IG_TX_SERVER="${IG_TX_SERVER:-https://tx.fhir.org/r4}"` declaration; `-tx "$IG_TX_SERVER"` in the Docker-invoked publisher.jar line.
- ~~the IG build-and-publish CI workflow — `-tx https://tx.fhir.org/r4` in the `Run IG Publisher` step.~~ Removed in commit `44b7600` (2026-08-15); see the correction under §Decision 2.
- `: ig/_genonce.sh` — upstream HL7 template script; intentionally untouched (`_updatePublisher.sh` refreshes it from upstream).
- `: docs/decisions/0019-terminology-server-strategy.md` — original "no public TX as default" stance; §Amendments extended by this ADR for the second-role exception.
- ADR-0049 — validator CLI default flipped to `tx.fhir.org/r4`; pattern mirrored here.
- ADR-0050 — HAPI delegates SNOMED to `tx.fhir.org`; closes the runtime side.
- ADR-0051 — validator sidecar; inherits validator-engine `tx.fhir.org` default.
- HL7 documentation on `tx.fhir.org`: "not a production grade system … operational use is not supported by tx.fhir.org." Scope fences against hospital deployments, not IG-authoring or thesis demonstrators.
- IG Publisher version: `hl7fhir/ig-publisher-base:latest` (Publisher 2.2.7 at time of writing, per the known-NPE comment in `build-and-deploy.sh:220–224`).
