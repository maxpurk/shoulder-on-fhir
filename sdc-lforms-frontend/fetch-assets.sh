#!/usr/bin/env sh
# Vendor the LHC-Forms build at image-build time. Same version and CDN the
# standalone experiment uses.
set -eu
LFORMS_VERSION="${LFORMS_VERSION:-43.1.0}"
CDN="https://lhcforms-static.nlm.nih.gov/lforms-versions/${LFORMS_VERSION}"
DIR="web/lforms-assets"
mkdir -p "$DIR/assets/lib" "$DIR/fhir/R4"
curl -fsSL "$CDN/webcomponent/styles.css"             -o "$DIR/styles.css"
curl -fsSL "$CDN/webcomponent/assets/lib/zone.min.js" -o "$DIR/assets/lib/zone.min.js"
curl -fsSL "$CDN/webcomponent/lhc-forms.js"           -o "$DIR/lhc-forms.js"
curl -fsSL "$CDN/fhir/R4/lformsFHIR.min.js"           -o "$DIR/fhir/R4/lformsFHIR.min.js"
echo "$LFORMS_VERSION" > "$DIR/VERSION"
