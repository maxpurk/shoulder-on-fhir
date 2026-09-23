#!/usr/bin/env python3
"""Generate the complete template-based Questionnaires, one per bundle profile.

Template extraction reads nothing from the profiles, so a template has to state
every fixed code, category, unit and status itself. Typing that out three times
would guarantee drift from the profiles it mirrors, so each template is derived
from a conformant example submission: the structure and the fixed values are
copied, and only the leaves a clinician answers become templateExtractValue
expressions.

Three kinds of leaf get an expression:
  * an answered value        -> the form item that carries it
  * an intra-bundle reference -> the uuid allocated for the entry it points at
  * an external reference     -> 'Type/' + the persisted id the form asks for

Entries that describe something optional (a comorbidity, a prior treatment, an
imaging study) carry a templateExtractContext instead, so an unanswered question
removes the whole entry. That is the mechanism's own conditional construct.

Run from shoulder_on_fhir/ after `sushi .`: the value set bindings are read off
the compiled profiles.
"""
import json, glob, os, re, sys

SDDIR = 'ig/fsh-generated/resources'
OUTDIR = 'ig/input/fsh/instances'
SEED = 'seed/bundles/anna-mueller'

TEV, ALLOC, BUND, TEC = '$TEV', '$ALLOC', '$BUNDLE', '$TECTX'
CALC = '$CALC'
INITIAL, POPCTX = '$INITIAL', '$POPCTX'
ENABLE_EXPR = '$ENABLE_EXPR'

FORMS = [
    dict(src='anna_mueller_01_registration.json', id='shoulder-registration-full-template', derived_from='shoulder-registration',
         name='ShoulderRegistrationFullTemplate', out='ShoulderRegistrationFullTemplateQuestionnaire.fsh',
         title='Shoulder Registry Registration (SDC, complete template extraction)',
         desc='The complete pre-operative registration, extracted from a contained Bundle template.'),
    dict(src='anna_mueller_02_surgery.json', id='shoulder-surgery-full-template', derived_from='shoulder-surgery',
         name='ShoulderSurgeryFullTemplate', out='ShoulderSurgeryFullTemplateQuestionnaire.fsh',
         title='Shoulder Registry Surgery (SDC, complete template extraction)',
         desc='The complete surgical submission, extracted from a contained Bundle template.'),
    # The richest follow-up visit, not the earliest. Generated from the six week
    # bundle the form could not carry the Constant-Murley sub-scores at all,
    # because that visit records only the total. Every observation is gated on
    # its own answer, so an early visit still submits only what was assessed.
    dict(src='anna_mueller_06_followup_12mo.json', id='shoulder-followup-full-template', derived_from='shoulder-follow-up',
         name='ShoulderFollowUpFullTemplate', out='ShoulderFollowUpFullTemplateQuestionnaire.fsh',
         title='Shoulder Registry Follow-Up (SDC, complete template extraction)',
         desc='The complete follow-up visit submission, extracted from a contained Bundle template.'),
]

# ---------------------------------------------------------------- bindings --
def value_bindings():
    out = {}
    for f in glob.glob(os.path.join(SDDIR, 'StructureDefinition-*.json')):
        d = json.load(open(f))
        if d.get('type') != 'Observation':
            continue
        for e in (d.get('snapshot') or d.get('differential') or {}).get('element', []):
            if e.get('id', '').startswith('Observation.value') and e.get('binding', {}).get('valueSet'):
                out[d['id']] = e['binding']['valueSet'].split('|')[0]
    return out

VS = value_bindings()

# Minimum cardinality of the top-level element each answer fills, read off the
# compiled profiles. A form that marks nothing required lets a half-filled
# response through, and the entries it produces then carry empty parents that
# break the invariants the base resource states.
PUBDIR = 'ig/output'

def element_minima():
    out = {}
    for f in glob.glob(os.path.join(SDDIR, 'StructureDefinition-*.json')):
        # The published profile, because only its snapshot carries what the
        # profile inherits. A differential lists what this profile changes, and
        # an element made mandatory by a parent appears nowhere in it, so
        # reading the differential silently treats it as optional.
        pub = os.path.join(PUBDIR, os.path.basename(f))
        d = json.load(open(pub if os.path.exists(pub) else f))
        root = d.get('type')
        if not root:
            continue
        mins = {}
        for e in (d.get('snapshot') or d.get('differential') or {}).get('element', []):
            eid = e.get('id', '')
            if eid.count('.') == 1 and eid.startswith(root + '.'):
                mins[eid.split('.', 1)[1]] = e.get('min', 0)
        out[d['id']] = mins
    return out

MINIMA = element_minima()

def is_mandatory(prof_id, rel_path):
    seg = rel_path.split('.')[0].split('[')[0]
    mins = MINIMA.get(prof_id or '', {})
    if seg in mins:
        return mins[seg] >= 1
    # a concrete choice element is written as the stem plus its type
    for k, v in mins.items():
        if k.endswith('[x]') and seg.startswith(k[:-3]):
            return v >= 1
    return False
