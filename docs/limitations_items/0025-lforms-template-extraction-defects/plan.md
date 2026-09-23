# Third-party SDC engine does not complete template extraction

> **Status:** Open

## Gap

The three template-based Questionnaires carry their whole submission as a
contained Bundle, annotated with `templateExtractValue` expressions and
`extractAllocateId` variables. Rendered and extracted by LHC-Forms 43.1.0, the
form fills correctly and every answered value reaches its field, but the bundle
envelope does not survive:

* **`extractAllocateId` variables never resolve.** `%encounterId` and its
  siblings evaluate to an empty collection, so no `entry.fullUrl` is produced
  and no entry can reference another.
* **An expression yielding nothing writes `[]` instead of removing the field.**
  The extracted bundle carries `"fullUrl": []`, `"reference": []`,
  `"performedDateTime": []` — types the element does not admit. The SDC
  specification says an element whose expression yields no value is omitted.
* **`meta` does not travel.** `Bundle.meta` is dropped outright, so the
  submission is not self-labelled, and each entry's `meta.profile` arrives
  empty even though the template states it literally.

Validated against `RotatorCuffSurgeryBundle`, the result carries 22 errors, all
of them from the three points above. The same template validates with zero
errors through the engine written for this guide.

## Why it matters

The guide's claim is that a Questionnaire is portable: any conformant SDC
client should be able to render it and return a conformant submission, with no
knowledge of the guide compiled in. That claim holds for the parts of the
mechanism the ecosystem has implemented, and the answer-to-template merge is
one of them. It does not yet hold end to end against an independent engine,
because the cross-resource scaffolding these submissions depend on is the
newest and least exercised part of the extension set.

This is a statement about tool maturity in September 2026, not about the
Questionnaires: the extensions involved are `draft` at FHIR Maturity Model
level 0, and the guide's own engine shows the declarations are sufficient.

## Note

Worth reporting upstream; each of the three is small and independently
fixable. A fourth, distinct issue is that `mergeFHIRDataIntoLForms` discards
`contained`, so an application reloading a saved `QuestionnaireResponse` loses
the template entirely. That one does not affect the ordinary fill-and-extract
path, which never calls it.
