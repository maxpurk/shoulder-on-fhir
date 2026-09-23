#!/usr/bin/env bash
# Syncs shared/*.ts into frontend/src/lib/shared/ and
# sdc-frontend/src/lib/shared/ — see shared/constantScore.ts's own header
# comment for why this codegen approach is used instead of a real shared
# package/Vite alias (ADR-0157: each frontend's Docker build context is
# scoped to its own directory, so a cross-directory import works in local
# `npm run dev` but fails inside the actual deployed Docker build).
#
# Run this after editing anything in shared/ — build-and-deploy.sh already
# runs it automatically before the frontend Docker builds, so a real deploy
# never serves a stale copy; only local `npm run dev` against a forgotten
# manual run can drift.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARED_DIR="$PROJECT_ROOT/shared"

sync_target() {
  local target_dir="$1"
  mkdir -p "$target_dir"
  for src_file in "$SHARED_DIR"/*.ts; do
    local base
    base="$(basename "$src_file")"
    local dest="$target_dir/$base"
    {
      echo "// ============================================================"
      echo "// GENERATED FILE — do not edit directly."
      echo "// Canonical source: shared/$base"
      echo "// Regenerate via: tools/sync-shared-code.sh"
      echo "// ============================================================"
      echo ""
      cat "$src_file"
    } > "$dest"
    echo "  Synced: $target_dir/$base"
  done
}

echo "==> Syncing shared/*.ts into both frontends..."
sync_target "$PROJECT_ROOT/frontend/src/lib/shared"
sync_target "$PROJECT_ROOT/sdc-frontend/src/lib/shared"
echo "Done."
