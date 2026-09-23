#!/usr/bin/env bash
# Terminology refresh: reindex Lucene + invalidate every IG ValueSet expansion.
#
# Lucene is mounted on tmpfs (docker-compose.yml) so the index is wiped on
# every HAPI restart. Pre-expand fires once on startup against an empty (or
# only partially-indexed) Lucene, caches "EXPANDED with 0 concepts" in
# trm_valueset, and never retries — so dropdowns and $expand return empty
# even though the CodeSystems are fully loaded and $lookup works. Fix:
# rebuild Lucene from postgres, then invalidate every IG ValueSet's stale
# expansion so HAPI's scheduled pre-expander (or the next in-memory $expand)
# repopulates correctly. See ADR-0053 §Consequences.
#
# Used by build-and-deploy.sh under its TERM_REFRESH trigger, and runnable
# standalone after any out-of-band HAPI restart (docker compose restart,
# Docker Desktop quit, OOM, system reboot) that bypassed build-and-deploy.sh.
#
# Usage:  ./tools/term-refresh.sh
# Assumes HAPI is up at http://localhost:8080.

set -e

HAPI_BASE="${HAPI_BASE:-http://localhost:8080/fhir/DEFAULT}"

echo "==> TERM   Reindexing Lucene and invalidating IG ValueSet expansions"
curl -s -X POST "$HAPI_BASE/\$reindex-terminology" \
  -H "Content-Type: application/fhir+json" \
  -d '{"resourceType":"Parameters"}' > /dev/null

# Collect VS ids to invalidate: every ValueSet whose canonical URL starts
# with https://maxpurk.github.io/shoulder-on-fhir (the IG namespace). HAPI's scheduled pre-expansion
# can run while CodeSystem indexing is still in flight, cache EXPANDED with
# 0 concepts in trm_valueset, and never recover without invalidation.
#
# Enumeration must paginate via Bundle.link[rel=next] rather than rely on a
# single _count=200 request: after the UV+terminology pack load (ADR-0053,
# ~750 ValueSets) the IG-namespaced VSs sit past page 1 alphabetically. A
# naive ?_count=200 query returns only base/HL7-terminology VSs, the
# invalidation loop processes zero IG VSs, and a coin-flip subset stays
# cached at 0 concepts (regression observed 2026-05-22). HAPI returns
# Bundle.total=null on this query (count calc is skipped for performance),
# so we follow link.next until exhausted instead of trusting a total.
# _elements=id,url trims the response to the two fields we need.
ig_ids=""
next_url="$HAPI_BASE/ValueSet?_count=200&_elements=id,url"
pages=0
while [ -n "$next_url" ] && [ "$next_url" != "null" ]; do
  page=$(curl -s "$next_url")
  page_ids=$(echo "$page" | jq -r '.entry[]?.resource | select(.url | startswith("https://maxpurk.github.io/shoulder-on-fhir")) | .id')
  [ -n "$page_ids" ] && ig_ids="$ig_ids $page_ids"
  next_url=$(echo "$page" | jq -r '[.link[]? | select(.relation == "next") | .url] | first // ""')
  pages=$((pages + 1))
done
ig_count=$(echo "$ig_ids" | wc -w | tr -d ' ')
echo "  Enumerated $ig_count IG-namespaced ValueSets across $pages page(s)"

invalidated=0
for id in $ig_ids; do
  curl -s -X POST "$HAPI_BASE/ValueSet/$id/\$invalidate-expansion" \
    -H "Content-Type: application/fhir+json" \
    -d '{"resourceType":"Parameters"}' > /dev/null
  invalidated=$((invalidated + 1))
done
echo "  Invalidated $invalidated IG ValueSet expansions."

# Force immediate re-expansion via instance-level $expand on each VS.
# The scheduled pre-expander is unreliable after invalidation — at least one
# VS routinely stays stuck at "NOT_EXPANDED with 0 concepts" past any
# reasonable polling window (observed 2026-05-24: goutallier-classification
# stayed at 0 for 90+ seconds while satisfaction-scale, cofield, patte all
# recovered in <5s). Instance-level POST /ValueSet/{id}/$expand computes the
# expansion synchronously and unsticks subsequent URL-form $expand calls
# from the same cache slot.
echo "  Forcing instance-level \$expand on each IG VS to bypass pre-expander..."
populated=0
empty=0
for id in $ig_ids; do
  count=$(curl -s -X POST "$HAPI_BASE/ValueSet/$id/\$expand" \
    -H "Content-Type: application/fhir+json" \
    -d '{"resourceType":"Parameters"}' \
    | jq -r '.expansion.contains | length // 0')
  if [ "$count" -gt 0 ]; then
    populated=$((populated + 1))
  else
    empty=$((empty + 1))
  fi
done
echo "  Populated $populated of $((populated + empty)) IG VSs (empty: $empty — SNOMED-backed VSs may need extra time if tx.fhir.org is slow)."

# Canary 1: an IG VS that's almost always loaded early and rarely fails.
echo -n "  Verifying canary (goutallier-classification via URL form): "
for i in 1 2 3 4 5 6; do
  count=$(curl -s "$HAPI_BASE/ValueSet/\$expand?url=https://maxpurk.github.io/shoulder-on-fhir/ValueSet/goutallier-classification" \
          | jq -r '.expansion.contains | length // 0')
  if [ "$count" -gt 0 ]; then echo "✓ ($count concepts)"; break; fi
  if [ "$i" = 6 ]; then echo "⚠ timeout — URL-form $expand still empty; instance-form likely works, check HAPI logs if frontends report blanks"; fi
  sleep 5
done

# Canary 2: a previously-stuck IG VS. Guards against the enumeration
# regression class going forward — if the pagination loop ever misses
# IG VSs again, cofield stays at 0 and this canary fails.
echo -n "  Verifying canary (cofield-tear-size-classification via URL form): "
for i in 1 2 3 4 5 6; do
  count=$(curl -s "$HAPI_BASE/ValueSet/\$expand?url=https://maxpurk.github.io/shoulder-on-fhir/ValueSet/cofield-tear-size-classification" \
          | jq -r '.expansion.contains | length // 0')
  if [ "$count" -gt 0 ]; then echo "✓ ($count concepts)"; break; fi
  if [ "$i" = 6 ]; then echo "⚠ timeout — IG VS enumeration may have regressed (see ADR-0053)"; fi
  sleep 5
done
