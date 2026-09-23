# ADR-0080: `tx.fhir.org` was never the problem — corrects ADR-0071/ADR-0079's root-cause misdiagnosis (local VPN tunnel), removes the resulting retry/auto-scrub machinery, moves TX-dependent testing to the deployment server

**Date:** 2026-07-17
**Status:** Accepted
**Amends:** ADR-0071 (§Context root-cause attribution, §Consequences), ADR-0079 (§Context root-cause attribution, §Decision 2/3/4 superseded, §Consequences), ADR-0031 (§Alternatives Considered, one line), ADR-0049 (§Consequences, one line), ADR-0052 (§Consequences, one line)
**Builds on:** ADR-0071, ADR-0079 (the two ADRs whose central diagnosis this ADR corrects)

## Context

Over several sessions — most recently and most concretely on 2026-07-17 — `tools/validate.sh`, `build-and-deploy.sh --genonce`, and `validator-service` repeatedly hung or stalled when run locally, with symptoms (zero output, JVM apparently frozen, occasional `SERVER_ERROR`/`SocketTimeoutException` responses cached to disk) that were consistently attributed to `tx.fhir.org` — HL7's public terminology server — being unreliable. That attribution produced real architecture: ADR-0071's timeout/dedup/client-abort resilience layer, and ADR-0079's same-day follow-up (`tools/scrub-tx-cache.sh`, watchdog+retry loops in `validate.sh` and `--genonce`, and an unconditional cache-scrub-and-restart of `validator-service` on every `build-and-deploy.sh` invocation).

Challenged on this — correctly — with the observation that every time the server itself was actually tested, it responded fine, we root-caused it instead of adding another layer of retry logic:

1. **Isolated calls to `tx.fhir.org` were fast and correct, every single time.** Direct `curl` tests of `/metadata`, `CodeSystem/$lookup`, `$cache-control?mode=start`, an intensional SNOMED `ValueSet/$expand` with a filter, and `ValueSet/$validate-code` — all returned in well under one second.

