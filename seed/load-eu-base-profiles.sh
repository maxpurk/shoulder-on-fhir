#!/bin/bash
# Load the EU Base + xver-r5 StructureDefinitions into HAPI.
#
# Why this exists (ADR-0042 / ADR-0044):
#   ADR-0038 aligned the IG with HL7 Europe Base + Core. That introduced two
#   canonical URLs that HAPI's validator must be able to resolve:
#
#     1. http://hl7.eu/fhir/base/StructureDefinition/Address-eu
#        — referenced by ShoulderPatient.address
#     2. http://hl7.org/fhir/5.0/StructureDefinition/extension-Procedure.recorded
#        — referenced by RotatorCuffProcedure (R5 backport)
#
#   Neither is in hl7.fhir.r4.core@4.0.1 (loaded by load-base-profiles.sh).
#   Without these packages loaded, HAPI Starter's
#   VersionedUrlFallbackValidationSupport recurses on missing canonicals.
#
#   ADR-0042 intended to enable `requests_enabled=true` so HAPI would gate
#   every POST against meta.profile. ADR-0044 reverted that — HAPI Starter
#   v8.8.0-1 has an unfixed recursion bug that fires even after the SDs are
#   loaded (the fallback module lacks a recursion guard; upstream fix is
#   PR #941 / commit 9fe0b42, unreleased at time of writing). This loader
#   stays: the SDs are still useful for `tools/validate.sh` (the FHIR
#   Validator CLI design-time gate, default `-tx https://tx.fhir.org/r4` per
#   ADR-0049) and for the `validator-service` sidecar on port 3500 (runtime
#   client pre-flight from both frontends per ADR-0051, same engine as that gate).
#
# Run order (in build-and-deploy.sh):
#   1. ./seed/load-base-profiles.sh       # base R4 SDs
#   2. ./seed/load-eu-base-profiles.sh    # EU + xver-r5 SDs (this script)
#   3. ./seed/load-profiles.sh            # IG-specific profiles
#   4. (restart HAPI)                     # refresh validator support chain
# (SNOMED fragment loader retired per ADR-0050 — HAPI now delegates SNOMED
# resolution to https://tx.fhir.org/r4 at runtime via remote_terminology_service.)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FHIR_SERVER="${FHIR_SERVER_URL:-http://localhost:8080/fhir/DEFAULT}"

EU_CACHE="$SCRIPT_DIR/.fhir-eu-base-cache"
EU_VERSION="2.0.0"
EU_URL="https://packages.fhir.org/hl7.fhir.eu.base/$EU_VERSION"
EU_TGZ="$EU_CACHE/hl7.fhir.eu.base-$EU_VERSION.tgz"

XVER_CACHE="$SCRIPT_DIR/.fhir-xver-r5-cache"
XVER_VERSION="0.1.0"
XVER_URL="https://packages.fhir.org/hl7.fhir.uv.xver-r5.r4/$XVER_VERSION"
XVER_TGZ="$XVER_CACHE/hl7.fhir.uv.xver-r5.r4-$XVER_VERSION.tgz"

# Idempotence canary IDs. EU base ships Address-eu with id="Address-eu";
# xver-r5 has ext-R5-Account.balance as one of its first files alphabetically
# and ext-R5-VirtualServiceDetail.addressUrl as one of its last. We require
# BOTH the first-by-upload AND last-by-upload SD to be present before
# declaring the script idempotent-skip — a partial upload then no longer
# silently passes the check (the bug the original Address-eu-only canary
# exposed when an upload died mid-stream).
EU_CANARY="Address-eu"
XVER_FIRST_CANARY="ext-R5-Account.balance"
XVER_LAST_CANARY="profile-VisionPrescription"

echo "=========================================================="
echo "  Shoulder on FHIR — EU base + xver-r5 SD loader (ADR-0042)"
echo "=========================================================="
echo "FHIR server: $FHIR_SERVER"
echo ""

# ─── Prereqs ──────────────────────────────────────────────────────────────────
for cmd in curl tar jq python3; do
  command -v "$cmd" > /dev/null 2>&1 || { echo "ERROR: $cmd not installed"; exit 1; }
done

if ! curl -sf "$FHIR_SERVER/metadata" > /dev/null 2>&1; then
  echo "ERROR: FHIR server is not reachable at $FHIR_SERVER"
  exit 1
fi

# ─── Idempotence check ────────────────────────────────────────────────────────
# A partial-upload protection: require the first-EU, first-xver, AND last-xver
# canaries to ALL resolve before short-circuiting. If any one is missing, we
# re-upload everything (PUT-by-id is idempotent on the loaded ones).
if [ "${FORCE_RELOAD:-false}" != "true" ]; then
  all_present=true
  for cid in "$EU_CANARY" "$XVER_FIRST_CANARY" "$XVER_LAST_CANARY"; do
    code=$(curl -s -o /dev/null -w '%{http_code}' \
              "$FHIR_SERVER/StructureDefinition/$cid")
    if [ "$code" != "200" ]; then
      all_present=false
      break
    fi
  done
  if [ "$all_present" = true ]; then
    echo "EU/xver SDs already loaded (EU + first/last xver canaries resolve). Nothing to do."
    echo "(Set FORCE_RELOAD=true to re-upload.)"
    exit 0
  fi
