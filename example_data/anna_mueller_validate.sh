#!/bin/bash

# Validate the Anna Müller resources that are already loaded in HAPI against
# the Shoulder on FHIR IG. Pulls everything for Patient PAT-LONG-001 via
# Patient/$everything, then runs the same FHIR Validator CLI engine that
# tools/validate.sh uses, with the same -ig / -tx flags
# (so this matches the CI gate per ADR-0024 / ADR-0049).

set -e

FHIR_SERVER="${FHIR_SERVER_URL:-http://localhost:8080/fhir/DEFAULT}"
PATIENT_IDENT="${PATIENT_IDENT:-PAT-LONG-001}"
TX_SERVER="${TX_SERVER:-https://tx.fhir.org/r4}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOF_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR_JAR="$SOF_ROOT/tools/validator_cli.jar"
TX_CACHE_DIR="$SOF_ROOT/tools/.tx-cache"
IG_OUTPUT_TGZ="$SOF_ROOT/ig/output/package.tgz"
FSH_GENERATED="$SOF_ROOT/ig/fsh-generated/resources"

echo "=========================================="
echo "  Anna Müller Server-Side Validation"
echo "=========================================="
echo "FHIR Server:        $FHIR_SERVER"
echo "Patient identifier: $PATIENT_IDENT"
echo "TX server:          $TX_SERVER"

# ─── Prerequisites ────────────────────────────────────────────────────────────

if ! command -v jq &> /dev/null; then
    echo "ERROR: 'jq' is required." >&2
    exit 1
fi
if ! command -v java &> /dev/null; then
    echo "ERROR: 'java' is required (Java 11+)." >&2
    exit 1
fi
if [ ! -f "$VALIDATOR_JAR" ]; then
    echo "ERROR: validator_cli.jar not found at $VALIDATOR_JAR" >&2
    echo "  Run tools/validate.sh once to download it." >&2
    exit 1
fi

if [ -f "$IG_OUTPUT_TGZ" ]; then
    IG_PACKAGE="$IG_OUTPUT_TGZ"
    echo "IG package:         ig/output/package.tgz"
elif [ -d "$FSH_GENERATED" ] && [ "$(ls -A "$FSH_GENERATED" 2>/dev/null)" ]; then
    IG_PACKAGE="$FSH_GENERATED"
    echo "IG package:         ig/fsh-generated/resources/ (SUSHI-only fallback)"
else
    echo "ERROR: No IG package found. Build the IG first." >&2
    exit 1
fi

if ! curl -sf "$FHIR_SERVER/metadata" > /dev/null 2>&1; then
    echo "ERROR: FHIR server not reachable at $FHIR_SERVER" >&2
    exit 1
fi

# ─── 1. Resolve patient → HAPI id ─────────────────────────────────────────────

patient_id=$(curl -sf "$FHIR_SERVER/Patient?identifier=$PATIENT_IDENT" \
    | jq -r '.entry[0].resource.id // empty')
if [ -z "$patient_id" ]; then
    echo "ERROR: Patient with identifier $PATIENT_IDENT not found on $FHIR_SERVER" >&2
    echo "  Did you run load-anna-mueller.sh yet?" >&2
    exit 1
fi
echo "Resolved Patient id: $patient_id"
echo ""

# ─── 2. Pull all resources for this patient via $everything ───────────────────

WORK_DIR="$(mktemp -d -t anna_validate.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

curl -sf "$FHIR_SERVER/Patient/$patient_id/\$everything?_count=500" \
    -o "$WORK_DIR/everything.json"

count=$(jq '[.entry[]?.resource] | length' "$WORK_DIR/everything.json")
if [ "$count" -eq 0 ]; then
    echo "ERROR: \$everything returned no resources for patient $patient_id" >&2
    exit 1
fi
echo "Fetched $count resources via \$everything; splitting into individual files..."

# Split entries into one file per resource. The index prefix preserves order
# so the Bundle output's .entry[i] aligns with the i-th input file.
jq -c '.entry[]?.resource' "$WORK_DIR/everything.json" | nl -nrz -w4 \
| while IFS=$'\t' read -r idx res; do
    rt=$(echo "$res" | jq -r '.resourceType')
    rid=$(echo "$res" | jq -r '.id')
    echo "$res" | jq . > "$WORK_DIR/${idx}-${rt}-${rid}.json"
done

mkdir -p "$TX_CACHE_DIR"

# ─── 3. Validate via FHIR Validator CLI (same engine as tools/validate.sh) ────

files=("$WORK_DIR"/[0-9]*.json)
echo ""
echo "Validating ${#files[@]} resources against the IG..."
echo ""

java -jar "$VALIDATOR_JAR" \
    "${files[@]}" \
    -ig "$IG_PACKAGE" \
    -ig "hl7.fhir.eu.base#2.0.0" \
    -ig "hl7.fhir.uv.xver-r5.r4#0.1.0" \
    -ig "hl7.fhir.uv.ips#1.1.0" \
    -version 4.0.1 \
    -tx "$TX_SERVER" \
    -txCache "$TX_CACHE_DIR" \
    -output "$WORK_DIR/result.json" \
    > "$WORK_DIR/validator.log" 2>&1 || true

if [ ! -f "$WORK_DIR/result.json" ]; then
    echo "ERROR: validator crashed — see log below" >&2
    cat "$WORK_DIR/validator.log" >&2
    exit 1
fi

# ─── 4. Summarise per file ────────────────────────────────────────────────────

outcome_type=$(jq -r '.resourceType' "$WORK_DIR/result.json")

i=0
pass=0
fail=0
total_errors=0
total_warnings=0
for f in "${files[@]}"; do
    name="$(basename "$f" .json)"
    if [ "$outcome_type" = "OperationOutcome" ]; then
        per_filter='.issue[]?'
    else
        per_filter=".entry[$i].resource.issue[]?"
    fi
    e=$(jq "[$per_filter | select(.severity == \"error\" or .severity == \"fatal\")] | length" "$WORK_DIR/result.json")
    w=$(jq "[$per_filter | select(.severity == \"warning\")] | length"                      "$WORK_DIR/result.json")
    total_errors=$((total_errors + e))
    total_warnings=$((total_warnings + w))
    if [ "$e" -gt 0 ]; then
        printf "  %-60s FAIL  (%s error(s), %s warning(s))\n" "$name" "$e" "$w"
        fail=$((fail + 1))
        jq -r "$per_filter | select(.severity == \"error\" or .severity == \"fatal\") | \"      [\" + .severity + \"] \" + (.location[0] // \"?\") + \" — \" + .details.text" \
            "$WORK_DIR/result.json"
    else
        printf "  %-60s OK    (%s warning(s))\n" "$name" "$w"
        pass=$((pass + 1))
    fi
    i=$((i + 1))
done

echo ""
echo "============================================"
echo "  Results: $pass passed, $fail failed"
echo "  Errors:  $total_errors  |  Warnings: $total_warnings"
echo "============================================"

if [ "$total_errors" -gt 0 ]; then
    # Preserve output for inspection when validation fails.
    KEEP_DIR="$SCRIPT_DIR/.anna_validate_last_failure"
    rm -rf "$KEEP_DIR"
    mv "$WORK_DIR" "$KEEP_DIR"
    trap - EXIT
    echo ""
    echo "Failure artefacts preserved at: $KEEP_DIR"
    exit 1
fi
