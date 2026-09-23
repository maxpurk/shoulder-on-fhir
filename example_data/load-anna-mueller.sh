#!/bin/bash

# Load the Anna Müller longitudinal example into a running HAPI FHIR server.
# Each anna_mueller_*.json file is a FHIR transaction bundle and is POSTed
# to the server root in chronological order.

set -e

FHIR_SERVER="${FHIR_SERVER_URL:-http://localhost:8080/fhir/DEFAULT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# The JSON bundles live under seed/bundles/ (one level up from this
# example_data/ directory); this loader and the narrative walkthrough
# (anna_mueller_story.md) ship alongside them in the published artifact.
BUNDLE_DIR="$SCRIPT_DIR/../seed/bundles/anna-mueller"

echo "=========================================="
echo "  Anna Müller Example Data Loader"
echo "=========================================="
echo "FHIR Server: $FHIR_SERVER"
echo ""

if ! curl -sf "$FHIR_SERVER/metadata" > /dev/null 2>&1; then
    echo "ERROR: FHIR server is not available at $FHIR_SERVER"
    exit 1
fi

for bundle in "$BUNDLE_DIR"/anna_mueller_0*.json; do
    name="$(basename "$bundle")"
    echo "Loading $name..."
    http_code=$(curl -s -o /tmp/anna_response.json -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/fhir+json" \
        --data-binary "@$bundle" \
        "$FHIR_SERVER")

    if [[ "$http_code" =~ ^2 ]]; then
        echo "  OK ($http_code)"
    else
        echo "  FAILED ($http_code)"
        cat /tmp/anna_response.json
        echo ""
        exit 1
    fi
done

echo ""
echo "All Anna Müller bundles loaded successfully."
