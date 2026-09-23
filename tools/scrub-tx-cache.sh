#!/bin/bash
# Removes cached terminology-server error responses ("poisoned" entries)
# from the FHIR Validator's -txCache directory (tools/.tx-cache/, shared
# with validator-service via the docker-compose mount).
#
# The validator's on-disk cache stores every terminology lookup response
# verbatim, including transient errors (an expired $cache-control session,
# a SocketTimeoutException) — regardless of whether the error originated
# server-side or from a bad local network path (ADR-0080 traced most of
# this project's observed cases to the latter: a VPN tunnel on the
# developer's machine, not tx.fhir.org). Once cached, that specific code
# returns the identical error forever with no further network call — a
# single bad response becomes a permanent local failure (see ADR-0071/
# ADR-0079/ADR-0080, which record the caching trade-off in full). This
# script re-opens each *.cache file, drops any record whose cached value
# contains "class" : "SERVER_ERROR", and rewrites the file so the next
# lookup for that code gets a fresh shot at the network. Safe to run
# anytime the validator_cli.jar process itself isn't actively writing to
# the cache; do not run this against a live validator-service container
# without stopping it first (it periodically flushes its in-memory cache
# back to disk and will silently overwrite this script's changes
# otherwise). Run on demand (no longer wired into every build-and-deploy.sh
# invocation — see ADR-0080).
#
# Usage: ./tools/scrub-tx-cache.sh [cache-dir]   (default: tools/.tx-cache)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR="${1:-$SCRIPT_DIR/.tx-cache}"
# No trailing-$ anchor: the cache files have CRLF line endings, and a bare
# $ anchor after \{80,\} fails to match past the trailing \r on plain grep.
# No other line in these files plausibly starts with 80+ dashes, so the
# leading anchor alone is unambiguous.
POISON_MARKER='"class" : "SERVER_ERROR"'
DELIM_RE='^-\{80,\}'

[ -d "$CACHE_DIR" ] || { echo "  (no tx cache at $CACHE_DIR — nothing to scrub)"; exit 0; }

TOTAL_REMOVED=0

for f in "$CACHE_DIR"/*.cache; do
  [ -f "$f" ] || continue

  # Records are bounded on each side by a delimiter line (86 dashes); the
  # file always ends with a trailing delimiter and no content after it, so
  # N delimiters bound N-1 records.
  DELIMS=()
  while IFS= read -r ln; do
    DELIMS+=("$ln")
  done < <(grep -n "$DELIM_RE" "$f" | cut -d: -f1)
  [ "${#DELIMS[@]}" -ge 2 ] || continue

  TMP="$(mktemp)"
  removed=0
  last_idx=$((${#DELIMS[@]} - 1))
  for ((i = 0; i < last_idx; i++)); do
    start=$((DELIMS[i] + 1))
    end=$((DELIMS[i + 1] - 1))
    if [ "$start" -le "$end" ] && sed -n "${start},${end}p" "$f" | grep -qF "$POISON_MARKER"; then
      removed=$((removed + 1))
      continue
    fi
    sed -n "${DELIMS[i]},${end}p" "$f" >> "$TMP"
  done
  # Trailing delimiter that closes the file.
  sed -n "${DELIMS[$last_idx]}p" "$f" >> "$TMP"

  if [ "$removed" -gt 0 ]; then
    mv "$TMP" "$f"
    echo "  scrubbed $removed poisoned entr$([ "$removed" -eq 1 ] && echo y || echo ies) from $(basename "$f")"
  else
    rm -f "$TMP"
  fi
  TOTAL_REMOVED=$((TOTAL_REMOVED + removed))
done

if [ "$TOTAL_REMOVED" -gt 0 ]; then
  echo "  tx-cache scrub: removed $TOTAL_REMOVED poisoned entries total (will be re-fetched from tx.fhir.org on next use)"
fi
