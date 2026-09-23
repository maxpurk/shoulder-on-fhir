#!/bin/bash
# Guard every element id a Questionnaire names against the compiled profiles.
#
# Two kinds are named. `item.definition` says which element an answer fills, and the
# SDC extraction extensions `definitionExtract` and `definitionExtractValue` say which
# profile to create and which element to write a declared value into. Both are checked
# here, because an id that names nothing is equally dead in either, and the extraction
# extensions had carried unresolvable ids for months while only item.definition was
# guarded.
#
# FHIR R4 is explicit about what may follow the "#" in item.definition: "a fragment
# identifier is used to specify the element definition by its id", and its own example
# is `.../StructureDefinition/Observation#Observation.value[x]`. A fragment that names
# no ElementDefinition resolves to nothing for any consumer that follows the
# specification, and nothing in the build catches it: sushi does not read fragments,
# and the publisher reports only a broken hyperlink, which reads as a rendering
# complaint rather than the modelling defect it is.
#
# This check resolves every fragment against the StructureDefinitions sushi actually
# compiled, walking baseDefinition and crossing into a complex datatype's own
# definition where a path goes deeper. It fails if any fragment names an element that
# does not exist.
#
# It also reports, for each choice element, the concrete property name the SDC
# frontend reconstructs from the resolved type (`value[x]` + Quantity -> valueQuantity).
# That column is the regression guard for extractor.ts: the reconstruction has to keep
# producing the same property FHIR itself names, or extraction writes to the wrong key.
#
# Run after any change to the Questionnaires, to a profile's value[x] type, or to the
# reconstruction logic in sdc-frontend/src/lib/.
#
# Usage: ./tools/check-questionnaire-definitions.sh [--verbose]   (exit 0 = clean, 1 = findings)

set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d ig/fsh-generated/resources ]; then
  echo "ig/fsh-generated/resources not found. Run 'sushi .' in ig/ first." >&2
  exit 1
fi

VERBOSE=0
[ "${1:-}" = "--verbose" ] && VERBOSE=1

VERBOSE=$VERBOSE python3 - <<'PY'
import json, glob, os, re, sys, collections

VERBOSE = os.environ.get('VERBOSE') == '1'
SD = {}


def load(path):
    try:
        d = json.load(open(path, encoding='utf-8'))
    except Exception:
        return
    if isinstance(d, dict) and d.get('resourceType') == 'StructureDefinition' and d.get('url'):
        SD.setdefault(d['url'], d)


# The compiled source first: it is what the FSH currently says exists, and a narrowing
# a single slice declares for itself lives there. The published copies come second,
# because only they carry snapshots, and a snapshot is what expands a named slice's
# child tree. A published copy older than its source would otherwise decide the answer,
# which is how a stale build directory came to report an ambiguous choice as resolvable.
for f in glob.glob('ig/fsh-generated/resources/StructureDefinition-*.json'):
    load(f)
for f in glob.glob('ig/output/StructureDefinition-*.json'):
    load(f)
for f in glob.glob(os.path.expanduser('~/.fhir/packages/*/package/StructureDefinition-*.json')):
    load(f)

PRIMITIVES = {
    'base64Binary', 'boolean', 'canonical', 'code', 'date', 'dateTime', 'decimal', 'id',
    'instant', 'integer', 'markdown', 'oid', 'positiveInt', 'string', 'time', 'unsignedInt',
    'uri', 'url', 'uuid', 'xhtml',
}


def elements(sd):
    return (sd.get('snapshot') or {}).get('element', []) + (sd.get('differential') or {}).get('element', [])


def declared_types(url, eid, depth=0):
    """Every type code the element declares, or [] if it exists without one.

    Returns None when no element with this id is declared anywhere in the chain.
    """
    if depth > 6:
        return None
    sd = SD.get(url)
    if not sd:
        return None
    for el in elements(sd):
        if el.get('id') == eid:
            return [t.get('code', '') for t in (el.get('type') or [])]
    base = sd.get('baseDefinition')
    if not base:
        return None
    found = declared_types(base, eid, depth + 1)
    if found is not None:
        return found
    rt = (SD.get(base) or {}).get('type')
    if rt and '.' in eid:
        return declared_types(base, rt + eid[eid.index('.'):], depth + 1)
    return None


def declared(url, eid, depth=0):
    """The element's first declared type code, or '' if it exists without one."""
    types = declared_types(url, eid, depth)
    if types is None:
        return None
    return types[0] if types else ''


def unslice_tail(eid):
    """The same id with any name slices dropped, keeping type slices.

    A named slice inherits every child of the element it slices, and a snapshot
    spells those children out while a differential does not. `activity:sixWeeks.
    detail.status` is therefore the same element as `activity.detail.status`. A
    type slice is kept, because `performed[x]:performedDateTime` chooses a type
    and dropping it would lose exactly what the id was written to say.
    """
    out, changed = [], False
    for seg in eid.split('.'):
        name, _, slice_name = seg.partition(':')
        if slice_name and not slice_name[:1].islower() or not slice_name:
            out.append(seg)
            continue
        if name.endswith('[x]'):
            out.append(seg)
            continue
        out.append(name)
        changed = True
    return '.'.join(out) if changed else None


