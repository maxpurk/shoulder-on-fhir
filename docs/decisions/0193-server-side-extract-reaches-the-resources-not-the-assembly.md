# ADR-0193: Server-side `$extract` reaches the resources, not the assembly

## Status

Accepted

## Context

ADR-0190 established the declarative ceiling of definition-based extraction by
reading the specification and the profiles. ADR-0192 then showed the template
mechanism clears that ceiling, using an extraction engine written for this
project. Both arguments would be stronger if the ceiling had also been observed
in an implementation nobody here wrote.

It was. A standalone experiment ran the three definition-based Questionnaires
through the NLM's LHC-Forms renderer and submitted the captured
`QuestionnaireResponse` to HAPI's own `QuestionnaireResponse/$extract`, the
operation HAPI's Clinical Reasoning module provides. That experiment lived
outside version control and has been removed; its two findings are recorded
here so they survive, and its two renderer workarounds now live in
`sdc-lforms-frontend/`.

## Decision

Treat HAPI's `$extract` as the independent confirmation of the ceiling, and
state the ceiling as a property of definition-based extraction rather than of
any one implementation.

## Consequences

**`$extract` does work on this guide, and does more than expected.** Given a
registration response it returns a transaction Bundle carrying `Patient`,
`Condition` and `Procedure`, correctly coded, with each fixed `Observation.code`
and `category` resolved from the profiles loaded into the server. Nothing is
hardcoded, and it worked even against the legacy `itemExtractionContext` the
Questionnaires carried at the time.

**What it does not emit is exactly the assembly.** The experiment had to add,
client-side, the transaction entries' `request.url`, the cross-resource
`subject` references, and required elements the operation leaves out such as
`Condition.clinicalStatus`. Beyond that it produces no three-bundle assembly, no
IPS profile claims, no `Coverage` and no research `CarePlan`, none of which any
item describes. So the division is not between a good and a bad extractor: the
core discrete resources are declarable and the registry-shaped envelope around
them is not, whoever performs the extraction.

**Two renderer limits were found and are worth keeping.** LHC-Forms does not
implement the SDC `itemPopulationContext` extension, only the base FHIR
`variable` extension, although both carry the same `valueExpression`; the
population query runs once it is rewritten into two base variables. And it
bulk-loads any `answerValueSet` at render time, so an implicit SNOMED
subsumption ValueSet has to have its binding dropped or the form renders with an
error banner. Both transforms are now in `sdc-lforms-frontend/web/app.js`.

Enabling the operation is not free: it requires `hapi.fhir.cr.enabled` on a
server this guide otherwise runs as pure storage (ADR-0044), which is why it is
recorded as an experiment rather than adopted into the stack.
