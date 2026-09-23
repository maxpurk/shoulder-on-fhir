# ADR-0119: Raise validator-service and HAPI container memory ceilings to stop recurring OOM kills

**Date:** 2026-07-30
**Status:** Accepted
**Builds on:** ADR-0051 (validator-service sidecar creation, first flagged the memory footprint concern), ADR-0071 (documented idle heap already at ~77–89% utilized against the 1.5GB `-Xmx`, left the concern open)

## Context

An end-to-end QA pass submitted a single realistic 45-entry Registration bundle (~90KB) to the live `validator-service` sidecar exactly as the frontend's `preflightValidate` would. The container's `java` process was killed mid-request. `docker inspect` showed the container had auto-restarted (`RestartCount=1`) via its `restart: unless-stopped` policy, and `dmesg` confirmed the cause: `Memory cgroup out of memory: Killed process ... (java) ... anon-rss:2091268kB` — a hard cgroup OOM kill, not a catchable `OutOfMemoryError` inside the JVM.

`dmesg` showed **12 such kills over the preceding 18 days**, all cgroup-scoped to `validator-service` (anon-rss consistently ~2.08–2.09GB, matching its `mem_limit: 2g` ceiling exactly) — this is a recurring production issue independent of this particular test, not a one-off caused by an unusually large bundle. No other container's process appeared in any OOM kill message; `shoulder-hapi-fhir` (the next-largest consumer) has never been killed.

Root cause, confirmed via `docker stats`: the container idles at **1.544GiB / 2GiB (77%)**, matching the ⚠️ already flagged in ADR-0071's Consequences section ("the JVM heap was already ~77–89% utilized at idle") — this ADR closes that previously-open concern rather than discovering a new one. Two compounding factors:

1. **`-Xmx1500m` inside a `mem_limit: 2g` container** leaves only ~500MB for everything the JVM needs *outside* the heap: metaspace (uncapped — no `-XX:MaxMetaspaceSize` was set), thread stacks, G1GC's native bookkeeping, JIT code cache, and HTTP client buffers for live `tx.fhir.org` terminology calls.
2. **The idle baseline itself is heavy.** The engine's startup log shows five different versions of `hl7.terminology(.r4)` loaded simultaneously (6.2.0, 6.3.0, 6.5.0, 7.1.0 under both r4 and r5) — roughly 20,000 CodeSystem/ValueSet resources in heap from redundant transitive package versions before a single request arrives. This is the FHIR validator's package loader not deduplicating across the IG dependency graph (`eu.base`, `xver-r5`, project IG each pin their own preferred `hl7.terminology` version) — a separate, harder problem not addressed by this ADR (see Alternatives).

With heap already ~77% full at idle, a single moderately-sized bundle's validation (snapshot generation + terminology binding checks) is enough to push total process RSS past the 2GB cgroup ceiling.

Separately, `hapi-fhir` (the storage tier) currently has **no `mem_limit` at all** — unbounded, observed comfortably using ~2.0GB of the host's 7.6GB. It has never been OOM-killed. But on a host with **zero configured swap**, an entirely unbounded container is its own latent risk: unchecked growth (e.g. under real registry load, larger than this demo has seen) could consume enough host memory to trigger a *host-wide* OOM kill, which — unlike a cgroup-scoped kill — could target any process, including `postgres`. Checked its entrypoint (`docker inspect` on the image): HAPI's container runs `java --class-path ... org.springframework.boot.loader.PropertiesLauncher` directly, no shell wrapper — so a `JAVA_OPTS` environment variable would be silently ignored, but `JAVA_TOOL_OPTIONS` is read natively by the `java` launcher itself regardless of invocation style, confirmed via the JDK's own documented behavior.

Host budget: 7.6GB total RAM, 0 swap. At the time of this ADR, all containers combined used ~3.8GB.

## Decision

1. **`validator-service`**: `mem_limit` raised `2g` → `3g`; `JAVA_OPTS` changed from `-Xmx1500m -XX:+UseG1GC` to `-Xmx2200m -XX:MaxMetaspaceSize=400m -XX:+UseG1GC`. Budget: 2200m heap + 400m metaspace ceiling = 2600m, leaving ~400m headroom within the 3g cgroup for threads/GC-native/JIT/HTTP buffers — roughly the same proportional headroom the original `1500m` heap had in its `2g` box, but at a scale that survives a full-size real bundle.
2. **`hapi-fhir`**: given an explicit `mem_limit: 3g` (previously unbounded) plus a matching `JAVA_TOOL_OPTIONS=-Xmx2200m -XX:MaxMetaspaceSize=400m -XX:+UseG1GC`, deliberately set together so the new cgroup ceiling doesn't cause the JVM's container-aware default heap sizing (`-XX:+UseContainerSupport`, JDK 10+ default-on, confirmed JDK 21 here) to recalculate a smaller default heap off the new smaller cgroup than it currently enjoys off the full host — that would have been a silent regression.
3. Neither `postgres` nor either frontend/Caddy container was changed — none has shown any memory distress (postgres ~170MB, frontends/Caddy each under 35MB).

