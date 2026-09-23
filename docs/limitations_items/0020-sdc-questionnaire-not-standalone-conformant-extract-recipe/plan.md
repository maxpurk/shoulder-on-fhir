# Three pieces of a submission still live outside the definition-based Questionnaires

> **Status:** Limitation — open, narrowed. Interoperability and portability of the
> definition-based extraction model. Classified against the expert consensus: **none** —
> this concerns the L3 extraction-mechanism envelope, not any `Q#.#` consensus element.

## Gap

A third party handed only the three definition-based `Questionnaire` artifacts, running a
generic SDC engine and reading the guide's profiles, now gets a transaction bundle that
conforms to the bundle profile it targets. Seven things still do not travel with the form. The
bundle conforms without them, because each is optional in the bundle profile, so none of these
is a validity failure and all of them are losses of meaning.

1. **The instance-level International Patient Summary claims.** The guide's own examples
   carry a second canonical in `meta.profile` on `Patient`, the comorbidity `Condition`,
   the surgical `Procedure` and the smoking `Observation`. Extraction stamps only the
   profile named in the extraction context. This is reachable and no longer open: an element
   id may be extended past a snapshot to walk into the data type of the element it names, so
   `#Patient.meta.profile` resolves through `Meta.profile`, which is `0..*`, and the rule for a
   collection is to add to it rather than replace it. What the specification does not state is
   the order: whether the extraction context stamps its own canonical before or after declared
   values are applied. An engine that stamps last would overwrite an appended one. Declaring it
   is therefore worth doing and worth testing against a second engine.

2. **`Condition.evidence.detail` and `Condition.stage.assessment`.** These point from one
   Condition at the imaging and grading observations. The reason recorded here until
   2026-09-17 was wrong: it blamed the scoping of an identifier allocated on a repeating
   group, but none of the grading observations repeats, and an `extractAllocateId` at the
   Questionnaire root is available to every child item, the Condition group included.

   The real obstacle is the unanswered case. An expression that always yields the allocated
   uuid writes a reference to an entry that was never created whenever the observation was
   not graded, and a receiving server rejects the whole transaction on an unresolved
   reference. That is avoidable, because an expression yielding nothing extracts nothing:
   guarding each reference on the answer existing, with `iif(...answer.exists(), %id, {})`,
   makes the link declarable without the dangling case. So this is expressible at the cost of
   one root `extractAllocateId` and one guarded expression per referenced observation, and it
   does not need the form reshaped around the reference graph. The template form already does
   the equivalent with an existence guard on `stage.assessment`.

   Until it is declared, what is lost is meaning rather than conformance: the Goutallier,
   Patte and tear-size observations sit in the bundle unlinked from the diagnosis they grade,
   and `stage` and `evidence` are mustSupport without a cardinality constraint.

3. **`Bundle.meta.profile`.** `definitionExtract` carries exactly six sub-extensions,
   `definition`, `fullUrl`, `ifNoneMatch`, `ifModifiedSince`, `ifMatch` and `ifNoneExist`,
   and every one is scoped to a bundle entry. Nothing reaches the envelope. No bundle
   profile in this guide constrains `Bundle.meta`, so this is a labelling matter and not a
   validity one: the submission conforms, and a receiver has to be told out of band which
   profile to validate it against. Template-based extraction is the mechanism that states
   the envelope, because `templateExtractBundle` extracts the whole transaction bundle as
   one templated resource.

4. **Workers' compensation, consensus element Q1.l.** The question is asked and no
   `definitionExtract` or `item.definition` targets `ShoulderCoverage`, so no Coverage is
   extracted. The template form does not carry it either. This is the stratifier both worked
   example patients are built around.

5. **Comorbidities, consensus element Q1.c.** Asked, and targeted by nothing in the
   definition-based form. The template form carries them up to a hard ceiling of two, because
   a template states a fixed number of entries.

6. **`Encounter.diagnosis` and its `rank`, `L3.F.5`.** Targeted by no form. The rule for
   marking the principal diagnosis stays in application code.

7. **The `QuestionnaireResponse` itself.** Two bundle profiles carry a slice for it, and
   definition-based extraction never places the response in the bundle, so the submission
   carries no record of the instrument that produced it. Distinct from
   `limitations_items/0019`, which is about a `Provenance` back-link rather than the response
   resource the bundle profile already has a slice for.

## Why it matters

The selling point of the SDC paradigm is that a Questionnaire is a portable, engine-agnostic
recipe: hand it to any SDC tool and get conformant registry data. That now holds for the
bundle envelope and for every element the forms do target. It does not hold for two consensus
elements, Q1.l and Q1.c, which a partner would lose without any error being raised, and the
diagnosis-to-evidence links and the IPS claims are declarable but not declared.

A second dependency sits underneath all of this and is recorded separately in
`limitations_items/0032`: the codes that identify every extracted observation come from the
profile, and the specification only recommends that an engine read them.

## What closed, and how

Recorded because the earlier version of this item listed all of it as missing.

- **The registration `ShoulderEncounter`.** Declared at the Questionnaire root, where a
  `definitionExtract` always extracts even with no answer beneath it, with its fixed
  status, class and type supplied by `definitionExtractValue`. This was the severe case:
  every bundle profile requires `encounter 1..1`.
- **The research `CarePlan`.** Declared the same way, with `activity` sliced on the
  timepoint code so each of the five expert consensus Q11 timepoints is addressable by
  element id and the code identifying it comes from the profile.
- **The cross-resource reference graph.** `extractAllocateId` at the root allocates one
  uuid per anchor for the whole bundle, `definitionExtract.fullUrl` places it on the entry
  and `definitionExtractValue` writes it into each referring element.
- **Required-but-not-collected submission defaults.** Resource status codes,
  `Condition.clinicalStatus`, `verificationStatus` and a recorded date, all declared.
- **`Observation.bodySite` carried from one laterality answer.** Declared on each
  physically anchored observation's own item, by the `DeclareBodySite` rule set, reading
  the single side answer. The follow-up form does not ask the side, so it seeds a hidden
  item from the diagnosis being followed up, because extraction reads only the response.
  A declaration has to sit on the item whose `definitionExtract` creates the resource, or
  beneath it, because the specification's traversal scans down from that context.

## Note

FHIRPath used during extraction cannot reach `launchContext`, `initialExpression` or
`variable`. It sees the QuestionnaireResponse, the Questionnaire and `extractAllocateId`
only. A value that must survive into extraction has to be in the response first, which is
what the hidden pre-populated items are for.

**Distinct from `limitations_items/0019`** (extracted resources carry no provenance
back-link to the QuestionnaireResponse): 0019 concerns linking back to the response, while
this item concerns the form not being a complete standalone recipe.
