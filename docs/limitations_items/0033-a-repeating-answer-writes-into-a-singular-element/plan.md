# A repeating answer writes into a singular element, and all but one answer is dropped

> **Status:** Limitation — open. Found 2026-09-17 by an interoperability review. Classified
> against the expert consensus: **Q4.b**, affected tendons. The element stays representable, and
> the worked examples carry it correctly, but the definition-based form loses all but one answer.

## Gap

`obs.tendons-involved` repeats, so a torn supraspinatus and infraspinatus are two answers to one
question. Its `item.definition` names
`tendons-involved-observation#Observation.value[x]`, and that element is `0..1 CodeableConcept`.

The mapping row for Q4.b specifies one Observation per affected tendon. The specification says
an item-level extraction context creates one resource per repetition of a repeating *item*, but
also that multiple answers to a single item are processed together, and that mapping several
answers into a singular element is an error. So a conformant engine has four defensible
outcomes: one observation per tendon, one observation carrying several codings, an error, or the
last answer winning.

This guide's engine takes the last answer, silently. Two tendons in, one tendon stored.

## Why it matters

Tendon involvement is a consensus element and one of the few that is genuinely multi-valued.
Losing it is invisible: the submission is valid, the bundle conforms, and the record simply says
one tendon was torn.

The template-based form is unaffected, and both worked example patients were authored as
bundles rather than through the form, so nothing in the repository currently demonstrates the
loss.

## Note

The fix is a form-design change, not an expression change: wrap the tendon question in a
repeating group and move the `definitionExtract` onto that group, so each repetition creates its
own Observation. That changes how the question is drawn, so it needs a clinical review of the
question wording alongside it.

The same shape is worth checking on any other repeating question whose answer lands in a
singular element. The 65 laterality declarations were given `first()` for the adjacent case on
the `definitionExtractValue` side; this is the `item.definition` side, which `first()` cannot
reach.
