#!/bin/bash
# Validate FHIR example instances, the SDC Questionnaires and the seed bundle
# against the IG profiles
# using the HL7 FHIR Validator CLI (validator_cli.jar).
#
# Usage:
#   ./tools/validate.sh                    # examples + Questionnaires + seed bundle (default)
#   ./tools/validate.sh --seed-only        # seed bundle only
#   ./tools/validate.sh --only=SUBSTR      # validate only files whose basename contains SUBSTR
#   ./tools/validate.sh --deep             # also validate all StructureDefinitions
#   ./tools/validate.sh --update-validator # re-fetch the pinned validator_cli.jar
#
# Speed: tx.fhir.org responses are cached locally in tools/.tx-cache/ via the
# validator's -txCache flag. First run after a fresh clone is slow (~3 min on
# a clean network path — measured on the deployment server; a VPN-constrained local machine
# can be far slower or stall outright, see ADR-0080), populating the cache;
# subsequent runs are ~10–20× faster because SNOMED lookups don't round-trip.
# Wipe the cache (`rm -rf tools/.tx-cache`) only if a SNOMED code's meaning
# changed at the source — virtually never for a stable release.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VALIDATOR_JAR="$SCRIPT_DIR/validator_cli.jar"
# shellcheck source=validator-pin.sh
. "$SCRIPT_DIR/validator-pin.sh"

OUTPUT_DIR="$SCRIPT_DIR/validation-output"
TX_CACHE_DIR="$SCRIPT_DIR/.tx-cache"
IG_OUTPUT="$PROJECT_ROOT/ig/output"
FSH_GENERATED="$PROJECT_ROOT/ig/fsh-generated/resources"
# Every subdirectory of seed/bundles/ is a longitudinal patient case (see
# build-and-deploy.sh's generalized seed loader); this glob picks up every
# bundle file in every case directory (anna-mueller/, kemal-demir/, ...).
SEED_BUNDLES_GLOB="$PROJECT_ROOT/seed/bundles/*/*.json"

SEED_ONLY=false
DEEP=false
UPDATE_VALIDATOR=false
ONLY_FILTER=""
# Default: run the validator against the HL7 public terminology server
# (`https://tx.fhir.org/r4`) per ADR-0049. This is HL7's official IG-authoring
# / validation / development TX endpoint and is the textbook fit for this
# demonstrator's design-time conformance gate (ADR-0024 / ADR-0044). The IG
# bundles enumerated ValueSet members (ADR-0019) but the validator special-
# cases `http://snomed.info/sct` and requires a real TX server to bind-check
# SNOMED codes that appear in `Questionnaire.answer.valueCoding` — a case the
# `-ig snomed_fragment.json` workaround does not cover (see ADR-0049 §Context).
#
# Override: `TX_SERVER=n/a ./tools/validate.sh` runs offline (plane, air-gap,
# tx.fhir.org genuinely down). Known limitation: SNOMED-in-QR-answer
# bind-checks are skipped — the seed bundle's QRs will surface 12 such
# errors. Documented in ADR-0049 §Consequences.
#
# ADR-0080: on a machine whose network path routes through a VPN, this may
# hang or fail even though tx.fhir.org itself is healthy (confirmed via a
# control test on the deployment server, which has no VPN in its path and completes
# cleanly). Prefer running this script over a clean network path rather
# than a VPN-constrained one for exactly that reason (ADR-0080).
#
# The original ADR-0048 finding still stands: validator_cli.jar 6.9.7+ enforces
# a CapabilityStatement feature-approval check that HAPI's JPA Server does not
# pass ("not approved for use with this software"). Do NOT point `-tx` at
# HAPI. `tx.fhir.org` is unaffected by that check.
TX_SERVER="${TX_SERVER:-https://tx.fhir.org/r4}"

for arg in "$@"; do
  [[ "$arg" == "--seed-only" ]]        && SEED_ONLY=true
  [[ "$arg" == "--deep" ]]             && DEEP=true
  [[ "$arg" == "--update-validator" ]] && UPDATE_VALIDATOR=true
  [[ "$arg" == --only=* ]]             && ONLY_FILTER="${arg#--only=}"
done

mkdir -p "$TX_CACHE_DIR"

# ─── Validator JAR ────────────────────────────────────────────────────────────