def resolve(url, eid):
    """Resolve an element id, crossing into a complex datatype where the path goes deeper."""
    direct = declared(url, eid)
    if direct is not None:
        return direct
    plain = unslice_tail(eid)
    if plain:
        via_slice = declared(url, plain)
        if via_slice is not None:
            return via_slice
    # Crossing into a datatype. The prefix is read as the id writes it, slice names
    # and all, and only then unsliced, so a narrowing a single slice declares for
    # itself is what decides the type rather than the three its parent allows. A
    # choice that still declares more than one type here is not resolvable: the id
    # walks into a datatype without saying which one, and an engine would have to
    # guess. That is the defect this guard exists to catch.
    written = eid.split('.')
    fallback = (plain or eid).split('.')
    for segs in (written, fallback):
        for i in range(len(segs) - 1, 1, -1):
            types = declared_types(url, '.'.join(segs[:i]))
            if not types:
                continue
            if len(types) > 1:
                return None
            prefix_type = types[0]
            if prefix_type in PRIMITIVES:
                continue
            nested = f'http://hl7.org/fhir/StructureDefinition/{prefix_type}'
            inner = resolve(nested, prefix_type + '.' + '.'.join(segs[i:]))
            if inner is not None:
                return inner
    return None


def concrete(segment, type_code):
    if not segment.endswith('[x]'):
        return segment
    return segment[:-3] + (type_code[:1].upper() + type_code[1:] if type_code else '?')


SDC = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-'
EXTRACT, EXTRACT_VALUE = SDC + 'definitionExtract', SDC + 'definitionExtractValue'


def sub(ext, name):
    for s in ext.get('extension', []):
        if s.get('url') == name:
            return s
    return {}


rows, missing = [], []
extract_ok, extract_missing = 0, []
value_rows, value_missing = [], []
for path in sorted(glob.glob('ig/fsh-generated/resources/Questionnaire-*.json')):
    q = json.load(open(path, encoding='utf-8'))
    qid = q.get('id', os.path.basename(path))

    def declarations(node, link):
        """The extraction profiles and element ids declared on one node."""
        global extract_ok
        for ext in node.get('extension', []) or []:
            url = ext.get('url')
            if url == EXTRACT:
                canonical = sub(ext, 'definition').get('valueCanonical')
                if canonical in SD:
                    extract_ok += 1
                else:
                    extract_missing.append((qid, link, canonical))
            elif url == EXTRACT_VALUE:
                d = sub(ext, 'definition')
                target = d.get('valueUri') or d.get('valueCanonical') or ''
                if '#' not in target:
                    value_missing.append((qid, link, target, '(no fragment)'))
                    continue
                u, frag = target.split('#', 1)
                if resolve(u, frag) is None:
                    value_missing.append((qid, link, u.rsplit('/', 1)[-1], frag))
                else:
                    value_rows.append((qid, link, frag))

    def walk(items):
        for item in items:
            link = item.get('linkId', '?')
            d = item.get('definition')
            if d and '#' in d:
                url, frag = d.split('#', 1)
                t = resolve(url, frag)
                if t is None:
                    missing.append((qid, link, url.rsplit('/', 1)[-1], frag))
                else:
                    segs = frag.split('.')
                    rows.append((qid, link, frag, concrete(segs[-1], t), t))
            declarations(item, link)
            walk(item.get('item', []))

    declarations(q, '<root>')
    walk(q.get('item', []))

print(f'Questionnaire.item.definition fragments checked: {len(rows) + len(missing)}')
print(f'  resolve to a declared ElementDefinition: {len(rows)}')
print(f'  unresolved:                              {len(missing)}')
print(f'definitionExtract profiles checked:        {extract_ok + len(extract_missing)}')
print(f'  resolve to a compiled profile:           {extract_ok}')
print(f'  unresolved:                              {len(extract_missing)}')
print(f'definitionExtractValue element ids checked: {len(value_rows) + len(value_missing)}')
print(f'  resolve to a declared ElementDefinition: {len(value_rows)}')
print(f'  unresolved:                              {len(value_missing)}')

choices = [r for r in rows if r[2].split('.')[-1].endswith('[x]')]
if choices:
    kinds = collections.Counter((re.sub(r'component:[A-Za-z]+', 'component:*', r[2]), r[3]) for r in choices)
    print(f'\nchoice elements, with the property the frontend reconstructs ({len(choices)} total):')
    for (frag, prop), n in kinds.most_common():
        print(f'  {n:3d}  {frag:45s} -> {prop}')

if VERBOSE:
    print('\nall resolved fragments:')
    for qid, link, frag, prop, t in rows:
        print(f'  {qid:28s} {link:34s} {frag:48s} {t:16s} {prop}')

if missing or extract_missing or value_missing:
    if missing:
        print('\nitem.definition FRAGMENTS NAMING NO ElementDefinition:', file=sys.stderr)
        for qid, link, prof, frag in missing:
            print(f'  {qid} / {link}: {prof}#{frag}', file=sys.stderr)
    if extract_missing:
        print('\ndefinitionExtract NAMING NO COMPILED PROFILE:', file=sys.stderr)
        for qid, link, canonical in extract_missing:
            print(f'  {qid} / {link}: {canonical}', file=sys.stderr)
    if value_missing:
        print('\ndefinitionExtractValue NAMING NO ElementDefinition:', file=sys.stderr)
        for qid, link, prof, frag in value_missing:
            print(f'  {qid} / {link}: {prof}#{frag}', file=sys.stderr)
    print('\nAn element id has to name an ElementDefinition the profile declares.', file=sys.stderr)
    print('For a choice element that is the bracketed form, e.g. Observation.value[x],', file=sys.stderr)
    print('or its type slice, e.g. Procedure.performed[x]:performedDateTime.', file=sys.stderr)
    sys.exit(1)

print('\nclean')
PY
