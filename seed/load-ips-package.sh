#!/bin/bash
# Load the HL7 IPS (International Patient Summary) v1.1.0 package into HAPI.
#
# Why this exists (ADR-0056, ADR-0055):
#   ADR-0055 (2026-05-22) added ShoulderComorbidityCondition.code extensible-
#   bound to http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips.
#   ADR-0056 (2026-05-22) rebinds SmokingStatusObservation.valueCodeableConcept
#   extensible to http://hl7.org/fhir/uv/ips/ValueSet/current-smoking-status-uv-ips.
#
#   Both ADRs assumed HAPI's remote_terminology_service.snomed delegation
#   (ADR-0050) would let HAPI resolve IPS-canonical ValueSet $expand calls via
#   tx.fhir.org. Empirical test 2026-05-22 (after ADR-0055 was accepted):
#
#     curl '/ValueSet/$expand?url=http://hl7.org/fhir/uv/ips/ValueSet/
#           problems-snomed-absent-unknown-uv-ips&filter=hyperten'
#     → HAPI-2788: Unknown ValueSet
#
#   The remote_terminology_service block only delegates terminology operations
#   on a specific CodeSystem (http://snomed.info/sct) — it does NOT resolve
#   external ValueSet resources. And tx.fhir.org/r4 itself returns "ValueSet
#   not found" at the IPS canonical URL — so even a transparent proxy would
#   fail. The IPS VSs must be loaded as resources in HAPI's storage; HAPI then
#   expands them locally (compose.include[].concept is enumerated; SNOMED
#   display strings are filled in via the existing tx.fhir.org delegation).
#
# Run order (in build-and-deploy.sh):
#   1. ./seed/load-base-profiles.sh       # base R4 SDs
#   2. ./seed/load-eu-base-profiles.sh    # EU + xver-r5 SDs
#   3. ./seed/load-uv-extensions.sh       # FHIR UV Extensions + HL7 terminology
#   4. ./seed/load-ips-package.sh         # IPS CSs + VSs + SDs (this script)
#   5. ./seed/load-profiles.sh            # IG-specific profiles
#   6. (restart HAPI)                     # refresh validator + term chain
#
# Idempotence canary: ValueSet/current-smoking-status-uv-ips (added by ADR-0056).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FHIR_SERVER="${FHIR_SERVER_URL:-http://localhost:8080/fhir/DEFAULT}"

IPS_CACHE="$SCRIPT_DIR/.fhir-ips-cache"
IPS_VERSION="1.1.0"
IPS_URL="https://packages.fhir.org/hl7.fhir.uv.ips/$IPS_VERSION"
IPS_TGZ="$IPS_CACHE/hl7.fhir.uv.ips-$IPS_VERSION.tgz"

# Idempotence canary: the smoking VS, which is one of the two IPS VSs the IG
# directly binds to (ADR-0056). Using a VS id avoids the EU-loader pitfall
# where a CodeSystem canary masked a partial VS upload.
IPS_CANARY_TYPE="ValueSet"
IPS_CANARY_ID="current-smoking-status-uv-ips"

