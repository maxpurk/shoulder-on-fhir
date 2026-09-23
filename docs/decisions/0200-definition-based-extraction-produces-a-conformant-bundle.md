# ADR-0200: Definition-based extraction produces a conformant bundle; the envelope difference is self-declaration

**Date:** 2026-09-17
**Status:** Accepted
**Corrects:** the reading of ADR-0190 that had spread into project decisions
**Relates to:** ADR-0190 (and its 2026-09-16 addendum), ADR-0192, ADR-0199

## Context

A claim had taken hold that template extraction is the only mechanism able to
produce a bundle conformant to this guide's bundle profiles, and that
definition-based extraction "provably cannot", so its conformance claim stops at
the Questionnaire. It reached a decision to drop the definition mechanism from the
thesis story, and it was repeated in working notes.

ADR-0190 does not say this. Its 2026-09-16 addendum says the opposite in as many
words: "This ADR has been misquoted, including by its own author, as finding that
definition-based cannot produce a conformant bundle. It finds the opposite." The
specification's extraction page compares the two mechanisms and does not rank them:
the template approach "supports the same level of capability, however is unable to
leverage any of the information inside a profile where the definition based approach
can."

Two separate facts had been collapsed into one. Only one of them holds.

## Findings

Measured through the guide-agnostic filler, both live surgery forms, every
StructureDefinition resolved from the compiled profiles with nothing unresolved.

| | definition-based | template |
|---|---|---|
| `Bundle.type` | `transaction` | `transaction` |
| `entry.fullUrl` set | all entries | all entries |
| `entry.request.url` set | all entries | all entries |
| entry `meta.profile` set | all entries | all entries |
| `Bundle.meta.profile` | absent | the bundle profile |

1. **`Bundle.meta.profile` is not reachable by definition-based extraction.**
   `definitionExtract` has exactly six sub-extensions, `definition`, `fullUrl`,
   `ifNoneMatch`, `ifModifiedSince`, `ifMatch` and `ifNoneExist`, and every one is
   scoped to a bundle entry. Nothing reaches `Bundle.meta`. This half of the claim
   is correct.

2. **That is not a conformance failure.** The three bundle profiles constrain
   `type = #transaction (exactly)`, `entry.fullUrl 1..`, open slicing discriminated
   by type and profile on `resource`, and their required entry slices. None of them
   constrains `Bundle.meta`. Definition-based extraction satisfies all of it,
   including the profile discriminator, because the canonical named in
   `definitionExtract.definition` is stamped onto each extracted resource's `meta`.

3. **What template extraction adds is self-declaration.** The submission says which
   profile it claims, so a receiver that was not told out of band can find out from
   the bundle. That is a real property and an interoperability convenience. It is not
   what makes the bundle conformant.

4. **The asymmetry the specification names runs the other way.** Definition-based
   extraction resolves fixed values, bindings and slice constraints from a
   StructureDefinition at extraction time. A template restates them and nothing in
   the build ties the restatement back to the profiles it claims
   (`limitations_items/0030`).

5. **Resources no question describes are declarable.** See ADR-0199. The absence of
   the research care plan from definition-based output was a gap in the
   Questionnaires, not a ceiling in the mechanism.

## Decision

1. **State the difference as self-declaration, not conformance.** Both mechanisms
   produce bundles that conform to this guide's bundle profiles. Only template
   extraction produces a bundle that says so about itself.

2. **Keep both mechanisms.** Six Questionnaires stay published, three per mechanism,
   and the guide-agnostic filler keeps reading both and choosing per form. The
   difference between them is reported as a finding about the standard rather than
   resolved by picking a winner.

3. **Never cite ADR-0190 as a finding that definition-based extraction cannot produce
   a conformant bundle.** Cite it for what it establishes: the six entry-level
   sub-extensions, the direction split on cross-resource references, and the
   declarations that were missing from the forms.

## Consequences

✅ The two mechanisms are comparable on equal terms, which is a stronger result than
either one alone: the standard calls them equal in capability, and building both
surfaced one asymmetry in each direction.

✅ The three definition-based Questionnaires keep their place in the artifact.

⚠️ Working notes and a stored project note repeated the incorrect premise and are
corrected alongside this record.

⚠️ A receiver of a definition-based submission must be told which bundle profile to
validate against. Nothing in the bundle says it.

## Sources

- ADR-0190, findings 3, 5 and 6, and the addendum of 2026-09-16
- HL7 SDC IG v4.0.0, Form Data Extraction
- `hl7.fhir.uv.sdc#4.0.0`, `StructureDefinition-sdc-questionnaire-definitionExtract.json`
- `ig/input/fsh/profiles/RotatorCuff{Registration,Surgery,FollowUp}Bundle.fsh`
- Extraction measured through `sdc-generic-frontend/src/lib/sdcExtract.ts` and `templateExtract.ts`
