#!/bin/bash
# Restart the FHIR Validator sidecar (ADR-0051) and wait for /health.
#
# Use this after the IG package changes (sushi rerun, IG Publisher rerun) but
# you don't want to do a full build-and-deploy. The sidecar loads the IG once
# at startup, so a restart is necessary for new profiles to take effect.
#
# Fail-open: if the sidecar doesn't come back inside the timeout, exit with
# code 0 and a warning. Frontends fall back to the unavailability banner —
# they were never meant to depend on this service being up.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

if ! docker compose ps validator-service --status=running --quiet > /dev/null 2>&1; then
  echo "validator-service is not running; starting it…"
  docker compose up -d validator-service
else
  echo "Restarting validator-service…"
  docker compose restart validator-service
fi

attempts=0
until curl -sf http://localhost:3500/health > /dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 24 ]; then
    echo "  validator-service did not respond on /health after 2 min." >&2
    echo "  Frontends will show the fail-open banner. Check 'docker compose logs validator-service'." >&2
    exit 0
  fi
  sleep 5
done

echo "  validator-service ready: $(curl -s http://localhost:3500/health)"
