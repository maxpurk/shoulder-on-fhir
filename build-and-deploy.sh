#!/bin/bash
# Layered, incremental build + deploy for Shoulder on FHIR.
#
# Default behaviour is the cheapest: bring containers up (or leave them up),
# let every idempotent loader short-circuit, return in seconds. Each expensive
# stage is opt-in via a flag. Postgres is preserved unless --clean.
#
# Stages (in order; cheap stages always run, expensive ones gated):
#
#   --clean              docker compose down -v --remove-orphans (wipe DB+volumes).
#                        Also implies --rebuild-frontends so a stale image can't
#                        serve JS that's behind the source — "from scratch" means
#                        from scratch (otherwise a Vite bundle baked into an older
#                        image will silently leak old code into the fresh stack).
#   --full               True end-to-end "everything from scratch": implies
#                        --clean + --genonce + --validate AND passes --no-cache
#                        to docker compose build so even Docker layer cache is
#                        bypassed. Use when you want zero possibility of stale
#                        state anywhere (≈ 17.5 min warm / ≈ 21 min cold, measured
#                        on the deployment server). For routine work, --clean is enough.
#   --genonce            (implies a profile reload)
#                        full HTML IG build (slow; default off). Runs the HL7 IG
#                        Publisher (hl7fhir/ig-publisher-base) in Docker so the
#                        host doesn't need Java/Ruby/Jekyll (ADR-0004). Heap size
#                        is IG_PUBLISHER_HEAP env var (default 3g — kept under
#                        Docker's 3.8 GB VM cap on 8 GB hosts). Verified peak
#                        heap use for this IG's dependency graph is ~1.5 GB, so
#                        3g has ~2× headroom while leaving room for container
#                        native overhead inside the VM.
#   --publish            (implies --genonce)
#                        publication build: passes -publish <canonical> to the IG
#                        Publisher, reading the canonical from ig/sushi-config.yaml.
#                        Without it the Publisher writes a file:// path into every
#                        package.json url and marks all four packages
#                        notForPublication, so a package built without this flag
#                        declares itself unpublishable. Use it for the packages
#                        committed under ig/output/; a routine build does not need it.
#   (sushi)              run sushi if FSH is newer than fsh-generated/, OR
#                        --reload-ig / --genonce is set (both force a recompile)
#   --validate           run FHIR Validator CLI (validator_cli.jar)
#   --rebuild-frontends  docker compose build {frontend services}
#   --rebuild-validator  rebuild the validator-service image (ADR-0051). Implicit
#                        on --clean. Use after bumping the pinned validator_cli.jar
#                        in tools/ or changing validator-service/.
#   (up -d)              always — cheap if already running
#   (load-base-profiles) idempotent: skips if base Patient SD already in HAPI
#   (load-eu-base)       idempotent: skips if Address-eu SD already in HAPI
#                        — ADR-0042 (loader retained for $validate / CI per
#                        ADR-0044's deferral of the runtime gate)
#   (load-uv-extensions) idempotent: skips if individual-recordedSexOrGender
#                        SD already in HAPI — ADR-0053
#   (load-ips-package)   idempotent: skips if current-smoking-status-uv-ips
#                        VS already in HAPI — ADR-0056 (closes runtime gap
#                        in ADR-0055 comorbidity typeahead)
#   (load-profiles)      idempotent: skips if rotator-cuff-follow-up-bundle present
#                        — also bypassed by FORCE_RELOAD=true on --reload-ig
#   (HAPI restart)       if any of the three loaders changed state, OR --clean
#                        (search-index lag makes the delta unreliable on a cold stack)
#   (term refresh)       only after a restart: $reindex-terminology rebuilds the
#                        tmpfs Lucene index from postgres, then $invalidate-expansion
#                        on every IG ValueSet so the next pre-expand runs cleanly
#   (longitudinal seed)  each subdirectory of seed/bundles/ is a self-contained
#                        longitudinal patient case (N sequential transaction
#                        bundles, registration → surgery → follow-ups). Every
#                        case is auto-discovered and loaded idempotently — skips
#                        a case if its bundle #1 Patient identifier is already
#                        in HAPI. Currently: seed/bundles/anna-mueller/
#                        (PAT-LONG-001) and seed/bundles/kemal-demir/
#                        (PAT-LONG-002).
#   --skip-seed          don't load the longitudinal patient cases (seed stage)
#   --no-logs            don't open the Terminal log window at the end (macOS only)
#   --trace              set -x for the whole script
#
# Costs (rule of thumb; wall-clock figures measured 2026-07-31 on the deployment server):
#   --clean              ≈ 7–8.5 min (full nuke + frontend image rebuilds; the
#                                     bulk is HAPI-local SD/CS loading + restart)
#   --full               ≈ 17.5 min warm / ≈ 21 min cold
#                                   (--clean + IG Publisher + Validator + no Docker cache)
#   default (warm)       ≈ 30 s (everything idempotent-skips)
#   --reload-ig          ≈ 30–60 s (sushi + IG profile reload + restart)
#   --rebuild-frontends  ≈ 35–40 s per frontend image
#   --validate           ≈ 3–4 min (current example+seed set; TX-cache warm vs cold)
#   --genonce            ≈ 6–9 min (Docker pull + container start + 2× sushi
#                                   + validate + jekyll site generation)
#
# Env vars:
#   IG_PUBLISHER_HEAP    JVM heap inside the IG Publisher container (default 3g).
#                        Must stay under Docker Desktop's VM memory cap to avoid
#                        container SIGKILL. On hosts with more Docker RAM
#                        allocated, bump it (e.g. IG_PUBLISHER_HEAP=6g).
#   IG_PUBLISHER_TIMEOUT Wall-clock ceiling in seconds for the --genonce Docker run
#                        (default 1800 = 30 min). The deployment server finishes the
#                        publisher in roughly 3 to 6 minutes; a constrained local
#                        Docker VM has been measured at 21:45, which the earlier 900 s
#                        default killed at 15:00 and left ig/output EMPTY. An empty
#                        ig/output is not only a wasted run: the offline test fixtures
#                        resolve profiles from it first, so a false kill breaks work
#                        that has nothing to do with the build. Reproduced 2026-07-11: the
#                        "Validating Resources" stage prints nothing while it makes
#                        synchronous per-code $validate-code/$expand calls to
#                        tx.fhir.org; ShoulderComorbidityCondition.code's extensible
#                        binding to the IPS intensional SNOMED ValueSet
#                        (problems-snomed-absent-unknown-uv-ips, effectively
#                        "<<404684003 minus exclusions", ~400k concepts — by far the
#                        largest single terminology payload anywhere in this project)
#                        was observed to stall for 10+ minutes with zero forward
#                        progress and no distinguishing log output — indistinguishable
#                        from a true hang from the terminal. ADR-0080 (2026-07-17)
#                        traced this to the local dev machine's VPN tunnel silently
#                        stalling large/long-lived connections, not tx.fhir.org itself
#                        (a control run on the deployment server, no VPN in its path, completed
#                        cleanly). Run --genonce over a clean network path rather than a
#                        VPN-constrained one (ADR-0080). The watchdog below stops the
#                        container and fails loudly instead of hanging the shell
#                        indefinitely, regardless of where this runs; use
#                        IG_TX_SERVER=n/a to skip remote TX calls entirely.
#
# Examples:
#   ./build-and-deploy.sh
#   ./build-and-deploy.sh --clean
#   ./build-and-deploy.sh --full                    # everything from scratch
#   ./build-and-deploy.sh --reload-ig
#   ./build-and-deploy.sh --rebuild-frontends frontend
#   ./build-and-deploy.sh --validate --genonce
#   IG_PUBLISHER_HEAP=6g ./build-and-deploy.sh --full   # more heap (needs more Docker VM)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Longitudinal patient cases live under seed/bundles/ — each subdirectory of
# BUNDLES_DIR is one patient case (N sequential transaction bundles). The
# narrative walkthrough for each case lives alongside in example_data/ (e.g.
# anna_mueller_story.md); keep the JSON and the story in sync by hand when a
# story is revised.
BUNDLES_DIR="$SCRIPT_DIR/seed/bundles"

