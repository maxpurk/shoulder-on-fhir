# ADR-0196: A template's temporal anchor falls back to a computed value, and a template carries nothing no question fills

**Date:** 2026-09-17
**Status:** Accepted
**Found via:** filling the generic form filler against the registration template
and pressing Extract. The submission was rejected by the pre-flight validator
with one error, and the bundle it produced carried no clinical timestamp
anywhere and one example patient's phone number and street address.

## Context

The registration and follow-up template Questionnaires each carry the whole
submission as a contained transaction Bundle, written out once from a worked
example and annotated with `templateExtractValue` expressions that swap the
example's values for the answers. The example is Anna Müller's registration.

Two properties of that copy were not carried across from the definition-based
Questionnaires that preceded them.

**Temporal anchors lost their computed fallback.** A definition-based
Questionnaire states the anchor as an expression that always yields a value:

| element | definition-based | template-based, as copied |
|---|---|---|
| `Observation.effectiveDateTime` | `now()` (50 items) | `encounter.date`, optional |
| `Encounter.period.start` | `now()` | `encounter.date`, optional |
| `Condition.recordedDate` | `today()` | `encounter.date`, optional |
| `Procedure.performedDateTime` | `%resource.authored` | `proc.priorTreatment1.start`, optional |

Forty-four expressions in the registration template and thirty in the follow-up
template read one optional question. Leaving it blank is ordinary use: the
question carries no `required` flag and the form does not gate submission on it.
The result was a bundle in which no resource carried a time. For
`RotatorCuffProcedure` it was worse than useless: `performed[x] 1..1` made the
Procedure non-conformant, which also cost it the `priorTreatment` slice of
`RotatorCuffRegistrationBundle`, whose discriminator is by profile.

**The example's own demographics had no question behind them.** Four elements of
the Patient template carry no `templateExtractValue` sidecar and correspond to no
question on the form: `telecom`, and `address.line`, `.city`, `.postalCode`. An
annotated element whose expression yields nothing is dropped; an unannotated one
is copied verbatim. So every Patient the form produced carried
`+49 331 5556677` and `Bertha-von-Suttner-Allee 7, 14471 Potsdam`.

Separately, the definition-based follow-up Questionnaire marked no measurement
required, while `RotatorCuffFollowUpBundle` requires `observation 1..*`.
Answering exactly what that form asks for produced a one-entry bundle its own
profile rejects. Its template sibling already required the Subjective Shoulder
Value.

## Decision

**A temporal anchor in a template falls back to a computed value when its
question is unanswered.** Each expression becomes
`iif(<answer>.exists(), <answer>, <fallback>)`, with the fallback matching what
the definition-based sibling uses for the same element: `now()` for
`Observation.effectiveDateTime`, `Encounter.period.start` and
`ImagingStudy.started`; `today()` for `Condition.recordedDate`;
`%resource.authored` for `Procedure.performedDateTime` and
`performedPeriod.start`.

Two elements deliberately keep an unconditional binding and are simply absent
when unanswered. `Period.end` may legitimately be unknown at the time of
writing, and inventing a closure time asserts something no one recorded.
`Condition.onset` is a clinical claim about when the disease began; defaulting it
to the visit date would state that every condition started the day it was
written down, which is false and unfalsifiable from the record.

**A template carries no element that no question fills.** The Patient's
`telecom` and `address` are removed. The rule generalises beyond them: a value
in a template is either fixed by the profile, or filled by an expression, or it
does not belong in the template.

**A form guarantees the bundle entries its profile requires.** The definition-
based follow-up Questionnaire marks the Subjective Shoulder Value required,
matching its template sibling. It is the single-question global outcome, the
smallest answer that makes a follow-up visit a follow-up.

## Consequences

The registration and follow-up templates produce timed resources from any answer
set the form accepts, and the prior-treatment Procedure is conformant whether or
not its dates were given. Nothing in any form filler changed: all three fixes are
edits to the Questionnaires, which is the property the demonstration rests on.

A resource timed by fallback carries the moment of data entry, not the moment of
care. For a registration completed at the visit these coincide; for a
retrospective entry they do not, and the visit-date question remains the way to
say so. This is the same accuracy the definition-based forms have always had.

The general defect stands: nothing checks a contained template against the
profiles its `meta.profile` claims, so the next hand-copied template can drift
the same way. Recorded as a limitation, with the specific regressions guarded by
tests — a template resource declaring a temporal anchor must still carry one when
the visit date is blank, no element the form never asks for may reach the
Patient, and the bundle-entry guarantee now covers the definition-based forms as
well as the template ones.
