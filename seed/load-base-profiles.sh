#!/bin/bash
# Load the FHIR R4 core base StructureDefinitions into HAPI.
#
# Why this exists (ADR-0031):
#   HAPI's transaction-bundle validator resolves each `meta.profile` chain by
#   searching the StructureDefinition resource collection. The base FHIR R4
#   types (Patient, Encounter, Observation, …) live in HAPI's in-memory
#   FhirContext but are *not* exposed as searchable resources. When the
#   validator walks `ShoulderPatient → baseDefinition Patient` it fails to
#   resolve the versioned canonical `Patient|4.0.1` and rejects the whole
#   transaction.
#
#   HAPI ships an `implementationguides` auto-installer that should solve
#   this, but in `hapiproject/hapi:latest` it crashes on NamingSystem
#   resources (HAPI-1315 "non-partitionable resource to a partition") and
#   takes the whole server down at startup. Until HAPI fixes that bug, we
#   load the StructureDefinitions ourselves via this script.
#
# Run order (per build-and-deploy.sh):
#   1. ./seed/load-base-profiles.sh       # base R4 SDs (this script)
#   2. ./seed/load-eu-base-profiles.sh    # EU base + xver-r5 SDs (ADR-0042 / 0044)
#   3. ./seed/load-profiles.sh            # IG-specific profiles
#   4. (restart HAPI)                     # refresh validator support chain
# (SNOMED fragment loader retired per ADR-0050 — HAPI now delegates SNOMED
# resolution to https://tx.fhir.org/r4 at runtime via remote_terminology_service.)
#
# The downloaded package is cached at $CACHE_DIR; subsequent runs are no-ops
# if the SDs are already loaded.
#
# The actual upload is delegated to a Python helper that re-uses a single
# HTTP connection (keep-alive) — much faster than spawning 658 individual
# curl processes, and avoids overwhelming HAPI's validation cache.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FHIR_SERVER="${FHIR_SERVER_URL:-http://localhost:8080/fhir/DEFAULT}"
CACHE_DIR="$SCRIPT_DIR/.fhir-r4-core-cache"
PACKAGE_VERSION="4.0.1"
PACKAGE_URL="https://packages.fhir.org/hl7.fhir.r4.core/$PACKAGE_VERSION"

echo "=================================================="
echo "  Shoulder on FHIR — Base R4 StructureDefinition loader"
echo "  (workaround for HAPI-1315; see ADR-0031)"
echo "=================================================="
echo "FHIR server: $FHIR_SERVER"
echo ""

# ─── Prereqs ──────────────────────────────────────────────────────────────────
for cmd in curl tar jq python3; do
  command -v "$cmd" > /dev/null 2>&1 || { echo "ERROR: $cmd not installed"; exit 1; }
done

# Ensure metadata endpoint responds (multitenancy URL)
if ! curl -sf "$FHIR_SERVER/metadata" > /dev/null 2>&1; then
  echo "ERROR: FHIR server is not reachable at $FHIR_SERVER"
  exit 1
fi

# ─── Idempotence check ────────────────────────────────────────────────────────
# Direct resource GET — bypasses the HAPI search engine entirely so a cold
# Lucene/result-cache on a freshly-wiped stack doesn't false-miss.
probe=$(curl -s -o /dev/null -w '%{http_code}' \
          "$FHIR_SERVER/StructureDefinition/Patient")
if [ "$probe" = "200" ]; then
  echo "Base SDs already loaded (Patient resolves). Nothing to do."
  exit 0
fi

# ─── Download the package once ────────────────────────────────────────────────
mkdir -p "$CACHE_DIR"
TGZ="$CACHE_DIR/hl7.fhir.r4.core-$PACKAGE_VERSION.tgz"
if [ ! -f "$TGZ" ]; then
  echo "Downloading hl7.fhir.r4.core@$PACKAGE_VERSION (~50 MB)…"
  curl -L --fail --progress-bar -o "$TGZ" "$PACKAGE_URL"
fi

EXTRACT="$CACHE_DIR/extracted"
if [ ! -d "$EXTRACT/package" ]; then
  echo "Extracting package…"
  mkdir -p "$EXTRACT"
  tar -xzf "$TGZ" -C "$EXTRACT"
fi

# ─── Upload via Python (keep-alive, sequential) ──────────────────────────────
# A single Python process re-uses one TCP connection for every PUT. The
# previous shell+xargs+curl approach spawned 658 processes and overwhelmed
# HAPI's validation-support cache; one keep-alive connection is faster and
# kinder to the server.
python3 - "$FHIR_SERVER" "$EXTRACT/package" <<'PY'
import json
import os
import sys
from http.client import HTTPConnection
from urllib.parse import urlparse

server = sys.argv[1].rstrip("/")
pkg_dir = sys.argv[2]

parsed = urlparse(server)
host = parsed.hostname
port = parsed.port or 80
base_path = parsed.path  # e.g. /fhir/DEFAULT

conn = HTTPConnection(host, port, timeout=60)

files = sorted(
    f for f in os.listdir(pkg_dir)
    if f.startswith("StructureDefinition-") and f.endswith(".json")
)
total = len(files)
print(f"Uploading {total} StructureDefinitions via keep-alive HTTP…")

ok = fail = skip = 0
fails: list[str] = []

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

    # PUT-by-id: HAPI's client_id_strategy=ANY honours client-supplied ids,
    # so every base SD lands at /StructureDefinition/<id> and can be read
    # back with a direct GET — no search-index lag on cold starts.
    target = f"{base_path}/StructureDefinition/{rid}"
    headers = {"Content-Type": "application/fhir+json", "Accept": "application/fhir+json"}
    try:
        conn.request("PUT", target, body=body, headers=headers)
        resp = conn.getresponse()
        resp.read()  # drain
        if resp.status in (200, 201):
            ok += 1
        else:
            fail += 1
            if len(fails) < 10:
                fails.append(f"  {resp.status}  {sd['url']}")
    except Exception as e:
        fail += 1
        if len(fails) < 10:
            fails.append(f"  EXC  {sd['url']} :: {e}")
        # Reconnect on error
        conn.close()
        conn = HTTPConnection(host, port, timeout=60)

    if i % 50 == 0 or i == total:
        print(f"  {i}/{total}  (ok={ok}, fail={fail}, skip={skip})", flush=True)

conn.close()

if fails:
    print("First failures (≤ 10):")
    for line in fails:
        print(line)

print(f"\nLoaded: {ok} | Skipped: {skip} | Failed: {fail}")
PY

# ─── Verify ──────────────────────────────────────────────────────────────────
# Direct resource GET — independent of HAPI's search index, so the verify
# reflects storage state immediately. A short retry covers the rare case where
# the PUT response is acknowledged microseconds before another connection sees
# the row.
status=0
for _ in 1 2 3 4 5; do
  status=$(curl -s -o /dev/null -w '%{http_code}' \
            "$FHIR_SERVER/StructureDefinition/Patient")
  [ "$status" = "200" ] && break
  sleep 1
done
if [ "$status" = "200" ]; then
  echo '✓ Base Patient StructureDefinition is loaded. Transaction-bundle validation will resolve meta.profile chains correctly.'
else
  echo "✗ Base Patient StructureDefinition NOT loaded (HTTP $status) — transaction validation will still fail."
  exit 1
fi