# Portable mtime flag: GNU stat (Linux) uses `-c '%Y'`, BSD stat (macOS) uses `-f '%m'`.
if stat -c '%Y' "$SCRIPT_DIR/build-and-deploy.sh" >/dev/null 2>&1; then
  STAT_MTIME_FMT=(-c '%Y')
else
  STAT_MTIME_FMT=(-f '%m')
fi

# Portable sha256: GNU coreutils ships sha256sum (Linux), macOS ships shasum.
# Used to verify pinned tool downloads (ADR-0194) on either host.
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

CLEAN=false
GENONCE=false
RELOAD_IG=false
REBUILD_FRONTENDS=false
REBUILD_VALIDATOR=false
RUN_VALIDATE=false
SKIP_SEED=false
OPEN_LOGS=true
TRACE=false
NO_CACHE=false  # pass --no-cache to docker compose build (set by --full)
PUBLISH_BUILD=false  # pass -publish <canonical> to the IG Publisher (set by --publish)
FRONTENDS_TO_REBUILD=()  # populated if --rebuild-frontends has positional args

# ─── help ─────────────────────────────────────────────────────────────────────
show_help() {
  # Print the top-of-file doc block (everything until the first non-comment line).
  awk 'NR>1 && /^[^#]/ {exit} NR>1 {sub(/^# ?/, ""); print}' "$0"
}

# ─── flag parsing ─────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --clean)              CLEAN=true ;;
    --full)               CLEAN=true; GENONCE=true; RUN_VALIDATE=true; NO_CACHE=true ;;
    --genonce)            GENONCE=true ;;
    --publish)            PUBLISH_BUILD=true; GENONCE=true ;;
    --reload-ig)          RELOAD_IG=true ;;
    --rebuild-frontends)
      REBUILD_FRONTENDS=true
      # Any non-flag args after --rebuild-frontends are frontend service names.
      shift
      while [ $# -gt 0 ] && [[ "$1" != --* ]]; do
        FRONTENDS_TO_REBUILD+=("$1")
        shift
      done
      continue
      ;;
    --validate)           RUN_VALIDATE=true ;;
    --rebuild-validator)  REBUILD_VALIDATOR=true ;;
    --skip-seed)          SKIP_SEED=true ;;
    --no-logs)            OPEN_LOGS=false ;;
    --trace)              TRACE=true ;;
    -h|--help)            show_help; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Run with --help for usage." >&2
      exit 2
      ;;
  esac
  shift
done

[ "$TRACE" = true ] && set -x

cd "$SCRIPT_DIR"

