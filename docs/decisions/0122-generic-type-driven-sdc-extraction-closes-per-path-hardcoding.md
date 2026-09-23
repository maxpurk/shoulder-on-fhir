# ADR-0122: Generic, type-driven SDC extraction — closes the per-path/per-profile hardcoding gap

**Date:** 2026-08-01
**Status:** Accepted
**Builds on:** ADR-0103 (runtime-derived Observation code/category, closed the `PROFILE_METADATA` value-table gap), ADR-0104 (TearSize/TearSizeClassification category split)
**Amends:** ADR-0102's transparency note (see below)

## Context

ADR-0102's transparency note in the project guide originally disclosed two SDC honesty gaps together: (1) `itemExtractionContext` being the STU3-era extraction-context extension rather than STU4's `definitionExtract` mechanism, and (2) — the one this ADR closes — that even a fully independent, spec-generic SDC engine would not correctly extract from these Questionnaires as-is, because fixed `Observation.code`/`category`/`unit` per profile lived in a hardcoded `PROFILE_METADATA` table in `extractor.ts`, not derived from the target StructureDefinition's own fixed values.

ADR-0103 already closed the *value* half of gap (2): `code`/`category`/`ucumCode` are resolved at runtime from the compiled StructureDefinition/CodeSystem HAPI serves, not a hand-typed table. But `extractor.ts` still hardcoded two other things a genuinely spec-generic engine would not need to know in advance:

- **Profile-id → resource-type dispatch** in `buildResourceForExtractionGroup`: an `if`/`else` chain matching the last URL segment of a profile canonical against string literals (`'shoulder-patient'` → `Patient`, `'rotator-cuff-condition'` → `Condition`, …).
- **Per-element-path typed setters**: `setPatientField`/`setConditionField`/`setProcedureField`/`setEncounterField`/`setObservationField`, five `switch` statements keyed on literal element-path strings (`'Patient.name.family'`, `'Condition.onsetDateTime'`, …), each hand-writing how to build and assign that specific answer's FHIR shape.

Revisiting this session confirmed the residual claim was real and reproducible — investigating "how, concretely, would we close this" rather than leaving it as a disclosed-but-unfixed limitation.

## Decision

**Make the entire answer → resource write generic**, driven purely by each element's FHIR type and cardinality, both resolved at runtime from the compiled StructureDefinition:

1. **`profileMetadataParse.ts`** gains `readElementType(sd, elementId)`: resolves an element's declared type + cardinality (`max`), including FHIR's choice-element (`[x]`) naming convention handled generically — a concrete path segment like `onsetDateTime` is matched against the declared choice element `Condition.onset[x]` by capitalizing each candidate type code (`dateTime` → `DateTime`) and comparing against the segment's suffix. No per-path table. Also gains `findExtensionSlice` (matches an `extension[bracket]` segment against a profile's compiled elements — bracket name is the extension's *profile URL suffix*, not its FSH slice name, confirmed live against the compiled `RotatorCuffCondition` SD) and `datatypeCanonical`/`isPrimitiveType` (trivial helpers for walking into a complex datatype's own StructureDefinition, e.g. `HumanName`, `Period`).

