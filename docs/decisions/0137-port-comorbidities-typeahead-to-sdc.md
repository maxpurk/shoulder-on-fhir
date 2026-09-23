# ADR-0137: Port Comorbidities capture (Q1.c) to SDC, including a new typeahead capability

**Date:** 2026-08-03
**Status:** Accepted
**Found via:** the cross-frontend parity audit, item #3 — the unified Registration wizard has a full Comorbidities section (SNOMED typeahead limited to non-shoulder findings per ADR-0084, plus explicit "none known"/"no information available" flags); SDC's Registration questionnaire had no comorbidity section whatsoever.

## Context

Q1.c is a named expert-consensus element, Full-status via the unified frontend. Per the Clinical Feedback Integration Workflow: classification **(b) structural gap fix** — ADR-0055 (resource-level IPS Problems binding) and ADR-0084 (the typeahead exclusion mechanism) already made every clinical/terminology decision here; nothing in this ADR revisits them.

Unlike every other item in this feedback round, this one could not be closed as a pure FSH + generic-extraction port. SDC's `QuestionnaireForm.tsx` only ever rendered two shapes for a `#choice` item: a bounded `<select>` (single-value) or a checkbox list (repeating), both fed by a *fully pre-fetched* `$expand` of the item's `answerValueSet`. Comorbidities' resource-level binding (`ShoulderComorbidityCondition.code`, IPS `problems-snomed-absent-unknown-uv-ips`) is — like the unified frontend's own equivalent — effectively "most of SNOMED CT," which cannot be `$expand`ed and rendered as a dropdown at all. The unified frontend solves this with a dedicated debounced-search typeahead (`useSnomedTypeahead` + `SnomedTypeahead`, filtering a SNOMED implicit-VS subset `isa/404684003` "Clinical finding" server-side per keystroke); SDC had no equivalent capability, and none of ADR-0103/ADR-0122's generic per-element resolution touches *how an item renders* — only how an *answered* value gets written onto a resource.

This is the one point in the whole feedback round genuinely bigger than "wire an existing mechanism to a new field" — it required adding a new, reusable capability to the SDC frontend. Weighed against the alternative of only porting the "none known"/"no information" flags and leaving specific-comorbidity capture out of SDC entirely: the fuller port was chosen because (a) the typeahead mechanism itself was a complete, working reference to port line-for-line, not a new design; (b) a partial port would leave Q1.c only nominally addressed in SDC (the flags without the ability to actually name a comorbidity); (c) `#open-choice` is the exact FHIR-standard item type for "searchable choice," already present (unused) in this codebase's own `QuestionnaireItem.type` union — using it rather than inventing a new convention keeps the port spec-idiomatic.

## Decision

**IG (`ShoulderRegistrationQuestionnaire.fsh`, `patientHistory` group, appended at indices 11–12):**
- `obs.comorbidities` — `#open-choice`, `repeats = true`, `answerValueSet = "http://snomed.info/sct?fhir_vs=isa/404684003"` (same SNOMED implicit-VS subset as unified). No `item.definition` — see extraction below.
- `comorbidity.absentReason` — `#choice`, 2 `answerOption`s bound to `http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips#no-known-problems` / `#no-problem-info`. Only consulted when the typeahead above is empty at submission — same tri-state semantics as unified's `comorbidityStatus`.

`Questionnaire.version` bumped `0.6.0` → `0.7.0`.