2. **Live capture of an actually-stuck local run** (`java -jar validator_cli.jar` against the seed bundle, run directly and monitored with `ps`/`lsof` rather than through the wrapper script's `> /dev/null 2>&1`): the process sat at "Validating" with **near-0% CPU** — blocked on I/O, not computing — while `lsof` showed **two dead sockets to `tx.fhir.org` (34.56.149.196) stuck in `CLOSE_WAIT`** (the remote side had already closed; the JVM never finished closing its end) and a **third connection freshly opened** moments later, as if silently abandoning the first attempts and retrying without ever surfacing an error.

3. **The local machine's default route for this traffic is a VPN tunnel** with a **reduced MTU of 1412** — below the standard 1500, as any tunnel's encapsulation overhead requires. A reduced-MTU tunnel is a well-known source of silently black-holed traffic on packets that need fragmentation or hit a broken PMTU-discovery path: small requests and small responses fit under the reduced MTU and sail through untouched; larger or longer-lived exchanges are the ones that stall. This matches the failure pattern exactly — and matches evidence already sitting in the ADR trail without anyone drawing the conclusion: ADR-0071 §Sources itself records that isolated `$subsumes`/`/metadata` calls were "healthy in under a second" even while full validations hung, and `build-and-deploy.sh`'s own `IG_PUBLISHER_TIMEOUT` comment names the specific stall as the **~400k-concept IPS intensional SNOMED expansion** (`problems-snomed-absent-unknown-uv-ips`) — by a wide margin the single largest terminology payload anywhere in this project's TX traffic.

4. **Decisive control test.** The identical `validator_cli.jar` invocation — same seed bundle, same `tx.fhir.org` endpoint, same `-ig` packages — run on the deployment server (no VPN in its path, direct internet) completed cleanly in **85 seconds** (47.5s package loading, 37.8s validation), full `Done.` output, no retry needed.

**Conclusion: `tx.fhir.org` is healthy.** The stalls were the local development machine's VPN tunnel silently dropping larger/longer-lived HTTPS connections. The VPN cannot simply be turned off — it is the network path this machine works over — so the fix is not "fix the VPN," it's "stop routing TX-dependent testing through it."

## Decision

1. **TX-dependent testing moves to the deployment server, permanently.** `tools/validate.sh` in online mode and `build-and-deploy.sh --genonce` in online mode are run on the deployment server (SSH), not the local Mac. This is now documented as project policy in the project guide. Local `sushi .`, `npm run build`/`lint`, and offline-mode (`TX_SERVER=n/a` / `IG_TX_SERVER=n/a`) runs are unaffected — none of them touch the broken network path, and none of today's evidence implicates them.

2. **`tools/validate.sh`'s automatic retry-after-scrub loop (`VALIDATE_MAX_ATTEMPTS`) is removed.** Retrying a call over a network path that silently drops larger connections does not fix anything — it just spends another full timeout window arriving at the same failure. The bounded watchdog (`VALIDATE_BATCH_TIMEOUT`, kill the JVM and report cleanly instead of hanging forever with zero output) is kept as a single-attempt bound — that part of ADR-0079 remains good, general-purpose engineering independent of what causes a stall. One `scrub-tx-cache.sh` pass still runs before the (now single) attempt, cheap hygiene against a stale entry from a previous run.

3. **`build-and-deploy.sh --genonce`'s equivalent retry loop (`IG_PUBLISHER_MAX_ATTEMPTS`) is removed** for the same reason. `IG_PUBLISHER_TIMEOUT`'s watchdog is kept, single-attempt.

4. **`build-and-deploy.sh`'s unconditional stop+scrub+restart of `validator-service` on every invocation is removed.** Under the corrected diagnosis, cache poisoning should be rare now that TX-dependent testing runs on a clean network path; restarting a container (with its brief downtime) on every single deploy to guard against a now-rare event is no longer worth the cost. `tools/scrub-tx-cache.sh` remains available as a standalone, on-demand tool — run it manually if `validator-service`'s cache is ever suspected of holding a poisoned entry (symptom: an error that returns *instantly*, with no network delay, and repeats identically on retry).

5. **What is explicitly kept, unchanged, because it has independent value regardless of root cause:**
   - `tools/scrub-tx-cache.sh` itself (ADR-0079 §Decision 1) — it correctly strips cached `SERVER_ERROR` responses whatever produces one (a real validator cache-design flaw: it caches errors as if permanent). Now invoked on-demand rather than automatically on every deploy.
   - `validator-service`'s bounded timeout (`VALIDATE_TIMEOUT_SECONDS=90` → clean `503` instead of hanging) and bounded thread pool (`VALIDATOR_THREADS`, protects shared heap from OOM) — both defensible defensive engineering for any HTTP endpoint doing heavy work, independent of why a particular call might be slow.
   - `validator-service`'s single-flight dedup — protects against genuinely concurrent identical submissions (e.g. a user double-clicking submit), a real scenario independent of the VPN finding.
   - Both frontends' client-side `AbortSignal.timeout(20s)` + `ValidatorUnavailableError` + fail-open banner (ADR-0051/ADR-0071) — this is sound UX design for an *advisory* pre-flight gate: the sidecar must never be able to block a submission, regardless of why it might be slow. This mechanism worked exactly as designed during this session's own testing (validator-service timed out gracefully, banner path fired, submission proceeded to HAPI successfully).
   - The `set -e` / `wait "$java_pid" 2>/dev/null || true` bug fix from ADR-0079 §Decision 5 — an independently real bug (a watchdog-killed process aborting the whole script under `set -e` before retry/summary logic ran), unrelated to root cause, still needed as long as any watchdog-kill pattern exists.
   - `frontend/src/lib/fhirClient.ts`, `preflightValidate.ts`, and their `sdc-frontend/` mirrors were reviewed and found to make no affirmative wrong claim about `tx.fhir.org` specifically — their comments hedge generically ("regardless of backend/`tx.fhir.org` slowness," "a slow/stuck sidecar") rather than asserting an observed diagnosis. Left unchanged.

6. **ADR-0071 and ADR-0079 are corrected in place, not deleted.** Per this project's own established convention (ADR-0048 → ADR-0049), a superseded diagnosis stays visible with its correction attached, rather than being silently rewritten. Their specific false root-cause claims are edited; the parts of their Decision sections describing mechanisms that are *kept* are left as accurate historical description. Their Decision sections' retry-loop and auto-scrub items are marked superseded by this ADR.

7. **ADR-0031, ADR-0049, and ADR-0052 receive a one-line correction each** to caveat language that leaned on "`tx.fhir.org` is unreliable" as part of their reasoning — in every case, the actual decision each ADR made rests on an independent, still-valid reason (ADR-0031: `tx.fhir.org` doesn't host the IG's local CodeSystems; ADR-0049: `tx.fhir.org`'s validator special-case for SNOMED-in-`QuestionnaireResponse.answer.valueCoding`; ADR-0052: published-IG HTML rendering quality) — so none of those three decisions themselves change.

8. **ADR-0050 and ADR-0062 are deliberately left untouched.** Their `tx.fhir.org` mentions are conditional/hypothetical ("if `tx.fhir.org` is down, the typeahead shows an error") rather than affirmative diagnosis claims — nothing in them is actually wrong. (ADR-0062's `/tx-fhir` same-origin proxy addresses a separate, real, unrelated `tx.fhir.org` quirk — duplicate CORS headers that Chromium rejects — not to be conflated with this VPN finding.)

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Fix the VPN tunnel's MTU / add a split-tunnel route excluding `tx.fhir.org`'s IP | Would directly address the root cause, but the VPN must stay active and correctly routed for the machine to work at all — reconfiguring it in place is exactly the kind of change that could sever the connection with no way to recover it locally. Testing on the deployment server sidesteps the problem entirely without touching the VPN, and the deployment server is where the software actually needs to work in production anyway. |
| Keep the retry loops as defensive fallback, just correct the diagnosis text | Considered and rejected (explicit user decision, this session): retrying doesn't fix a broken local network path, so the retry only spends up to 2× the timeout arriving at the same inevitable failure. Once the primary testing path moves to the deployment server, the loops mainly exist to make a rare local run appear more resilient than it needs to be. |
| Leave `build-and-deploy.sh`'s unconditional validator-service scrub-restart in place as cheap insurance | Considered and rejected (explicit user decision, this session): the insurance is against a failure mode this ADR's policy change should make rare; the cost (a container restart, with brief downtime, on every single deploy including plain no-flag runs) isn't worth paying for a rare event when the tool remains available on-demand. |
| Rip out the timeout/dedup/pool/fail-open resilience code entirely, since the triggering diagnosis was wrong | Rejected — these mechanisms are correct, general-purpose engineering for a service making calls to an external, best-effort dependency with no SLA (a documented fact about `tx.fhir.org` independent of this session's finding), not exclusively bandages for a VPN artifact. Removing them would be throwing away good defensive code because its origin story turned out to be partly wrong. |
| Silently rewrite ADR-0071/ADR-0079 to remove the wrong claims, no trace | Rejected — inconsistent with this project's own established amendment convention (ADR-0048 → ADR-0049) and would hide a real, instructive misdiagnosis from future readers (including future sessions) who might otherwise repeat it. |

## Consequences

✅ Every place that recorded "`tx.fhir.org` is unreliable" as an established fact now correctly attributes the observed symptoms to a local VPN/MTU interaction, evidenced by a concrete server-side control test.

✅ `tools/validate.sh` and `build-and-deploy.sh --genonce`, run locally, now fail once, cleanly, within a single bounded timeout — not up to 2× that after a pointless retry — when the VPN path is the problem. The corrected guidance in both tools' failure messages points at the real fix (the deployment server) rather than "wait it out" or "raise the timeout."

✅ `build-and-deploy.sh` no longer restarts `validator-service` on every invocation for a problem that should now be rare.

✅ The resilience code with genuine independent value (bounded timeout/pool/dedup server-side, client-side abort + fail-open) is untouched and still fully in force — this ADR narrows *scope*, it doesn't remove defensive engineering wholesale.

⚠️ This does not fix the VPN tunnel itself — a genuinely reduced-MTU tunnel interface is still active on the local machine for all other traffic. It's out of scope here because the VPN must stay active; a later pass could investigate a split-tunnel route for `tx.fhir.org`'s IP specifically as a follow-up, but server-only TX testing is sufficient for this project's needs today.

⚠️ TX-dependent testing now has an SSH-to-server-side step in the loop that didn't exist before. Documented in the project guide as the new normal workflow, not a workaround.

## Sources

- Live evidence, 2026-07-17: `curl` timing tests against `tx.fhir.org` (`/metadata`, `$lookup`, `$cache-control?mode=start`, `ValueSet/$expand` with an intensional SNOMED filter, `$validate-code`) — all under 1s.
- Live `ps`/`lsof` capture of a stuck `java -jar validator_cli.jar` process: near-0% CPU, two sockets to `34.56.149.196:443` in `CLOSE_WAIT`, a third freshly opened.
- `ifconfig`/`netstat -rn`/`ps aux` output identifying a reduced-MTU (1412) VPN tunnel interface as the active default route for this traffic.
- Control test: identical `validator_cli.jar` command run over SSH on the deployment server — 85s clean completion (47.5s load + 37.8s validate), zero VPN in that machine's network path.
- `docs/decisions/0071-validator-service-resilience-timeout-dedup-client-patience.md` — the ADR whose central diagnosis this corrects; §Sources' own "healthy in under a second when tested in isolation" line already recorded the small-calls-fine / long-calls-stall signature without anyone drawing the conclusion at the time.
- `docs/decisions/0079-tx-cache-poison-scrub-and-retry-automation.md` — the ADR most directly contradicted (its §Context/§Consequences claim of "a genuine live stall on `tx.fhir.org`'s side").
- `build-and-deploy.sh` lines ~71–85 — the `IG_PUBLISHER_TIMEOUT` doc naming the ~400k-concept IPS intensional SNOMED expansion as the specific observed stall point — the largest-payload TX call in the project, consistent with an MTU/fragmentation explanation.
- `tools/validate.sh`, `build-and-deploy.sh` — code changes described in this ADR (retry loops removed, unconditional validator-service restart removed).
