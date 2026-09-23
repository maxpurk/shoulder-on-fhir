#!/usr/bin/env python3
"""Hold every value a contained template restates against the profile it claims.

Template-based extraction reads nothing from a StructureDefinition. Each fixed
code, category, unit, status and meta.profile is written out inside the
Questionnaire, so a profile can change and no template follows it. Nothing in
the build fails, and the drift surfaces as a validation error on the next
submission, or not at all where the element is unconstrained.

This resolves every entry of every contained template bundle to the profile its
own meta.profile claims, walks that profile's baseDefinition chain for values it
pins, adds what the containing bundle profile pins on that entry's resource, and
compares the two in both directions. It fails if a literal the template states
disagrees with what the profile pins there, if the profile makes an element or an
extension mandatory the template can neither state nor fill, or if the template
restates a pin naming several codings and omits one of them.

A pin counts whether it is written as a CodeableConcept, a bare Coding or a bare
code, and whether it sits on a direct child of the resource, inside a backbone or
inside an extension. Paths are compared whole, with an extension matched by the
url an instance writes to the slice a profile pins values on, so two
sub-extensions of one complex extension are never judged against each other.

Only paths a profile actually pins are judged. A literal on a path no profile
constrains is the template's own content and is left alone.

Usage: template-fidelity.py [--verbose]   (exit 0 = clean, 1 = findings)
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# ig/output first, because that is what seed/load-profiles.sh uploads.
DIRS = [os.path.join(ROOT, 'ig', 'output'),
        os.path.join(ROOT, 'ig', 'fsh-generated', 'resources')]

VERBOSE = '--verbose' in sys.argv


def declared_questionnaire_ids():
    """The Questionnaires the FSH currently declares.

    `ig/output` is a build directory and can hold a resource the source has since
    retired. The compiled `fsh-generated` is what the source says exists, so it
    decides which Questionnaires are examined, while `ig/output` still decides
    their content, the same per-resource choice `seed/load-profiles.sh` makes.
    """
    gen = os.path.join(ROOT, 'ig', 'fsh-generated', 'resources')
    if not os.path.isdir(gen):
        return None
    ids = set()
    for name in os.listdir(gen):
        if not name.startswith('Questionnaire-') or not name.endswith('.json'):
            continue
        try:
            with open(os.path.join(gen, name), encoding='utf-8') as fh:
                doc = json.load(fh)
        except (ValueError, OSError):
            continue
        if isinstance(doc, dict) and doc.get('id'):
            ids.add(doc['id'])
    return ids


def load_all():
    """canonical -> StructureDefinition, and id -> Questionnaire."""
    sds, qs = {}, {}
    for d in DIRS:
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            if not name.endswith('.json'):
                continue
            try:
                with open(os.path.join(d, name), encoding='utf-8') as fh:
                    doc = json.load(fh)
            except (ValueError, OSError):
                continue
            if not isinstance(doc, dict):
                continue
            kind = doc.get('resourceType')
            if kind == 'StructureDefinition' and doc.get('url') not in sds:
                sds[doc['url']] = doc
            elif kind == 'Questionnaire' and doc.get('id') not in qs:
                qs[doc['id']] = doc
    declared = declared_questionnaire_ids()
    if declared is not None:
        qs = {k: v for k, v in qs.items() if k in declared}
    return sds, qs


FHIR_CHOICE = re.compile(r'^([a-z][A-Za-z0-9]*?)([A-Z][A-Za-z0-9]+)$')

# An extension names itself by a url that carries dots of its own, and a path is
# read by splitting on dots. The url's dots are held aside while it sits inside
# one path segment, and put back whenever the segment is shown or looked up.
DOT = '\x01'


def readable(path):
    return path.replace(DOT, '.')


def instance_path(path):
    """A profile element path written the way an instance writes it.

    Drops the resource type the path is rooted at and every slice name, so
    `Observation.component:pain.code` and the template's own `component.code`
    are the same path. Slice names go because a template states values, not
    slices; the cost is that two slices pinning the same element merge into one
    set of acceptable values.

    Extension slices keep their name. An extension identifies itself in the
    instance by its url, so the two are matchable, and two sub-extensions of one
    complex extension pin different values at the same stripped path: merging
    them would judge each against the other.
    """
    out = []
    for seg in path.split('.')[1:]:
        name, _, slice_name = seg.partition(':')
        out.append('%s:%s' % (name, slice_name)
                   if slice_name and name in ('extension', 'modifierExtension')
                   else name)
    return '.'.join(out)


def slice_aliases(url, sds, seen=None):
    """Every name an extension slice of this profile answers to.

    A template names an extension by url. The profile names the same extension
    by slice name, and carries the url either as the slice's own name (a
    sub-extension of a complex extension) or as the profile it points at (an
    extension defined elsewhere).
    """
    out, seen = {}, seen or set()
    while url and url in sds and url not in seen:
        seen.add(url)
        for el in sds[url].get('differential', {}).get('element', []):
            eid = el.get('id') or ''
            seg = eid.split('.')[-1]
            name, _, slice_name = seg.partition(':')
            if not slice_name or name not in ('extension', 'modifierExtension'):
                continue
            out[slice_name] = slice_name
            prof = ((el.get('type') or [{}])[0].get('profile') or [None])[0]
            if prof:
                out[prof] = slice_name
        url = sds[url].get('baseDefinition')
    return out


def spellings(path, aliases=None):
    """Every profile-path spelling a literal found at `path` could answer to.

    A profile pins a CodeableConcept whole (`Observation.code`) where the
    template states the coding inside it (`code.coding`), names a choice element
    `value[x]` where the template names the type it chose
    (`valueCodeableConcept`), and names an extension by slice where the template
    names it by url.
    """
    out = {path}
    if path.endswith('.coding'):
        out.add(path[:-len('.coding')])
    for cand in list(out):
        segs = cand.split('.')
        for i, seg in enumerate(segs):
            m = FHIR_CHOICE.match(seg)
            if not m:
                continue
            alt = list(segs)
            alt[i] = m.group(1) + '[x]'
            out.add('.'.join(alt))
    if aliases:
        for cand in list(out):
            segs = cand.split('.')
            hit = False
            for i, seg in enumerate(segs):
                name, _, ref = seg.partition(':')
                ref = readable(ref)
                if ref and name in ('extension', 'modifierExtension') and ref in aliases:
                    segs[i] = '%s:%s' % (name, aliases[ref])
                    hit = True
            if hit:
                out.add('.'.join(segs))
    return out


# A pin on a primitive, compared against a bare literal the template states.
SCALAR_PINS = tuple(
    prefix + suffix
    for prefix in ('fixed', 'pattern')
    for suffix in ('Code', 'Uri', 'Canonical', 'String', 'Id', 'Oid', 'Uuid', 'Url',
                   'Boolean', 'Integer', 'Decimal', 'PositiveInt', 'UnsignedInt',
                   'Date', 'DateTime', 'Instant', 'Time', 'Markdown', 'Base64Binary')
)


def collect_pins(el, path, out):
    """Every fixed or pattern value one element definition states.

    A coded concept contributes each of its codings, a bare coding contributes one,
    and a pin on a primitive contributes a value with no system, so an element fixed
    to a plain code, a status, a class, a url or a flag is comparable against the
    bare literal a template states there. A pin on a complex type other than a
    coding is decomposed by recursion, which is how a fixed `Quantity`'s unit and
    system are reached.
    """
    for key, val in el.items():
        if key.startswith(('patternCodeableConcept', 'fixedCodeableConcept')):
            for cod in val.get('coding', []):
                out.setdefault(path, []).append((cod.get('system'), cod.get('code')))
        elif key in ('fixedCoding', 'patternCoding'):
            out.setdefault(path, []).append((val.get('system'), val.get('code')))
        elif key in SCALAR_PINS:
            out.setdefault(path, []).append((None, val))
        elif key.startswith(('fixed', 'pattern')) and isinstance(val, dict):
            for sub, inner in val.items():
                if isinstance(inner, (str, int, float, bool)):
                    out.setdefault('%s.%s' % (path, sub), []).append((None, inner))


def pinned(url, sds, seen=None):
    """instance path -> list of (system, code) the profile chain pins there."""
    out, seen = {}, seen or set()
    while url and url in sds and url not in seen:
        seen.add(url)
        sd = sds[url]
        for el in sd.get('differential', {}).get('element', []):
            path = instance_path(el.get('id') or el.get('path') or '')
            if path:
                collect_pins(el, path, out)
        url = sd.get('baseDefinition')
    return out


ENTRY_RESOURCE = re.compile(r'^Bundle\.entry:([^.]+)\.resource$')
ENTRY_ELEMENT = re.compile(r'^Bundle\.entry:([^.]+)\.resource\.(.+)$')


def bundle_entry_pins(url, sds, seen=None):
    """(resource type, claimed profile) -> pins the bundle profile puts on it.

    A bundle profile can pin a value on the resource inside one of its entry
    slices, where the resource's own profile leaves that element open. Reading
    only the resource profile misses those, and a template that restates one
    of them wrongly would go unjudged.
    """
    out, seen = {}, seen or set()
    while url and url in sds and url not in seen:
        seen.add(url)
        sd = sds[url]
        slice_key = {}
        for el in sd.get('differential', {}).get('element', []):
            m = ENTRY_RESOURCE.match(el.get('id') or '')
            if not m:
                continue
            t = (el.get('type') or [{}])[0]
            slice_key[m.group(1)] = (t.get('code'), (t.get('profile') or [None])[0])
        for el in sd.get('differential', {}).get('element', []):
            m = ENTRY_ELEMENT.match(el.get('id') or '')
            if not m:
                continue
            key = slice_key.get(m.group(1))
            if not key:
                continue
            path = '.'.join(seg.split(':')[0] for seg in m.group(2).split('.'))
            collect_pins(el, path, out.setdefault(key, {}))
        url = sd.get('baseDefinition')
    return out


def literals(node, path=''):
    """Every concrete coded value a template resource states.

    A coding is read as a (system, code) pair. A bare code, uri or string leaf is
    read with no system, so an element a profile fixes to a plain code, a status
    or a class, is comparable too. Without the bare leaves, half of what a
    profile can pin could never be judged at all.
    """
    found = []
    if isinstance(node, dict):
        # an extension names itself by url, which is how it is matched back to
        # the slice a profile pins values on
        if isinstance(node.get('url'), str) and path.split('.')[-1] in (
                'extension', 'modifierExtension'):
            path = '%s:%s' % (path, node['url'].replace('.', DOT))
        pair = 'system' in node and isinstance(node.get('code'), str)
        if pair:
            found.append((path, node['system'], node['code']))
        for key, val in node.items():
            if pair and key in ('system', 'code'):
                continue
            found += literals(val, '%s.%s' % (path, key) if path else key)
    elif isinstance(node, list):
        for val in node:
            found += literals(val, path)
    elif isinstance(node, str) and path:
        found.append((path, None, node))
    return found


TEV = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue'


def required_top_level(url, sds):
    """Direct children of the resource the profile makes mandatory.

    Read from the snapshot where the published guide supplies one, otherwise by
    walking the differential chain. Deeper paths are left alone: a required
    element inside a repeating backbone is only required once that backbone is
    present, and a template that omits the backbone entirely is not in breach.

    A required extension slice counts as one of those children, keyed by the url
    an instance would write, because an extension a profile makes mandatory is
    as missing as any other required element when a template omits it.
    """
    req, seen = {}, set()
    chain, cur = [], url
    while cur and cur in sds and cur not in seen:
        seen.add(cur)
        chain.append(sds[cur])
        cur = sds[cur].get('baseDefinition')
    for sd in chain:
        els = sd.get('snapshot', {}).get('element') or sd.get('differential', {}).get('element') or []
        for el in els:
            path = el.get('path', '')
            parts = path.split('.')
            if len(parts) != 2 or el.get('min') is None:
                continue
            name = parts[1]
            if name in ('id', 'meta', 'implicitRules', 'language', 'text', 'contained',
                        'extension', 'modifierExtension'):
                continue
            if el.get('min', 0) >= 1:
                req.setdefault(name, path)
        for el in els:
            eid = el.get('id') or ''
            m = re.match(r'^\w+\.(extension|modifierExtension):([^.]+)$', eid)
            if not m or (el.get('min') or 0) < 1:
                continue
            url = ((el.get('type') or [{}])[0].get('profile') or [None])[0]
            if not url:
                for child in els:
                    if child.get('id') == eid + '.url':
                        url = child.get('fixedUri') or child.get('patternUri')
                        break
            if url:
                req.setdefault('%s:%s' % (m.group(1), url), eid)
    return req


def fillable(res, name):
    """Does the template state this element, or an expression that would fill it?"""
    if name.startswith(('extension:', 'modifierExtension:')):
        kind, _, url = name.partition(':')
        return any(e.get('url') == url for e in res.get(kind) or [])
    if name.endswith('[x]'):
        stem = name[:-3]
        return any(k == stem or k.startswith(stem) or k.lstrip('_').startswith(stem)
                   for k in res)
    if name in res:
        return True
    side = res.get('_' + name)
    if isinstance(side, dict):
        return any(e.get('url') == TEV for e in side.get('extension') or [])
    return False


def multi_coding_pins(url, sds, seen=None):
    """path -> the coding sets a single element pins there, those naming several.

    Deliberately not derived from pinned(), which flattens a path's pins into one
    list and so cannot tell one element naming two codings from two elements
    naming one each. Slicing makes that difference material: the four Constant
    sub-score slices each pin one code on Observation.component.code, and
    demanding a template restate all four together would be wrong.
    """
    out, seen = {}, seen or set()
    while url and url in sds and url not in seen:
        seen.add(url)
        for el in sds[url].get('differential', {}).get('element', []):
            path = instance_path(el.get('id') or el.get('path') or '')
            if not path:
                continue
            for key, val in el.items():
                if not key.startswith(('patternCodeableConcept', 'fixedCodeableConcept')):
                    continue
                group = [(c.get('system'), c.get('code')) for c in val.get('coding', [])]
                if len(group) > 1:
                    out.setdefault(path, []).append(group)
        url = sds[url].get('baseDefinition')
    return out


def unstated(groups, stated, aliases=None):
    """Codings of one pin the template started to restate and then left short.

    The literal loop in main() walks the template and asks the profile about what
    it finds, so a coding the template simply omits is never visited. This walks
    the other way, over pins naming several codings at once. Where a pin names
    one coding an omission is already caught, either as a disagreeing literal or
    as a required element the template cannot fill.

    A pin is judged only once the template restates part of it. That is what
    makes the omission an incomplete restatement rather than an absent element.

    Returns (path, missing_coding) pairs.
    """
    out = []
    for path, sets in sorted(groups.items()):
        here = set()
        for spelling, codings in stated.items():
            if path in spellings(spelling, aliases):
                here |= codings
        if not here:
            continue
        for want in sets:
            if not any(c in here for c in want):
                continue
            for coding in want:
                if coding not in here:
                    out.append((path, coding))
    return out


def main():
    sds, qs = load_all()
    if not sds:
        print('no compiled profiles found; run sushi first', file=sys.stderr)
        return 1

    entries = judged = agreed = multi = 0
    unresolved, findings, missing, incomplete = [], [], [], []

    for qid, q in sorted(qs.items()):
        for contained in q.get('contained', []):
            if contained.get('resourceType') != 'Bundle':
                continue
            envelope = ((contained.get('meta') or {}).get('profile') or [None])[0]
            envelope_pins = bundle_entry_pins(envelope, sds) if envelope in sds else {}
            for idx, entry in enumerate(contained.get('entry', [])):
                res = entry.get('resource') or {}
                profiles = (res.get('meta') or {}).get('profile') or []
                entries += 1
                if not profiles or profiles[0] not in sds:
                    unresolved.append('%s entry[%d] %s claims %s'
                                      % (qid, idx, res.get('resourceType'),
                                         profiles[0] if profiles else 'no profile'))
                    continue
                for name, path in sorted(required_top_level(profiles[0], sds).items()):
                    if not fillable(res, name):
                        missing.append('%s entry[%d] %s requires %s and the template neither '
                                       'states it nor carries an expression for it'
                                       % (qid, idx, res.get('resourceType'), path))
                pins = dict(pinned(profiles[0], sds))
                aliases = slice_aliases(profiles[0], sds)
                # What the bundle profile pins on this entry's resource counts
                # too: an element the resource profile leaves open can still be
                # fixed by the entry slice the template's own bundle claims.
                for key, extra in envelope_pins.items():
                    if key[0] and key[0] != res.get('resourceType'):
                        continue
                    if key[1] and key[1] not in profiles:
                        continue
                    for path, vals in extra.items():
                        pins.setdefault(path, []).extend(vals)
                for path, system, code in literals(res):
                    if path.startswith('meta'):
                        continue
                    want = [c for spelling in spellings(path, aliases)
                            for c in pins.get(spelling, [])]
                    if not want:
                        continue
                    judged += 1
                    if (system, code) in want or (None, code) in want:
                        agreed += 1
                    else:
                        findings.append('%s entry[%d] %s %s = %s, profile pins %s'
                                        % (qid, idx, res.get('resourceType'),
                                           readable(path), code, want))
                stated = {}
                for path, system, code in literals(res):
                    if not path.startswith('meta'):
                        stated.setdefault(path, set()).add((system, code))
                groups = multi_coding_pins(profiles[0], sds)
                multi += sum(len(sets) for sets in groups.values())
                for path, coding in unstated(groups, stated, aliases):
                    incomplete.append('%s entry[%d] %s restates %s in part and omits %s, '
                                      'which the profile pins there'
                                      % (qid, idx, res.get('resourceType'),
                                         readable(path), coding))

    print('template entries examined      %d' % entries)
    print('literals on a pinned path      %d' % judged)
    print('  agree with the profile       %d' % agreed)
    print('  disagree                     %d' % len(findings))
    print('required elements unfillable   %d' % len(missing))
    print('elements pinning >1 coding     %d' % multi)
    print('  restated incompletely        %d' % len(incomplete))
    if unresolved:
        print('entries whose claimed profile did not resolve  %d' % len(unresolved))
        if VERBOSE:
            for u in unresolved:
                print('    ' + u)
    for f in findings:
        print('  ' + f)
    for m in missing:
        print('  ' + m)
    for i in incomplete:
        print('  ' + i)
    return 1 if (findings or missing or incomplete) else 0


if __name__ == '__main__':
    sys.exit(main())
