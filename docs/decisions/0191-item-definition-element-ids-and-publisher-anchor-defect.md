# ADR-0191: `item.definition` fragments corrected to ElementDefinition ids; residual link errors root-caused to the publisher

**Date:** 2026-09-15
**Status:** Accepted
**Supersedes:** ADR-0164 (corrects its diagnosis, its severity assessment, and the mitigation it proposed)
**Relates to:** ADR-0120 (first QA triage), ADR-0122 (spec-generic extraction), ADR-0040 (SDC conformance), `limitations_items/0001` (rewritten; absorbed the separate `0017`, now removed)

## Context

ADR-0164 triaged the residual `qa.html` entries as "cosmetic (documentation-rendering)", deferred
them, and named an IG Publisher expected-messages or `ignoreWarnings` file as "the cheapest future
cleanup". Re-examining that triage found three of its claims do not hold, and a fourth that was
never stated: the two counts it reports are not independent.

## Findings

Each was verified against a primary source rather than inferred.

**1. The fragments were a specification deviation, not only a rendering mismatch.** FHIR R4's own
comment on `Questionnaire.item.definition` reads: "The uri refers to an ElementDefinition in a
StructureDefinition and always starts with the canonical URL for the target resource. When
referring to a StructureDefinition, a fragment identifier is used to specify the element definition
by its id. E.g. `http://hl7.org/fhir/StructureDefinition/Observation#Observation.value[x]`." The
guide's Questionnaires used the concrete choice spelling, `#Observation.valueQuantity`. That names
no ElementDefinition: the compiled profiles declare `Observation.value[x]`, and the concrete form
appears nowhere in the differential or the snapshot. The same applied to `Condition.onsetDateTime`
and to `Condition.extension[condition-dueTo]`, whose element id is `Condition.extension:dueTo`.
`Patient.address.line`, `.city` and `.postalCode` named elements the profile never constrained, so
a complex datatype's children were absent from the snapshot and the ids did not exist either.

**2. Correcting them does not clear the report, because the publisher contradicts itself.** It
renders the anchor on a profile page with the choice suffix escaped, `name="Observation.value_x_"`,
while generating the cross-reference from `item.definition` verbatim,
`href="…#Observation.value[x]"`. `HTMLInspector` compares fragments literally; disassembling it
shows neither `[x]` nor `_x_` anywhere in the class. The link therefore cannot find the anchor the
same tool rendered a moment earlier.

**3. No authoring form satisfies both requirements.** The specification requires the bracketed
element id; only the escaped spelling resolves as an anchor. The one string that would satisfy the
link checker, `Observation.value_x_`, is not an ElementDefinition id and would reintroduce the
deviation in finding 1. The two constraints are mutually exclusive, so this cannot be authored
around at all.

**4. The mitigation ADR-0164 proposed does not exist.** `ignoreWarnings.txt` suppresses warnings
and hints only. `ValidationPresenter` in the pinned publisher carries `suppressedInfo` and
`suppressedWarnings` counters and no error counter, and `qa.json` reports `suppressed-hints` and
`suppressed-warnings` and nothing for errors; the upstream issue HL7/fhir-ig-publisher#470 records
that documented error suppression does not work, because fatal and error are filtered in
`ValidationPresenter`. Every one of these entries is an error, so none of them is suppressible.

**5. Not fixed upstream, and not patchable locally.** No entry in the 2.3.1 through 2.3.4
changelogs touches link checking, anchors, or choice elements. `ig/template` is the unpacked
`fhir2.base.template#current`, refetched on every build, so emitting a second anchor from a patched
template is not durable.

**6. The two counts in ADR-0164 are one defect counted twice.** The resource-level errors are
reported once per questionnaire item; the build errors are the same links re-reported once per
rendering of that narrative on its generated page, three renderings per page. Adding the two
figures overstates the defect roughly fourfold.

## Decision

1. Write every `item.definition` fragment as the ElementDefinition id the specification requires:
   `Observation.value[x]`, `Observation.component:<slice>.value[x]`, `Condition.onset[x]`,
   `Condition.extension:dueTo`.
2. Declare `address.line`, `address.city` and `address.postalCode` in `ShoulderPatient`, the three
   address parts the registration form collects, so those ids exist.
3. Reconstruct the concrete choice property in the SDC frontend from the type resolved off the
   compiled profile rather than reading it out of the anchor string, mirroring what the extension
   branch already did. An element id never spells a concrete choice name out, so the frontend has
   to derive it; FHIR's own rule, base name plus the capitalized type code, is the derivation.
4. Add `tools/check-questionnaire-definitions.sh`, which resolves every fragment against the
   compiled StructureDefinitions and fails on any that names no element. It also prints the property
   each choice element reconstructs to, which is the regression guard for the frontend change.
5. Treat the residual link errors as an external tooling defect. Do not inject anchors into profile
   page content to satisfy the checker: that would add invisible markup to every profile page in
   the published guide to work around a defect in the tool that generates it.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Leave the fragments as they were | They name no ElementDefinition, so any consumer resolving them per the specification gets nothing. The link errors were the symptom that exposed it |
| Point fragments at `Observation.value_x_` so links resolve | Resolves the anchor but is not an element id, trading a real conformance property for a cosmetic one |
| Suppress via `ignoreWarnings.txt` | Not possible: errors are filtered before suppression is applied (finding 4) |
| Upgrade the publisher | No relevant fix in 2.3.1 through 2.3.4 (finding 5) |
| Inject `<a name="Observation.value[x]">` into each profile's intro page | Would work, at the cost of invisible markup on every profile page purely to satisfy a defective checker, across the whole Observation family |

## Consequences

✅ Every `item.definition` fragment now names a real ElementDefinition, so a consumer that resolves them per the specification succeeds where it previously got nothing.
✅ The three address links resolve, because their ids now exist. This is the only part of the report the guide could fix.
✅ Extraction is unchanged: every rewritten fragment reconstructs to the same property as before, checked fragment by fragment against the compiled profiles before the change was accepted.
✅ A repository check now guards the property, so the deviation cannot return unnoticed.
⚠️ The report still does not come back clean, and cannot be made to. The cause is external and is now stated as such rather than as a defect in this guide's authoring.
❌ ADR-0164's "cosmetic" framing, and its proposed `ignoreWarnings` cleanup, are both retired.

## Sources

- FHIR R4 `Questionnaire.item.definition`, comment field, read from `hl7.fhir.r4.core#4.0.1`
- IG Publisher `HTMLInspector` and `ValidationPresenter`, disassembled from the pinned `publisher.jar`
- HL7/fhir-ig-publisher issue #470, error suppression
- IG Publisher release notes 2.3.1 through 2.3.4
- `tools/check-questionnaire-definitions.sh`, and the compiled profiles under `ig/fsh-generated/resources/`
- ADR-0162, ADR-0163 (the two genuine model-level errors already cleared), ADR-0164 (superseded)