# ─── 0. (opt-in) Clean ────────────────────────────────────────────────────────
if [ "$CLEAN" = true ]; then
  echo ""
  echo "==> CLEAN  Wiping all generated state (containers, volumes, sushi output)"
  docker compose down -v --remove-orphans 2>/dev/null || true
  rm -rf "$SCRIPT_DIR/ig/fsh-generated"
  rm -rf "$SCRIPT_DIR/ig/output"
  rm -rf "$SCRIPT_DIR/ig/temp"
  rm -rf /tmp/fsh-expanded
  # "From scratch" must include the frontend images, otherwise the Vite bundle
  # baked into the previously-built image leaks old JS into the fresh stack
  # (e.g. a datetime conversion fix in src/ that never made it past `docker
  # build`). Forcing the rebuild here removes a whole class of stale-deploy bugs.
  REBUILD_FRONTENDS=true
  echo "  Done — clean slate. (--clean implies --rebuild-frontends.)"
fi

# ─── 1. Sushi (mtime-driven) ──────────────────────────────────────────────────
# Re-compile FSH if:
#   * fsh-generated/resources/ is missing entirely
#   * any .fsh under ig/input/ is newer than fsh-generated/resources/
#   * --reload-ig is set (force)
#   * --genonce is set (publisher needs fresh fsh-generated/ output)
needs_sushi=false
if [ ! -d "$SCRIPT_DIR/ig/fsh-generated/resources" ]; then
  needs_sushi=true
elif [ "$RELOAD_IG" = true ] || [ "$GENONCE" = true ]; then
  needs_sushi=true
else
  newest_fsh=$(find "$SCRIPT_DIR/ig/input" -name '*.fsh' -type f -print0 2>/dev/null \
               | xargs -0 stat "${STAT_MTIME_FMT[@]}" 2>/dev/null | sort -nr | head -1)
  newest_gen=$(find "$SCRIPT_DIR/ig/fsh-generated/resources" -name '*.json' -type f -print0 2>/dev/null \
               | xargs -0 stat "${STAT_MTIME_FMT[@]}" 2>/dev/null | sort -nr | head -1)
  if [ -n "$newest_fsh" ] && { [ -z "$newest_gen" ] || [ "$newest_fsh" -gt "$newest_gen" ]; }; then
    needs_sushi=true
  fi
fi

if [ "$needs_sushi" = true ]; then
  echo ""
  echo "==> SUSHI  Compiling FSH → JSON"
  ( cd "$SCRIPT_DIR/ig" && sushi . )
else
  echo ""
  echo "==> SUSHI  fsh-generated/ is up-to-date — skipping. (--reload-ig forces a recompile.)"
fi

