# ADR-0198: What the extraction engines infer, and what they refuse

**Date:** 2026-09-17
**Status:** Accepted
**Builds on:** ADR-0122 (choice elements resolved from the compiled profile, in the guide-aware frontend)
**Relates to:** ADR-0190 (the declarative ceiling), ADR-0192 (template extraction as the mechanism of record), `future_work_items/0031`

## Context

Both engines in the guide-agnostic filler had only ever been run against this
guide's own Questionnaires. Running them instead against the examples HL7 ships
inside `hl7.fhir.uv.sdc#4.0.0` — thirty-eight Questionnaires, including the same
form written four ways, once per extraction mechanism — is a different test: it
asks whether an engine written to be generic actually is, using forms nobody here
authored.

Template-based extraction passed both variants unchanged, producing every resource
the examples describe. Definition-based extraction produced three defects, all of
them invisible against this guide because this guide's Questionnaires happen to use
the more specific of two spellings the specification allows in each case.

Two of the three were failures to name an element. FHIR names a choice element's
property after the type it carries, so `Observation.effective[x]` is written
`effectiveDateTime`. An element id may name the choice with its suffix, without it,
or pin a type through a slice, and the specification's own examples use all three.
The engine handled one. The third defect was a value written into the wrong
resource: a value declared for a profile with no extraction context in scope fell
back to the first resource built for that profile anywhere in the form, which gave
one Observation a second code and a second performer belonging to another.

Testing also surfaced the general question behind all of this. An engine that meets
a declaration it cannot act on has three options — guess, drop it silently, or say
so — and the three defects were each a case of the engine having quietly picked one
without the choice ever being made deliberately.

## Decision

Two rules, and they are a pair. The engine infers only what a declaration bounds,
and refuses everything else in the open.

### What is inferred

**A choice element's concrete type is decided by the value written into it, within
the types the element permits.** Three cases, in order:

1. A type slice pins the property name. `Observation.value[x]:valueQuantity` writes
   `valueQuantity` because the slice name *is* the concrete property name, and the
   value gets no say — the form already chose.
2. A choice permitting one type uses it. This is every element this guide declares,
   because its profiles constrain `value[x]` to a single type.
3. A choice permitting several is named from the shape of the value: a boolean
   answer writes `valueBoolean`, an object carrying `start` writes a Period, a
   string matching a date-time writes `dateTime`. A type the element does not
   permit is never chosen.

This extends ADR-0122, which resolved the opposite direction in the guide-aware
frontend by matching a concrete `onsetDateTime` back to the declared `onset[x]` and
comparing capitalised type codes against the segment's suffix. That mechanism
cannot reach a choice named with no suffix at all, because there is nothing to
compare.

**A slice name is not a repetition.** Array-ness is read from the cardinality of
the element in the resource being profiled, `ElementDefinition.base.max`, and never
from the presence of a slice name. Slicing a repeating element picks one of its
entries; slicing a choice element by type leaves a single value, and treating the
two alike wrote `valueQuantity` as an array of one.

### What is refused

| Situation | What the engine does |
|---|---|
| A value declared for a profile with no extraction context in scope | Reports it. The first resource built for that profile belongs to a different question |
| A form declaring `targetStructureMap` | Classified as neither mechanism, so extraction is refused rather than attempted |
| A template writing a value over an element it had drawn as an object | Copies it out as the template asks, and reports the mismatch |
| An `attachment` item | Drawn as a control labelled unsupported |

The template row is the load-bearing one. Correcting that mismatch means knowing
the element is a Reference, which means reading a StructureDefinition, which is the
one thing template extraction does not do — reading none is what distinguishes it
from the other mechanism and is the whole of the trade ADR-0192 recorded. So the
template stays the authority over its own content and the reader is told, which
keeps both the mechanism and the reader intact.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Name a choice element from the element's first declared type | The previous behaviour, and also a guess — just one with no information behind it, which wrote `valueQuantity` over a boolean answer |
| Refuse to name a bare choice at all and report it | Consistent with the refusals, but wrong: the element's own type list bounds the inference and FHIR's naming rule is mechanical, so there is nothing being guessed at |
| Let the value override a type the form pinned through a slice | A form that named `valueQuantity` has already decided; a whole-number answer would otherwise silently become `valueInteger` |
| Create the missing resource when a value has no extraction context | Invents a resource the form never declared, which is a larger fabrication than the one being fixed |
| Drop an unactionable declaration silently | The failure then surfaces as a server rejection, or not at all |
| Wrap a scalar as a Reference where a template drew an object | Requires a StructureDefinition and dissolves the distinction between the two mechanisms |
| Attempt StructureMap extraction partially | An interpreter for the FHIR Mapping Language is a substantially larger undertaking than either mechanism present, and a partial one produces plausible wrong output |

## Consequences

✅ Both mechanisms now extract HL7's own examples. The template variants produce
every resource described with nothing unresolved, which generalises ADR-0192's
result beyond this guide's profiles to forms authored elsewhere.

✅ Every extracted choice element is named as FHIR names it, so a value written
into `Observation.effective` or into an unconstrained `value[x]` is valid where it
previously was not.

✅ What an engine cannot do is now visible in the interface rather than inferred
from a missing field.

⚠️ The definition-based engine now reports more, not less. Against HL7's
`extract-complex-defn3` it reports eight unresolved elements where it previously
reported one and silently mixed the rest into an unrelated Observation. The
reported state is the honest one, and it is also noisier.

⚠️ Two of the specification's own examples carry defects that this reports rather
than absorbs: `extract-complex-defn3` declares seven values for an Observation it
never declares the context to create, and the per-item Observation template in
`extract-complex-template` annotates `subject` whole with an expression yielding a
bare id, where its sibling `RelatedPerson.patient` correctly annotates `reference`.
Both are recorded in `future_work_items/0031`.

❌ StructureMap-based extraction remains unimplemented, so a guide choosing that
mechanism is not served by this client. Refusal is the safe behaviour, not a fix.

## Sources

- `sdc-generic-frontend/src/lib/profileTypes.ts` — `chooseType`, `concreteType`, choice resolution, segment naming
- `sdc-generic-frontend/src/lib/sdcExtract.ts` — the three value modes, and array-ness from cardinality alone
- `sdc-generic-frontend/src/lib/templateExtract.ts` — the reported type mismatch
- `sdc-generic-frontend/test/sdc-spec-examples.test.mjs` — fifteen tests over the examples in `hl7.fhir.uv.sdc#4.0.0`
- `hl7.fhir.uv.sdc#4.0.0` package — `Questionnaire-extract-complex-{defn3,template,template2,smap}`
