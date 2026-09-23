# The pinned FHIR Validator CLI, in one place.
#
# Sourced by tools/validate.sh, build-and-deploy.sh and deploy/bootstrap-server.sh.
# It exists because the pin used to live in bootstrap-server.sh alone while the
# other two fetched `releases/latest`, so which validator a host ran depended on
# the day it was provisioned, and a jar left behind by an unpinned fetch was
# never caught. That is the failure ADR-0194 was written about: validator 6.10.4
# removed the no-arg ValidationService() constructor validator-service compiles
# against, and a from-scratch rebuild died there.
#
# To move up: bump both values together, recompile validator-service, and re-run
# tools/validate.sh before trusting the output.

VALIDATOR_VERSION="6.10.0"
VALIDATOR_SHA256="fc663ae55dd31bbfde19788dddfb49cacbeebc3c64498fa7b7779df90000434b"
VALIDATOR_URL="https://github.com/hapifhir/org.hl7.fhir.core/releases/download/${VALIDATOR_VERSION}/validator_cli.jar"

validator_sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# Fetch when absent, then verify on every run, not only after a download.
ensure_pinned_validator() {
  local jar="$1"
  if [ ! -f "$jar" ]; then
    echo "==> FETCH  validator_cli.jar absent — fetching pinned ${VALIDATOR_VERSION} (~250 MB)"
    curl -fL --progress-bar -o "$jar" "$VALIDATOR_URL"
  fi
  local actual
  actual="$(validator_sha256_of "$jar")"
  if [ "$actual" != "$VALIDATOR_SHA256" ]; then
    echo "ERROR: $jar is not the pinned ${VALIDATOR_VERSION} build." >&2
    echo "  expected sha256 $VALIDATOR_SHA256" >&2
    echo "  actual   sha256 $actual" >&2
    echo "  Delete it and re-run to fetch the pinned release." >&2
    return 1
  fi
  echo "  Validator jar verified (${VALIDATOR_VERSION})"
}
