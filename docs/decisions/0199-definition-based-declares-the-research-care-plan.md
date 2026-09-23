# ADR-0199: Definition-based extraction declares the research care plan, and `activity` is sliced by timepoint

**Date:** 2026-09-17
**Status:** Accepted
**Relates to:** ADR-0129 (the research follow-up plan and its five timepoints), ADR-0190 (what the definition mechanism can and cannot declare), ADR-0192 (template extraction), `limitations_items/0020`, `limitations_items/0024`

## Context

The `RotatorCuffResearchCarePlan` carrying the five expert consensus Q11 follow-up
timepoints was produced by application code, not declared by any Questionnaire.
`bundleAssembler.ts` synthesised it from the index procedure date. A form filler
handed only `shoulder-surgery` therefore produced a surgery bundle without it,
while the template form, which states its whole submission literally, carried it.

This was read, including by the author of ADR-0190, as a ceiling in the definition
mechanism: a resource no question describes cannot be declared. That reading is
wrong, and ADR-0190 finding 4b already said so. A `definitionExtract` placed on the
Questionnaire root rather than on an item "will always be extracted, even if there
are no answer items within the fully completed QuestionnaireResponse", and
`definitionExtractValue` supplies "either a fixed value, or an expression to
evaluate". The care plan was absent because nobody had declared it.

One obstacle was real. `CarePlan.activity` repeats, and the five timepoints differ
from one another. Writes to an unsliced repeating element all land in the first
repetition, so five declarations would have merged into one activity. The
specification's own complex definition-based example resolves the general case with
a repeating group, which needs five group occurrences in the response and therefore
five answers from whoever fills the form. The timepoints follow from the surgery
date and are not a clinician's choice, so asking them would be a question with one
correct answer.

## Decision

1. **Slice `RotatorCuffResearchCarePlan.activity` on `detail.code`**, the
   discriminator the profile already named in prose, into the five consensus
   timepoints: `sixWeeks`, `threeMonths`, `sixMonths`, `oneYear`, `twoYears`. Each
   slice pins its own `detail.code`. Slicing is open and every slice is `0..1`, so a
   plan with fewer than five timepoints, or with an additional activity outside the
   consensus set, still conforms.

2. **Declare the care plan at the root of `shoulder-surgery`**, with a
   `definitionExtract` naming the profile and an `extractAllocateId` for its
   `fullUrl`. Slicing makes each timepoint addressable by element id, so the form
   states `CarePlan.activity:sixWeeks.detail.scheduledTiming.event` and the code
   identifying which timepoint it is comes from the profile. The form declares the
   scheduled date, the status and the description; the profile supplies `intent` and
   the five timepoint codes.

3. **Add `entry[carePlan] 0..1` to `RotatorCuffSurgeryBundle`**, bound to
   `RotatorCuffResearchCarePlan`. ADR-0129 moved the care plan from the registration
   bundle to the surgery bundle; the removal landed and the addition did not, so the
   care plan travelled as an unsliced extra entry in both worked examples. This
   closes `limitations_items/0024`.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| A hidden repeating group with five seeded occurrences | FHIR R4 forbids `initial` on a group (`que-8`), so the occurrences cannot be seeded declaratively and the filler would have to invent them |
| A repeating choice item carrying the five timepoint codes as `initial` values | Produces the five codes but gives no way to attach a distinct scheduled date, status and description to each |
| Extending the extractor so repeated declarations against one repeating element append | Puts behaviour the specification does not define into the client, which is the one thing the guide-agnostic filler exists not to do |
| Leaving the care plan to application code | Keeps a resource the guide requires outside every artifact the guide ships, and leaves the two mechanisms incomparable |

## Consequences

✅ Extraction from `shoulder-surgery` now yields the care plan with all five
activities, verified against the compiled profiles with nothing unresolved: codes
`6-weeks`, `3-months`, `6-months`, `1-year`, `2-years`, each with its own scheduled
date computed from the incision time, `status` `scheduled`, and a description.

✅ The form never states a timepoint code. It comes from the profile, which is the
property that distinguishes this mechanism from template extraction, shown rather
than asserted.

✅ The two mechanisms now emit the same resource types from the same guide, so the
comparison between them is about how conformance is stated and not about what is
missing from one side.

✅ `limitations_items/0024` closes. Both worked examples already carry exactly one
care plan with exactly the five codes and no duplicates, so they match the new
slices without being edited.

⚠️ The five slices encode a protocol. A registry that follows a different follow-up
schedule matches none of them and falls through to the open slicing, which is
conformant but unsliced.

⚠️ `detail.status` is declared by the form as `scheduled` rather than pinned in the
profile, because an activity that has since been completed must remain conformant.

## Sources

- `hl7.fhir.uv.sdc#4.0.0`, `StructureDefinition-sdc-questionnaire-definitionExtract.json`, `StructureDefinition-sdc-questionnaire-definitionExtractValue.json`, `Questionnaire-extract-complex-defn3.json`
- ADR-0190 finding 4b
- `ig/input/fsh/profiles/RotatorCuffResearchCarePlan.fsh`, `RotatorCuffSurgeryBundle.fsh`
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh`
- `seed/bundles/anna-mueller/anna_mueller_02_surgery.json`, `seed/bundles/kemal-demir/kemal_demir_02_surgery.json`
