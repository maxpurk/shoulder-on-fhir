#!/usr/bin/env bash
# Report every resource whose published form carries less than its source.
# See tools/publish-fidelity.py for what is compared and why.
set -euo pipefail
exec python3 "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/publish-fidelity.py" --check
