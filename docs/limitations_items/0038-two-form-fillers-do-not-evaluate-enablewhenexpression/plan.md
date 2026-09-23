# Two form fillers do not evaluate enableWhenExpression

> **Status:** Limitation — open. Found 2026-09-18, alongside ADR-0206, which gates the two
> prior-treatment count questions on the treatment they count. Classified against the expert
> consensus: **none** — the elements stay representable and the guide states the condition
> correctly; this is a renderer gap in two applications.

## Gap

`ShoulderRegistrationQuestionnaire` and `ShoulderRegistrationFullTemplateQuestionnaire` declare
`sdc-questionnaire-enableWhenExpression` on the two count questions, so a form filler is told not
to ask them until a prior physical therapy or injection is recorded. Two of the four fillers do
not read it:

- The guide-aware SDC frontend (port 3001) renders the definition-based form and filters items on
  `questionnaire-hidden` only. It shows the count regardless, and its bundle assembler builds the
  Observation from whatever answer is present, so it can still submit a count with no Procedure
  behind it — the defect ADR-0206 corrects.
- The LHC-Forms frontend (port 3003) renders the template form through a third-party engine. The
  template gates the resource at extraction, so an unanswered or refused treatment extracts
  nothing regardless of what the engine draws; the exposure there is a question that should not
  be on screen, not a record that should not exist.

The generic filler evaluates the expression and applies it to the renderer, the required-question
check and the QuestionnaireResponse alike.

## Why it matters

The demonstration's claim is that a form's behaviour travels with the form, so a second
implementer reading the same Questionnaire collects the same data. An expression the guide states
and a filler ignores is the counterexample: two applications on one server, given identical
answers, disagree about whether a record exists. The count is a small instance of it; the gap is
general, and any future conditional question inherits it.

Both applications are outside what the deliverables describe, which is why this is recorded rather
than fixed: neither is evidence in the thesis, and closing it in the guide-aware frontend is
ordinary work whenever that frontend is next touched.

## Note

The work in the guide-aware frontend is small and already half-present: `lib/calculatedExpression.ts`
evaluates FHIRPath against a QuestionnaireResponse it builds from form state, which is exactly what
an enableWhenExpression needs. It would be a collector over the items, one evaluation pass per
answer change, a filter beside `isHiddenItem` in `QuestionnaireForm.tsx`, and the same result
consulted where the response is built.
