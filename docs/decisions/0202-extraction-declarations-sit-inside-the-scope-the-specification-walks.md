# ADR-0202: Extraction declarations sit inside the scope the specification walks, and name real element ids

**Date:** 2026-09-17
**Status:** Accepted
**Relates to:** ADR-0199 (a resource no question describes is declared at the Questionnaire root), ADR-0200 (both mechanisms produce a conformant bundle), ADR-0201 (template fidelity checked in both directions), ADR-0122 (the generic resolver reads types from the profile, not from a table)

## Context

Two properties of the definition-based Questionnaires were true of this project's
own extraction engine and not of the mechanism as the specification states it.

**Where a value may be declared.** SDC v4.0.0 states the traversal: for each item
carrying a `definitionExtract`, create a stub resource of that profile, "then
scan the item and all its children and populate values in the resource based on
items that have a matching definition property set, or have
definitionExtractValue extensions on them that have the same definition canonical
URL value as in the definitionExtract extension". The scan runs downward from the
extraction context. The specification's own definition-based example co-locates
every `definitionExtractValue` with the `definitionExtract` it belongs to, or
places it beneath it.

Eighty declarations sat above their context instead: at the Questionnaire root,
keyed to a profile whose `definitionExtract` was on a descendant item. Forty-one
in the registration form, thirty-three in the follow-up form, six in the surgery
form. Among them `Encounter.status`, `Encounter.class` and
`Encounter.reasonReference`, all mandatory, `Patient.identifier`,
`ImagingStudy.status`, `Condition.verificationStatus`, and `Observation.bodySite`
on every observation that names a physical site, which is the laterality the
whole model turns on. This engine resolved them by deferring a root-declared
value and retrying it after the walk, against the first draft created for that
profile. No such resolution order appears in the specification, so a second
implementer following the stated traversal would have dropped all eighty, and the
follow-up form's Encounter would have failed cardinality on `status` alone.

**How an element is named.** `definitionExtract.definition` and
`definitionExtractValue.definition` carry a profile canonical, a `#`, and an
element id. Four families of declaration named a choice element by the concrete
property an instance writes rather than by the element id the profile declares:
`Observation.effectiveDateTime` (through a rule set, so on every extracted
observation in all three forms), `Procedure.performedDateTime`,
`Procedure.performedPeriod.start`/`.end`,
`Patient.extension:recordedSexOrGender.extension:value.valueCodeableConcept`, and
`CarePlan.activity:<timepoint>.detail.scheduledTiming.event`. None of those ids
exists in any snapshot. They resolved here only because the generic resolver
carries a fallback that splits a tail into a stem and a capitalised type suffix
and matches it against any `stem[x]` whose type list contains that suffix — a
convenience of one codebase, not a spelling the specification defines. That
fallback also matched on the tail alone, so a complex extension, which carries a
generic open `value[x]` alongside the one its own sub-extension declares, could
be resolved to whichever element the snapshot happened to list first.

## Decision

1. Every `definitionExtractValue` is declared on the item whose
   `definitionExtract` creates the resource it belongs to, or beneath it. Only a
   resource extracted at the Questionnaire root keeps its values at the root,
   which is where the specification says an extract always fires. The side is
   declared by a new `DeclareBodySite` rule set inserted per observation item,
   alongside the `DeclareObservation` rule sets that already declare the status,
   the subject, the visit and the effective time there.
2. Every element id is the id the profile declares: `Observation.effective[x]`,
   `Procedure.performed[x]:performedDateTime`,
   `Procedure.performed[x]:performedPeriod.start`,
   `Patient.extension:recordedSexOrGender.extension:value.value[x]`,
   `CarePlan.activity:<timepoint>.detail.scheduled[x].event`.
   Where a profile slices a choice by type, the type slice is named; where it does
   not, the `[x]` element is named and the written value decides the type.
   `RotatorCuffResearchCarePlan` now constrains `scheduled[x]` to `Timing` on each of
   the five timepoint slices, which a scheduled research visit always is. Without
   that the element carries three types under every slice and an id walking into
   `Timing` is ambiguous; a `mustSupport` flag alone compiles to nothing, because the
   unsliced element already carries it. The published snapshot expands a named slice's
   child tree but not its type slices, so the type slice spelling
   `scheduled[x]:scheduledTiming` resolves only on the unsliced element and is wrong
   under a named slice.