COMORBIDITY_VS = 'http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips'

# A reference leaving the bundle still needs a literal placeholder, and the
# publisher resolves it. Pointing it at the guide's own published examples keeps
# the template self-consistent; extraction replaces it with the answered id.
EXAMPLE_FOR = {
    'Patient': 'Patient/AnnaMueller',
    'Condition': 'Condition/AnnaRotatorCuffTear',
}
MODALITY_VS = 'https://maxpurk.github.io/shoulder-on-fhir/ValueSet/imaging-modality'
LATERALITY_VS = 'https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-laterality'

# A follow-up bundle must carry at least one observation: a visit recording no
# measurement says nothing. Every observation in the form is otherwise optional,
# so answering only what the form marks required produced a visit the profile
# rejects. One measure is therefore always present and always asked.
#
# The subjective shoulder value is the one chosen: the expert consensus names it
# at every post-operative timepoint, and it is a single question, so making it
# mandatory adds the least a mandatory question can add. Which measure this
# should be is a clinical decision and is open to review.
ALWAYS_PRESENT = {'shoulder-followup-full-template': 'ssv-score-observation'}
RC_CONDITION_PROFILE = 'https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-condition'

# Which resource each external reference actually points at, read from the other
# bundles of the same example case. Labelling by sort order instead put the
# rotator cuff label on whichever reference happened to sort first.
def external_profiles():
    out = {}
    for f in sorted(glob.glob(os.path.join(SEED, '*.json'))):
        try:
            b = json.load(open(f))
        except Exception:
            continue
        for e in b.get('entry', []):
            r = e.get('resource', {})
            if r.get('id'):
                out[f"{r['resourceType']}/{r['id']}"] = profile_of(r)
    return out

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def profile_of(r):
    return (r.get('meta', {}).get('profile') or [''])[0].split('/')[-1]

# ------------------------------------------------------------- FSH literals --
CODE_KEYS = {'status', 'gender', 'method', 'use', 'intent', 'mode'}

def is_code(key, parent, val=None):
    if key in CODE_KEYS:
        return True
    if key == 'code' and isinstance(parent, dict) and 'system' in parent:
        return True
    if key == 'system' and isinstance(val, str) and not re.match(r'^[a-z][a-z0-9+.-]*:', val):
        return True
    return False

def fsh_lit(key, val, parent):
    if isinstance(val, bool):
        return 'true' if val else 'false'
    if isinstance(val, (int, float)):
        return repr(val)
    if is_code(key, parent, val):
        return '#' + (val if re.fullmatch(r'[^\s"]+', val) else f'"{val}"')
    return '"' + val.replace('\\', '\\\\').replace('"', '\\"') + '"'

# ------------------------------------------------------------------ emitter --
# prose and dates that describe the example patient, not the form being filled
PROSE = {'text', 'div'}

def annotate_line(lines, path, expr):
    lines.append(f'* {path}.extension[0].url = {TEV}')
    lines.append(f'* {path}.extension[0].valueString = "{expr}"')

def emit(node, path, lines, ann, items_seen, parent=None, key=None, skip=(), ctx_gates=None, lit_refs=None):
    ctx_gates = ctx_gates or {}
    lit_refs = lit_refs or {}
    if isinstance(node, dict):
        rel_self = path.split('.resource.', 1)[-1] if '.resource.' in path else path
        if rel_self in ctx_gates:
            n = len(node.get('extension') or [])
            lines.append(f'* {path}.extension[{n}].url = {TEC}')
            lines.append(f'* {path}.extension[{n}].valueString = "{ctx_gates[rel_self]}"')
        for k, v in node.items():
            rel = f'{path}.{k}'.split('.resource.', 1)[-1]
            if rel in skip or k in PROSE:
                continue
            emit(v, f'{path}.{k}', lines, ann, items_seen, node, k, skip, ctx_gates, lit_refs)
        # an expression on a complex element replaces the whole element, so a
        # coded answer cannot leave a stale display behind, and an unanswered
        # one removes the element rather than leaving a system with no code
        if rel_self in ann:
            annotate_line(lines, path, ann[rel_self])
    elif isinstance(node, list):
        for i, v in enumerate(node):
            emit(v, f'{path}[{i}]', lines, ann, items_seen, parent, key, skip, ctx_gates, lit_refs)
    else:
        rel = path.split('.resource.', 1)[-1] if '.resource.' in path else path
        value = lit_refs.get(rel, node) if lit_refs else node
        lines.append(f'* {path} = {fsh_lit(key, value, parent)}')
        if rel in ann:
            annotate_line(lines, path, ann[rel])

