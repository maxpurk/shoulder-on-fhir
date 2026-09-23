#!/bin/bash
# Guard against shorthand artefact names (…VS / …CS) that no declared artefact carries.
#
# The IG declares its ValueSets and CodeSystems without a type suffix
# (`ShoulderLaterality`, `ShoulderObservationCodes`). Writing `ShoulderLateralityVS`
# or `ShoulderObservationCS` in prose invents a name a reader cannot look up: it
# matches nothing in the published guide, nothing in the FSH, and nothing in HAPI.
#
# This check derives the shorthand forms from the names actually declared in
# ig/input/fsh/ and fails if any of them appears in the FSH itself, the published
# narrative, the README, the mapping, the example-data stories, the .http request
# files, or anything under docs/. Real words that end in VS/CS
# (PACS) are never flagged, because only derived forms are searched. A line that
# must quote the shorthand deliberately opts out with
# `<!-- check-artifact-names:allow -->`.
#
# Usage: ./tools/check-artifact-names.sh [extra-glob ...]   (exit 0 = clean, 1 = findings)
#
# Extra globs are scanned in addition to the built-in targets, so a caller that
# keeps prose outside this directory can point the same check at it, e.g.
#   ./tools/check-artifact-names.sh '../some-doc-dir/*.md'

set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 - "$@" <<'PY'
import re, io, glob, sys, os

vs, cs = set(), set()
for f in glob.glob('ig/input/fsh/valuesets/*.fsh'):
    vs |= set(re.findall(r'^ValueSet:\s*(\S+)', io.open(f, encoding='utf-8').read(), re.M))
for f in glob.glob('ig/input/fsh/codesystems/*.fsh'):
    cs |= set(re.findall(r'^CodeSystem:\s*(\S+)', io.open(f, encoding='utf-8').read(), re.M))

M = {}
for v in vs:
    M[v + 'VS'] = v
for c in cs:
    M[c + 'CS'] = c
    if c.endswith('Codes'):
        M[c[:-5] + 'CS'] = c
if not M:
    print('no artefacts found under ig/input/fsh/ — run from the project root'); sys.exit(2)

targets = (glob.glob('ig/input/pagecontent/*.md')
           + glob.glob('ig/input/fsh/**/*.fsh', recursive=True)
           + glob.glob('mapping/*.csv') + glob.glob('mapping/*.md')
           + glob.glob('docs/**/*.md', recursive=True)
           + glob.glob('example_data/*.md') + glob.glob('fhir-requests/*.http')
           + ['README.md'])
# Callers may extend the sweep without this script hard-coding paths outside the
# directory it ships in.
for extra in sys.argv[1:]:
    targets += glob.glob(extra, recursive=True)

pat = re.compile(r'\b(' + '|'.join(sorted(M, key=len, reverse=True)) + r')\b')

# the same shorthand also occurs space-separated ("RotatorCuffEtiology VS")
sep = re.compile(r'\b(' + '|'.join(sorted(vs | cs, key=len, reverse=True)) + r') (VS|CS)\b')

found = 0
for f in sorted(targets):
    if not os.path.exists(f):
        continue
    for i, line in enumerate(io.open(f, encoding='utf-8', errors='replace'), 1):
        # A line may quote the shorthand deliberately (ADR-0182, which defines this
        # rule, cites the bad forms as counter-examples). Opt out per line with an
        # HTML comment: <!-- check-artifact-names:allow -->
        if 'check-artifact-names:allow' in line:
            continue
        for m in pat.finditer(line):
            found += 1
            print('  %s:%d  %s  ->  %s' % (f, i, m.group(1), M[m.group(1)]))
        for m in sep.finditer(line):
            found += 1
            kind = 'ValueSet' if m.group(2) == 'VS' else 'CodeSystem'
            print('  %s:%d  %s  ->  %s %s' % (f, i, m.group(0), m.group(1), kind))

print('%d shorthand artefact name(s) found (%d declared forms checked)' % (found, len(M)))
sys.exit(1 if found else 0)
PY
