# ADR-0192: Template extraction proven across all three bundle profiles

## Status

Accepted

**Amended 2026-09-17 by ADR-0198.** The portability paragraph below is stronger
than it was written. It records that the mechanism's declarations are portable but
that an independent engine did not complete the bundle scaffolding. The template
engine in the guide-agnostic filler has since been run against the template examples
HL7 ships inside `hl7.fhir.uv.sdc#4.0.0` — `extract-complex-template`, which carries one
contained template per resource, and `extract-complex-template2`, which carries the
whole submission as a single contained Bundle. Both extract every resource the
examples describe with nothing unresolved and nothing emptied, from forms nobody
here authored. The generality the paragraph left open for the mechanism is therefore
established: what remains open is the ecosystem claim about a third-party engine,
which is unchanged.

## Context

ADR-0190 evaluated what the SDC extraction mechanisms can declare and found a
ceiling in the definition-based mechanism: it describes where a single answer
belongs, one element at a time, and leaves the surrounding submission — the
bundle envelope, its profile label, the resources no question describes, and
the references between them — to the receiving application. A guide built on
three named transaction-bundle profiles needs all of that, so the conformance
claim stopped at the Questionnaire and did not reach the bundle.

The template mechanism states the submission literally instead: the whole
Bundle is written out once as a contained resource, fields sourced from answers
carry a `templateExtractValue` FHIRPath expression, and `extractAllocateId`
declares the uuids the entries reference each other by.

A single registration Questionnaire established that the mechanism carries the
envelope. The open question was whether it generalises, in particular to the
two submissions that create no Patient and no Condition and must instead
reference resources persisted by an earlier submission.

## Decision

Declare extraction for all three bundle profiles with the template mechanism,
one Questionnaire each, and treat the template as the mechanism of record for
this guide's SDC demonstration.

For Surgery and Follow-Up, the patient and the condition are referenced by
persisted id. The form asks for the two ids and the template builds each
reference by FHIRPath concatenation. This follows the same rule as any other
annotated field: an unanswered id yields nothing, so the reference is dropped
rather than emitted empty.

The definition-based Questionnaires remain alongside them. They are what the
SDC frontend consumes, and keeping both makes the difference between the two
mechanisms inspectable rather than asserted.

## Consequences

All three submissions are now self-labelled: each extracted Bundle carries the
`meta.profile` of the bundle profile it claims, so a receiver can check the
claim without being told out of band which profile to expect. Each validates
against that profile with zero errors and is accepted by the server as a
transaction.

One element the definition mechanism could not reach is now covered:
laterality answered once reaches `Observation.bodySite` on every observation in
the submission, because a template can name the same answer from several
places.

The cost is that nothing is read from the profiles. Every fixed code, category,
unit and status in a template is typed out by hand and has to be kept in step
with the profile that fixes it — the opposite trade from the definition
mechanism, which resolves all of that at runtime and needs none of it written
down. A change to a fixed value in a profile will not propagate; it has to be
made in the template too.

The mechanism's portability is established for the declarations, not yet for
the ecosystem. An independent engine renders these Questionnaires and merges
answers into the template correctly, but does not complete the bundle
scaffolding; the specifics are logged as a limitation. See the amendment above:
the declarations side now holds against the specification's own template
examples as well as against this guide's.