if [ "$UPDATE_VALIDATOR" = true ] && [ -f "$VALIDATOR_JAR" ]; then
  echo "  Removing existing validator_cli.jar for update..."
  rm "$VALIDATOR_JAR"
fi

ensure_pinned_validator "$VALIDATOR_JAR"

# ─── Java check ───────────────────────────────────────────────────────────────

if ! command -v java &> /dev/null; then
  echo "ERROR: 'java' not found on PATH. Install Java 11+ to use the FHIR Validator."
  exit 1
fi

# ─── IG Package ───────────────────────────────────────────────────────────────

if [ -f "$IG_OUTPUT/package.tgz" ]; then
  IG_PACKAGE="$IG_OUTPUT/package.tgz"
  echo "  IG package:  ig/output/package.tgz  (IG Publisher build)"
elif [ -d "$FSH_GENERATED" ] && [ "$(ls -A "$FSH_GENERATED" 2>/dev/null)" ]; then
  IG_PACKAGE="$FSH_GENERATED"
  echo "  IG package:  ig/fsh-generated/resources/  (SUSHI-only build fallback)"
else
  echo "ERROR: No IG package found."
  echo "  Run 'sushi .' inside ig/ (SUSHI only) or './build-and-deploy.sh --genonce' (full HTML build) first."
  exit 1
fi

# ─── Output directory ─────────────────────────────────────────────────────────

mkdir -p "$OUTPUT_DIR"

# ─── TX server reachability ───────────────────────────────────────────────────
# The default is `https://tx.fhir.org/r4` (set above, ADR-0049). With
# `TX_SERVER=n/a` the validator runs offline and resolves required-bound
# membership from the IG package's enumerated ValueSets instead. When TX_SERVER
# is a real URL (tx.fhir.org or a Snowstorm endpoint), check reachability before
# launching the validator so we fail fast with a clear message instead of dozens
# of opaque "no terminology services" warnings per resource.
echo "  TX server:   $TX_SERVER"
if [ "$TX_SERVER" != "n/a" ]; then
  if ! curl -sf -o /dev/null --max-time 5 "$TX_SERVER/metadata"; then
    echo "ERROR: TX server '$TX_SERVER' is not reachable." >&2
    echo "  Either start the TX server, set TX_SERVER=n/a to run offline," >&2
    echo "  or point TX_SERVER at a reachable endpoint." >&2
    exit 1
  fi
fi

# SNOMED fragment plumbing retired per ADR-0050. With TX_SERVER=tx.fhir.org/r4
# (the default per ADR-0049), the validator gets SNOMED resolution from the
# TX server directly; the prior `-ig snomed_fragment.json` workaround is
# unnecessary. With TX_SERVER=n/a (offline fallback), SNOMED-in-QR-answer
# bind-checks are skipped — that limitation is documented in ADR-0049
# §Consequences and is unaffected by the fragment's presence.

# ─── Validation runner ────────────────────────────────────────────────────────

TOTAL_ERRORS=0
TOTAL_WARNINGS=0
PASS_COUNT=0
FAIL_COUNT=0
EMPTY_BATCHES=0

# Filter a file list by the --only=SUBSTR flag (basename contains) AND skip
# entries that don't exist on disk (the caller passes shell globs that may
# fail to match anything). Writes results to the FILTERED global array.
filter_by_only() {
  FILTERED=()
  local f
  for f in "$@"; do
    [ -f "$f" ] || continue
    if [ -n "$ONLY_FILTER" ]; then
      case "$(basename "$f" .json)" in
        *"$ONLY_FILTER"*) FILTERED+=("$f") ;;
      esac
    else
      FILTERED+=("$f")
    fi
  done
}