fi

# ─── Download + extract both packages ─────────────────────────────────────────
download_and_extract() {
  local cache_dir="$1" tgz="$2" url="$3" label="$4"
  mkdir -p "$cache_dir"
  if [ ! -f "$tgz" ]; then
    echo "Downloading ${label}…"
    curl -L --fail --progress-bar -o "$tgz" "$url"
  fi
  local extract="$cache_dir/extracted"
  if [ ! -d "$extract/package" ]; then
    echo "Extracting ${label}…"
    mkdir -p "$extract"
    tar -xzf "$tgz" -C "$extract"
  fi
}

download_and_extract "$EU_CACHE"   "$EU_TGZ"   "$EU_URL"   "hl7.fhir.eu.base@$EU_VERSION"
download_and_extract "$XVER_CACHE" "$XVER_TGZ" "$XVER_URL" "hl7.fhir.uv.xver-r5.r4@$XVER_VERSION (large, may take ~1 min)"

# ─── Upload via Python (keep-alive, sequential) ──────────────────────────────
# Same pattern as load-base-profiles.sh: one TCP connection per package, PUT
# every StructureDefinition by its own id. PUT-by-id is necessary because
# HAPI's client_id_strategy=ANY honours client-supplied ids, so each SD lands
# at a predictable path that a direct GET can verify without waiting for
# Lucene to index.
python3 - "$FHIR_SERVER" "$EU_CACHE/extracted/package" "$XVER_CACHE/extracted/package" <<'PY'
import json
import os
import sys
from http.client import HTTPConnection
from urllib.parse import urlparse

server = sys.argv[1].rstrip("/")
pkg_dirs = sys.argv[2:]

parsed = urlparse(server)
host = parsed.hostname
port = parsed.port or 80
base_path = parsed.path

conn = HTTPConnection(host, port, timeout=60)

grand_ok = grand_fail = grand_skip = 0
all_fails: list[str] = []

for pkg_dir in pkg_dirs:
    label = os.path.basename(os.path.dirname(pkg_dir))
    files = sorted(
        f for f in os.listdir(pkg_dir)
        if f.startswith("StructureDefinition-") and f.endswith(".json")
    )
    total = len(files)
    print(f"\n[{label}] Uploading {total} StructureDefinitions…")

    ok = fail = skip = 0

    for i, fname in enumerate(files, 1):
        path = os.path.join(pkg_dir, fname)
        with open(path, "rb") as fh:
            body = fh.read()
        try:
            sd = json.loads(body)
        except Exception:
            skip += 1
            continue
        if sd.get("resourceType") != "StructureDefinition" or not sd.get("url"):
            skip += 1
            continue

        rid = sd.get("id")
        if not rid:
            skip += 1
            continue

        target = f"{base_path}/StructureDefinition/{rid}"
        headers = {"Content-Type": "application/fhir+json", "Accept": "application/fhir+json"}
        try:
            conn.request("PUT", target, body=body, headers=headers)
            resp = conn.getresponse()
            resp.read()
            if resp.status in (200, 201):
                ok += 1
            else:
                fail += 1
                if len(all_fails) < 10:
                    all_fails.append(f"  {resp.status}  {sd['url']}")
        except Exception as e:
            fail += 1
            if len(all_fails) < 10:
                all_fails.append(f"  EXC  {sd['url']} :: {e}")
            conn.close()
            conn = HTTPConnection(host, port, timeout=60)

        if i % 100 == 0 or i == total:
            print(f"  {i}/{total}  (ok={ok}, fail={fail}, skip={skip})", flush=True)

    grand_ok += ok
    grand_fail += fail
    grand_skip += skip

conn.close()

if all_fails:
    print("\nFirst failures (≤ 10):")
    for line in all_fails:
        print(line)

print(f"\nTotals: ok={grand_ok} | skipped={grand_skip} | failed={grand_fail}")
PY

# ─── Verify ──────────────────────────────────────────────────────────────────
# All three canaries (EU first + xver first + xver last) must resolve;
# otherwise we silently exit with a partial-upload state that the idempotence
# check above would then falsely accept.
verify_fail=""
for cid in "$EU_CANARY" "$XVER_FIRST_CANARY" "$XVER_LAST_CANARY"; do
  status=0
  for _ in 1 2 3 4 5; do
    status=$(curl -s -o /dev/null -w '%{http_code}' \
              "$FHIR_SERVER/StructureDefinition/$cid")
    [ "$status" = "200" ] && break
    sleep 1
  done
  if [ "$status" != "200" ]; then
    verify_fail+="$cid (HTTP $status) "
  fi
done
if [ -z "$verify_fail" ]; then
  echo "✓ EU + xver canaries resolve. ShoulderPatient.address and the xver-r5 extension chain are now validator-resolvable."
else
  echo "✗ Post-load verification failed for: $verify_fail— validator may still recurse on missing canonicals."
  exit 1
fi
