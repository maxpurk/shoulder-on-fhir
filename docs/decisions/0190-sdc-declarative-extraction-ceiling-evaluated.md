# ADR-0190: SDC declarative extraction ceiling evaluated; deferral of the `definitionExtract` migration upheld

**Date:** 2026-09-14
**Status:** Accepted
**Amends:** ADR-0102 (adds a second, independent reason for the deferral it recorded; corrects one date)
**Relates to:** ADR-0040 (SDC conformance, three-Questionnaire split), ADR-0073 (evidence versus staging split), ADR-0122 (spec-generic extraction), `limitations_items/0020`, `future_work_items/0003`

## Context

ADR-0102 recorded that the three Questionnaires declare `sdc-questionnaire-extr-defn` from SDC
4.0.0 while expressing their extraction contexts with `sdc-questionnaire-itemExtractionContext`,
the extension SDC 4.0.0 deprecated. Its decision 4 deferred the migration on two grounds: it is a
substantive code change rather than a documentation fix, and no consumer outside this project's own
frontend forces it. `future_work_items/0003` scoped the work and framed it as a vocabulary swap.
`limitations_items/0020` separately recorded that the Questionnaires are not a standalone recipe
for a conformant bundle, and speculated that the replacement extensions could express "much of"
the missing wiring.

Neither document had actually evaluated the replacement extensions against this guide's bundle
profiles, and neither recorded anything about their maturity. This ADR closes both gaps.

## Findings

Verified against the published `hl7.fhir.uv.sdc#4.0.0` package, HL7's `package-list.json`, and the
guide's Form Data Extraction page. Every quoted sentence was additionally checked against the
continuous integration build and is unchanged there.

**1. Release history.** SDC 3.0.0 was published 2022-03-08, the 4.0.0 ballot 2024-12-17, and 4.0.0
itself reached trial-use on 2026-03-24. The ballot is where definition-based extraction was
revamped, `itemExtractionContext` deprecated, and `definitionExtract`, `definitionExtractValue`,
and `extractAllocateId` introduced.

**2. No mature extraction extension exists.** In published 4.0.0 the `sdc-questionnaire-extr-defn`
profile is `active`, standards status trial-use, FHIR maturity level 4. Within it,
`itemExtractionContext` is `retired`, standards status deprecated, maturity 0, retitled
"Extract Definition - Resource (legacy)"; and `definitionExtract`, `definitionExtractValue`, and
`extractAllocateId` are each `draft`, standards status draft, maturity 0. The profile is mature
while every extraction extension it governs is either retired or draft, so an implementer of
definition-based extraction has no mature option.

**3. The bundle envelope needs no work.** All three bundle profiles constrain only
`type = #transaction (exactly)`, `entry.fullUrl 1..`, `entry ^slicing.rules = #open`, and slicing
discriminated by `type` and `profile` on `resource`, with no constraint on `Bundle.meta`,
`identifier`, `timestamp`, entry order, or any invariant. Definition-based extraction satisfies all
of these unaided, including the `profile` discriminator, because the profile canonical named in
`definitionExtract.definition` is stamped onto the extracted resource's `meta`.

**4. Cross-resource references split by direction.** References from a resource to a singleton
anchor are declarable with `extractAllocateId` plus `definitionExtractValue`, which covers most of
the Encounter-as-anchor graph. References from a singleton to a repeating set are not, because the
spec requires the referring resource's extract rules to sit inside the same repeating group as the
referenced item. `Condition.evidence.detail` and `Condition.stage.assessment` fall on the wrong
side of that rule as the forms are currently shaped.

**4b. Three further pieces of application logic were not in scope of the earlier record.** Beyond the
reference graph and the submission defaults, `bundleAssembler.ts` also propagates the Condition's
laterality onto physically-anchored Observations under a selection rule that excludes the aggregate
PROMs (ADR-0074); stamps the instance-level IPS profile claims on `Patient`, the comorbidity
`Condition`, the surgical `Procedure`, and the smoking `Observation` (ADR-0056); and synthesises the
`RotatorCuffResearchCarePlan` in full from the index procedure date (ADR-0129).

A fourth, found while writing the declarations rather than by reading the code, is more serious than
any of them: **the Registration Questionnaire describes no Encounter at all**, and
`bundleAssembler.ts` constructs that one outright. Every bundle profile requires `encounter 1..1`,
and the Encounter is the anchor that `subject`, `Observation.encounter`, `Procedure.encounter`, and
`Encounter.reasonReference` hang from (ADR-0037). A generic engine handed only the Registration
Questionnaire would produce no Encounter, so the bundle would fail a required slice before any
reference wiring came into question. The CarePlan and the registration Encounter are the same kind
of hole; only the Encounter is load-bearing.

The Surgery and Follow-Up Questionnaires do each carry an `encounter` group, so this is one
Questionnaire of three, not all three. In all three, though, the coded envelope (`status`, `class`,
`type`) is hard-coded in the assembler rather than declared; the groups that exist supply the date,
the linked diagnosis, the setting, the performer, and the timepoint.

The standard covers this case directly. A `definitionExtract` on the Questionnaire root rather than
on an item "will always be extracted, even if there are no answer items within the fully completed
QuestionnaireResponse", and `definitionExtractValue` supplies the fixed status, class, and type
alongside the references and a `now()` period. So the most severe item in the gap is also the most
directly closeable.

`limitations_items/0020` had recorded none of the four, and so understated its own gap.

**5. `Bundle.meta.profile` is not addressable** by any definition-based mechanism, since
`definitionExtractValue` is scoped to an extracted resource. Template-based extraction can control
the envelope but is a different mechanism with a different profile.

