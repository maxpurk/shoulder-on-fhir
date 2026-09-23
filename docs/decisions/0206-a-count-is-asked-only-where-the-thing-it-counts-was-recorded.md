# ADR-0206: A count is asked only where the thing it counts was recorded

**Date:** 2026-09-18
**Status:** Accepted

## Context

Filling the registration form in the generic filler and answering nothing but the patient, the
diagnosis and "Prior Physical Therapy, Number of Sessions" produced a conformant transaction
Bundle carrying a `prior-physical-therapy-session-count` Observation and no Procedure. The
submission asserts a number of physical therapy sessions for a patient with no physical therapy
on record.

`ShoulderRegistrationQuestionnaire` puts the two counts in a `priorTreatmentFrequency` group that
sits beside the repeating `priorTreatment` group and depends on nothing in it. Each count carries
its own `definitionExtract`, so it builds its own Observation whether or not any treatment was
entered. The unified frontend has always asked the question the other way round — a yes/no
"Prior Physical Therapy", with the count revealed only on "yes" — so the two applications
disagreed about what the same dataset means.

The template form had the same defect from the other direction. Its counts are gated at
extraction, on `...answer.value.where($this).exists()`, and that expression does not filter a
boolean: `where($this)` over `[false]` returns `[false]`, which exists. Answering **no** to
"Prior treatment given: Physical therapy" therefore extracted the physical therapy Procedure and
its session count, asserting a treatment the form had just been told did not happen. The same
expression gates the prior-treatment entries themselves, so the reach was wider than the counts.

Neither case is caught downstream. Both Bundles satisfy `RotatorCuffRegistrationBundle`: the
prior-treatment slice is `0..*`, an Observation needs no Procedure to refer to, and nothing
relates the two. Validation has nothing to object to, because the resources are individually
well-formed and the relationship that is missing was never modelled.

## Decision

A question whose subject is another answer is asked only when that answer was given, and the
form says so itself.

The two counts in `ShoulderRegistrationQuestionnaire` carry SDC's
`sdc-questionnaire-enableWhenExpression`, evaluated against the response so far:

```
%resource.repeat(item).where(linkId='priorTreatment.type').answer.valueCoding
  .where(system='http://snomed.info/sct' and code='91251008').exists()
```

for the session count, and the two injection codes `PriorNonSurgicalTreatmentType` offers for the
injection count. An expression rather than `enableWhen`, because the governing answer lives inside
a repeating group: `enableWhen.question` names one question by linkId, and R4 leaves undefined
which occurrence that resolves to, while the expression states what is actually meant — any
occurrence recording that treatment.

The template form carries the same gate on the booleans it asks instead, and every
`where($this)` in it becomes `where($this = true)`, which filters a false answer.

The generic filler collects these expressions, evaluates them whenever an answer changes, and
reads the result in three places: the renderer, the required-question check, and the
QuestionnaireResponse. The last is what makes it a data rule rather than a display rule — an
answer typed while a condition held and kept in form state after it stopped holding is left out
of the response, so nothing extracts from it. The typed value stays in the form, and returns if
the condition does.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Move the counts inside the repeating `priorTreatment` group, gated by plain `enableWhen` on a sibling | Semantically tighter, and it would need no expression at all, but two entries of the same treatment would then extract two counts of it; the count is one statement per registration, which is what the unified frontend records and what both worked examples carry |
| Gate on `priorTreatment.category` instead of `priorTreatment.type` | The category is the broader of the two answers and the type is what names the treatment; a count of injections belongs to an injection, not to "administration of medication" |
| Leave the form alone and add an invariant to `RotatorCuffRegistrationBundle` rejecting a count with no matching Procedure | Refuses the submission after it is filled in rather than not asking the question, and a bundle-level invariant cannot express "any entry whose code is one of these" without restating the terminology the form already binds |
| Have the filler drop an orphan count at extraction | Puts knowledge of this guide into a filler that holds none, and would be wrong for any form where the count stands alone |

## Consequences

✅ The count questions appear once the treatment they count is recorded, and not before, in both
extraction mechanisms.
✅ An answer the form has stopped asking for does not reach the QuestionnaireResponse, so it
extracts nothing and blocks nothing: the same rule now governs display, the required check, and
the submission.
✅ A prior treatment answered "no" in the template form is no longer asserted as having happened.
✅ The filler gained a mechanism the specification defines, tested against this guide's forms;
nothing in it knows what a prior treatment is.
⚠️ The guide-aware SDC frontend and the LHC-Forms frontend do not evaluate
`enableWhenExpression`, so the question stays visible in both. The template mechanism refuses the
orphan resource regardless, so the LHC-Forms path is display-only; the guide-aware frontend would
still submit it. Left as it is and recorded as limitations item 0038.
⚠️ `tools/generate-template-questionnaires.py` does not reproduce its own checked-in output, so
the template gate was applied to the `.fsh` by hand and the generator updated to match rather than
re-run. Recorded as limitations item 0037.

## Sources

- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — the two gated count items
- `ig/input/fsh/instances/ShoulderRegistrationFullTemplateQuestionnaire.fsh` — the gated booleans
- `sdc-generic-frontend/src/lib/formLogic.ts` — `collectEnableExpressions`, `enabled`
- `sdc-generic-frontend/src/lib/response.ts` — a disabled item carries no answer
- `sdc-generic-frontend/test/extract.test.mjs` — three regressions, each failing before this change
- `hl7.fhir.uv.sdc#4.0.0` — `sdc-questionnaire-enableWhenExpression`, context `Questionnaire.item`
- ADR-0133 — the bucketed counts that replaced the exact prior-treatment date
- ADR-0144 — parity across the capture flows
