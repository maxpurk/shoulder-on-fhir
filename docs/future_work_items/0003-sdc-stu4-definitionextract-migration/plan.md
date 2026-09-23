# SDC Questionnaires — migrate `itemExtractionContext` to the SDC 4.0.0 extraction extensions

> **Status:** Future work item — mostly landed, one step left, not approved. Captured
> 2026-07-26 (ADR-0102) while fixing an unrelated SDC version-label documentation mismatch.
> Re-scoped 2026-09-14 (ADR-0190). The three definition-based Questionnaires now carry the
> 4.0.0 extraction extensions and everything the migration was meant to unlock: see
> **What has since landed** below. What remains is the half this item started as, removing
> the retired `itemExtractionContext` extension, which is held open by one client that reads
> only that extension.

## Context

This IG declares `hl7.fhir.uv.sdc: 4.0.0` (STU4) and all three definition-based Questionnaires
parent from the STU4 profile `sdc-questionnaire-extr-defn`. They carry the extensions that profile
documents as current, `sdc-questionnaire-definitionExtract`,
`sdc-questionnaire-definitionExtractValue` and `sdc-questionnaire-extractAllocateId`, on every
extracted resource. They also still carry the **STU3-era** `sdc-questionnaire-itemExtractionContext`
(`$SDC_EXTRACT_CTX` alias) on the nine groups that predate the newer extensions, naming the same
target profile in each case.

Per web research (`build.fhir.org/ig/HL7/sdc`), `itemExtractionContext` is retained in STU4 for
backward compatibility — it still works — but was superseded because it "did not support defining
a profile to create and the expression was not deemed sufficiently implementable." The newer
`definitionExtract` extension apparently closes exactly that gap: it can carry the target profile
canonical *and* `Bundle.entry.request` properties directly on the extension, where
`itemExtractionContext` could only carry a bare resource-type/profile expression.

**What holds the last step open.** `sdc-frontend`, the guide-aware client on port 3001, reads only
`itemExtractionContext`. Removing the extension from the forms means porting
`sdc-frontend/src/lib/extractor.ts` to read `definitionExtract`, or retiring that client
(`future_work_items/0030-retire-the-guide-aware-sdc-frontend/`). Until then the published forms
declare two extraction mechanisms, one of them retired: the IG Publisher reports the deprecation as
an INFORMATION notice, and an engine that implements the retired extension would run a
StructureDefinition canonical as an `x-fhir-query`, get no rows, and by that extension's own
semantics create a second copy of the resource the current extension already creates.

## Why this matters

Two reasons, one of which was not visible when this item was captured.

**Portability.** If an off-the-shelf SDC renderer is ever used
(`future_work_items/0002-lhcforms-frontend-parity/`), the Questionnaires need the extension
vocabulary that renderer implements. A tool built against current guidance is more likely to
understand `definitionExtract` than the deprecated `itemExtractionContext`.

**Closing the standalone-recipe gap.** `limitations_items/0020` records that the Questionnaires
are not by themselves a complete recipe for a conformant bundle, because the cross-resource
references and a handful of required-but-unasked values live in `bundleAssembler.ts` and
`extractor.ts`. The 4.0.0 extensions can carry most of that inside the Questionnaire:
`extractAllocateId` allocates a `Bundle.entry.fullUrl` uuid, `definitionExtract.fullUrl` places it
on the entry, and `definitionExtractValue` writes it into a referring element or supplies a fixed
value. ADR-0190 records the evaluation of what this would and would not close, against the three
bundle profiles. In summary: the bundle envelope needs no work, forward references to singleton
anchors become declarable, submission defaults become declarable, `Condition.evidence.detail` and
`Condition.stage.assessment` need the form restructured, and `Bundle.meta.profile` is not
addressable by any definition-based mechanism.

**What still argues for deferral.** `itemExtractionContext` is retired but functional and
backward-compatible, and nothing outside this project consumes these Questionnaires. In published
SDC 4.0.0 the replacement extensions carry standards status `draft` at maturity level 0, while the
`sdc-questionnaire-extr-defn` profile they belong to is trial-use at maturity level 4. There is no
mature option to migrate to, so the trade is a deprecated stable extension against a draft
replacement.

## What has since landed

Recorded so the remaining step is not mistaken for the whole item.

- Every extracted resource in the three definition-based forms declares
  `definitionExtract` with its target profile, `definitionExtractValue` for the values no
  question asks for, and `extractAllocateId` for the identifiers the reference graph needs
  (ADR-0199, ADR-0200).
- The registration `ShoulderEncounter` and the `RotatorCuffResearchCarePlan` with its five
  Q11 timepoints are declared at the Questionnaire root, where an extract always fires.
- `Observation.bodySite` reaches every physically anchored observation from the single side
  answer, declared per item by the `DeclareBodySite` rule set (ADR-0202).
- Every extraction target names an element id the profile declares, so a choice element is
  named `Observation.effective[x]` or `Procedure.performed[x]:performedDateTime` rather than
  by the property an instance writes (ADR-0202).
- `PROFILE_METADATA` is gone; `profileMetadataResolver.ts` resolves fixed values, types and
  cardinalities at runtime (ADR-0103, ADR-0122).
- `limitations_items/0020` lists seven residues, three of them declarable: the instance-level
  IPS claims, the diagnosis-to-evidence links, and `Bundle.meta.profile`.

## Scope of what is left

1. Port `sdc-frontend/src/lib/extractor.ts`: `extractionContextOf()` reads
   `itemExtractionContext`'s `valueExpression.expression` as the target profile URL. It needs to
   read `definitionExtract`'s `definition` sub-extension instead. Or retire the client, per
   `future_work_items/0030`.
2. Remove the `$SDC_EXTRACT_CTX` declarations from `ShoulderRegistrationQuestionnaire.fsh`,
   `ShoulderSurgeryQuestionnaire.fsh` and `ShoulderFollowUpQuestionnaire.fsh`, then `sushi .`
   and `seed/load-profiles.sh`.
3. Re-run `tools/validate.sh` and a full browser pass of all three flows on the server. This
   touches the mechanism every submitted bundle depends on, so the regression risk is real.
4. Decide the create-versus-update shape deliberately. Extraction emits POST when the extracted
   resource carries no `id` and PUT when it does. The registration bundle currently PUTs the
   Patient with an explicit id. The specification's update mode replaces rather than merges, so
   any resource submitted as a PUT must have every element it should retain present in the
   QuestionnaireResponse. The surgery and follow-up bundles do not re-submit Patient or
   Condition, which keeps them clear of this, and that should stay true.

## Effort estimate

Rough order of magnitude only, not a committed estimate: the extractor port ~2–4h, the FSH
removal ~0.5h, validator plus browser regression across all three flows ~3–4h, ADR ~0.5h.
Total: **under a day**, and nothing in it is exploratory any more.

## Related limitations

- `limitations_items/0020-sdc-questionnaire-not-standalone-conformant-extract-recipe/` — the gap
  this item closes most of. Already carried in the Status line and in the scope steps above; listed
  here so the mapping is findable from one place.
- `limitations_items/0023-bundle-entry-fullurl-not-aligned-with-references/` — `extractAllocateId`
  allocates the `Bundle.entry.fullUrl` uuid and `definitionExtract.fullUrl` places it on the entry,
  so a declaratively extracted bundle refers to its own entries by that same uuid. That is option 1
  of the two coherent fixes 0023 records, arrived at for the extraction path as a consequence of
  this migration rather than as the separate submission-semantics decision 0023 asks for.