# ─── 1.25 IG Publisher (opt-in via --genonce) ─────────────────────────────────
# Docker-based to avoid requiring Java + Ruby + Jekyll on the host (ADR-0004).
# Heap is constrained by IG_PUBLISHER_HEAP (default 3g) — must stay under the
# Docker VM's memory cap or the container gets SIGKILL'd before the JVM hits
# its own heap ceiling. Verified peak heap use is ~1.5 GB, so 3g is comfortable
# inside a 3.8 GB Docker VM.
if [ "$GENONCE" = true ]; then
  echo ""

  # Stop the app stack (if running) before the build so Jekyll/IG Publisher
  # gets exclusive use of the host's CPUs. Running concurrently with HAPI +
  # validator-service (both JVMs) causes severe contention — observed load
  # average 27 on a 4-vCPU deployment server, which made Jekyll blow through its
  # own hardcoded 300s timeout (reproduced 2026-07-12). `stop` (not `down`)
  # preserves volumes/data; stage 2 below ("docker compose up -d") always
  # runs right after this block and brings everything back automatically.
  if [ -n "$(docker compose ps -q 2>/dev/null)" ]; then
    echo "==> STOP   Stopping app stack for the duration of the IG build (frees CPU for Jekyll; restarted automatically right after)"
    docker compose stop
  fi

  cd "$SCRIPT_DIR/ig"

  # Pinned, not "latest" — ADR-0194 applied to the tool that renders the guide.
  # The upstream _updatePublisher.sh resolves the GitHub releases/latest alias,
  # so which Publisher built a given site depended on when a host happened to
  # fetch it. input-cache/ is the one piece of ig/ state --clean does NOT wipe,
  # so that version then stuck to the host for the life of its checkout and
  # moved only on a from-scratch rebuild — the drift was invisible precisely
  # because nothing ever wiped it.
  #
  # Fetching the release directly also retires the self-overwrite race the
  # delegation carried: _updatePublisher.sh downloads a fresh copy of itself
  # mid-run over its own path, which corrupted bash's parse of the
  # still-executing script on a genuinely fresh clone (reproduced 2026-08-01).
  #
  # To move up: bump both values together, run --genonce, and read qa.html
  # before trusting the output.
  PUBLISHER_VERSION="2.3.4"
  PUBLISHER_SHA256="970922c12eb583bfb4cb6121584b922a236d5904e36413e3545d2fbc248f8e2b"
  PUBLISHER_JAR="./input-cache/publisher.jar"
  if [ ! -f "$PUBLISHER_JAR" ]; then
    echo "  Publisher jar absent — fetching pinned ${PUBLISHER_VERSION}"
    mkdir -p ./input-cache
    curl -fL --progress-bar -o "$PUBLISHER_JAR" \
      "https://github.com/HL7/fhir-ig-publisher/releases/download/${PUBLISHER_VERSION}/publisher.jar"
  fi
  # Verified on every run, not only after a download: a jar left behind by an
  # earlier unpinned fetch is exactly what this pin exists to catch.
  PUBLISHER_ACTUAL="$(sha256_of "$PUBLISHER_JAR")"
  if [ "$PUBLISHER_ACTUAL" != "$PUBLISHER_SHA256" ]; then
    echo "ERROR: ig/input-cache/publisher.jar is not the pinned ${PUBLISHER_VERSION} build." >&2
    echo "  expected sha256 $PUBLISHER_SHA256" >&2
    echo "  actual   sha256 $PUBLISHER_ACTUAL" >&2
    echo "  Delete ig/input-cache/publisher.jar and re-run to fetch the pinned release." >&2
    echo "  Likely cause: ig/_updatePublisher.sh, which fetches releases/latest and is" >&2
    echo "  not pinned. input-cache/ survives --clean, so an old jar persists until deleted." >&2
    exit 1
  fi
  echo "  Publisher jar verified (${PUBLISHER_VERSION})"

  IG_HEAP="${IG_PUBLISHER_HEAP:-3g}"
  # TX server for ValueSet expansion in the rendered IG site (ADR-0052,
  # mirroring ADR-0049's validator-side flip). Default to HL7's public TX
  # so SNOMED-bound ValueSets render with concept tables / display strings.
  # Override with IG_TX_SERVER=n/a for offline builds (accepts ugly IG site).
  IG_TX_SERVER="${IG_TX_SERVER:-https://tx.fhir.org/r4}"
  echo "==> IG-PUB Building HTML IG via Docker (hl7fhir/ig-publisher-base, -Xmx${IG_HEAP}, -tx ${IG_TX_SERVER})"

  # Bind-mount the FHIR cache instead of using a Docker named volume: named
  # volumes are root-owned at creation, but the container runs as a non-root
  # user (the baked-in "publisher" account — see the entrypoint note below) and
  # cannot write to them. A host directory owned by the current user works.
  FHIR_CACHE="${HOME}/.fhir-ig-publisher"
  mkdir -p "$FHIR_CACHE/packages"

  # The image's entrypoint (docker-entrypoint.sh) tries to remap its baked-in
  # "publisher" user (UID 1001) to match the mounted ig/ dir's owner via
  # `usermod -u $(stat -c %u ig/) publisher`, then runs everything as that
  # user via gosu. On a Mac dev host (non-root user) this succeeds and just
  # works. On a Linux server run as root, the remap target is UID 0 — which
  # `usermod` refuses (UID 0 already belongs to root, and it won't create a
  # second, non-unique UID-0 account) — so the remap silently fails, the
  # entrypoint swallows the error, and "publisher" is left at its default
  # UID 1001, which then can't write into these root-owned (mode 755)
  # directories: "Unable to get file lock" on every package + "EACCES:
  # permission denied, rmdir 'fsh-generated/data'" (reproduced 2026-07-12
  # on the deployment server, deterministic every run). Widening permissions
  # here is a no-op on Mac (owner already has full access) and fixes the
  # root-host case.
  chmod -R o+rwX "$FHIR_CACHE" "$SCRIPT_DIR/ig" 2>/dev/null || true

  # Wipe Publisher's per-build temp/ to avoid Jekyll picking up stale pages
  # for resources later removed from the FSH source. Example: HandDominanceCS
  # was removed in commit 70166eb, but temp/pages/en/CodeSystem-hand-dominance-cs.html
  # lingered and still referenced an include (CodeSystem-hand-dominance-cs-history-en.xhtml)
  # the current build no longer regenerates — Jekyll dies on the dangling Liquid include.
  # The Publisher rebuilds temp/ from scratch every run, so wiping costs nothing.
  # The package cache in $FHIR_CACHE is preserved.
  rm -rf "$SCRIPT_DIR/ig/temp"

  # Named container so the watchdog below can target it with `docker stop`
  # without racing another concurrent run.
  IG_PUBLISHER_TIMEOUT="${IG_PUBLISHER_TIMEOUT:-1800}"

  # ADR-0080: this used to retry automatically (IG_PUBLISHER_MAX_ATTEMPTS,
  # scrubbing tools/.tx-cache between attempts) on the theory that a bad
  # tx.fhir.org session might clear on a fresh retry. Root-caused 2026-07-17:
  # the stalls this was working around traced to the local dev machine's VPN
  # tunnel, not tx.fhir.org (a control run on the deployment server, no VPN in its path,
  # completed cleanly in 85s) — retrying over a broken local network path
  # doesn't help, it just spends the timeout twice. Single attempt now; run
  # --genonce over a clean network path, not a VPN-constrained one (ADR-0080).
  # One scrub still runs first, cheap hygiene against a stale cache entry.
  if [ "$IG_TX_SERVER" != "n/a" ]; then
    bash "$SCRIPT_DIR/tools/scrub-tx-cache.sh" "$SCRIPT_DIR/tools/.tx-cache" | sed 's/^/  /'
  fi

  # Without -publish the Publisher has no publication URL to record, so it
  # writes the container's own output path into package.json url and sets
  # notForPublication on all four packages. --publish supplies the canonical
  # from sushi-config.yaml so the committed packages name where they are served.
  PUBLISHER_ARGS=(-ig . -tx "$IG_TX_SERVER")
  if [ "$PUBLISH_BUILD" = true ]; then
    IG_CANONICAL=$(awk '/^canonical:[[:space:]]/ {print $2; exit}' "$SCRIPT_DIR/ig/sushi-config.yaml")
    if [ -z "$IG_CANONICAL" ]; then
      echo "ERROR: --publish given but no canonical found in ig/sushi-config.yaml." >&2
      exit 1
    fi
    echo "==> IG-PUB Publication build: -publish $IG_CANONICAL"
    PUBLISHER_ARGS+=(-publish "$IG_CANONICAL")
  fi

  PUBLISHER_CONTAINER="ig-publisher-run-$$"
  PUBLISHER_EXIT=0
  docker run --rm --name "$PUBLISHER_CONTAINER" \
    -v "$(pwd):/home/publisher/ig" \
    -v "$FHIR_CACHE:/home/publisher/.fhir" \
    -w /home/publisher/ig \
    hl7fhir/ig-publisher-base:latest@sha256:245d363857d76dfb58145a9a1dcd2f138809d2eccf739e285d55439771bc8baf \
    java -Xmx"$IG_HEAP" -jar /home/publisher/ig/input-cache/publisher.jar "${PUBLISHER_ARGS[@]}" &
  PUBLISHER_DOCKER_PID=$!

  # Watchdog: a stalled terminology call can silently hang the Publisher for
  # 10+ minutes with zero console output, indistinguishable from a true hang.
  # Stop the container past the ceiling instead of letting the shell wait
  # forever, regardless of what's causing the stall.
  (
    sleep "$IG_PUBLISHER_TIMEOUT"
    if docker ps -q --filter "name=^${PUBLISHER_CONTAINER}$" | grep -q .; then
      echo ""
      echo "  ⏱ IG Publisher exceeded ${IG_PUBLISHER_TIMEOUT}s — stopping it (see diagnosis below)."
      docker stop "$PUBLISHER_CONTAINER" >/dev/null 2>&1 || true
    fi
  ) &
  WATCHDOG_PID=$!

  wait "$PUBLISHER_DOCKER_PID" 2>/dev/null || PUBLISHER_EXIT=$?
  kill "$WATCHDOG_PID" 2>/dev/null || true
  wait "$WATCHDOG_PID" 2>/dev/null || true

  # Recent IG Publisher builds (observed on 2.2.7) have a known NPE in
  # NpmPackage.loadSubFolders that fires after HTML generation completes,
  # producing a non-zero exit despite a complete build. The image is pulled as
  # :latest, so the exact version drifts; this check keys on output existence,
  # not a version string. Treat as a warning when output exists; hard-fail only
  # if absent.
  if [ ! -f "./output/index.html" ]; then
    echo "  ✗ IG Publisher failed — output/index.html missing."
    if [ "$PUBLISHER_EXIT" -eq 143 ] || [ "$PUBLISHER_EXIT" -eq 137 ]; then
      echo "    Stopped by the ${IG_PUBLISHER_TIMEOUT}s watchdog. If you're running this"
      echo "    locally, this is very likely a local network-path issue (e.g. a VPN"
      echo "    tunnel) stalling tx.fhir.org calls — not tx.fhir.org itself (ADR-0080)."
      echo "    Run --genonce on the deployment server instead, or:"
      echo "    Try: IG_TX_SERVER=n/a ./build-and-deploy.sh --genonce   (offline, fast,"
      echo "         renders without SNOMED display strings)"
      echo "    Or:  IG_PUBLISHER_TIMEOUT=1800 ./build-and-deploy.sh --genonce   (wait longer)"
    else
      echo "    See logs above."
    fi
    exit "${PUBLISHER_EXIT:-1}"
  fi
  if [ "$PUBLISHER_EXIT" -ne 0 ]; then
    echo "  ⚠ Publisher exited $PUBLISHER_EXIT after producing output (known post-build NPE, see comment above). Continuing."
  fi
  cd "$SCRIPT_DIR"
