# ADR-0195: `Encounter.diagnosis.rank` is optional, not required

**Date:** 2026-09-16
**Status:** Accepted
**Found via:** a republish of a stale guide. The published IG was 42 minutes
behind its own source and still reported 279 errors on the template
Questionnaires that the source had already fixed. One rebuild cleared those 279
and left 36, all on the registration template, none of which had any counterpart
in the source: the element the validator called missing is present in the FSH,
present in `fsh-generated/`, and absent only from what the Publisher emitted.

## Context

Each of the three template Questionnaires carries the whole submission as a
contained transaction Bundle (`#submissionBundle`), written out once with every
fixed code, category, unit and status stated literally. SDC template extraction
fills in the answers; the structure is copied from a conformant example so the
two cannot drift by hand.

The IG Publisher normalises resources through its internal R5 model. For
`Questionnaire.contained[]` that round-trip is lossy: an element R4 has and R5
does not has nowhere to land on the way out, and cannot be restored on the way
back. Measured on the 2026-09-16 build (Publisher 2.3.4, embedding
`org.hl7.fhir.validation` 6.10.4) by diffing `ig/output/` against
`ig/fsh-generated/resources/`, three groups are lost, and each is exactly an
element R5 deleted or restructured:

| element | R4 | R5 | lost from |
|---|---|---|---|
| `Encounter.diagnosis.rank` | present | removed | registration, 2 entries |
| `Condition.evidence.detail` | present | merged into a `CodeableReference` | registration, 3 entries |
| `CarePlan.activity.detail.*` | present | replaced by `plannedActivityReference` | surgery, 5 activities |

Top-level resources are unaffected: `Bundle-AnnaRegistrationBundle` carries the
same `Encounter.diagnosis` with `rank` 1 and 2 and keeps both through the same
build. The loss is specific to resources contained in a Questionnaire.

`ShoulderEncounter` required `diagnosis.rank 1..1`, so the stripped Encounter the
Publisher emitted no longer satisfied the profile it claims in `meta.profile`.
That produced 2 errors on the Encounter itself and 34 more of the form
`Unable to find a profile match for urn:uuid:…0001 among choices:
shoulder-encounter`, one for each sibling entry whose `.encounter` reference
resolves to it. 36 in total, from one non-conformant resource.

The errors were masked until this rebuild rather than introduced by it. Before
the fix the reference pointed at an identifier that did not exist, so the
validator stopped at "unresolvable" and never reached the conformance check.

The FHIR Validator CLI does not reproduce this, because it validates the source,
which still has `rank`. Both 6.10.0 and 6.10.4 report the template Questionnaires
clean. Validating a rank-stripped copy, which is what the Publisher actually
checks, reproduces the Publisher's count exactly: 2 cardinality errors plus 34
profile-match errors against `diagnosis.rank 1..1`, and 0 errors against
`0..1`.

## Decision

`ShoulderEncounter.diagnosis.rank` is `0..1 MS`.

This is defensible independently of the defect that surfaced it. R5 removed
`Encounter.diagnosis.rank` because `Encounter.diagnosis.use` supersedes it, and
both frontends and all three templates already populate `use` with the
`diagnosis-role` split (`CC` for the principal diagnosis, `CM` for coexisting
ones). Mandating an element the next version of the specification deletes, whose
meaning is already carried by a field that survives, over-constrains the profile
against the direction of travel.

It also removes a contradiction the profile already contained. The `L3.F.5`
mapping note and the profile's own comment both state that rank is populated
only when more than one diagnosis is submitted, since with exactly one the rank
is unambiguous. `1..1` said the opposite.

`Encounter.diagnosis.rank` is `L3.F.5`, an IG-Operational row that the expert
consensus never names. Representability is unchanged: 58 consensus elements, 0
Missing.

## Alternatives Considered

**Pin an older IG Publisher.** 2.3.4 is the current release, so there is no
forward fix to adopt. Going backwards would freeze the guide on a tool the
project had just deliberately pinned forward (ADR-0194), and the R5
normalisation is architectural rather than a recent regression, so every
intervening release carries it. A trial run of 2.2.7 was started and did not
complete. Rejected as a version number wrapped around a workaround.

**Drop `diagnosis` from the templates.** Would end the errors by removing the
data, losing principal-diagnosis ranking from every template-extracted
submission. Rejected.

**Suppress the 36 errors.** Rejected on the grounds that makes this decision
uncomfortable: they were the only loud symptom of a round-trip that is also
silently discarding `Condition.evidence.detail` and `CarePlan.activity.detail`.

## Consequences

The 36 errors are gone at the source rather than hidden, and the profile no
longer contradicts its own documentation.

**This does not restore the stripped content.** `rank`, `Condition.evidence.detail`
and `CarePlan.activity.detail` remain absent from the published Questionnaires
and from `package.tgz`, which is the copy an implementer installing
`shoulder-on-fhir` receives. The two silent losses raise no error at all,
because `CarePlan.activity.detail` and `Condition.evidence.detail` are both
optional in their profiles; relaxing `rank` removes the last one that announced
itself. The gap is recorded separately under `docs/limitations_items/`, which is
where the residual belongs.

The running demonstration system is unaffected. `seed/load-profiles.sh` takes
StructureDefinitions from `ig/output/` but loads Questionnaires from
`ig/fsh-generated/resources/`, so HAPI and all four form fillers serve the
unstripped templates and extract with every element intact.

## Sources

- `ig/input/fsh/profiles/ShoulderEncounter.fsh` — the constraint.
- `mapping/SECEC_FHIR_Mapping.csv` — row `L3.F.5`, constraint column.
- `seed/load-profiles.sh` — Questionnaires loaded from `fsh-generated`, not `output`.
- ADR-0194 — the Publisher pin this decision declines to reverse.
- ADR-0077 — the principal-diagnosis ranking this element carries.
- ADR-0145, ADR-0152 — the `CC` / `CM` `diagnosis-role` split in both frontends.