**New SDC frontend capability (mechanical port of the unified frontend's identical files):**
- `sdc-frontend/src/lib/terminologyService.ts` — added `searchValueSet`/`expandViaTx` (the existing file already had `expandValueSet` for bounded dropdowns; these are new, additive).
- `sdc-frontend/src/lib/fhirClient.ts` — added `expandFiltered` (a `filter`-taking sibling to the existing `expand`, without its Lucene-not-populated fallback, which doesn't apply to a search that legitimately returns zero matches).
- `sdc-frontend/src/hooks/useSnomedTypeahead.ts`, `sdc-frontend/src/components/SnomedTypeahead.tsx` — new files, byte-for-byte logic ports of the unified frontend's identical files (adapted to import SDC's own `TermOption`).
- `sdc-frontend/vite.config.ts` / `nginx.conf` — added the `/tx-fhir` → `tx.fhir.org/r4` same-origin proxy (dev + prod), identical to the unified frontend's, needed because HAPI cannot walk the SNOMED hierarchy locally (ADR-0062) and same-origin proxying avoids tx.fhir.org's duplicate-CORS-header rejection in Chromium.
- `QuestionnaireForm.tsx` — new render branch for `item.type === 'open-choice'` (rendered via `SnomedTypeahead` instead of the checkbox path used for bounded repeating `#choice`); new `typeaheadState` (`Record<linkId, Coding[]>`, since each search result already carries a full `system`/`code`/`display` — no separate lookup table needed, unlike `multiFormState`'s bare-code-plus-`answerOptions`-lookup approach) threaded through `SectionCard`/`QuestionField`; `buildQuestionnaireResponse` gained a `typeaheadState` parameter emitting one `valueCoding` answer per selected item. The comorbidity linkId's shoulder-region exclusion set (`SHOULDER_REGION_DISORDERS_EXCLUSION_VS`, ADR-0084) is hardcoded to that one linkId in `QuestionnaireForm.tsx`, same tradeoff as everywhere else in this port (FSH has no generic "exclusion VS" extension mechanism).

**Extraction (`extractor.ts`) — hand-built, not the generic resolver:** same reason as Coverage/RSG — `ShoulderComorbidityCondition` needs `category = problem-list-item`, which the blanket `submissionDefaults('Condition')` (written for `RotatorCuffCondition`, `category = encounter-diagnosis`) doesn't give it, and the generic resolver's profile-derived fixed-value reading is Observation-code/category-only. New `findAllAnswersByLinkId` (returns every answer of a repeating loose leaf, vs. `findAnswerByLinkId`'s first-only) + `buildComorbidityConditions(qr)`: if `obs.comorbidities` has any answers, emits one `Condition` per selected code; else if `comorbidity.absentReason` is answered, emits one absent-value `Condition`; else emits nothing. `ExtractedResources.comorbidities: Condition[]` (new field) is wired into the bundle in `bundleAssembler.ts` with `subject` only (no `encounter` — a comorbidity is patient-level, not visit-anchored, matching unified).

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Only port the none-known/no-info flags, skip specific-comorbidity capture | Leaves Q1.c only nominally addressed — a clinician could record "yes comorbidities exist" but never *which*. The recommendation explicitly asked for "the same IPS Problems VS typeahead binding... the unified frontend uses." |
| Bind to a small curated dropdown VS of ~20–30 common comorbidities instead of the full IPS/SNOMED typeahead | Would be a genuine new clinical-scope decision (which comorbidities to include) requiring its own `shoulder-surgeon` review — not a "straight port" of an already-settled design, unlike everything else in this feedback round. Rejected in favor of reusing the exact mechanism and VS already decided by ADR-0055/ADR-0084. |
| Give `#open-choice` a generic `enableWhen`-style rendering hint instead of a hardcoded linkId check for the exclusion set | This codebase doesn't use `enableWhen` anywhere (see ADR-0133's identical reasoning for the prior-treatment count items); a single hardcoded linkId check is smaller and consistent with the Coverage/RSG precedent of small named exceptions over new general mechanism. |

## Consequences

✅ Closes clinical-review item #3 — SDC can now capture specific comorbidities via the same SNOMED typeahead mechanism as unified, plus the none-known/no-info flags.
✅ `SnomedTypeahead`/`useSnomedTypeahead`/`searchValueSet` are now reusable by any future SDC field needing free-text terminology search, not just comorbidities.
✅ `sushi .`: 0 errors / 0 warnings. `sdc-frontend`: `npm run build` (tsc + vite) and `npm run lint` (zero-warnings gate) both clean.
✅ No mapping status change — Q1.c was already Full via the unified frontend.
⚠️ Fourth instance of the "loose leaf + hardcoded builder" pattern in this codebase (after Coverage, RSG, phone) — `buildComorbidityConditions` is the first to build *multiple* resources from one pattern and the first to need a second loose leaf (`absentReason`) as a fallback. Still small and well-precedented; the extractor's own module comment already flags this class of gap as a legitimate future generalization.
⚠️ `/tx-fhir` proxy duplication across two frontends' `vite.config.ts`/`nginx.conf` — same accepted tradeoff as the LaTeX-subproject asset duplication elsewhere in this project (the project guide's "each subproject self-contained" policy), not something this ADR introduces a new pattern for.

## Sources

- the cross-frontend parity audit, item #3.
- ADR-0055 (resource-level IPS Problems binding), ADR-0084 (typeahead exclusion mechanism, SHOULDER_REGION_DISORDERS_EXCLUSION_VS anchor concepts) — sole clinical/terminology authority; nothing here revisits them.
- `frontend/src/lib/terminologyService.ts`, `frontend/src/hooks/useSnomedTypeahead.ts`, `frontend/src/components/shared/SnomedTypeahead.tsx`, `frontend/src/components/wizard/StepPatient.tsx` (lines ~390-424) — reference implementations this ADR ports.
- `frontend/vite.config.ts` / `nginx.conf` (`/tx-fhir` proxy block) — reference config this ADR ports.
- ADR-0062 — same-origin `/tx-fhir` proxy rationale (tx.fhir.org duplicate-CORS-header Chromium rejection), applies unchanged to SDC.
- `sdc-frontend/src/lib/extractor.ts` (`buildComorbidityConditions`, `findAllAnswersByLinkId`), `sdc-frontend/src/components/QuestionnaireForm.tsx` (`open-choice` branch, `typeaheadState`).
