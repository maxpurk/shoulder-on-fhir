#!/usr/bin/env python3
"""Does publishing a resource lose any of its content?

`ig/output` is the machine-readable form of the guide: `package.tgz` is what an
implementer installs and what the validator loads, and its StructureDefinitions
carry the snapshots a client needs to resolve an element. So the demonstrator
should load what the guide ships.

It cannot do that blindly. The IG Publisher normalises `Questionnaire.contained[]`
through its internal R5 model, and that round-trip drops every element R4 has and
R5 does not, without reporting anything. A resource that loses content must keep
being loaded from source until the loss is fixed upstream.

Comparison is on leaf element paths with array indices collapsed, so it catches
the next divergence without anyone knowing in advance which element it will be.

  --check          report every lossy resource, exit 1 if there are any
  --pick <file>    print the directory to load that resource from
  --pick-all <p>   print the directory for a whole resource type (prefix, e.g.
                   ValueSet-), choosing source unless every one of them is clean
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'ig', 'fsh-generated', 'resources')
OUT = os.path.join(HERE, '..', 'ig', 'output')

# The publisher adds these; their absence from the source is not a loss.
ADDED_BY_PUBLISHER = ('snapshot', 'text.', 'text', 'meta.lastUpdated')


def leaves(node, path=''):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from leaves(v, f'{path}.{k}' if path else k)
    elif isinstance(node, list):
        for v in node:
            yield from leaves(v, path)
    else:
        yield path


def lost(name):
    """Leaf paths present in the source and absent from the published form."""
    a_path, b_path = os.path.join(SRC, name), os.path.join(OUT, name)
    if not os.path.exists(b_path):
        return None            # never published; caller decides what that means
    # A published copy older than the source is a previous build's answer, and
    # running what the guide ships is only right while the guide ships what was
    # last compiled. Falling back to source is the fix for content, whose
    # compiled form is complete.
    #
    # It is not the fix for a profile. A compiled profile carries only what it
    # constrains; the snapshot saying what it inherits is added by publishing.
    # Loading the compiled one trades a profile that is out of date for one that
    # cannot say what an element's cardinality is, which is worse and just as
    # quiet: the extractor then wrote a repeating element as a single object. A
    # stale profile is reported instead, and the remedy is to rebuild the guide.
    if os.path.getmtime(a_path) > os.path.getmtime(b_path):
        return None if not name.startswith('StructureDefinition-') else []
    try:
        a, b = json.load(open(a_path)), json.load(open(b_path))
    except Exception:
        return None
    missing = set(leaves(a)) - set(leaves(b))
    return sorted(m for m in missing if not m.startswith(ADDED_BY_PUBLISHER))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    if sys.argv[1] == '--pick':
        name = os.path.basename(sys.argv[2])
        missing = lost(name)
        # Unpublished or lossy: the source is the only complete copy.
        print(SRC if missing is None or missing else OUT)
        return 0

    if sys.argv[1] == '--pick-all':
        prefix = sys.argv[2]
        names = [n for n in os.listdir(SRC) if n.startswith(prefix) and n.endswith('.json')]
        # All or nothing: these are loaded as a directory, so one lossy member
        # means the directory cannot be taken from the published guide.
        for n in names:
            missing = lost(n)
            if missing is None or missing:
                print(SRC)
                return 0
        print(OUT if names else SRC)
        return 0

    if sys.argv[1] != '--check':
        print(__doc__)
        return 2

    if not os.path.isdir(SRC):
        print('no ig/fsh-generated/resources: run sushi first')
        return 1
    if not os.path.isdir(OUT):
        print('no ig/output: run build-and-deploy.sh --genonce first')
        return 1

    lossy, unpublished, stale, clean = [], [], [], 0
    for name in sorted(os.listdir(SRC)):
        if not name.endswith('.json'):
            continue
        out_path = os.path.join(OUT, name)
        if not os.path.exists(out_path):
            unpublished.append(name)
            continue
        if os.path.getmtime(os.path.join(SRC, name)) > os.path.getmtime(out_path):
            stale.append(name)
        missing = lost(name)
        if missing:
            lossy.append((name, missing))
        else:
            clean += 1

    print(f'{clean} resource(s) publish without loss')
    if unpublished:
        print(f'\n{len(unpublished)} compiled but NOT published:')
        for n in unpublished:
            print(f'  {n}')
    if stale:
        profiles = [n for n in stale if n.startswith('StructureDefinition-')]
        print(f'\n{len(stale)} published before their source last changed, so out of date:')
        for n in stale[:6]:
            print(f'  {n}')
        if len(stale) > 6:
            print(f'  and {len(stale) - 6} more')
        if profiles:
            print(f'\n{len(profiles)} of those are profiles, still loaded from the published')
            print('guide because only that carries their snapshots. Rebuild the guide so the')
            print('server stops serving the previous version of them.')
    if lossy:
        print(f'\n{len(lossy)} resource(s) lose content when published:')
        for name, missing in lossy:
            print(f'  {name}  ({len(missing)} leaf path(s))')
            for m in missing[:8]:
                print(f'      {m}')
            if len(missing) > 8:
                print(f'      and {len(missing) - 8} more')
        print('\nEach is loaded from source instead of from the published guide.')
    return 1 if (lossy or unpublished or stale) else 0


if __name__ == '__main__':
    sys.exit(main())
