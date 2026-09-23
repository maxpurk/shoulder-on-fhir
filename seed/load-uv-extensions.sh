#!/bin/bash
# Load FHIR UV Extensions + HL7 Terminology into HAPI.
#
# Why this exists (ADR-0053 §Consequences):
#   ADR-0053 adopts the HL7 Gender Harmony individual-recordedSexOrGender
#   (RSG) extension on ShoulderPatient. RSG is R4-backported in
#   hl7.fhir.uv.extensions.r4, and its `value` sub-extension binds (required)
#   to the FHIR-core administrative-gender ValueSet (no terminology-pack
#   dependency for the value VS). Sushi pulls hl7.fhir.uv.extensions.r4 at IG
#   build time, but HAPI's seed pipeline never loaded it — runtime validation
#   of Patient.extension[recordedSexOrGender] failed because HAPI couldn't
#   resolve the RSG StructureDefinition.
#
#   This loader closes that gap by mirroring the eu-base loader pattern:
#   download hl7.fhir.uv.extensions.r4 + hl7.terminology.r4, cache them, PUT
#   every StructureDefinition / ValueSet / CodeSystem into HAPI by id. The
#   terminology pack is loaded alongside the UV pack to future-proof the IG
#   for any other UV extension that binds standard HL7 terminology ValueSets.
#
#   The two packs together carry ~5000 resources. All are HL7-stewarded,
#   stable, and pull-once at IG-authoring time. Loading them whole future-
#   proofs the IG for any other UV extension or terminology binding we ever
#   adopt (R5 backports, more standard ValueSets, etc.).
#
# Run order (in build-and-deploy.sh):
#   1. ./seed/load-base-profiles.sh       # base R4 SDs
#   2. ./seed/load-eu-base-profiles.sh    # EU + xver-r5 SDs
#   3. ./seed/load-uv-extensions.sh       # UV extensions pack (this script)
#   4. ./seed/load-profiles.sh            # IG-specific profiles
#   5. (restart HAPI)                     # refresh validator support chain

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FHIR_SERVER="${FHIR_SERVER_URL:-http://localhost:8080/fhir/DEFAULT}"

UV_CACHE="$SCRIPT_DIR/.fhir-uv-extensions-cache"
UV_VERSION="5.3.0"
UV_URL="https://packages.fhir.org/hl7.fhir.uv.extensions.r4/$UV_VERSION"
UV_TGZ="$UV_CACHE/hl7.fhir.uv.extensions.r4-$UV_VERSION.tgz"

TERM_CACHE="$SCRIPT_DIR/.fhir-terminology-r4-cache"
TERM_VERSION="7.1.0"
TERM_URL="https://packages.fhir.org/hl7.terminology.r4/$TERM_VERSION"
TERM_TGZ="$TERM_CACHE/hl7.terminology.r4-$TERM_VERSION.tgz"

# Idempotence canary: RSG is the load-bearing extension (ADR-0053 depends
# on it). Its `value` sub-extension binds to FHIR-core administrative-gender
# (always loaded), so we only need to check the RSG StructureDefinition.
RSG_SD_CANARY="individual-recordedSexOrGender"

echo "=========================================================="
echo "  Shoulder on FHIR — UV Extensions pack loader (ADR-0053)"
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
# If the RSG StructureDefinition already resolves, the UV-extensions pack has
# already been loaded. (PUT-by-id is idempotent if you do want to re-upload —
# FORCE_RELOAD=true bypasses this check.)
if [ "${FORCE_RELOAD:-false}" != "true" ]; then
  sd_code=$(curl -s -o /dev/null -w '%{http_code}' "$FHIR_SERVER/StructureDefinition/$RSG_SD_CANARY")
  if [ "$sd_code" = "200" ]; then
    echo "UV extensions pack already loaded (RSG SD canary resolves). Nothing to do."
    echo "(Set FORCE_RELOAD=true to re-upload.)"
    exit 0
  fi
fi

# ─── Download + extract both packages ────────────────────────────────────────
download_and_extract() {
  local cache="$1" tgz="$2" url="$3" label="$4"
  mkdir -p "$cache"
  if [ ! -f "$tgz" ]; then
    echo "Downloading ${label}…"
    curl -L --fail --progress-bar -o "$tgz" "$url"
  fi
  if [ ! -d "$cache/extracted/package" ]; then
    echo "Extracting ${label}…"
    mkdir -p "$cache/extracted"
    tar -xzf "$tgz" -C "$cache/extracted"
  fi
}

