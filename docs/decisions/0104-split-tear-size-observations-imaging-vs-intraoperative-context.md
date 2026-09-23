# ADR-0104: Split TearSize/TearSizeClassification into imaging vs. intra-operative (exam) profiles

**Date:** 2026-07-26
**Status:** Accepted
**Amends:** ADR-0047 (introduced the dual continuous-cm/categorical-Cofield encoding — now each of the two encodings has an imaging-context and a surgical-context sibling), ADR-0103 (closes its "Part 0.5" exception)
**Builds on:** ADR-0103 (runtime-derived Observation code/category)

## Context

ADR-0103 replaced the SDC extractor's hand-typed `PROFILE_METADATA` table with a runtime resolver that reads fixed `Observation.code`/`category` directly from the compiled IG. While rolling that fix out to all 47 derived Observation profiles, two — `TearSizeObservation` and `TearSizeClassificationObservation` — were found to be genuinely different: their own FSH description said the measurement could come from "MRI or intra-operative measurement," and the IG's own `RotatorCuffSurgeryBundle` example already demonstrated an intra-operative instance with `category = exam`, while the same profile is also used pre-operatively (Registration flow) with `category = imaging`. ADR-0103 left both profiles unfixed and added a small runtime exception in `sdc-frontend/src/lib/extractor.ts` (`CONTEXT_DEPENDENT_CATEGORY_PROFILES` / `contextDependentCategory()`) that resolved `category` from which Questionnaire group a leaf answer belonged to (`intraOpObservations` → `exam`, else → `imaging`).

A `shoulder-surgeon` subagent consulted this session confirmed the underlying clinical picture: pre-operative MRI/ultrasound-based tear size is standard for surgical planning, and intra-operative direct measurement (post-debridement) is the reference-standard used to actually apply the Cofield bucket and drive the operative decision. Both routinely coexist in the same patient's chart, obtained by different means at different times, and disagreement between them is a well-recognized, clinically expected phenomenon — a surgeon reading the chart wants to see both values, not have one silently overwrite the other.

Given that, the runtime exception in `extractor.ts` was a reasonable stopgap but not the right final state — the IG itself should model these as two distinct concepts fixable at the profile level, closing the last runtime special-case ADR-0103 left open.

## Decision

1. **Keep the existing profile IDs (`tear-size-observation`, `tear-size-classification-observation`) as the imaging-context variant.** Add `* category = http://terminology.hl7.org/CodeSystem/observation-category#imaging "Imaging"` to each — the same one-line fixed-category pattern already applied to the other 45 derived Observation profiles. Descriptions updated to name the imaging context explicitly and cross-reference the new intra-operative siblings. Both profiles bumped to `0.2.0`. This required zero changes to the Registration Questionnaire or the longitudinal seed bundles (Anna Müller, Kemal Demir) — both already only ever populate these two profiles with `imaging` category.

2. **Add two new profiles for the intra-operative context**: `IntraopTearSizeObservation` (`intraop-tear-size-observation`) and `IntraopTearSizeClassificationObservation` (`intraop-tear-size-classification-observation`). Each:
   - `Parent: ShoulderObservation` — flat, matching how all 47 sibling Observation profiles are direct children of the one abstract parent, rather than introducing a second layer of abstraction under the existing TearSize profiles that doesn't exist elsewhere in this IG.
   - **Identical `Observation.code`** to their imaging sibling (`ShoulderObservationCodes#tear-size` / `#tear-size-classification`). `code` names the concept measured (maximum tear diameter / Cofield bucket); `category` names the acquisition context. These are orthogonal FHIR axes — giving the two contexts different codes would break "query all tear-size measurements regardless of context," and would misrepresent the fact that both variants are measuring the exact same clinical concept.
   - Same `value[x]` constraint as their sibling (`Quantity`/cm, `CodeableConcept`/Cofield).
   - Fixed `category = exam`.

   No existing "context-prefix" naming precedent existed in this IG before this ADR (context has always been carried by `category`/`effectiveDateTime`, never by profile name) — `Intraop` is a new but narrowly-scoped pattern, justified because these two profiles differ *only* by acquisition context and must be distinguishable by name for that reason alone.

3. **Re-point the Surgery Questionnaire's `intraOpObservations` group** (`ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh`) leaf items' `item.definition` to the two new profiles. The Registration Questionnaire is unchanged — it already correctly targets the imaging profiles. Surgery Questionnaire bumped to `0.2.0`.