Worst-case combined ceiling if both `validator-service` and `hapi-fhir` peaked simultaneously: 3g + 3g = 6g, plus postgres/frontends/Caddy (~500MB combined) ≈ 6.5GB of the 7.6GB host, leaving roughly 1.1GB for the OS/kernel/Docker daemon. Tighter than ideal for zero-swap, but both peaking together is unlikely at this project's actual traffic (a handful of demo users, not concurrent production load) and is a straightforward `mem_limit` adjustment to revisit if real usage patterns change.

## Alternatives Considered

| Alternative | Why not chosen (now) |
|---|---|
| Deduplicate the five loaded `hl7.terminology` package versions at the source (fix the IG dependency graph so only one version loads) | The actual fix for the *heavy idle baseline*, not just its symptom — but requires reconciling version pins across `hl7.fhir.eu.base`, `hl7.fhir.uv.xver-r5.r4`, and the project IG's own dependencies, a separate and larger investigation. Logged as a follow-on in `docs/limitations_items/`; this ADR takes the faster, lower-risk path of giving the current footprint more room rather than shrinking the footprint itself. |
| Raise `mem_limit` without raising `-Xmx` to match | Rejected outright — the container ceiling only helps if the heap can actually grow into it; leaving `-Xmx1500m` unchanged inside a bigger box does nothing for the crash this ADR fixes. |
| Give `hapi-fhir` a `mem_limit` without also setting `JAVA_TOOL_OPTIONS` | Investigated and rejected: JDK 21's container-aware ergonomics would auto-detect the new, smaller cgroup ceiling and could size the default heap as a fraction of *that* (e.g. 25% of 3g ≈ 768MB) — materially smaller than the ~2.0GB HAPI currently uses comfortably off the unbounded host, a likely performance regression or a newly-introduced OOM risk of its own. |
| Leave `hapi-fhir` unbounded | Works today (never crashed), but is a latent host-wide risk on a zero-swap machine — an unbounded container's growth isn't stopped by its own cgroup, so a spike could trigger the *global* OOM killer, which can pick any process, not just the one that grew. Bounding it now, while it's not in distress, is cheaper than diagnosing a host-wide outage later. |

## Consequences

✅ Closes 12 confirmed recurring production OOM kills of `validator-service` — the sidecar can now validate a full-size real Registration bundle (the largest either frontend produces) without crashing.
✅ `hapi-fhir` gains an explicit, generous ceiling instead of unbounded host access, removing a latent host-wide-OOM risk on this zero-swap machine, without a heap-sizing regression (verified via matching `-Xmx` set together with the new `mem_limit`).
⚠️ Does not address the root cause of the heavy idle baseline (five redundant `hl7.terminology` package versions) — this ADR buys headroom, it doesn't shrink the footprint. Logged in `docs/limitations_items/` as a follow-on.
⚠️ Combined worst-case ceiling (6g across the two largest containers) leaves proportionally less host headroom than before if both services were ever simultaneously maxed — acceptable at current traffic; revisit if usage grows.

## Sources

- `docker-compose.yml` — `validator-service` and `hapi-fhir` service definitions, `mem_limit`, `JAVA_OPTS`/`JAVA_TOOL_OPTIONS`.
- `dmesg` on the deployment server — 12 `Memory cgroup out of memory: Killed process ... (java)` entries, all matching `validator-service`'s prior 2GB ceiling.
- `docker stats` — idle memory percentages at time of diagnosis (`validator-service` 77.18%, `hapi-fhir` 26.72% of host with no own limit).
- `docker inspect hapiproject/hapi:v8.8.0-1` — confirmed entrypoint invokes `java` directly (no shell wrapper reading `JAVA_OPTS`), and `JAVA_VERSION=21.0.10`.
- ADR-0051, ADR-0071 — prior sidecar design and the originally-flagged, previously-unresolved idle-heap-utilization concern this ADR closes.