2. **`profileMetadataResolver.ts`**'s `resolveElementType` combines three resolution steps, all against real StructureDefinitions HAPI already serves: (a) direct lookup on the profile's own differential; (b) a walk up the profile's `baseDefinition` chain (the same bounded, cycle-guarded walk ADR-0103 introduced for fixed values, generalized to any per-element lookup); (c) where a path crosses from a resource into a complex datatype (e.g. `Patient.name` → `HumanName`), fetch that datatype's own StructureDefinition and recurse. This third step is the one genuinely new mechanism — it is what lets `Patient.name.family` resolve correctly even though no IG profile's own differential lists that path with a type (HumanName's sub-elements live in HumanName's own SD, not inlined into Patient's). `resolveExtractionPlan(targets)` is the new batch entry point, replacing `resolveProfileMetadataBatch`; its output `ResolvedProfile` carries `resourceType` (read from `StructureDefinition.type`, not guessed from the profile id) plus a `Map<elementPath, ResolvedElement>` where each `ResolvedElement` carries `fhirType`, `isArray`/`containerIsArray` (from the SD's own cardinality, not assumed from the path shape), and (where applicable) `ucumCode`/`fixedCoding`/`extensionUrl`.

3. **`extractor.ts`**'s `assignByPath` is the one generic writer that replaces all five typed setters: given a resolved element and an answer, it builds the right FHIR value (`buildValue`, a single `switch` on FHIR type — not resource or path) and writes it at the right place, handling three path shapes generically (a plain 1-or-2-segment dotted path, an `extension[bracket]` segment, a `component:Slice.valueX` segment). `emptyResource(resourceType, profileCanonical, resolvedProfile)` is the one generic factory replacing `emptyPatient`/`emptyCondition`/`emptyProcedure`/`emptyEncounter`/`emptyObservation`. `collectExtractionTargets` generalizes the old Observation-only `collectObservationProfileCanonicals` to every resource type, since resource type no longer needs a separate lookup table to determine.

4. **Two things remain deliberately *not* derived from the StructureDefinition**, named explicitly in `extractor.ts`'s own module doc comment and in the corrected the project guide transparency note rather than left implicit:
   - **`submissionDefaults(resourceType)`** — a small, resourceType-keyed table of required-but-not-fixed fields no profile fixes a value for and no form field collects (`Observation.status`/`effectiveDateTime`, `Procedure.status`, `Condition.clinicalStatus`/`verificationStatus`/`category`/`recordedDate`, `Encounter.status`/`class`). These are genuinely business/workflow defaults, not spec facts a StructureDefinition could ever encode (a profile marking an element `1..1` doesn't say *what* value to submit when the form itself doesn't ask).
   - **The inherent SDC property** that `item.definition` names *which* StructureDefinition applies but not its fixed values inline — resolving those still requires a live fetch against the server, not a static read of the Questionnaire alone. This was already true before this ADR and remains true after; it is a property of SDC's definition-based extraction mechanism itself, not a shortcut of this implementation.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Leave the per-path hardcoding in place, just re-word the transparency note to be accurate about ADR-0103's partial fix | Honest, but leaves the actual gap unclosed when closing it is tractable — the element-path surface across all three Questionnaires is small (~25 distinct paths) and every cardinality/type fact needed is already sitting in StructureDefinitions HAPI serves. |
| StructureMap-based extraction (SDC's heaviest mechanism) | Same conclusion ADR-0021 and ADR-0103 both reached: a substantially larger engineering lift (FML authoring + execution engine) than a thesis IG's demonstrator warrants, for no behavioral gain over a generic TS writer once type/cardinality resolution is in place. |
| Derive `isArray` from a hardcoded per-path table instead of the SD's own `max` | Would have reintroduced exactly the kind of table this ADR removes, just for cardinality instead of code/category. The SD already carries `max`; reading it costs nothing extra once the type-resolution walk is in place. |
| Fully generalize the path walker to arbitrary depth (not just 1-or-2 segments) | No current profile path goes deeper than 2 segments (verified by exhaustive enumeration of every `item.definition` across all three generated Questionnaires). The cardinality-aware building blocks (`resolveElementType`'s datatype walk) already support deeper paths; only the container-array bookkeeping in `resolveElement`/`assignByPath` is scoped to 2 segments, documented as a scope boundary rather than a silent assumption. |

## Verification

A live extraction-parity check (same methodology ADR-0103 used: drive the real extractor against a real Questionnaire fetched from the deployment server's HAPI, with a synthetic filled `QuestionnaireResponse`): the pre-refactor `extractor.ts`/`profileMetadataResolver.ts` (checked out from git HEAD) and the new generic versions were run side by side against all three Questionnaires (`shoulder-registration`, `shoulder-surgery`, `shoulder-follow-up`), auto-filling every leaf that carries an `item.definition` (inline `answerOption` and `answerValueSet`-expanded codings used where the item is coded, so `CodeableConcept`/`code`-typed fields get real answers, not placeholder strings). Every resolved profile matched (44/44, 6/6, 20/20 across the three Questionnaires) and the two `ExtractedResources` outputs were deep-diffed. All 135 diffs across the three runs decomposed into exactly four expected, understood categories — none an unexplained bug:

- `*.subject: old={"reference":""} new=undefined` (68×) — harmless; `bundleAssembler.ts` always spreads a fresh `subject` reference on top (`{ ...resource, subject: ref }`), so the old placeholder was never load-bearing.
- `*.effectiveDateTime` (65×) — timestamp jitter between two independently-timed `new Date().toISOString()` calls a few hundred milliseconds apart, not a real difference.
- `patient.name[0].use: old="official" new=undefined` (1×) — accepted, intentional delta: `HumanName.use` was a UI-authored default with no StructureDefinition source, dropped rather than reproduced by the generic writer.
- `patient.identifier: old=[] new=undefined` (1×) — harmless; `bundleAssembler.ts`'s `patient.identifier && patient.identifier.length > 0` synthesis check treats `undefined` and `[]` identically.

Spot-checks of the actual resource shapes (not just the diff) confirmed correctness beyond parity-with-the-old-code: the `Condition.extension[condition-dueTo]` extension was built with the correct URL and `valueCodeableConcept`; the Constant-Murley Observation correctly merged four `component[]` slices plus the top-level `valueQuantity` onto one shared resource (ADR-0090's merge behavior); a `repeats=true` leaf (tendons-involved) correctly produced multiple separate Observations; `Encounter.period.start`/`.end` correctly nested into one `Period` object rather than two.

Two real bugs were caught and fixed during this same verification pass, both in the new code (not the old): (1) `parseDefinition`'s `elementPath` already includes the leading `<ResourceType>.` prefix (an existing, unrelated-to-this-ADR convention) — the new resolver was initially designed assuming a stripped local path, causing every single resolution to fail before the fix (`localElementPath` helper added to `extractor.ts`); (2) `buildValue`'s `'code'` case initially fell back to a raw answer string when no coding was present — masking a test-fixture gap and, more importantly, not matching real FHIR semantics (a `code` element is always value-set-bound; the fallback is removed, matching the old code's stricter `ans.coding?.code`-only behavior).

`sdc-frontend`'s `npm run build` (tsc + vite) and `npm run lint` (zero-warning ESLint gate) both pass.

## Consequences

✅ Closes the residual half of ADR-0102's disclosed transparency gap that ADR-0103 left open — an independent SDC engine resolving the same StructureDefinitions this IG publishes would now derive not just fixed values but every element's type/cardinality/write-shape, matching what `extractor.ts` itself does.
✅ `extractor.ts` no longer contains a profile-id → resource-type table or a per-element-path switch statement; both were structural hardcoding this ADR set out to remove.
✅ The two things still not SD-derived (`submissionDefaults`, and SDC's own "resolve the target StructureDefinition" requirement) are named explicitly in code and in the project guide, not left implicit — consistent with this project's established honesty-disclosure pattern (ADR-0036, ADR-0039, ADR-0102).
✅ Live extraction-parity check against real HAPI data (methodology matching ADR-0103's own verification) found zero unexplained behavioral differences from the pre-refactor extractor across all three Questionnaires.
⚠️ The generic writer trades some compile-time type safety for genericness — `assignByPath` and `emptyResource` operate through `Record<string, unknown>` casts rather than each resource's precise TypeScript shape, the intrinsic cost of building a resource reflectively from runtime-resolved metadata instead of hand-typed field assignments.
⚠️ The container-array handling in `resolveElement`/`assignByPath` is scoped to paths of 1 or 2 segments (matching every path currently in use, verified exhaustively) — a future 3+-segment path would need that bookkeeping generalized; documented as a scope boundary in both files' comments, not a silent assumption.
⚠️ Unified frontend's own, separate `OBSERVATION_CODINGS`/`OBSERVATION_PROFILE_URLS` duplication (`frontend/src/types/fhir.ts`) remains untouched — ADR-0103 already named this as a known, separate gap, out of scope here too.

## Sources

- `sdc-frontend/src/lib/extractor.ts`, `profileMetadataResolver.ts`, `profileMetadataParse.ts` — the changed modules, each carrying inline doc comments citing this ADR.
- Live verification session: real Questionnaires fetched from the deployment server HAPI, pre- and post-refactor `extractor.ts` driven side by side via `vite-node` against a shared synthetic `QuestionnaireResponse`, output deep-diffed and spot-checked.
- ADR-0102 — the transparency note this ADR closes the residual half of.
- ADR-0103 — the value-resolution half this ADR builds on and generalizes.
- ADR-0090 — Constant-Murley `component[]` merge behavior, re-verified unchanged by this refactor.