**6. Neither residue breaks conformance.** `Bundle.meta` is unconstrained by the bundle profiles,
and `stage` and `evidence` on `RotatorCuffCondition` are mustSupport without a cardinality
constraint, so they inherit `0..*`. After migration the extracted bundle would validate; what would
be lost is the link from the diagnosis to the imaging observations that grade it.

**7. The standard does not promise conformant output.** The extraction page states that it is the
responsibility of the client system to ensure generated resources are valid against the necessary
profiles. No Questionnaire, under any of the four mechanisms, carries such a guarantee.

## Decision

1. **The deferral recorded in ADR-0102 decision 4 stands**, now on a second and independent ground:
   the replacement extensions are draft at maturity 0 while the extension in use is stable and
   backward-compatible. This reason was established by the evaluation above and was not part of the
   original decision; it is recorded here rather than inserted into ADR-0102, so the earlier record
   stays as it was written.

2. **`limitations_items/0020` is updated** to replace its speculation with the findings above,
   including the direction split, the envelope result, and the conclusion that the post-migration
   output would be conformant. Its earlier reasoning attributed the residue to limited expression
   power; the actual constraint is structural. Its Gap section gains the three omissions in
   finding 4b, and its Note now sorts the residue into four kinds: reachable by an expression
   because the data is already in the response; reachable only if placed into the response first,
   as the persisted ids are; structurally blocked by the allocation-scoping rule; and not
   addressable at all. Only the last two are hard stops.

   One question is left explicitly open there rather than assumed: whether `definitionExtractValue`
   can append a second canonical to an extracted resource's `meta.profile` alongside the one the
   extraction context stamps, which is what declaring the IPS claims would require.

3. **`future_work_items/0003` is re-scoped** from a vocabulary swap to the work that closes most of
   `limitations_items/0020`, and the two are marked to be picked up together. Its scope gains the
   `Bundle.meta.profile` decision, the create-versus-update constraint, and the note that FHIRPath
   during extraction cannot reach `launchContext`, `initialExpression`, or `variable`.

4. **No change to the FSH, the extractor, or any profile.** This ADR records an evaluation.

5. **Date correction.** ADR-0040's update note and ADR-0102 both date the `hl7.fhir.uv.sdc` bump
   from 3.0.0 to 4.0.0 to 2026-05-19. Commit `e425f1c` is dated 2026-05-21. The dependency was
   introduced at 3.0.0 in commit `df5ddb8` on 2026-05-19 and bumped to 4.0.0 two days later, so the
   guide was on 3.0.0 for two days. Corrected forward here rather than by editing the earlier ADRs.

## Consequences

The portability limitation is now bounded with a stated mechanism rather than asserted, and the
choice to keep the deprecated extension rests on a maturity argument that can be checked in the
package. The cost is that `limitations_items/0020` and `future_work_items/0003` are now coupled,
and picking up either without the other will leave the record inconsistent.

## Sources

- HL7 SDC Implementation Guide v4.0.0 (STU 4): https://hl7.org/fhir/uv/sdc/
- HL7 SDC IG, Form Data Extraction: https://hl7.org/fhir/uv/sdc/extraction.html
- HL7 publication manifest: https://hl7.org/fhir/uv/sdc/package-list.json
- Maturity flags read from `~/.fhir/packages/hl7.fhir.uv.sdc#4.0.0/package/`
- `ig/input/fsh/profiles/RotatorCuff{Registration,Surgery,FollowUp}Bundle.fsh`, `RotatorCuffCondition.fsh`
- `ig/input/fsh/instances/Shoulder{Registration,Surgery,FollowUp}Questionnaire.fsh`
- `sdc-frontend/src/lib/extractor.ts`, `bundleAssembler.ts`

## Addendum, 2026-09-16: the standard puts the two mechanisms level

Re-read against the published extraction page after template-based extraction was built
(ADR-0192). Every finding above still holds, and one piece of evidence should have been in the
original: the specification compares the two mechanisms directly, and does not rank them.

> "The template based approach provides an alternative to the definition based approach and where
> the full power of StructureMaps isn't required. **It supports the same level of capability**,
> however is unable to leverage any of the information inside a profile where the definition based
> approach can."

The only asymmetry the standard names therefore runs the other way, in definition-based's favour: it
resolves fixed values, bindings and slice constraints from a StructureDefinition at extraction time,
where a template restates them and can fall out of step with the profiles it mirrors.

**This ADR has been misquoted, including by its own author, as finding that definition-based cannot
produce a conformant bundle.** It finds the opposite. Point 3 says the bundle envelope needs no
work; point 4 says the Encounter-as-anchor graph is declarable; point 6 says neither residue breaks
conformance. The spec is explicit on each: `bundle.entry.resource`, `fullUrl`, `request.method` and
`request.url` are populated by the mechanism, `extractAllocateId` supplies cross-resource
references, and a `definitionExtract` at the Questionnaire root extracts a resource "even if there
are no answer items", which is the standard's own answer to a resource no question describes.

What survives is narrow and unchanged: `Bundle.meta.profile` is addressable by no definition-based
mechanism, so a definition-extracted submission does not declare which bundle profile it claims and
a receiver must be told out of band. Template-based writes the Bundle literally and can label it.
That is a difference in self-description, not in conformance.

The practical consequence for the demonstration: template extraction should be presented as the
mechanism that lets a submission label itself, and as the one whose cost is duplicating the
profiles. It should not be presented as the only mechanism able to produce the bundle, because the
specification says plainly that it is not.
