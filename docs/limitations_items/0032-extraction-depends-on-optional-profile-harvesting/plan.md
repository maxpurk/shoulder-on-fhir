# Every extracted observation depends on a step the specification only recommends

> **Status:** Limitation — open. Portability of the definition-based forms. Found 2026-09-17 by
> an interoperability review of the extraction declarations against SDC v4.0.0. Classified
> against the expert consensus: **none directly** — every element stays representable, but the
> codes that identify 84 of them travel only if the receiving engine takes an optional step.

## Gap

A definition-based form names, for each answer, the element it fills. It does not restate the
code that identifies the resource: `Observation.code`, `Observation.category` and the UCUM unit
on a quantity are all supplied by the profile as `patternCodeableConcept`, `patternUri` and
`patternCode`, and no `definitionExtractValue` or `item.definition` in any of the three forms
targets them.

That is the design, and it is the asymmetry the specification itself names in favour of the
definition-based mechanism. But the specification words the harvesting step as a
recommendation, not a requirement: fixed and pattern values from the profile *should* also be
extracted, and slicing information *may* be processed. An engine that skips it is still
conformant, and it emits 84 observations with no `code`, which is `1..1` in R4, no category,
and a bare number with no unit.

HL7's own reference walkthroughs of definition-based extraction set `Observation.category`
explicitly rather than relying on harvesting, so the path this guide depends on is the less
exercised of the two.

## Why it matters

This is a larger portability dependency than any other in the forms. The guide's own engine
harvests, so nothing here shows the failure. A second implementer whose engine does not gets a
submission that is rejected on cardinality, and if a receiver is lenient, a set of unlabelled
numbers.

## Note

Two ways out, both open.

- **State the requirement.** The published narrative now says an engine must resolve the target
  profile and apply the values it pins. That makes the expectation visible; it does not make it
  enforceable.
- **Declare the codes in the form.** A `definitionExtractValue` per observation profile for
  `Observation.code.coding` and `Observation.category.coding` would make each form a
  self-contained recipe. It is mechanical, derivable from the profiles themselves, and it costs
  the thing the definition-based mechanism exists to provide: the form would then restate values
  the profile pins, which is what the template mechanism does and what
  `limitations_items/0030` exists to police.

The second option converts this guide's definition-based forms into something closer to
templates for the elements that matter most, so it is a real design decision and not a fix.
