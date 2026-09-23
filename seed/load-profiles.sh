#!/bin/bash

# Shoulder on FHIR - IG Profile Loader
# Loads the Implementation Guide's CodeSystems, ValueSets, StructureDefinitions
# and Questionnaires into HAPI so the server can expand the guide's value sets
# and clients can resolve its profiles. It does NOT turn HAPI into a validating
# server: HAPI is a storage tier by design (requests_enabled=false), with
# conformance gated at design time by tools/validate.sh and at the client by the
# validator-service sidecar.

set -e

FHIR_SERVER="${FHIR_SERVER_URL:-http://localhost:8080/fhir/DEFAULT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IG_DIR="$SCRIPT_DIR/../ig/fsh-generated/resources"
# What the guide publishes. package.tgz built from here is what an implementer
# installs and what the validator loads, and its StructureDefinitions carry the
# snapshots clients resolve elements against, so the demonstrator runs on the
# same bytes the guide ships wherever that is lossless.
IG_OUTPUT_DIR="$SCRIPT_DIR/../ig/output"

# Whether a given resource survives publishing intact. The IG Publisher
# normalises Questionnaire.contained[] through its internal R5 model and drops
# every element R4 has and R5 does not, reporting nothing, so a resource that
# loses content has to keep coming from source. Asking per file rather than
# keeping a list means the next element it drops is handled without anyone
# having predicted which one. See tools/publish-fidelity.py and ADR-0195.
pick_all() {
    if [ "${USE_FSH_GENERATED:-false}" = "true" ] || [ ! -d "$IG_OUTPUT_DIR" ]; then
        echo "$IG_DIR"; return
    fi
    python3 "$SCRIPT_DIR/../tools/publish-fidelity.py" --pick-all "$1" 2>/dev/null || echo "$IG_DIR"
}

pick_source() {
    local name; name="$(basename "$1")"
    if [ "${USE_FSH_GENERATED:-false}" = "true" ] || [ ! -d "$IG_OUTPUT_DIR" ]; then
        echo "$IG_DIR"; return
    fi
    python3 "$SCRIPT_DIR/../tools/publish-fidelity.py" --pick "$name" 2>/dev/null || echo "$IG_DIR"
}

echo "=========================================="
echo "  Shoulder on FHIR - IG Profile Loader"
echo "=========================================="
echo ""
echo "FHIR Server: $FHIR_SERVER"
echo "IG Resources: $IG_DIR"
echo ""

# Check if IG resources exist
if [ ! -d "$IG_DIR" ]; then
    echo "ERROR: IG resources not found at $IG_DIR"
    echo ""
    echo "Please build the IG first by running:"
    echo "  cd $SCRIPT_DIR/../ig && sushi ."
    echo ""
    exit 1
fi

# Inject pre-computed expansions into ValueSet JSON files so HAPI can serve
# $expand without a live SNOMED or custom terminology service.
# Output goes to a writable temp dir (ig/ mount is read-only in Docker).
echo "Generating ValueSet expansions..."
export EXPANDED_OUTPUT_DIR=/tmp/fsh-expanded
# ValueSets publish without loss, so expand the copies the guide ships.
VS_SOURCE="$(pick_all ValueSet-)"
EXPANSION_SOURCE_DIR="$VS_SOURCE" bash "$SCRIPT_DIR/generate-expansions.sh"
echo ""

# Check if server is available
echo "Checking FHIR server availability..."
if ! curl -sf "$FHIR_SERVER/metadata" > /dev/null 2>&1; then
    echo "ERROR: FHIR server is not available at $FHIR_SERVER"
    echo "Please ensure the server is running."
    exit 1
fi
echo "Server is available."
echo ""

# ─── Idempotence ──────────────────────────────────────────────────────────────
# Skip the upload loop if a representative IG profile is already on the server.
# We use the newest profile (rotator-cuff-follow-up-bundle, ADR-0030, renamed by ADR-0066) as the canary —
# if it's there, every earlier IG artefact has been loaded too. Override with
# FORCE_RELOAD=true to push every profile again (use after FSH edits).
FORCE_RELOAD="${FORCE_RELOAD:-false}"
if [ "$FORCE_RELOAD" != "true" ]; then
    canary=$(curl -s "$FHIR_SERVER/StructureDefinition/rotator-cuff-follow-up-bundle" 2>/dev/null \
             | jq -r '.id // "missing"')
    if [ "$canary" = "rotator-cuff-follow-up-bundle" ]; then
        echo "IG profiles already loaded (canary: rotator-cuff-follow-up-bundle). Skipping."
        echo "(Set FORCE_RELOAD=true to push every profile again after FSH edits.)"
        exit 0
    fi
fi

FAILED_COUNT=0

