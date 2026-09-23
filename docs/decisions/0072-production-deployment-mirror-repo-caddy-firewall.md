# ADR-0072: Production deployment — deploy-only mirror repo, Caddy, Cloud Firewall

**Date:** 2026-07-12
**Status:** Accepted; the five pieces all stand, and the host and service inventory in §Decision 1–2 has since grown (see §Amendment).

## Amendment (2026-09-18) — what the deployment carries now

The shape of the decision is unchanged: loopback bindings, an additive Compose
overlay, Caddy terminating TLS behind Basic Auth, a deploy-only mirror, host
provisioning, and a network-edge firewall. Three counts below have moved.

1. **Four frontends, not two.** `frontend` (3000), `sdc-frontend` (3001),
   `sdc-generic-frontend` (3002) and `sdc-lforms-frontend` (3003), alongside HAPI
   (8080) and the validator sidecar (3500). All six still bind to `127.0.0.1` only,
   which is the property §Decision 1 exists to state.
2. **Three hosts, not two, and the SDC host multiplexes.** `{$DOMAIN}` serves the
   unified frontend, `{$SDC_DOMAIN}` serves the guide-aware filler at its root with
   the generic filler under `/generic/` and LHC-Forms under `/lforms/` via
   `handle_path`, and `{$IG_DOMAIN}` is a static `file_server` over the built
   `ig/output/`. Path prefixes were chosen over further subdomains so an added
   filler needs no DNS record and no additional certificate. Every host sits behind
   the same Basic Auth.
3. **The mirror repository's visibility is a release-time decision.** §Decision 3
   calls it private, which is what it was while the thesis was unpublished. Its
   "clean history, zero thesis trace" claim is about *file content*: the split
   carries the commit messages of every commit that touched `shoulder_on_fhir/`
   verbatim, and many of those messages name thesis, defense-deck and poster work.
   Publishing the mirror therefore publishes that narration; a squashed or
   rewritten history is the way to avoid it, and the archived snapshot named in the
   thesis carries no history at all.

## Context

The project needed a small, access-controlled public demo of
`shoulder_on_fhir/` (synthetic seed data only — no real patient data, per
the project's standing rule). This is the first time any part of the
repository has been exposed on the public internet, which raised three
problems that hadn't existed for local-only development:

1. **The git repo is not just `shoulder_on_fhir/`.** The development
   repository is a private monorepo that also contains the unpublished
   thesis manuscript, the defense deck, and the poster. A plain `git clone`
   on a public-facing server would put all of that on the box too.
2. **HAPI and both frontends have no production-grade access control of
   their own.** ADR-0044 already established HAPI as a pure storage tier
   with `requests_enabled=false` and no runtime auth; it also ships with
   wide-open CORS. That's fine for local dev, not for a box reachable by
   anyone with the URL.
3. **A fresh Ubuntu VPS has none of the host-level tooling
   `build-and-deploy.sh` assumes** (a development machine has Docker, `jq`,
   Node, and an already-downloaded FHIR Validator jar; a fresh cloud image
   has none of it), and some of that tooling has genuine macOS/Linux
   portability gaps (e.g. `stat -f` vs `stat -c`).

## Decision

Five pieces, together:

1. **`docker-compose.yml` hardened** — HAPI (8080), the validator sidecar
   (3500), and both frontends (3000/3001) bind to `127.0.0.1` only. Nothing
   is directly reachable from outside the host except through the reverse
   proxy below.
2. **`docker-compose.prod.yml` + `deploy/Caddyfile`** — an additive
   compose overlay starts Caddy on 80/443, reverse-proxying the two
   frontend subdomains to the loopback-bound containers above, each behind
   Caddy's `basic_auth`, with automatic Let's Encrypt HTTPS.
3. **A dedicated private deploy-only mirror repo**, produced by
   `git subtree split --prefix=shoulder_on_fhir` from the monorepo and
   force-pushed on demand. The server clones/pulls **only** this mirror,
   never the monorepo — it contains just `shoulder_on_fhir/`'s contents,
   flattened to repo root, with clean history and zero thesis trace. The
   monorepo remains the sole place real edits happen; the mirror is
   regenerated after every change worth deploying.
4. **`deploy/bootstrap-server.sh`** — one-time host provisioning for a
   fresh Ubuntu VPS: Docker + Compose plugin, `jq`, Node.js 20 + SUSHI
   (needed because `fsh-generated/` is gitignored, so a fresh clone has no
   pre-compiled FSH output and must run `sushi` itself), and the FHIR
   Validator CLI jar (~180 MB, gitignored, fetched directly from GitHub
   Releases on the server rather than relayed through a development
   machine).
5. **A cloud-provider network firewall** attached to the server, allowing
   only the ports the reverse proxy and administrative access need and
   default-denying everything else. This is a network-edge safety net
   independent of (1) above — if a future change to `docker-compose.yml`
   ever accidentally widened a binding from `127.0.0.1` to `0.0.0.0`, the
   firewall still blocks external access to that port.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| `git clone` the monorepo directly on the server | Puts the unpublished thesis manuscript, defense deck, and poster on a public-facing box for no reason |
| `rsync shoulder_on_fhir/` straight from a development machine instead of a mirror repo | Used as a stopgap during initial setup — avoids the thesis problem, but ties every deploy to whichever machine last ran the rsync, has no clean "pull to update" workflow, and re-transfers the whole tree each time. Superseded by the mirror repo once it existed. |
| Source-IP-narrowed administrative access | Evaluated against this deployment's actual operating pattern and traded off against the risk of an unrecoverable lockout. The resulting posture, and the compensating controls chosen alongside it, are recorded in the project's private operational documentation rather than here. |
| HAPI-level authentication instead of a reverse-proxy gate | Out of scope — ADR-0044 already decided HAPI stays a pure storage tier with no runtime conformance/auth gate, by design, matching HAPI's own production guidance against `RequestValidatingInterceptor` |

## Consequences

✅ Public demo reachable over valid HTTPS with a shared password gate; zero
risk of thesis content ever touching the server, by construction rather
than by discipline.
✅ Mirror-repo workflow (`git subtree split` + force-push, `git pull` on
the server) is a clean, git-native "ship a new version" path — no more
manual file transfers.
✅ Free, independent network-edge firewall layer that doesn't depend on
Docker Compose bindings staying correct forever.
⚠️ Mirror regeneration is manual/on-demand, not CI-automated — a forgotten
`subtree split` after an edit means the server silently keeps running
stale code with no warning.
⚠️ This is a demonstration deployment, not a production-hardened one. A
security review identified residual host-hardening gaps that were
consciously accepted for a synthetic-data demo and would have to be closed
before any deployment handling real patient data. The specific findings and
their status are tracked in the project's private operational
documentation, deliberately not enumerated in this published record.

## Sources

- `docker-compose.yml`, `docker-compose.prod.yml`, `deploy/Caddyfile`,
  `deploy/bootstrap-server.sh`, `deploy/.env.prod.example`
- git commits `c9dd9a2` (docs: document server deployment split),
  `d436816` (fix: bootstrap-server.sh missing Node/SUSHI install),
  `97a09dd` (prod deploy overlay)