fi

# NOTE: VALIDATE used to run here (before Docker up) with `-tx n/a`. It now
# uses local HAPI as the TX server (in-stack terminology, ADR-0031), so it
# must run after the TERM stage completes. See the post-TERM block below.

# ─── 2. Docker up ─────────────────────────────────────────────────────────────
# Rebuild only requested frontend images; let `up -d` recreate any service
# whose image is newer than its running container.
if [ "$REBUILD_FRONTENDS" = true ]; then
  echo ""
  # ADR-0157: regenerate the synced shared/*.ts copies before the Docker
  # build — each frontend's build context is scoped to its own directory
  # (docker-compose.yml `context: ./frontend` / `./sdc-frontend`), so a
  # stale or missing copy would silently ship old logic (or fail to
  # compile) rather than reflect the canonical shared/ source.
  echo "==> SYNC   Regenerating shared/*.ts copies (tools/sync-shared-code.sh)"
  "$SCRIPT_DIR/tools/sync-shared-code.sh"
  BUILD_ARGS=()
  if [ "$NO_CACHE" = true ]; then
    BUILD_ARGS+=(--no-cache)
    NO_CACHE_NOTE=" (--no-cache: Docker layer cache bypassed)"
  else
    NO_CACHE_NOTE=""
  fi
  # bash 3.2 + `set -u` treats an empty array's `[@]` expansion as unbound;
  # the `+`-substitution pattern returns the array contents only when set,
  # avoiding the error when BUILD_ARGS is empty (no --no-cache).
  if [ ${#FRONTENDS_TO_REBUILD[@]} -eq 0 ]; then
    echo "==> BUILD  Rebuilding both frontend images${NO_CACHE_NOTE}"
    docker compose build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} frontend sdc-frontend
  else
    echo "==> BUILD  Rebuilding ${FRONTENDS_TO_REBUILD[*]}${NO_CACHE_NOTE}"
    docker compose build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} "${FRONTENDS_TO_REBUILD[@]}"
  fi
fi