3. The resolver's concrete-choice fallback stays, because a form written
   elsewhere may still use that spelling, but it now requires the parent path to
   match and not only the tail segment.
4. `tools/template-fidelity.py` judges what it previously could not see: a pin
   stated as a bare `Coding` rather than inside a `CodeableConcept`, a pin whose
   value is a bare code compared against a bare literal, a pin the containing
   bundle profile places on an entry's resource where the resource's own profile
   leaves it open, and a required extension slice. Paths are compared whole
   rather than by leaf name, with an extension matched by url to the slice that
   pins it. Judged literals rise from 150 to 239 across the same 86 entries, with
   no disagreement.
5. `tools/validate.sh` validates the six Questionnaires against the SDC profile
   each one claims. The conformance claim previously rested on the declaration
   alone.
6. `tools/check-questionnaire-definitions.sh` resolves the element ids the extraction
   extensions name, not only those `item.definition` names. It had guarded one of the
   two places a Questionnaire names an element and not the other, which is how
   unresolvable ids survived in the extraction declarations while every
   `item.definition` fragment stayed clean. It now checks 128 `item.definition`
   fragments, 95 `definitionExtract` profiles and 460 `definitionExtractValue` element
   ids, resolves against the published snapshots in preference to the differential,
   and treats a named slice as inheriting the children of the element it slices, which
   a snapshot spells out and a differential does not. Verified to fail on both defect
   shapes this ADR corrects.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep the root declarations and document the resolution order as an extension of the mechanism | The point of the definition-based forms is that a client reading only published artifacts captures conformant data. A resolution order only this engine implements defeats exactly that, and the relocation costs nothing: the expressions are rooted at `%resource`, so they read the same answer from either position. |
| Nest the observation groups so one declaration could cover many | Changes the form's shape for the reader to suit the extraction mechanism. A rule set inserted per item keeps the declaration once per profile in the source while placing it correctly in the output. |
| Keep the concrete-choice spellings and rely on the resolver | They name element ids that exist in no snapshot, so any engine that resolves ids strictly, which the specification requires a validator to do, finds nothing there. |
| Drop the resolver's fallback entirely | A form authored elsewhere may use the concrete spelling, and refusing it would fail a form a lenient engine handles. Requiring the parent path to match removes the mis-resolution without removing the tolerance. |

## Consequences

✅ A form handed to an engine that follows the stated traversal now yields the
   same records this engine yields. The portability claim is a property of the
   artifacts rather than of the client.
✅ Every extraction target resolves to an element id that exists, so the
   validator check the specification requires of a Questionnaire has something to
   confirm.
✅ The side reaches every physically anchored observation from one answer, as
   before, now declared where the mechanism looks for it.
⚠️ The published `RotatorCuffResearchCarePlan` snapshot must be regenerated for the
   sliced timepoint ids to appear in the published guide. The check no longer depends
   on it, since it resolves a named slice's children through the element it slices.
⚠️ The template forms are unaffected, so the two mechanisms are no longer
   symmetric in how much of the build checks them: the templates are held by the
   fidelity check, the definition-based forms by the validator and by the
   extraction tests.

## Sources

- `ig/input/fsh/instances/Shoulder{Registration,Surgery,FollowUp}Questionnaire.fsh`
- `ig/input/fsh/rulesets/SdcExtractionRuleSet.fsh` — `DeclareBodySite`
- `sdc-generic-frontend/src/lib/profileTypes.ts` — the concrete-choice fallback
- `tools/template-fidelity.py`, `tools/validate.sh`, `tools/check-questionnaire-definitions.sh`
- HL7 Structured Data Capture Implementation Guide, Release 4.0.0, Form Data Extraction — the definition-based traversal and the element-id syntax