echo "=========================================================="
echo "  Shoulder on FHIR — IPS v$IPS_VERSION loader (ADR-0056)"
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
if [ "${FORCE_RELOAD:-false}" != "true" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' \
            "$FHIR_SERVER/$IPS_CANARY_TYPE/$IPS_CANARY_ID")
  if [ "$code" = "200" ]; then
    echo "IPS package already loaded ($IPS_CANARY_TYPE/$IPS_CANARY_ID resolves). Nothing to do."
    echo "(Set FORCE_RELOAD=true to re-upload.)"
    exit 0
  fi
fi

# ─── Download + extract ───────────────────────────────────────────────────────
mkdir -p "$IPS_CACHE"
if [ ! -f "$IPS_TGZ" ]; then
  echo "Downloading hl7.fhir.uv.ips@${IPS_VERSION}…"
  curl -L --fail --progress-bar -o "$IPS_TGZ" "$IPS_URL"
fi
EXTRACT="$IPS_CACHE/extracted"
if [ ! -d "$EXTRACT/package" ]; then
  echo "Extracting hl7.fhir.uv.ips@${IPS_VERSION}…"
  mkdir -p "$EXTRACT"
  tar -xzf "$IPS_TGZ" -C "$EXTRACT"
fi

# ─── Upload via Python (keep-alive, sequential, load order matters) ───────────
# Load order: CodeSystem → ValueSet → StructureDefinition. ConceptMaps and
# CapabilityStatement / OperationDefinition / ImplementationGuide are skipped
# (not load-bearing for the IG's bindings; would just bloat HAPI's storage).
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
base_path = parsed.path

conn = HTTPConnection(host, port, timeout=60)

# Resource types to upload, in dependency order.
# CodeSystems first so VS references resolve; ValueSets next so SD bindings
# resolve; StructureDefinitions last.
LOAD_ORDER = ["CodeSystem", "ValueSet", "StructureDefinition"]

grand_ok = grand_fail = grand_skip = 0
all_fails: list[str] = []

for rtype in LOAD_ORDER:
    files = sorted(
        f for f in os.listdir(pkg_dir)
        if f.startswith(f"{rtype}-") and f.endswith(".json")
    )
    total = len(files)
    if total == 0:
        continue
    print(f"\n[hl7.fhir.uv.ips] Uploading {total} {rtype}s…")

    ok = fail = skip = 0

    for i, fname in enumerate(files, 1):
        path = os.path.join(pkg_dir, fname)
        with open(path, "rb") as fh:
            body = fh.read()
        try:
            res = json.loads(body)
        except Exception:
            skip += 1
            continue
        if res.get("resourceType") != rtype:
            skip += 1
            continue
        rid = res.get("id")
        if not rid:
            skip += 1
            continue

        target = f"{base_path}/{rtype}/{rid}"
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
                    all_fails.append(f"  {resp.status}  {rtype}/{rid}")
        except Exception as e:
            fail += 1
            if len(all_fails) < 10:
                all_fails.append(f"  EXC  {rtype}/{rid} :: {e}")
            conn.close()
            conn = HTTPConnection(host, port, timeout=60)

        if i % 20 == 0 or i == total:
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
# The canary VS must resolve, AND HAPI must be able to expand it (catches the
# subtle case where the VS is loaded but its SNOMED CodeSystem references
# don't resolve through the remote_terminology_service delegation).
status=0
for _ in 1 2 3 4 5; do
  status=$(curl -s -o /dev/null -w '%{http_code}' \
            "$FHIR_SERVER/$IPS_CANARY_TYPE/$IPS_CANARY_ID")
  [ "$status" = "200" ] && break
  sleep 1
done
if [ "$status" != "200" ]; then
  echo "✗ Post-load verification failed: $IPS_CANARY_TYPE/$IPS_CANARY_ID returned HTTP $status."
  exit 1
fi

expand_count=$(curl -s \
  "$FHIR_SERVER/$IPS_CANARY_TYPE/\$expand?url=http://hl7.org/fhir/uv/ips/ValueSet/$IPS_CANARY_ID" \
  | jq '(.expansion.contains // []) | length' 2>/dev/null || echo 0)
if [ "$expand_count" -gt 0 ]; then
  echo "✓ IPS package loaded. $IPS_CANARY_TYPE/$IPS_CANARY_ID resolves and \$expand returns $expand_count concepts."
else
  echo "✓ IPS package loaded ($IPS_CANARY_TYPE/$IPS_CANARY_ID resolves) but \$expand returned 0 concepts."
  echo "  (HAPI may need the remote_terminology_service.snomed delegation to fill in SNOMED displays — check tx.fhir.org connectivity.)"
fi
