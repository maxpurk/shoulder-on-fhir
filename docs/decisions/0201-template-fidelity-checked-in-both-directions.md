# ADR-0201: Template fidelity is checked in both directions

**Date:** 2026-09-17
**Status:** Accepted
**Relates to:** ADR-0192 (template extraction as the mechanism of record), ADR-0196 (a template carries nothing no question fills), ADR-0198 (what the engines infer and what they refuse)

## Context

Template-based extraction reads nothing from a `StructureDefinition`. Every fixed
code, category, unit and status is written out by hand inside the Questionnaire,
so a profile can change and no template follows it. `tools/template-fidelity.py`
exists to close that exposure at build time: it resolves each entry of each
contained template bundle to the profile its own `meta.profile` names, walks that
profile's `baseDefinition` chain for the values it pins, and compares.

The comparison ran in one direction only. It iterated the literals the template
states and asked the profile about each, so a value the template simply omits was
never visited. Where a profile pins a `CodeableConcept` carrying more than one
coding, a template stating only one of them scored as agreement: the coding it
did state was found among the pinned values, and the absent one was never looked
for. The companion check covers a mandatory element the template cannot fill at
all, but not an element stated and left incomplete.

Nothing in the guide triggers this today. No element in any profile pins more
than one coding, so the gap was latent. It was found by reasoning about the
script rather than by a failure, and a latent gap in a verification tool is worth
closing while it costs nothing, because the tool's output is read as a
completeness statement.

## Decision

Check both directions. Alongside the existing literal walk, walk the pins and
report a pinned coding the template restates in part and leaves incomplete.

Two boundaries make the new direction safe to act on.

**Only an element pinning several codings is judged.** Where a pin names one
coding, an omission is already caught: either the template states a different
value, which the literal walk reports as a disagreement, or it states nothing at
all, which the mandatory-element check reports. Adding single-coding pins to the
reverse walk would report the same fact twice.

**A pin is judged only once the template restates part of it.** That is what
makes an omission an incomplete restatement rather than an absent element, and it
is what keeps the path matching from reporting a pin against an element of the
same name elsewhere in the resource.

The new walk reads its own view of the profile chain rather than reusing
`pinned()`. `pinned()` flattens every pin on a path into one list and so cannot
distinguish one element naming two codings from two elements naming one each.
Slicing makes that difference material: the four Constant-Murley sub-score slices
each pin one code on `Observation.component.code`, and a template carrying two of
the four components is correct, not incomplete.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Leave it, since no profile currently pins two codings | The script's output is read as a statement that the templates are held to the profiles. A direction it never checks is a silent exception, and the condition that would expose it is a routine modelling choice away. |
| Judge every pin in the reverse direction, not only multi-coding ones | Reports the same omission twice for single-coding pins, and turns the loose path matching into a source of false findings. |
| Derive the reverse walk from `pinned()` | Cannot separate one element pinning two codings from two slices pinning one each, so it would demand that a template carrying two Constant sub-scores carry all four. |
| Generate the templates from the profiles instead of checking them | The real fix, and a larger one: it removes hand restatement rather than guarding it. Recorded as future work, not done here. |

## Consequences

✅ A pinned coding a template restates in part and leaves incomplete is now a
build failure rather than a silent pass.

✅ The script reports how many elements pin more than one coding, so a reader can
see the new check ran rather than inferring it from a zero.

✅ The existing counts are unchanged: 86 template entries examined, 150 literals
on a profile-pinned path, all agreeing, no mandatory element unfillable. The new
direction adds `elements pinning >1 coding 0`, consistent with the profiles.

⚠️ The check is unexercised by this guide's own content. Its behaviour was
established against constructed inputs instead: a pin restated in part reports the
omitted coding, a pin restated in full reports nothing, an absent element reports
nothing and is left to the mandatory-element check, and four slices pinning one
coding each report nothing when a template carries two of them.

⚠️ Numeric bounds are still outside the script. A profile's `minValue[x]` and
`maxValue[x]` are restated as `minValue` and `maxValue` extensions on the
Questionnaire item, in both mechanisms, and nothing compares the two. See
`docs/limitations_items/`.

## Sources

- `tools/template-fidelity.py` — `multi_coding_pins`, `unstated`, and the report block in `main`
- `tools/check-template-fidelity.sh` — the entry point run before a deploy-mirror push
- `ig/input/fsh/profiles/observations/ConstantScoreObservation.fsh` — the sliced `component` that motivates the per-element view
- HL7 FHIR R4, ElementDefinition `pattern[x]` — a pattern on a `CodeableConcept` requires every coding it names to be present in the instance
