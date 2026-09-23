# SDC features the generic filler does not implement

> **Status:** Open. Scoped by testing against the specification's own examples, not approved.

## Gap

The guide-agnostic filler was exercised against the examples HL7 ships inside
`hl7.fhir.uv.sdc#4.0.0` rather than against this guide's own Questionnaires. Both
declarative extraction mechanisms, population, conditional display and every item
type the corpus uses are handled. Three declarations the specification's examples
exercise are not:

| Declaration | Where the spec uses it | Behaviour today |
|---|---|---|
| `targetStructureMap` | `Questionnaire-extract-complex-smap` | The form is classified as neither template nor definition based, so extraction is refused rather than attempted |
| `contextExpression` with `choiceColumn` | `questionnaire-sdc-profile-example-context-expression` | The answer list stays empty; the item still renders and can be left blank |
| `attachment` item type | three items across the corpus | Drawn as a disabled control labelled unsupported |

## Why it matters

The claim the filler is built to support is that a client reading only published
artifacts can capture conformant data for a guide it has never seen. Extraction
by StructureMap is the one mechanism of the three the specification defines that
this client cannot perform, so a guide choosing it would not be served. The other
two are narrower: a query-driven answer list is a convenience the form can be
authored without, and an attachment is a data type this guide never collects.

## Note

Implementing StructureMap extraction means an interpreter for the FHIR Mapping
Language, which is a substantially larger undertaking than the two mechanisms
already present and is not reached by anything this guide declares. Refusing a
form the client cannot correctly extract is the safe behaviour in the meantime,
and is what it does.

Two of the specification's own extraction examples carry defects that testing
surfaced, both reported rather than worked around: `extract-complex-defn3`
declares seven values for an Observation it never declares the context to create,
and the per-item Observation template in `extract-complex-template` annotates
`subject` whole with an expression yielding a bare id, where the sibling
`RelatedPerson.patient` correctly annotates `reference`.