download_and_extract "$UV_CACHE"   "$UV_TGZ"   "$UV_URL"   "hl7.fhir.uv.extensions.r4@$UV_VERSION (~3 MB)"
download_and_extract "$TERM_CACHE" "$TERM_TGZ" "$TERM_URL" "hl7.terminology.r4@$TERM_VERSION (large, ~40 MB)"

# ─── Upload via Python (keep-alive, sequential) ──────────────────────────────
# Generalised from load-eu-base-profiles.sh to handle three resource types:
# StructureDefinition, ValueSet, CodeSystem. PUT-by-id; HAPI's
# client_id_strategy=ANY honours client-supplied ids.
python3 - "$FHIR_SERVER" "$UV_CACHE/extracted/package" "$TERM_CACHE/extracted/package" <<'PY'
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

# Filenames in the package follow the pattern: <ResourceType>-<id>.json
RESOURCE_PREFIXES = {
    "StructureDefinition-": "StructureDefinition",
    "ValueSet-":            "ValueSet",
    "CodeSystem-":          "CodeSystem",
}

grand_ok = grand_fail = grand_skip = 0
grand_counts = {rt: 0 for rt in RESOURCE_PREFIXES.values()}
all_fails: list[str] = []

for pkg_dir in pkg_dirs:
    label = os.path.basename(os.path.dirname(pkg_dir))
    files = sorted(os.listdir(pkg_dir))
    selected = [
        (f, rt)
        for f in files
        for prefix, rt in RESOURCE_PREFIXES.items()
        if f.startswith(prefix) and f.endswith(".json")
    ]
    total = len(selected)
    print(f"\n[{label}] Uploading {total} resources…")

    ok = fail = skip = 0
    for i, (fname, expected_rt) in enumerate(selected, 1):
        path = os.path.join(pkg_dir, fname)
        with open(path, "rb") as fh:
            body = fh.read()
        try:
            res = json.loads(body)
        except Exception:
            skip += 1
            continue

        rt = res.get("resourceType")
        rid = res.get("id")
        if rt != expected_rt or not rid:
            skip += 1
            continue

        target = f"{base_path}/{rt}/{rid}"
        headers = {"Content-Type": "application/fhir+json", "Accept": "application/fhir+json"}
        try:
            conn.request("PUT", target, body=body, headers=headers)
            resp = conn.getresponse()
            resp.read()
            if resp.status in (200, 201):
                ok += 1
                grand_counts[rt] += 1
            else:
                fail += 1
                if len(all_fails) < 10:
                    all_fails.append(f"  {resp.status}  {rt}/{rid}")
        except Exception as e:
            fail += 1
            if len(all_fails) < 10:
                all_fails.append(f"  EXC  {rt}/{rid} :: {e}")
            conn.close()
            conn = HTTPConnection(host, port, timeout=60)

        if i % 200 == 0 or i == total:
            print(f"  {i}/{total}  (ok={ok}, fail={fail}, skip={skip})", flush=True)

    grand_ok += ok
    grand_fail += fail
    grand_skip += skip

conn.close()

if all_fails:
    print("\nFirst failures (≤ 10):")
    for line in all_fails:
        print(line)

print(f"\nBy type: {grand_counts}")
print(f"Totals: ok={grand_ok} | skipped={grand_skip} | failed={grand_fail}")
PY

# ─── Verify ──────────────────────────────────────────────────────────────────
# RSG SD must resolve before we declare success. RSG's `value` sub-extension
# binds to FHIR-core administrative-gender, which lives in the R4 core pack
# loaded by load-base-profiles.sh — no terminology-pack VS dependency on the
# critical path, so no post-load $invalidate-expansion is needed here.
verify_fail=""
status=0
for _ in 1 2 3 4 5; do
  status=$(curl -s -o /dev/null -w '%{http_code}' "$FHIR_SERVER/StructureDefinition/$RSG_SD_CANARY")
  [ "$status" = "200" ] && break
  sleep 1
done
if [ "$status" != "200" ]; then
  echo "✗ Post-load verification failed: StructureDefinition/$RSG_SD_CANARY (HTTP $status) — Patient.extension[recordedSexOrGender] will not validate."
  exit 1
fi
echo "✓ RSG SD resolves."