# Validate an entire batch of files in ONE validator JVM invocation. The
# validator returns a `Bundle (type=collection)` whose .entry[N].resource is
# the OperationOutcome for the Nth input file (in the order passed). Per-file
# OK / FAIL lines are reconstructed by parsing that Bundle by index.
#
# Why batch: each JVM startup + IG/EU/xver package load is ~20s. The actual
# per-file validation step is ~0.25s. Running 23 separate invocations spends
# ~7 min on engine init; one batch spends ~20s once. Speedup is ~10×.
#
# Resilience: the validator CLI has no timeout of its own — a stalled
# terminology call can hang the JVM indefinitely with zero output. The
# invocation runs under a background watchdog (VALIDATE_BATCH_TIMEOUT,
# default 300s) that kills the JVM if it's still running past the ceiling,
# so a stall fails cleanly instead of hanging forever. scrub-tx-cache.sh
# runs once before the attempt to drop any previously-poisoned cache entry.
#
# ADR-0080: this used to retry automatically (up to VALIDATE_MAX_ATTEMPTS)
# after a timeout, on the theory that a fresh terminology session might
# succeed where a poisoned/stalled one failed. Root-caused 2026-07-17: the
# stalls traced to this developer machine's VPN tunnel silently dropping
# longer-lived connections to tx.fhir.org, not the server (an identical run
# on the deployment server, no VPN in its path, completed cleanly in 85s). Retrying over a
# broken local network path doesn't fix it — it just spends the timeout
# twice arriving at the same failure. If this fires locally, run this
# script over a clean network path instead (ADR-0080), or set
# TX_SERVER=n/a to validate offline.
validate_batch() {
  local label="$1"; shift
  # An empty batch is only ever legitimate when --only=SUBSTR filtered it out.
  # Without that filter, a declared batch that resolves to zero files means the
  # glob no longer matches what the build produces (e.g. examples were renamed),
  # and staying silent would report success for a category never checked. Say so
  # loudly and fail the run.
  if [ "$#" -eq 0 ]; then
    if [ -z "$ONLY_FILTER" ]; then
      echo "--- $label ---"
      echo "  NO FILES MATCHED — this batch's glob resolves to nothing."
      echo "  A declared batch must never be silently empty; fix the glob in tools/validate.sh."
      echo ""
      EMPTY_BATCHES=$((EMPTY_BATCHES + 1))
    fi
    return
  fi
  local sanitized
  sanitized="$(printf '%s' "$label" | tr ' /' '__')"
  local bundle_file="$OUTPUT_DIR/_batch-${sanitized}.json"

  echo "--- $label ($# file$([ "$#" -gt 1 ] && echo s)) ---"

  local cmd=(
    java -jar "$VALIDATOR_JAR"
    "$@"
    -ig "$IG_PACKAGE"
    -ig "hl7.fhir.eu.base#2.0.0"
    -ig "hl7.fhir.uv.xver-r5.r4#0.1.0"
    -ig "hl7.fhir.uv.ips#1.1.0"
    -version 4.0.1
    -tx "$TX_SERVER"
    -txCache "$TX_CACHE_DIR"
    -output "$bundle_file"
  )

  local batch_timeout="${VALIDATE_BATCH_TIMEOUT:-300}"

  if [ "$TX_SERVER" != "n/a" ] && [ -d "$TX_CACHE_DIR" ]; then
    bash "$SCRIPT_DIR/scrub-tx-cache.sh" "$TX_CACHE_DIR" | sed 's/^/  /'
  fi

  rm -f "$bundle_file"
  "${cmd[@]}" > /dev/null 2>&1 &
  local java_pid=$!

  ( sleep "$batch_timeout"
    if kill -0 "$java_pid" 2>/dev/null; then
      echo "  ⏱ validator exceeded ${batch_timeout}s on '$label' — stopping it."
      echo "     If this is running locally, this is very likely a local network-path issue"
      echo "     (e.g. a VPN tunnel), not tx.fhir.org — see ADR-0080. Run this on the deployment server,"
      echo "     or set TX_SERVER=n/a to validate offline."
      kill "$java_pid" 2>/dev/null
    fi
  ) &
  local watchdog_pid=$!

  wait "$java_pid" 2>/dev/null || true
  kill "$watchdog_pid" 2>/dev/null || true
  wait "$watchdog_pid" 2>/dev/null || true

  if [ ! -f "$bundle_file" ]; then
    echo "  BATCH CRASH (no Bundle output written for $label)"
    FAIL_COUNT=$((FAIL_COUNT + $#))
    TOTAL_ERRORS=$((TOTAL_ERRORS + $#))
    echo ""
    return
  fi

  # The validator writes:
  #   - resourceType=OperationOutcome (with .issue[]) when given exactly 1 file
  #   - resourceType=Bundle (type=collection, .entry[N].resource.issue[]) when given N>1 files
  # Both shapes need to be handled.
  local outcome_type
  outcome_type=$(jq -r '.resourceType' "$bundle_file" 2>/dev/null || echo "")

  local i=0
  local f name errors warnings issues_filter
  for f in "$@"; do
    name="$(basename "$f" .json)"
    if [ "$outcome_type" = "OperationOutcome" ]; then
      issues_filter=".issue[]?"
    else
      issues_filter=".entry[$i].resource.issue[]?"
    fi
    errors=$(jq "[$issues_filter | select(.severity == \"fatal\" or .severity == \"error\")] | length" "$bundle_file" 2>/dev/null || echo 0)
    warnings=$(jq "[$issues_filter | select(.severity == \"warning\")] | length" "$bundle_file" 2>/dev/null || echo 0)
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + warnings))
    if [ "$errors" -gt 0 ]; then
      printf "  %-55sFAIL  (%s error(s), %s warning(s))\n" "$name" "$errors" "$warnings"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      TOTAL_ERRORS=$((TOTAL_ERRORS + errors))
      jq -r "$issues_filter | select(.severity == \"fatal\" or .severity == \"error\") | \"         [\" + .severity + \"] \" + (.location[0] // \"?\") + \" — \" + .details.text" \
        "$bundle_file" 2>/dev/null || true
    else
      printf "  %-55sOK    (%s warning(s))\n" "$name" "$warnings"
      PASS_COUNT=$((PASS_COUNT + 1))
    fi
    i=$((i + 1))
  done
  echo ""
}

# ─── Run validation ───────────────────────────────────────────────────────────

echo ""
echo "==> FHIR Validation"
echo ""

# Examples (from fsh-generated/resources — skip CodeSystems, ValueSets, SDs, IG resource)
if [ "$SEED_ONLY" = false ]; then
  filter_by_only \
    "$FSH_GENERATED"/Patient-*.json \
    "$FSH_GENERATED"/Condition-*.json \
    "$FSH_GENERATED"/Procedure-*.json \
    "$FSH_GENERATED"/Encounter-*.json \
    "$FSH_GENERATED"/Observation-*.json
  validate_batch "Example instances" "${FILTERED[@]}"

  # Match every generated Bundle example, not a name prefix. The earlier
  # `Bundle-Example*.json` glob stopped matching when the examples were renamed
  # to Bundle-Anna*, so this batch silently validated nothing while the summary
  # still reported success — see the empty-batch guard in validate_batch().
  filter_by_only "$FSH_GENERATED"/Bundle-*.json
  validate_batch "Bundle examples" "${FILTERED[@]}"

  # Questionnaires — each form declares an SDC extraction profile in meta.profile
  # (sdc-questionnaire-extr-defn or sdc-questionnaire-extr-template), so the
  # validator checks the form against the profile it claims rather than against
  # base Questionnaire. Without this batch the conformance claim rested on the
  # declaration alone. Note that the extraction extensions themselves are draft
  # in SDC v4.0.0 and the legacy itemExtractionContext is retired, so this batch
  # is expected to carry INFORMATION-level notices while staying error-free.
  filter_by_only "$FSH_GENERATED"/Questionnaire-*.json
  validate_batch "SDC Questionnaires" "${FILTERED[@]}"
fi

# Seed bundles — one directory per longitudinal patient case (seed/bundles/<slug>/),
# each holding N sequential transaction bundles that are individually conformant
# to their own declared bundle profile (registration/surgery/follow-up).
filter_by_only $SEED_BUNDLES_GLOB
validate_batch "Seed bundles" "${FILTERED[@]}"

# Deep mode: all StructureDefinitions
if [ "$DEEP" = true ]; then
  filter_by_only "$FSH_GENERATED"/StructureDefinition-*.json
  validate_batch "StructureDefinitions (deep)" "${FILTERED[@]}"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────

echo "============================================"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "  Errors:  $TOTAL_ERRORS  |  Warnings: $TOTAL_WARNINGS"
if [ "$EMPTY_BATCHES" -gt 0 ]; then
  echo "  Empty batches: $EMPTY_BATCHES  (declared but matched no files — see above)"
fi
echo "  Output:  $OUTPUT_DIR"
echo "============================================"

if [ "$TOTAL_ERRORS" -gt 0 ] || [ "$EMPTY_BATCHES" -gt 0 ]; then
  exit 1
fi
