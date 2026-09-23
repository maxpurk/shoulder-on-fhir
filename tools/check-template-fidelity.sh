#!/bin/bash
# Guard every value a contained extraction template restates against the profile
# it claims. See template-fidelity.py for what is checked and why.
#
# Run after any change to a profile or to a template Questionnaire, and before a
# deploy-mirror push.
#
# Usage: ./tools/check-template-fidelity.sh [--verbose]   (exit 0 = clean, 1 = findings)
set -euo pipefail
exec python3 "$(dirname "$0")/template-fidelity.py" "$@"