# Function to upload a resource
upload_resource() {
    local file="$1"
    local filename=$(basename "$file")
    local resource_type=$(jq -r '.resourceType' "$file" 2>/dev/null)
    local resource_id=$(jq -r '.id' "$file" 2>/dev/null)

    if [ "$resource_type" = "null" ] || [ -z "$resource_type" ]; then
        echo "  SKIP: $filename (no resourceType)"
        return
    fi

    # Skip example instances
    if [[ "$filename" == *"Example"* ]]; then
        echo "  SKIP: $filename (example instance)"
        return
    fi

    echo -n "  Loading: $filename ($resource_type/$resource_id)..."

    local response
    local http_code

    # Use PUT to create or update the resource with its ID
    http_code=$(curl -s -o /tmp/response.json -w "%{http_code}" \
        -X PUT \
        -H "Content-Type: application/fhir+json" \
        -d @"$file" \
        "$FHIR_SERVER/$resource_type/$resource_id")

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo " OK"
    else
        echo " FAILED (HTTP $http_code)"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        if [ -f /tmp/response.json ]; then
            jq -r '.issue[]?.diagnostics // .text?.div // "Unknown error"' /tmp/response.json 2>/dev/null | head -2
        fi
    fi
}

# Load resources in the correct order (dependencies first)
echo "Loading CodeSystems..."
for file in "$IG_DIR"/CodeSystem-*.json; do
    [ -f "$file" ] || continue
    upload_resource "$(pick_source "$file")/$(basename "$file")"
done
echo ""

# ValueSets are expanded before upload; expand the published copies where the
# published copies are the ones being loaded.
echo "Loading ValueSets..."
for file in /tmp/fsh-expanded/ValueSet-*.json; do
    [ -f "$file" ] && upload_resource "$file"
done
echo ""

echo "Loading StructureDefinitions (Extensions)..."
# From the published guide when every profile publishes intact, which is what
# gives HAPI pre-built snapshots and stops it generating them lazily (a
# race-condition 500 on concurrent POSTs). USE_FSH_GENERATED=true forces source,
# for a run without --genonce when ig/output is stale.
SD_DIR="$(pick_all StructureDefinition-)"
if [ "$SD_DIR" = "$IG_OUTPUT_DIR" ]; then
    echo "  (from the published guide, snapshots included)"
else
    # Worth saying out loud: without the published snapshots HAPI generates them
    # lazily, and a client that resolves elements against them sees only what
    # each profile constrains.
    echo "  (from source: at least one profile is missing or incomplete in ig/output)"
    python3 "$SCRIPT_DIR/../tools/publish-fidelity.py" --check 2>/dev/null | sed -n '/NOT published/,$p' | head -8
fi
for file in "$SD_DIR"/StructureDefinition-*extension*.json "$SD_DIR"/StructureDefinition-*Extension*.json; do
    [ -f "$file" ] && upload_resource "$file"
done
echo ""

echo "Loading StructureDefinitions (Profiles)..."
for file in "$SD_DIR"/StructureDefinition-*.json; do
    # Skip if already loaded (extensions)
    if [[ "$file" != *"extension"* ]] && [[ "$file" != *"Extension"* ]]; then
        [ -f "$file" ] && upload_resource "$file"
    fi
done
echo ""

echo "Loading Questionnaires..."
for file in "$IG_DIR"/Questionnaire-*.json; do
    [ -f "$file" ] || continue
    src="$(pick_source "$file")"
    [ "$src" = "$IG_DIR" ] && [ -d "$IG_OUTPUT_DIR" ] && \
        echo "  (from source: the published copy of $(basename "$file") is missing content)"
    upload_resource "$src/$(basename "$file")"
done
echo ""

# Cleanup
rm -f /tmp/response.json

if [ "$FAILED_COUNT" -gt 0 ]; then
    echo "ERROR: $FAILED_COUNT resource(s) failed to upload."
    echo "Re-run ./seed/load-profiles.sh once HAPI is fully ready."
    exit 1
fi

echo "=========================================="
echo "  Profile loading complete!"
echo "=========================================="
echo ""
echo "Verify loaded profiles:"
echo "  StructureDefinitions: curl $FHIR_SERVER/StructureDefinition?_summary=count"
echo "  CodeSystems:          curl $FHIR_SERVER/CodeSystem?_summary=count"
echo "  ValueSets:            curl $FHIR_SERVER/ValueSet?_summary=count"
echo ""
# HAPI is a storage tier by design: hapi.fhir.validation.requests_enabled stays
# false, matching HAPI's own production guidance on RequestValidatingInterceptor.
# This block used to tell the operator to flip it to true, which is the one thing
# the architecture decided against.
echo "Profiles are served for \$expand and client-side resolution. HAPI does not"
echo "validate writes: conformance is gated at design time by tools/validate.sh and"
echo "at the client by the validator-service sidecar on port 3500."
echo ""