4. **Re-point the example instances** `ExampleIntraOpTearSize`/`ExampleIntraOpTearSizeClassification` (`ig/input/fsh/examples/RotatorCuffSurgeryBundle.fsh`) to `InstanceOf: IntraopTearSizeObservation`/`IntraopTearSizeClassificationObservation`, and remove their now-redundant explicit `category = ...#exam` assignments (implied by the new profiles' fixed pattern) — the same cleanup already applied to the other now-redundant example instances in ADR-0103.

5. **Simplify `sdc-frontend/src/lib/extractor.ts`**: delete `CONTEXT_DEPENDENT_CATEGORY_PROFILES`, `contextDependentCategory()`, the now-unused `IMAGING_CATEGORY` constant, and the `groupLinkId` parameter threading in `metadataFor`/`buildObservationsForPerLeafGroup` that existed only to support it. `metadataFor` is now a pure lookup into the resolved map with zero runtime branching — every derived Observation profile (49, after this ADR) fixes both `code` and `category` in the IG itself, and the resolver reads all of it. This fully closes the gap ADR-0102/ADR-0103 identified: an independent SDC processor can now extract these Questionnaires correctly with no private, code-side knowledge of context-dependent exceptions.

6. **Mapping update**: `mapping/SECEC_FHIR_Mapping.csv`'s Q4.a row — `Bundle` column `Registration` → `"Registration,Surgery"`; `Notes` and `IG Implementation` columns extended to describe the imaging/surgical split and cite the surgeon confirmation. `mapping/SECEC_FHIR_Mapping.md`'s Q4.a narrative bullet extended correspondingly. Q4.a's Hurley-consensus coverage status is unaffected (still one consensus element, still Partial — the profile split is a structural refinement, not a new consensus element).

7. **Unified frontend (port 3000) deliberately not touched.** It has zero surgery-side tear-size UI today (verified) — only Registration's `StepImaging.tsx` captures tear size, always `category: imaging`, which the imaging-fixed profiles already match with no conflict. Adding intra-operative tear-size capture there is net-new UI feature work, not a rename, and independent of this profile split; deferred, matching this project's existing precedent (e.g. ADR-0064) of not always giving both frontends parity.
   *Amended by ADR-0144 (2026-08-03): the "not always giving both frontends parity" precedent is retired going forward. The missing unified-frontend intra-operative tear-size capture remains open, tracked as an ordinary parity item in the cross-frontend parity audit.*

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Drop the two profiles' category requirement entirely / leave `contextDependentCategory()` in place indefinitely | Leaves a permanent runtime special-case in `extractor.ts` that an independent SDC processor cannot replicate without private knowledge — exactly the gap ADR-0103 otherwise closed for every other profile. |
| Nest the new profiles under the existing `TearSizeObservation`/`TearSizeClassificationObservation` (`Parent: TearSizeObservation` instead of `Parent: ShoulderObservation`) | Would introduce a two-level Observation hierarchy that exists nowhere else in this IG (all 47 other concrete profiles are direct children of the single abstract `ShoulderObservation`), and would give the pre-existing profile a confusing dual role as both a directly-instantiable profile and an intermediate parent. |
| Give the imaging and intra-operative variants distinct `Observation.code` values | Would break cross-context queryability and misrepresent `code` as encoding acquisition context, which is `category`'s job — the two axes are orthogonal by FHIR design. |
| Also add surgery-side tear-size UI to the unified frontend in this same change | Genuinely new feature work (new wizard fields, new builder wiring), independent of the FHIR profile split; confirmed out of scope with the user, deferred as a separate future item. |

## Consequences

✅ Zero runtime context-dependent branching remains in `extractor.ts` — every derived Observation profile's `code`/`category` is now resolvable purely from the compiled IG, fully closing the gap ADR-0102 first identified and ADR-0103 mostly closed.
✅ The pre-operative imaging estimate and the intra-operative direct measurement are now modeled as genuinely distinct, non-redundant FHIR concepts (different `meta.profile`, same `code`, different fixed `category`) — matching real clinical practice, where both are routinely recorded and their disagreement is itself clinically informative.
✅ Minimal churn: reusing the existing profile IDs for the imaging variant meant zero changes to the Registration Questionnaire, the longitudinal seed bundles, or the CSV's existing profile-ID references.
✅ `sushi .` — 0 errors, 0 warnings (65 profiles, up from 63). `npm run build && npm run lint` — clean.
⚠️ The unified frontend (port 3000) has no surgery-side tear-size capture at all, imaging or intra-operative — this ADR does not change that; adding it is future work.
⚠️ `Intraop` is a new naming pattern for this IG (context has never been carried by profile name before) — scoped narrowly to these two profiles, where it is the only way to distinguish two profiles differing solely by fixed category.

## Sources

- `shoulder-surgeon` subagent consultation, this session — confirmed pre-op imaging vs. intra-operative tear-size measurement are both real, routinely both recorded, and their disagreement is clinically expected and meaningful.
- `ig/input/fsh/profiles/observations/TearSizeObservation.fsh`, `TearSizeClassificationObservation.fsh` — original Description text naming both acquisition contexts.
- `ig/input/fsh/examples/RotatorCuffSurgeryBundle.fsh` (`ExampleIntraOpTearSize`, `ExampleIntraOpTearSizeClassification`) — the pre-existing example that first surfaced the category conflict during ADR-0103's rollout.
- `sdc-frontend/src/lib/extractor.ts` — the `CONTEXT_DEPENDENT_CATEGORY_PROFILES`/`contextDependentCategory()` mechanism this ADR removes.
- `mapping/SECEC_FHIR_Mapping.csv`/`.md` — Q4.a row/bullet.
- ADR-0047 — original dual cm/Cofield encoding, amended by this ADR.
- ADR-0103 — runtime-derived Observation code/category; this ADR closes its Part 0.5 exception.
- ADR-0064 — precedent for deliberately not giving both frontends parity.