# CarePlan timepoints are computed from the surgery date, not authored
Q11_OFFSET = {'6-weeks': '6 weeks', '3-months': '3 months', '6-months': '6 months',
              '1-year': '1 year', '2-years': '2 years'}

def build(cfg):
    b = json.load(open(os.path.join(SEED, cfg['src'])))
    entries = b['entry']
    ITEMS = []                  # (linkId, text, type, valueSet|None, calc|None)

    def add_item(lid, text, typ, vs=None, calc=None, initial=None):
        if not any(i[0] == lid for i in ITEMS):
            ITEMS.append((lid, text, typ, vs, calc, initial))
        return lid

    def answer(lid, suffix=''):
        return f"%resource.repeat(item).where(linkId='{lid}').answer.value{suffix}"

    # ---- one allocated uuid per entry, reachable by fullUrl and by Type/id ----
    used, names = {}, {}
    for e in entries:
        r = e['resource']; t = r['resourceType']; prof = profile_of(r)
        if t == 'Patient':        base = 'patientId'
        elif t == 'Encounter':    base = 'encounterId'
        elif t == 'ImagingStudy': base = 'imagingId'
        elif t == 'CarePlan':     base = 'carePlanId'
        elif t == 'Condition':
            cat = (r.get('category') or [{}])[0].get('coding', [{}])[0].get('code', '')
            base = ('conditionRc' if prof.startswith('rotator-cuff-condition')
                    else 'comorbidity' if cat == 'problem-list-item' else 'otherDiagnosis')
        elif t == 'Procedure':
            cat = (r.get('category') or {}).get('coding', [{}])[0].get('code', '')
            base = 'procedure' if cat == '387713003' else 'priorTreatment'
        else:
            base = re.sub(r'[^a-zA-Z0-9]', '', prof.replace('-observation', '').title()) or 'obs'
        n = used.get(base, 0); used[base] = n + 1
        var = base if (n == 0 and base in ('patientId', 'encounterId', 'imagingId',
                                           'carePlanId', 'conditionRc')) else f'{base}{n + 1}'
        names[e['fullUrl']] = var
        if r.get('id'):
            names[f"{t}/{r['id']}"] = var

    # ---- references leaving this bundle become answered persisted ids ----
    LABEL = {'Patient': ('context.patientId', 'Patient Resource ID (from the registration)'),
             'Condition': ('context.conditionId', 'Rotator Cuff Condition ID (from the registration)'),
             'Encounter': ('context.encounterId', 'Encounter Resource ID')}
    external = {}
    def scan_external(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k == 'reference' and isinstance(v, str) and v not in names:
                    external.setdefault(v, None)
                else:
                    scan_external(v)
        elif isinstance(node, list):
            for v in node: scan_external(v)
    scan_external(b)
    seen_ext = {}
    ext_prof = external_profiles()
    # The rotator cuff condition first, so its label lands on the reference that
    # really points at it rather than on whichever one sorts first.
    def rank(ref):
        prof = ext_prof.get(ref, '')
        return (0 if prof.startswith('rotator-cuff-condition') else 1, ref)
    for ref in sorted(external, key=rank):
        typ = ref.split('/')[0]
        lid, text = LABEL.get(typ, (f'context.{slug(typ)}Id', f'{typ} Resource ID'))
        if lid in seen_ext:                       # a second Condition, etc.
            lid = f'{lid}.{len([k for k in seen_ext if k.startswith(lid)]) + 1}'
            prof = ext_prof.get(ref, '')
            text = (f'{prof.replace("-", " ").title()} ID' if prof
                    else f'Additional {typ} Resource ID')
        seen_ext[lid] = ref
        initial = {'context.patientId': '%patient.id',
                   'context.conditionId': '%rotatorCuffCondition.id'}.get(lid)
        add_item(lid, text, 'string', initial=initial)
        external[ref] = f"'{typ}/' + {answer(lid)}"
    return b, entries, names, external, ITEMS, add_item, answer

def render(cfg):
    b, entries, names, external, ITEMS, add_item, answer = build(cfg)
    lines = []
    USES = {}
    # linkId -> the condition under which the form asks the question at all
    ENABLE = {}

    # pass one: which entries are conditional, and on what
    gates = {}
    for e in entries:
        r = e['resource']; t = r['resourceType']; prof = profile_of(r)
        var = names[e['fullUrl']]
        if t == 'Observation':
            lid = 'obs.' + slug(prof.replace('-observation', ''))
            if prof == ALWAYS_PRESENT.get(cfg['id']):
                continue                       # always emitted, so never gated
            gates[var] = f"%resource.repeat(item).where(linkId='{lid}').answer.value"
        elif t == 'Condition':
            kind = var.rstrip('0123456789')
            if kind in ('otherDiagnosis', 'comorbidity'):
                gates[var] = f"%resource.repeat(item).where(linkId='cond.{var}').answer.value"
        elif t == 'Procedure' and var.startswith('priorTreatment'):
            # `= true` rather than a bare `$this`: a boolean answer of false is a
            # value, so filtering on the value alone keeps it, and a treatment
            # answered "no" was asserted as having happened
            gates[var] = f"%resource.repeat(item).where(linkId='proc.{var}').answer.value.where($this = true)"
        elif t == 'ImagingStudy':
            gates[var] = "%resource.repeat(item).where(linkId='imaging.modality').answer.value"

    var_entry = {names[e['fullUrl']]: n for n, e in enumerate(entries)}

    def ref_expr(target_var):
        """A reference to a conditional entry has to vanish with it."""
        g = gates.get(target_var)
        return f'iif(({g}).exists(), %{target_var}, {{}})' if g else '%' + target_var

    for ent, e in enumerate(entries):
        r = e['resource']; t = r['resourceType']; prof = profile_of(r)
        var = names[e['fullUrl']]
        ann, skip, gate, ctx_gates, lit_refs = {}, ['id'], None, {}, {}

        def refs(node, path):
            if isinstance(node, dict):
                for k, v in node.items():
                    if k == 'reference' and isinstance(v, str):
                        p = f'{path}.reference'.lstrip('.')
                        if v in names:
                            tv = names[v]
                            ann[p] = ref_expr(tv)
                            # the placeholder resolves inside the template, so the
                            # publisher does not chase the example patient's ids
                            lit_refs[p] = f'urn:uuid:00000000-0000-4000-8000-{var_entry[tv]:012d}'
                            if tv in gates:
                                # the element carrying it goes too, or it would be
                                # a backbone with a required reference and no value
                                holder = re.sub(r'\.[A-Za-z]+$', '', p)
                                m = re.match(r'^(.*\[\d+\])', holder)
                                ctx_gates[m.group(1) if m else holder] = gates[tv]
                        elif v in external:
                            ann[p] = external[v]
                            ex = EXAMPLE_FOR.get(v.split('/')[0])
                            if ex: lit_refs[p] = ex
                    else:
                        refs(v, f'{path}.{k}')
            elif isinstance(node, list):
                for i, v in enumerate(node): refs(v, f'{path}[{i}]')
        refs(r, '')

        if t == 'Patient':
            ann['identifier[0].value'] = answer(add_item('patient.identifier', 'Registry Identifier', 'string'))
            ann['name[0].given[0]'] = answer(add_item('patient.givenName', 'Given Name', 'string'))
            ann['name[0].family'] = answer(add_item('patient.familyName', 'Family Name', 'string'))
            ann['birthDate'] = answer(add_item('patient.birthDate', 'Date of Birth', 'date'))
            ann['gender'] = answer(add_item('patient.gender', 'Gender', 'choice',
                                            'http://hl7.org/fhir/ValueSet/administrative-gender'), '.code')
            for i, x in enumerate(r.get('extension', [])):
                if 'recordedSexOrGender' in x['url']:
                    lid_sex = add_item('patient.sexAssignedAtBirth', 'Sex Assigned at Birth', 'choice',
                                       'http://hl7.org/fhir/ValueSet/administrative-gender')
                    # unanswered, the whole extension goes: a value sub-extension
                    # with an empty CodeableConcept is not a valid extension
                    ctx_gates[f'extension[{i}]'] = answer(lid_sex)
                    for j, sub in enumerate(x['extension']):
                        if sub['url'] == 'value':
                            ann[f'extension[{i}].extension[{j}].valueCodeableConcept.coding[0]'] = answer(lid_sex)
        elif t == 'Encounter':
            ann['period.start'] = answer(add_item('encounter.date', 'Visit / Incision Date and Time', 'dateTime'))
            ann['period.end'] = answer(add_item('encounter.endDate', 'Visit / Closure Date and Time', 'dateTime'))
        elif t == 'Condition':
            kind = var.rstrip('0123456789')
            spec = {'conditionRc': ('cond.diagnosis', 'Rotator Cuff Diagnosis',
                                    'https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-diagnosis', False),
                    'otherDiagnosis': (f'cond.{var}', 'Other Shoulder Diagnosis',
                                    'https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-diagnosis', True),
                    'comorbidity': (f'cond.{var}', f'Comorbidity {var[-1] if var[-1].isdigit() else 1}',
                                    COMORBIDITY_VS, True)}[kind]
            lid, label, vs, optional = spec
            add_item(lid, label, 'choice', vs)
            ann['code.coding[0]'] = answer(lid)
            skip += ['code.text']                 # free text about the example
            for f in ('onsetDateTime', 'recordedDate'):
                if f in r:
                    ann[f] = answer(add_item('encounter.date', 'Visit / Incision Date and Time', 'dateTime'))
            if optional:
                gate = answer(lid)                       # unanswered -> entry removed
            if r.get('bodySite'):
                ann['bodySite[0].coding[0]'] = answer(add_item(
                    'cond.laterality', 'Affected Side', 'choice',
                    'https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-laterality'))
            for i, x in enumerate(r.get('extension', [])):
                if 'dueTo' in x['url']:
                    ann[f'extension[{i}].valueCodeableConcept.coding[0]'] = answer(add_item(
                        'cond.etiology', 'Etiology', 'choice',
                        'https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-etiology'))
        elif t == 'Procedure':
            disp = r['code']['coding'][0].get('display', var)
            if var.startswith('priorTreatment'):
                lid = add_item(f'proc.{var}', f'Prior treatment given: {disp}', 'boolean')
                # `= true` and not a bare `$this`: a boolean answer of false is a
                # value, so filtering on the value alone keeps it, and a treatment
                # answered "no" was emitted as having happened
                gate = answer(lid, '.where($this = true)')   # only when answered true
                skip += ['code.text']
                if 'performedDateTime' in r:
                    ann['performedDateTime'] = answer(add_item(f'proc.{var}.date', f'{disp}: date', 'dateTime'))
                if 'performedPeriod' in r:
                    ann['performedPeriod.start'] = answer(add_item(f'proc.{var}.start', f'{disp}: start', 'dateTime'))
                    ann['performedPeriod.end'] = answer(add_item(f'proc.{var}.end', f'{disp}: end', 'dateTime'))
            else:
                # The index procedure is always performed; anything alongside it
                # is not. Giving every one of them the same question emitted a
                # concomitant procedure, with the index procedure's own code, for
                # every submission, asserting an operation that never happened.
                nth = int(var[len('procedure'):] or 1)
                if nth == 1:
                    lid = add_item('proc.type', 'Procedure Type', 'choice',
                                   'https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-procedure-type')
                else:
                    lid = add_item(f'proc.type.{nth}', f'Concomitant Procedure {nth - 1} (if performed)',
                                   'choice',
                                   'https://maxpurk.github.io/shoulder-on-fhir/ValueSet/rotator-cuff-procedure-type')
                    gate = answer(lid)        # unanswered, and the entry goes
                ann['code.coding[0]'] = answer(lid)
                skip += ['code.text']
                if r.get('bodySite'):
                    ann['bodySite[0].coding[0]'] = answer(add_item(
                        'cond.laterality', 'Affected Side', 'choice',
                        'https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-laterality'))
                for f in ('performedDateTime',):
                    if f in r: ann[f] = answer(add_item('encounter.date', 'Visit / Incision Date and Time', 'dateTime'))
                if 'performedPeriod' in r:
                    ann['performedPeriod.start'] = answer(add_item('encounter.date', 'Visit / Incision Date and Time', 'dateTime'))
                    ann['performedPeriod.end'] = answer(add_item('encounter.endDate', 'Visit / Closure Date and Time', 'dateTime'))
        elif t == 'ImagingStudy':
            lid = add_item('imaging.modality', 'Imaging Modality Obtained', 'choice', MODALITY_VS)
            gate = answer(lid)
            ann['modality[0]'] = answer(lid)
            # `started` reuses the visit date, as the other capture flows do
            ann['started'] = answer(add_item('encounter.date', 'Visit / Incision Date and Time', 'dateTime'))
        elif t == 'CarePlan':
            base = answer(add_item('encounter.date', 'Visit / Incision Date and Time', 'dateTime'))
            ann['period.start'] = base
            ann['period.end'] = f'{base} + 2 years'
            for i, a in enumerate(r.get('activity', [])):
                code = a['detail']['code']['coding'][0]['code']
                off = Q11_OFFSET.get(code)
                if off:
                    ann[f'activity[{i}].detail.scheduledTiming.event[0]'] = f'{base} + {off}'
        elif t == 'Observation':
            lid = 'obs.' + slug(prof.replace('-observation', ''))
            text = r['code']['coding'][0].get('display') or lid
            if 'valueQuantity' in r:
                calc = None
                if r.get('component'):        # a score whose parts are captured separately
                    parts = [f"%resource.repeat(item).where(linkId='{lid}.{slug(c['code']['coding'][0]['code'])}')"
                             f".answer.value" for c in r['component'] if 'valueQuantity' in c]
                    if parts:
                        # the profile requires all four sub-scores or none, and the
                        # total to equal their sum, so an incomplete worksheet
                        # computes nothing rather than a total built out of zeros
                        have = ' and '.join(f'({p}).exists()' for p in parts)
                        total = ' + '.join(f'({p}).first()' for p in parts)
                        calc = f'iif({have}, {total}, {{}})'
                ann['valueQuantity.value'] = answer(add_item(
                    lid, f"{text} ({r['valueQuantity'].get('unit','')})", 'decimal', None, calc))
            elif 'valueCodeableConcept' in r:
                vs = VS.get(prof)
                add_item(lid, text, 'choice' if vs else 'string', vs)
                ann['valueCodeableConcept.coding[0]'] = answer(lid)
            elif 'valueString' in r:
                ann['valueString'] = answer(add_item(lid, text, 'string'))
            elif 'valueInteger' in r:
                ann['valueInteger'] = answer(add_item(lid, text, 'integer'))
            # a measurement that was not taken is not recorded at all, rather
            # than recorded as an Observation with no value. The one measure the
            # bundle profile requires is the exception: it is always recorded,
            # and always asked for.
            gate = None if prof == ALWAYS_PRESENT.get(cfg['id']) else answer(lid)
            # a count of prior treatments only means anything if that treatment
            # was given, so it is gated on the same answer the Procedure is,
            # and on the same answer the form stops asking the question
            for pre, boolean in (('prior-physical-therapy-session-count', 'proc.priorTreatment1'),
                                 ('prior-injection-count', 'proc.priorTreatment2')):
                if lid.endswith(pre):
                    gate = f"iif({answer(boolean, '.where($this = true)')}.exists(), {answer(lid)}, {{}})"
                    ENABLE[lid] = f"{answer(boolean, '.where($this = true)')}.exists()"
            for ci, comp in enumerate(r.get('component', [])):
                cc = comp['code']['coding'][0]
                if 'valueQuantity' in comp:
                    ann[f'component[{ci}].valueQuantity.value'] = answer(add_item(
                        f'{lid}.{slug(cc["code"])}', f'{text}: {cc.get("display", cc.get("code"))}', 'decimal'))
            if 'effectiveDateTime' in r:
                ann['effectiveDateTime'] = answer(add_item('encounter.date', 'Visit / Incision Date and Time', 'dateTime'))

        # Every body site in the example names one side. Asked once here, so a
        # submission for the other side does not quietly assert the example's.
        def body_sites(node, path=''):
            if isinstance(node, dict):
                for k, v in node.items():
                    sub = f'{path}.{k}'.lstrip('.')
                    if k == 'bodySite':
                        for cp in coding_paths(v, sub):
                            yield cp
                    else:
                        yield from body_sites(v, sub)
            elif isinstance(node, list):
                for i, v in enumerate(node):
                    yield from body_sites(v, f'{path}[{i}]')

        def coding_paths(node, path):
            if isinstance(node, list):
                for i, v in enumerate(node):
                    yield from coding_paths(v, f'{path}[{i}]')
            elif isinstance(node, dict):
                for i, _ in enumerate(node.get('coding') or []):
                    yield f'{path}.coding[{i}]'

        sites = list(body_sites(r))
        if sites:
            lat = add_item('cond.laterality', 'Affected Side', 'choice', LATERALITY_VS)
            for sp in sites:
                ann[sp] = answer(lat)

        # Which element each answer fills, so an answer that fills a mandatory
        # element on an entry that is always emitted can be marked mandatory too.
        for rel_path, expr in ann.items():
            m = re.search(r"linkId='([^']+)'", str(expr))
            if m:
                USES.setdefault(m.group(1), []).append((prof, rel_path, bool(gate)))

        p = f'contained[0].entry[{ent}]'
        lines.append(f'\n// ---- entry {ent}: {t} ({prof or "-"}) ----')
        if gate:
            lines.append(f'* {p}.extension[0].url = {TEC}')
            lines.append(f'* {p}.extension[0].valueString = "{gate}"')
        lines.append(f'* {p}.fullUrl = "urn:uuid:00000000-0000-4000-8000-{ent:012d}"')
        lines.append(f'* {p}.fullUrl.extension[0].url = {TEV}')
        lines.append(f'* {p}.fullUrl.extension[0].valueString = "%{var}"')
        emit(r, f'{p}.resource', lines, ann, ITEMS, skip=tuple(skip), ctx_gates=ctx_gates, lit_refs=lit_refs)
        lines.append(f'* {p}.request.method = #POST')
        lines.append(f'* {p}.request.url = "{t}"')

    return b, names, lines, ITEMS, USES, ENABLE

HEADER = '''// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  {title}
// │  GENERATED by tools/generate-template-questionnaires.py — do not hand-edit. │
// ╰─────────────────────────────────────────────────────────────────────────────╯
//
// The whole submission, written out once as a contained Bundle. Template
// extraction reads nothing from the profiles, so every fixed code, category,
// unit and status here is stated literally; the structure and those fixed values
// are copied from a conformant example so the two cannot drift by hand.
//
// A leaf a clinician answers carries a templateExtractValue expression, and an
// expression yielding nothing removes its element. An entry that is optional
// carries a templateExtractContext instead, so leaving its question unanswered
// removes the entry outright.
//
// FHIRPath context is the QuestionnaireResponse, per templateExtractBundle
// sitting at the Questionnaire root.

Alias: $TEV = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue
Alias: $TECTX = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext
Alias: $ALLOC = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extractAllocateId
Alias: $BUNDLE = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractBundle
Alias: $CALC = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression
Alias: $INITIAL = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression
Alias: $POPCTX = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemPopulationContext
Alias: $ENABLE_EXPR = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-enableWhenExpression

Instance: {id}
InstanceOf: Questionnaire
Usage: #definition
Title: "{title}"
Description: """
{desc}
Produces a Bundle labelled with the profile it claims, carrying the resources
the example it was generated from contains. That is a subset of what the profile
allows, not all of it.
"""
* meta.profile = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extr-template"
* url = "https://maxpurk.github.io/shoulder-on-fhir/Questionnaire/{id}"
* name = "{name}"
* version = "0.1.0"
* status = #draft
* subjectType = #Patient
// The standard sanctions the two extraction mechanisms side by side only where
// one form is derived from the other, so the pairing is stated, not implied.
* derivedFrom = "https://maxpurk.github.io/shoulder-on-fhir/Questionnaire/{derived_from}"
// sdc-2: the version SUSHI stamps requires an accompanying versionAlgorithm.
* extension[0].url = "http://hl7.org/fhir/StructureDefinition/artifact-versionAlgorithm"
* extension[0].valueCoding = http://hl7.org/fhir/version-algorithm#semver
'''

# Population and extraction are independent features of the standard. A form
# that asks for identifiers already on record declares what it wants handed to
# it, and seeds them from that instead of asking the person filling it in. The
# items stay editable, so a filler that does not populate still works. A
# registration form creates the patient, so it has nothing to be handed.
LAUNCH_CONTEXT = '''// what the form asks to be handed when it is launched
* extension[1].url = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-launchContext"
* extension[1].extension[0].url = "name"
* extension[1].extension[0].valueCoding = http://hl7.org/fhir/uv/sdc/CodeSystem/launchContext#patient "Patient"
* extension[1].extension[1].url = "type"
* extension[1].extension[1].valueCode = #Patient
* extension[1].extension[2].url = "description"
* extension[1].extension[2].valueString = "The patient this submission is about."
'''

GROUPS = [('context.', 'Registered Patient'), ('patient.', 'Patient Information'),
          ('encounter.', 'Visit'), ('cond.', 'Diagnoses'), ('proc.', 'Procedures'),
          ('imaging.', 'Imaging'), ('obs.', 'Clinical Assessment')]

# Within the assessment group the example bundle's order is arbitrary. These
# prefixes put a clinician's own sequence back: history, then inspection, then
# range of motion, strength, provocation tests, imaging findings, then scores.
OBS_ORDER = [
    'smoking-status', 'smoking-pack-years', 'employment-status',
    'occupational-physical-demand', 'occupational-overhead-exposure',
    'hand-dominance', 'sports-participation', 'sleep-disturbance',
    'functional-limitations', 'prior-physical-therapy-session-count',
    'prior-injection-count',
    'atrophy', 'deformity', 'normal-shoulder-contour',
    'shoulder-flexion', 'shoulder-abduction', 'shoulder-external-rotation',
    'shoulder-internal-rotation', 'shoulder-passive-flexion',
    'supraspinatus-strength', 'supraspinatus-strength-dynamometry',
    'external-rotation-strength', 'internal-rotation-strength',
    'subscapularis-strength',
    'jobe-test', 'lift-off-test', 'belly-press-test', 'bear-hug-test',
    'hornblower-test',
    'tear-thickness', 'tendons-involved', 'tear-location', 'tear-size',
    'tear-size-classification', 'patte', 'goutallier',
    'intraop-tear-size', 'intraop-tear-size-classification',
    'procedure-approach', 'reconstruction-extent', 'fixation-technique',
    'pain-average', 'constant-score', 'ssv-score',
]

def obs_rank(lid):
    rest = lid[len('obs.'):]
    base = rest.split('.')[0]
    # a total computed from sub-scores is asked after the parts it sums
    return (OBS_ORDER.index(base) if base in OBS_ORDER else len(OBS_ORDER),
            1 if '.' not in rest else 0, lid)

def write(cfg, bundle, names, body, ITEMS, USES=None, ENABLE=None):
    out = [HEADER.format(**cfg)]
    wants_launch = any(i[0].startswith('context.') for i in ITEMS)
    if wants_launch:
        out.append(LAUNCH_CONTEXT)
    uniq = list(dict.fromkeys(names.values()))
    out.append('\n// ── the uuids the entries reference each other by ────────────────────────────')
    first = 2 if wants_launch else 1
    for i, v in enumerate(uniq, start=first):
        out.append(f'* extension[{i}].url = {ALLOC}')
        out.append(f'* extension[{i}].valueString = "{v}"')
    n = len(uniq) + first
    out.append(f'* extension[{n}].url = {BUND}')
    out.append(f'* extension[{n}].valueReference.reference = "#submissionBundle"')

    out.append('\n// ╭──────────────────────────── the template ─────────────────────────────────╮')
    out.append('* contained[0].resourceType = "Bundle"')
    out.append('* contained[0].id = "submissionBundle"')
    out.append('// the template is only a Bundle; extraction labels the result')
    out.append('* contained[0].meta.profile[0] = "http://hl7.org/fhir/StructureDefinition/Bundle"')
    out.append(f'* contained[0].meta.profile[0].extension[0].url = {TEV}')
    out.append(f"* contained[0].meta.profile[0].extension[0].valueString = \"'{bundle['meta']['profile'][0]}'\"")
    out.append('* contained[0].type = #transaction')
    out += body

    out.append('\n// ╭──────────────────────────── the form ─────────────────────────────────────╮')
    gi = 0
    placed = set()
    for pref, title in GROUPS:
        members = [i for i in ITEMS if i[0].startswith(pref)]
        if not members:
            continue
        if pref == 'obs.':
            members.sort(key=lambda i: obs_rank(i[0]))
        out.append(f'\n* item[{gi}].linkId = "{pref.rstrip(".")}"')
        out.append(f'* item[{gi}].text = "{title}"')
        out.append(f'* item[{gi}].type = #group')
        if pref == 'context.' and any(i[0] == 'context.conditionId' for i in members):
            # the diagnosis the launch patient already has on record
            out.append(f'* item[{gi}].extension[0].url = {POPCTX}')
            out.append(f'* item[{gi}].extension[0].valueExpression.name = "rotatorCuffCondition"')
            out.append(f'* item[{gi}].extension[0].valueExpression.language = #application/x-fhir-query')
            out.append(f'* item[{gi}].extension[0].valueExpression.expression = '
                       f'"Condition?subject={{{{%patient.id}}}}&_profile={RC_CONDITION_PROFILE}"')
        for k, (lid, text, typ, vs, calc, initial) in enumerate(members):
            placed.add(lid)
            out.append(f'* item[{gi}].item[{k}].linkId = "{lid}"')
            out.append(f'* item[{gi}].item[{k}].text = "{text}"')
            out.append(f'* item[{gi}].item[{k}].type = #{typ}')
            # mandatory where it fills a mandatory element of an entry that is
            # always emitted; an optional entry disappears instead
            if (any(is_mandatory(prof, rel) and not gated
                    for prof, rel, gated in (USES or {}).get(lid, []))
                    or lid == 'obs.' + slug(ALWAYS_PRESENT.get(cfg['id'], '').replace('-observation', ''))):
                out.append(f'* item[{gi}].item[{k}].required = true')
            if vs:
                out.append(f'* item[{gi}].item[{k}].answerValueSet = "{vs}"')
            ei = 0
            if calc:
                out.append(f'* item[{gi}].item[{k}].readOnly = true')
                out.append(f'* item[{gi}].item[{k}].extension[{ei}].url = {CALC}')
                out.append(f'* item[{gi}].item[{k}].extension[{ei}].valueExpression.language = #text/fhirpath')
                out.append(f'* item[{gi}].item[{k}].extension[{ei}].valueExpression.expression = "{calc}"')
                ei += 1
            if initial:
                out.append(f'* item[{gi}].item[{k}].extension[{ei}].url = {INITIAL}')
                out.append(f'* item[{gi}].item[{k}].extension[{ei}].valueExpression.language = #text/fhirpath')
                out.append(f'* item[{gi}].item[{k}].extension[{ei}].valueExpression.expression = "{initial}"')
                ei += 1
            # a question the template would extract nothing from is a question
            # the form does not ask: the count of a treatment nobody recorded
            if (ENABLE or {}).get(lid):
                out.append(f'* item[{gi}].item[{k}].extension[{ei}].url = {ENABLE_EXPR}')
                out.append(f'* item[{gi}].item[{k}].extension[{ei}].valueExpression.language = #text/fhirpath')
                out.append(f'* item[{gi}].item[{k}].extension[{ei}].valueExpression.expression = "{ENABLE[lid]}"')
                ei += 1
        gi += 1
    stray = [i for i in ITEMS if i[0] not in placed]
    if stray:
        print('  !! items in no group:', [s[0] for s in stray], file=sys.stderr)
    path = os.path.join(OUTDIR, cfg['out'])
    open(path, 'w').write('\n'.join(out) + '\n')
    return path, len(bundle['entry']), len(uniq), len(ITEMS), len(out)

if __name__ == '__main__':
    for cfg in FORMS:
        b, names, body, ITEMS, USES, ENABLE = render(cfg)
        p, ents, allocs, items, lines = write(cfg, b, names, body, ITEMS, USES, ENABLE)
        print(f'{cfg["id"]:36s} entries={ents:3d}  allocateId={allocs:3d}  items={items:3d}  lines={lines}')