if [ "$REBUILD_VALIDATOR" = true ] || [ "$CLEAN" = true ]; then
  echo ""
  # validator-service/Dockerfile COPYs this in; it's gitignored (~250 MB) and
  # normally already present because tools/validate.sh fetched it once and it
  # persists across incremental deploys. On a from-scratch checkout it has never
  # been fetched at all, so --clean/--full would fail on a genuinely fresh clone
  # (reproduced on the deployment server 2026-08-01: `docker compose build
  # validator-service` failed with COPY ... not found). The version and digest
  # come from tools/validator-pin.sh, the one place they are stated.
  VALIDATOR_JAR="$SCRIPT_DIR/tools/validator_cli.jar"
  # shellcheck source=tools/validator-pin.sh
  . "$SCRIPT_DIR/tools/validator-pin.sh"
  ensure_pinned_validator "$VALIDATOR_JAR" || exit 1
  BUILD_ARGS=()
  [ "$NO_CACHE" = true ] && BUILD_ARGS+=(--no-cache)
  echo "==> BUILD  Rebuilding validator-service image (ADR-0051)"
  docker compose build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} validator-service
fi

# ADR-0079 originally scrubbed tools/.tx-cache and stopped/restarted
# validator-service unconditionally on every invocation here, on the theory
# that tx.fhir.org sessions poison the shared cache often enough to warrant
# it. ADR-0080 (2026-07-17) removed this: the poisoning this was guarding
# against traced to a local VPN tunnel on the dev machine, not tx.fhir.org,
# and TX-dependent testing now runs over a clean network path (ADR-0080)
# where the tunnel is out of the way — so restarting a container (with its
# brief downtime) on every single deploy is no longer worth the cost against
# a now-rare event. If validator-service's cache is ever suspected of
# holding a poisoned entry (symptom: an error that returns instantly, with
# no network delay, and repeats identically on retry), run manually:
#   docker compose stop validator-service && bash tools/scrub-tx-cache.sh && docker compose up -d validator-service

echo ""
echo "==> UP     docker compose up -d"
docker compose up -d

# --clean's `docker compose down -v --remove-orphans` treats caddy as an orphan
# — it's declared only in docker-compose.prod.yml, an overlay this script never
# passes via -f — so a production host loses its reverse proxy entirely (site
# fully unreachable, not just bad-gateway) until something brings it back.
# Restore it automatically whenever the prod overlay is configured on this host
# (reproduced + fixed 2026-07-12 on the deployment server after a --full run).
if [ -f "$SCRIPT_DIR/.env.prod" ] && [ -f "$SCRIPT_DIR/docker-compose.prod.yml" ]; then
  if [ -z "$(docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod ps -q caddy 2>/dev/null)" ]; then
    echo "==> UP     Restoring Caddy (removed as an orphan by --clean; lives only in docker-compose.prod.yml)"
    docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d caddy
  fi
fi

# Wait for HAPI to answer DB-backed queries.
echo "  Waiting for HAPI FHIR to be ready…"
attempts=0
until curl -sf "http://localhost:8080/fhir/DEFAULT/Patient?_count=0" > /dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 30 ]; then
    echo "ERROR: HAPI did not become ready after 5 minutes. Aborting." >&2
    exit 1
  fi
  sleep 10
done
echo "  HAPI is ready."

# Validator sidecar (ADR-0051) — non-blocking. Sidecar is fail-open by design
# (frontends show a banner if it's unreachable), so a slow / failing validator
# doesn't block the rest of the deploy. We poll briefly for visibility.
echo "  Waiting for validator-service /health (non-blocking; fail-open)…"
val_attempts=0
until curl -sf "http://localhost:3500/health" > /dev/null 2>&1; do
  val_attempts=$((val_attempts + 1))
  if [ "$val_attempts" -ge 18 ]; then
    echo "  validator-service not ready after 90 s — continuing. Frontends will show a fail-open banner."
    break
  fi
  sleep 5
done
if [ "$val_attempts" -lt 18 ]; then
  echo "  Validator sidecar is ready."
fi

# ─── 2a. Idempotent loaders ──────────────────────────────────────────────────
# Each script prints its own "already loaded, skipping" line and exits early
# when applicable. We detect whether *anything* actually changed state by
# comparing canonical-resource counts before and after.
sd_count_before=$(curl -s "http://localhost:8080/fhir/DEFAULT/StructureDefinition?_summary=count&_count=0" \
                  | jq -r '.total // 0')
cs_count_before=$(curl -s "http://localhost:8080/fhir/DEFAULT/CodeSystem?_summary=count&_count=0" \
                  | jq -r '.total // 0')

echo ""
echo "==> LOAD   Base R4 StructureDefinitions (ADR-0031)"
bash "$SCRIPT_DIR/seed/load-base-profiles.sh"

echo ""
echo "==> LOAD   EU base + xver-r5 StructureDefinitions (ADR-0042)"
if [ "$RELOAD_IG" = true ]; then
  FORCE_RELOAD=true bash "$SCRIPT_DIR/seed/load-eu-base-profiles.sh"
else
  bash "$SCRIPT_DIR/seed/load-eu-base-profiles.sh"
fi

echo ""
echo "==> LOAD   FHIR UV Extensions pack (ADR-0053)"
# Needed so HAPI can resolve the individual-recordedSexOrGender (RSG)
# extension that the ShoulderPatient slice references (ADR-0053). Sushi
# pulls the UV extensions + terminology packs at IG build time; HAPI did
# not load them until this step was added.
if [ "$RELOAD_IG" = true ]; then
  FORCE_RELOAD=true bash "$SCRIPT_DIR/seed/load-uv-extensions.sh"
else
  bash "$SCRIPT_DIR/seed/load-uv-extensions.sh"
fi

