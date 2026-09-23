# ADR-0194: The build toolchain is pinned, not resolved as "latest"

**Date:** 2026-09-16
**Status:** Accepted
**Found via:** a deliberate erase-and-rebuild of the deployment server. Every
cache, image, volume and the working tree itself were deleted, so every tool the
build fetches was fetched again from scratch. The build then failed on a host
where the identical commit had been running minutes earlier, and a sweep for the
same pattern found three tools resolving a floating alias rather than a version.

## Context

Three tools that together produce the artifact were fetched without a version,
each through an alias that means "whatever is current on the day this host
happened to ask".

**The FHIR Validator CLI.** `tools/validator_cli.jar` is gitignored: at roughly
180 MB it is fetched by `deploy/bootstrap-server.sh` rather than shipped in the
repository, and that script resolved the GitHub `releases/latest` alias. The jar
is not only a command-line tool — `validator-service/src/ValidatorServer.java`
compiles against it (`javac -cp /build/validator_cli.jar`), so the sidecar
depends on the engine's Java API, which is not stable across releases. Release
6.10.4 removed the no-arg `ValidationService()` constructor the server calls:

```
error: no suitable constructor found for ValidationService(no arguments)
    ValidationService svc = new ValidationService();
  constructor ValidationService.ValidationService(RendererFactory) is not applicable
  constructor ValidationService.ValidationService(SessionCache) is not applicable
```

The Docker build fails outright, which aborts `build-and-deploy.sh` under
`set -e`. This is the failure that exposed the pattern.

**The IG Publisher.** `ig/_updatePublisher.sh`, vendored from upstream, fetches
`publisher.jar` from the same `releases/latest` alias. It renders the published
guide. The drift here was the best hidden of the three: `ig/input-cache/` is the
one piece of `ig/` state that `--clean` does not wipe, so whichever Publisher a
host first downloaded stayed with it for the life of its checkout. Only a
from-scratch rebuild moved it — which is to say, the version could not change
and could not be observed to change, until the day the tree was deleted.

**SUSHI.** `deploy/bootstrap-server.sh` ran `npm install -g fsh-sushi`
unversioned. SUSHI compiles the FSH into the StructureDefinitions that *are* the
guide. At the time of this rebuild the deployment server had 3.20.0, the
development machine had 3.19.0, and npm was publishing 3.20.1: three compilers
for one source tree, with nothing recording which had produced what.

Two distinct problems sit behind these. The build breaks when an API changes
under it, and — the quieter one — the tools drift underneath the results the
guide reports. The examples and seed bundles were validated against validator
6.10.0. A host bootstrapped after 2026-09-04 would have revalidated them against
6.10.4 and reported whatever that engine reports, while the guide's own prose
still described the older run. A rebuild meant to reproduce the artifact would
instead have re-measured it against a moving reference.

## Decision

Pin all three, and verify what was fetched rather than trusting the fetch.

| Tool | Pinned to | Where |
|---|---|---|
| FHIR Validator CLI | 6.10.0, sha256 `fc663ae5…` | `tools/validator-pin.sh` |
| IG Publisher | 2.3.4, sha256 `970922c1…` | `build-and-deploy.sh` |
| `hl7fhir/ig-publisher-base` | digest `sha256:245d3638…` | `build-and-deploy.sh` |
| SUSHI | 3.20.0 | `deploy/bootstrap-server.sh` |

Each download URL names a release tag instead of an alias. The two jars carry a
sha256 that is checked on *every* run, not only after a download, so a jar left
behind by an earlier unpinned fetch is rejected rather than silently reused: a
mismatch fails with the expected and actual digests and the instruction to
delete the file and re-run.

**Amended 2026-09-17.** That was true of the Publisher and only half true of the
validator. The validator's version and digest were stated in
`deploy/bootstrap-server.sh`, while `build-and-deploy.sh` and `tools/validate.sh`
each fetched `releases/latest` with no verification, so which validator a host ran
still depended on the day it first needed one, and `tools/validate.sh`, which this
guide's own ADR-0024 names the authoritative design-time gate, verified nothing at
all. The pin now lives in `tools/validator-pin.sh`, which all three source, and the
digest is checked on every run in each of them. The Publisher's base image is pinned by registry
digest. SUSHI's pin compares the installed version and reinstalls at the pinned
one when it differs, so a host cannot quietly keep an older global install.

The verification helper `sha256_of()` is portable across the macOS development
host (`shasum -a 256`) and the Linux server (`sha256sum`).

Two versions were chosen deliberately rather than by default. The validator
stays at **6.10.0**, the engine the examples were validated against: adapting
`ValidatorServer.java` to 6.10.4's constructor would fix the compile break but
would also swap the validation engine underneath results the guide reports,
which is a change to what the artifact claims and not one to make as a side
effect of a rebuild. The IG Publisher moves to **2.3.4**, the current release,
because the old cached jar's version was unknowable once the tree was deleted
and 2.3.4 builds the guide cleanly; pinning it now fixes the version that
actually produced the published site.

## Alternatives Considered

**Adapt `ValidatorServer.java` to the 6.10.4 constructor.** A small code change,
but it addresses only the compile break and leaves the version floating, so the
next API change reintroduces the same failure. See above for why the engine
swap is a separate decision.

**Commit the jars to the repository.** Removes the fetch entirely and guarantees
the bytes, at the cost of roughly 420 MB in a repository mirrored to a public
deployment target. The pin plus digest gives the same guarantee without the
weight.

**Keep the aliases and treat breakage as a signal to upgrade.** Makes every
from-scratch rebuild a coin flip whose outcome depends on the upstream release
calendar, and makes the demonstration server unreproducible on exactly the days
it most needs to come back up.

## Consequences

A from-scratch rebuild now produces the toolchain the artifact was built and
validated with, so `--full` reproduces the system rather than re-measuring it.
Every version is visible in the script instead of being an undocumented property
of when a host was first provisioned, and the digest checks turn silent drift
into a loud failure.

Retiring the `_updatePublisher.sh` delegation also removes a self-overwrite
race it carried: that script downloads a fresh copy of itself mid-run over its
own path, which corrupted bash's parse of the still-executing script on a
genuinely fresh clone (reproduced 2026-08-01) and had needed a run-from-a-copy
workaround.

The cost is that upgrades are now manual. Each tool will sit at its pinned
version until someone bumps it, which is the intended trade: a tool version
becomes a decision with a date attached instead of an accident of provisioning.
The bump procedure is per-tool and recorded at each pin — for the validator,
bump the version and digest, recompile validator-service, and re-run
`tools/validate.sh`; for the Publisher, bump both values and read `qa.html`
before trusting the output.

## Sources

- `deploy/bootstrap-server.sh` — validator and SUSHI pins, digest check.
- `build-and-deploy.sh` — Publisher jar pin, base image digest, `sha256_of()`.
- `validator-service/Dockerfile` — compiles `ValidatorServer.java` against the jar.
- ADR-0051 — the validator-service sidecar and why it must run the same engine
  as the design-time gate.
- ADR-0024 — `tools/validate.sh` as the authoritative design-time gate.
- ADR-0004 — running the IG Publisher in Docker.
