#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu VPS before the first ./build-and-deploy.sh
# run. Installs the host-level dependencies build-and-deploy.sh assumes are
# already present on a dev's Mac (Docker, jq, Node/SUSHI for FSH compilation
# — fsh-generated/ is gitignored so sushi always runs on a fresh clone) and
# fetches the FHIR Validator CLI jar that's gitignored (~180 MB, not shipped
# via git).
set -euo pipefail

echo "==> Docker + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
else
  echo "  already installed — skipping"
fi

echo "==> jq"
if ! command -v jq >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq jq
else
  echo "  already installed — skipping"
fi

# SUSHI is pinned for the same reason as the validator CLI below: it compiles
# the FSH into the StructureDefinitions that ARE the guide, so an unpinned
# `npm install -g fsh-sushi` means the artifact depends on the day a host was
# provisioned. To move up: bump SUSHI_VERSION, recompile, and re-run
# tools/validate.sh.
SUSHI_VERSION="3.20.0"

echo "==> Node.js 20 + SUSHI ${SUSHI_VERSION}"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
INSTALLED_SUSHI="$(sushi --version 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1 | tr -d 'v' || true)"
if [ "$INSTALLED_SUSHI" != "$SUSHI_VERSION" ]; then
  echo "  installing fsh-sushi@${SUSHI_VERSION} (found: ${INSTALLED_SUSHI:-none})"
  npm install -g "fsh-sushi@${SUSHI_VERSION}" >/dev/null
else
  echo "  already at ${SUSHI_VERSION} — skipping"
fi

echo "==> Java 11+ (for the FHIR Validator CLI — tools/validate.sh runs validator_cli.jar"
echo "    directly on the host; unlike the IG Publisher, which runs its own Java inside Docker)"
if ! command -v java >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq openjdk-17-jre-headless
else
  echo "  already installed — skipping"
fi

# Pinned, not "latest". validator-service/src/ValidatorServer.java compiles
# against this jar, and the engine's Java API is not stable across releases:
# 6.10.4 removed the no-arg ValidationService() constructor the server calls,
# so a bootstrap that resolved "latest" failed the validator-service image
# build outright on a from-scratch rebuild. Pinning also keeps the runtime
# sidecar on the same engine the examples were validated against, so a clean
# rebuild reproduces the artifact instead of revalidating it against whatever
# shipped that week. To move up: bump VALIDATOR_VERSION, recompile
# validator-service against the new jar, and re-run tools/validate.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The version and digest live in tools/validator-pin.sh, which build-and-deploy.sh
# and tools/validate.sh source as well, so a host cannot end up running a
# different validator than the one the artifact was validated against.
# shellcheck source=../tools/validator-pin.sh
. "$SCRIPT_DIR/tools/validator-pin.sh"

echo "==> FHIR Validator CLI ${VALIDATOR_VERSION} (~180 MB)"
VALIDATOR_JAR="$SCRIPT_DIR/tools/validator_cli.jar"
if [ ! -f "$VALIDATOR_JAR" ]; then
  curl -L --progress-bar -o "$VALIDATOR_JAR" \
    "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/${VALIDATOR_VERSION}/validator_cli.jar"
else
  echo "  already present — skipping"
fi
# Verify regardless of whether we just downloaded it: a jar left over from an
# unpinned bootstrap is the exact failure this pin exists to catch.
ACTUAL_SHA256="$(sha256sum "$VALIDATOR_JAR" | cut -d' ' -f1)"
if [ "$ACTUAL_SHA256" != "$VALIDATOR_SHA256" ]; then
  echo "ERROR: tools/validator_cli.jar is not the pinned ${VALIDATOR_VERSION} build." >&2
  echo "  expected sha256 $VALIDATOR_SHA256" >&2
  echo "  actual   sha256 $ACTUAL_SHA256" >&2
  echo "  Delete the jar and re-run this script to fetch the pinned release." >&2
  exit 1
fi
echo "  sha256 verified (${VALIDATOR_VERSION})"

echo ""
echo "Done. Run ./build-and-deploy.sh next."