echo ""
echo "==> LOAD   IPS package (ADR-0056)"
# Loads hl7.fhir.uv.ips@1.1.0 (~80 KB) so HAPI can $expand the IPS VS
# canonicals referenced by ShoulderComorbidityCondition (ADR-0055) and
# SmokingStatusObservation (ADR-0056). Despite ADR-0055's original claim,
# HAPI's remote_terminology_service.snomed delegation does NOT resolve
# external ValueSet resources by canonical — the VSs must live in HAPI's
# storage. The SNOMED-system codes inside those VSs are still resolved
# via the remote service at $expand time. See ADR-0056 §Context.
if [ "$RELOAD_IG" = true ]; then
  FORCE_RELOAD=true bash "$SCRIPT_DIR/seed/load-ips-package.sh"
else
  bash "$SCRIPT_DIR/seed/load-ips-package.sh"
fi

# SNOMED fragment seed step retired per ADR-0050. HAPI's
# `remote_terminology_service.snomed` config in hapi/application.yaml now
# delegates SNOMED resolution to https://tx.fhir.org/r4 at runtime, so the
# local fragment CodeSystem is no longer needed for HAPI's $expand. The
# associated scripts (seed/load-snomed-fragment.sh, seed/generate-snomed-
# fragment.sh) were deleted in the same change; recoverable from git history
# if a future closed-network deployment needs them.

echo ""
echo "==> LOAD   IG profiles"
# --genonce forces the reload too. Rebuilding the guide means its resources
# changed, and the loader's own canary would otherwise see the guide already
# present and skip every one of them, leaving the server on the previous
# version of profiles and Questionnaires while ig/output says otherwise. That
# split is silent, and it has cost real debugging time more than once.
if [ "$RELOAD_IG" = true ] || [ "$GENONCE" = true ]; then
  FORCE_RELOAD=true bash "$SCRIPT_DIR/seed/load-profiles.sh"
else
  bash "$SCRIPT_DIR/seed/load-profiles.sh"
fi

# Did anything actually land?
sd_count_after=$(curl -s "http://localhost:8080/fhir/DEFAULT/StructureDefinition?_summary=count&_count=0" \
                 | jq -r '.total // 0')
cs_count_after=$(curl -s "http://localhost:8080/fhir/DEFAULT/CodeSystem?_summary=count&_count=0" \
                 | jq -r '.total // 0')

if [ "$sd_count_after" -ne "$sd_count_before" ] || [ "$cs_count_after" -ne "$cs_count_before" ] || [ "$RELOAD_IG" = true ] || [ "$GENONCE" = true ] || [ "$CLEAN" = true ]; then
  echo ""
  if [ "$CLEAN" = true ]; then
    # PUT-by-id storage lands in postgres immediately but the Lucene search index
    # lags behind, so ?_summary=count returns 0 on both sides of the loaders and
    # the delta-based trigger misfires. After a wipe we know we need a restart
    # regardless — force it. (See ADR-0031 for the TERM-stage rationale.)
    echo "==> RESTART  HAPI (forced after --clean: search-index lag makes ΔSD/ΔCS unreliable on cold stack)"
  else
    echo "==> RESTART  HAPI (validator support chain refresh needed: ΔSD=$((sd_count_after - sd_count_before)), ΔCS=$((cs_count_after - cs_count_before)))"
  fi
  docker compose restart hapi-fhir > /dev/null
  until curl -sf "http://localhost:8080/fhir/DEFAULT/Patient?_count=0" > /dev/null 2>&1; do sleep 5; done
  echo "  HAPI restarted and ready."
  TERM_REFRESH=true
  # ADR-0051: validator sidecar loads the IG package once at startup. When the
  # IG changes (new SDs / CodeSystems hot-loaded into HAPI imply sushi or
  # genonce produced new package content), the sidecar must restart to pick it
  # up. Fail-open: if the sidecar fails to come back, the frontends just show
  # the banner; the deploy is not blocked.
  echo "  Restarting validator-service to pick up new IG package…"
  docker compose restart validator-service > /dev/null 2>&1 || true
  val_attempts=0
  until curl -sf "http://localhost:3500/health" > /dev/null 2>&1; do
    val_attempts=$((val_attempts + 1))
    if [ "$val_attempts" -ge 18 ]; then
      echo "    validator-service did not come back; frontends will show fail-open banner."
      break
    fi
    sleep 5
  done
else
  echo ""
  echo "==> RESTART  Skipping HAPI restart — no new profiles or CodeSystems were uploaded."
  TERM_REFRESH=false
fi

# ─── 2.5. Terminology refresh ────────────────────────────────────────────────
# The TERM logic (reindex Lucene + invalidate IG VS expansions) lives in
# tools/term-refresh.sh so it can also be run standalone after any out-of-band
# HAPI restart that bypassed this script (system reboot, Docker Desktop quit,
# manual `docker compose restart hapi-fhir`, OOM kill). The trigger here flips
# TERM_REFRESH=true on those out-of-band restarts too, by probing a canary
# IG VS for 0 concepts (the symptom of the tmpfs-Lucene-wipe race documented
# in ADR-0053 §Consequences).
if [ "$TERM_REFRESH" = false ]; then
  canary=$(curl -s "http://localhost:8080/fhir/DEFAULT/ValueSet/\$expand?url=https://maxpurk.github.io/shoulder-on-fhir/ValueSet/goutallier-classification" \
           | jq -r '.expansion.total // 0')
  if [ "$canary" = "0" ]; then
    echo ""
    echo "==> TERM   Canary probe returned 0 concepts — HAPI was restarted out-of-band; forcing refresh."
    TERM_REFRESH=true
  fi
fi

if [ "$TERM_REFRESH" = true ]; then
  echo ""
  bash "$SCRIPT_DIR/tools/term-refresh.sh"
fi

