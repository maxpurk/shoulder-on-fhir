#!/bin/bash

# generate-expansions.sh
#
# Patches all ValueSet JSON files in ig/fsh-generated/resources/ with a
# pre-computed expansion block so HAPI can serve $expand without a live
# terminology service (required for SNOMED-backed ValueSets and custom
# CodeSystems that may not yet be loaded).
#
# Expansion is derived entirely from the sushi-generated JSON — no
# hardcoded codes here.  Two cases:
#
#   1. compose.include[].concept[] exists (SNOMED-style explicit enumeration)
#      → expansion.contains is built directly from those entries.
#
#   2. compose.include has only a system URL (custom CodeSystem include-all)
#      → the matching CodeSystem-*.json is located by its "url" field and
#        expansion.contains is built from its concept[] array.
#
# Run this after "sushi ." and before "load-profiles.sh".
# It modifies fsh-generated/resources/ in place; those files are regenerated
# by sushi anyway, so the patch is always fresh.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# The guide ships ig/output; fsh-generated is an intermediate. Source directory
# is overridable so the loader can pass whichever one it decided to load from.
IG_DIR="${EXPANSION_SOURCE_DIR:-$SCRIPT_DIR/../ig/fsh-generated/resources}"
OUTPUT_DIR="${EXPANDED_OUTPUT_DIR:-/tmp/fsh-expanded}"
mkdir -p "$OUTPUT_DIR"

if [ ! -d "$IG_DIR" ]; then
    echo "ERROR: fsh-generated/resources not found at $IG_DIR"
    echo "Run 'sushi .' in the ig/ directory first."
    exit 1
fi

if ! command -v jq &>/dev/null; then
    echo "ERROR: jq is required but not installed."
    echo "Install with: brew install jq  (macOS) or apt-get install jq  (Linux)"
    exit 1
fi

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Clean output dir to avoid stale files from previous runs (e.g. after ValueSet Id renames)
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

patched=0
skipped=0

for vs_file in "$IG_DIR"/ValueSet-*.json; do
    [ -f "$vs_file" ] || continue
    filename=$(basename "$vs_file")
    concepts_json=""

    # Determine whether compose.include entries have explicit concept lists
    has_concepts=$(jq '[.compose.include[] | select(.concept != null and (.concept | length) > 0)] | length' "$vs_file")

    if [ "$has_concepts" -gt 0 ]; then
        # ── Case 1: codes are enumerated in compose.include[].concept[] ─────
        # (used by SNOMED-backed ValueSets like rotator-cuff-diagnosis)
        expansion_json=$(jq --arg ts "$TIMESTAMP" '{
            timestamp: $ts,
            contains: [
                .compose.include[] |
                .system as $sys |
                (.concept // [])[] |
                {system: $sys, code: .code, display: .display}
            ]
        } | .total = (.contains | length)' "$vs_file")

    else
        # ── Case 2: include all codes from a referenced CodeSystem ───────────
        # (used by custom CodeSystem-backed ValueSets like hand-dominance)
        cs_url=$(jq -r '.compose.include[0].system // empty' "$vs_file")

        if [ -z "$cs_url" ]; then
            echo "  SKIP: $filename (no system URL found in compose.include)"
            skipped=$((skipped + 1))
            continue
        fi

        # Find the CodeSystem file whose "url" matches
        cs_file=""
        for f in "$IG_DIR"/CodeSystem-*.json; do
            [ -f "$f" ] || continue
            url=$(jq -r '.url // empty' "$f" 2>/dev/null)
            if [ "$url" = "$cs_url" ]; then
                cs_file="$f"
                break
            fi
        done

        if [ -z "$cs_file" ]; then
            echo "  SKIP: $filename (no CodeSystem found for $cs_url)"
            skipped=$((skipped + 1))
            continue
        fi

        expansion_json=$(jq --arg sys "$cs_url" --arg ts "$TIMESTAMP" '{
            timestamp: $ts,
            contains: [
                .concept[] |
                {system: $sys, code: .code, display: .display}
            ]
        } | .total = (.contains | length)' "$cs_file")

        # Also populate compose.include[0].concept[] from the CodeSystem so
        # HAPI can expand in-memory without Hibernate Search (same mechanism
        # it uses for SNOMED ValueSets that enumerate concepts explicitly).
        concepts_json=$(jq '[.concept[] | {code: .code, display: .display}]' "$cs_file")
    fi

    # Write expansion (and, for custom CS, explicit compose concepts) into
    # the output directory (never modifies the read-only ig/ mount).
    out_file="$OUTPUT_DIR/$(basename "$vs_file")"
    if [ -n "$concepts_json" ]; then
        jq --argjson exp "$expansion_json" --argjson concepts "$concepts_json" \
            '.expansion = $exp | .compose.include[0].concept = $concepts' \
            "$vs_file" > "$out_file"
        concepts_json=""
    else
        jq --argjson exp "$expansion_json" '. + {expansion: $exp}' "$vs_file" > "$out_file"
    fi

    total=$(echo "$expansion_json" | jq '.total')
    echo "  Patched: $filename ($total codes)"
    patched=$((patched + 1))
done

echo ""
echo "Done: $patched ValueSet(s) patched with expansions, $skipped skipped."