# HAPI is configured as a storage server only (see ADR-0031 + docker-compose.yml
# validation block). Design-time conformance is enforced by `tools/validate.sh`
# (FHIR Validator CLI), invoked manually or via this script's --validate flag;
# the IG Publisher's own QA pass (--genonce, output in ig/output/qa.html) is the
# second design-time gate. There is no CI pipeline — both gates are run on
# demand, on the deployment server for the TX-dependent ones (ADR-0080). A production
# deployment would route runtime terminology operations to a dedicated TX server
# (Snowstorm / Ontoserver).

# ─── 2.6 FHIR Validator CLI (opt-in, post-TERM) ───────────────────────────────
# Runs after HAPI is up. NOTE: tools/validate.sh validates against its own
# default TX server, https://tx.fhir.org/r4 (ADR-0049) — build-and-deploy.sh
# does not set TX_SERVER, so this stage has a public TX dependency (override
# with TX_SERVER=n/a for offline). It does NOT use local HAPI as its TX server.
if [ "$RUN_VALIDATE" = true ]; then
  echo ""
  echo "==> VALIDATE  Running FHIR Validator CLI (TX = tx.fhir.org/r4 by default; TX_SERVER=n/a for offline)"
  bash "$SCRIPT_DIR/tools/validate.sh"
fi

# ─── 3. Seed data — longitudinal patient cases ────────────────────────────────
# Every subdirectory of seed/bundles/ is a self-contained longitudinal patient
# case: N sequential transaction bundles (registration → surgery → follow-ups),
# named <slug>_01_registration.json .. <slug>_0N_<phase>.json. Each case is
# auto-discovered and its bundles are POSTed in filename order, but only if its
# own Patient (read from bundle #1) isn't already in HAPI — these aren't
# conditional creates, so re-POSTing an already-loaded case would duplicate
# every non-Patient resource in it.
if [ "$SKIP_SEED" = false ]; then
  echo ""
  echo "==> SEED   Loading longitudinal patient cases"
  if [ -d "$BUNDLES_DIR" ]; then
    shopt -s nullglob
    case_dirs=("$BUNDLES_DIR"/*/)
    shopt -u nullglob
    if [ ${#case_dirs[@]} -eq 0 ]; then
      echo "  (no patient case directories under seed/bundles/ — skipping)"
    fi
    for case_dir in "${case_dirs[@]}"; do
      case_name="$(basename "$case_dir")"
      first_bundle=$(ls "$case_dir"*_01_*.json 2>/dev/null | head -n1)
      if [ -z "$first_bundle" ]; then
        echo "  ⚠ $case_name: no *_01_*.json (registration) bundle found — skipping" >&2
        continue
      fi
      patient_id=$(jq -r '[.entry[]?.resource | select(.resourceType == "Patient") | .identifier[0].value] | first // empty' "$first_bundle")
      if [ -z "$patient_id" ]; then
        echo "  ⚠ $case_name: could not read Patient identifier from $(basename "$first_bundle") — skipping" >&2
        continue
      fi
      existing=$(curl -s "http://localhost:8080/fhir/DEFAULT/Patient?identifier=https://maxpurk.github.io/shoulder-on-fhir/identifier/patient|$patient_id&_summary=count" \
                | jq -r '.total // 0')
      if [ "$existing" -gt 0 ]; then
        echo "  $case_name ($patient_id) already present. Skipping."
      else
        echo "  Loading $case_name ($patient_id)…"
        for bundle in "$case_dir"*_0*.json; do
          name="$(basename "$bundle")"
          http_code=$(curl -s -X POST \
            -H "Content-Type: application/fhir+json" \
            --data @"$bundle" \
            "http://localhost:8080/fhir/DEFAULT" \
            --max-time 180 \
            -o /tmp/seed_bundle_resp.json \
            -w "%{http_code}")
          if [ "$http_code" = "200" ]; then
            entries=$(jq -r '.entry | length' /tmp/seed_bundle_resp.json 2>/dev/null || echo "?")
            echo "  ✓ $name loaded — transaction-response: $entries entries"
          else
            echo "  ✗ $name POST returned HTTP $http_code:" >&2
            jq '[.issue[]? | select(.severity == "error") | .diagnostics] | unique | .[0:5]' /tmp/seed_bundle_resp.json 2>/dev/null >&2
            exit 1
          fi
        done
      fi
    done
  else
    echo "  (no seed/bundles/ directory — skipping)"
  fi
else
  echo ""
  echo "==> SEED   Skipping seed data (--skip-seed)"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  All done!"
echo "  HAPI FHIR:           http://localhost:8080/fhir/DEFAULT"
echo "  Wizard frontend:     http://localhost:3000"
echo "  SDC frontend:        http://localhost:3001  (Registration / Surgery / Follow-Up flows, see ADR-0040)"
echo "  Generic SDC filler:  http://localhost:3002  (template extraction, no knowledge of this guide, see ADR-0192)"
echo "  LHC-Forms filler:    http://localhost:3003  (the same Questionnaires through a third-party engine)"
echo "  (Follow-Up flow is now under  http://localhost:3000/follow-up — see ADR-0035)"
echo "============================================"

# macOS-only: `osascript` opens a log window in Terminal.app. On the Linux
# deployment server osascript doesn't exist, so guard on it — otherwise `set -e`
# would make the whole script exit non-zero on this last line even though all
# the real work already completed. Pass --no-logs to skip regardless of OS.
if [ "$OPEN_LOGS" = true ] && command -v osascript > /dev/null 2>&1; then
  echo ""
  echo "  Opening container logs in a new Terminal window…"
  osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR' && docker compose logs -f\"" > /dev/null
fi
