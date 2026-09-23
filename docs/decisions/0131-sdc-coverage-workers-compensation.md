# ADR-0131: Port Q1.l workers'-compensation Coverage capture to the SDC frontend

**Date:** 2026-08-02
**Status:** Accepted
**Found via:** a full SDC-frontend end-to-end test (Registration → Surgery → Follow-Up×2) run this session via live browser automation, cross-checked against `$everything` for both longitudinal seed patients. The SDC-created patient had zero `Coverage` resources where Anna Müller and Kemal Demir each have one — traced to ADR-0061's own explicit deferral note ("SDC frontend deferred… A future SDC ADR may extend the registration Questionnaire with a Coverage item").

## Context

Hurley Q1.l ("workmen's compensation") was closed to `Full` status by ADR-0061: a "yes" answer emits a `ShoulderCoverage` resource with `Coverage.type = v3-ActCode#WCBPOL` (German Berufsgenossenschaft); "no"/"unknown" emit nothing. ADR-0061 fully specified this modeling — the fixed code, the profile shape (`status`/`type`/`subscriber`/`payor`), the rationale for hardcoding the code client-side rather than deriving it from the profile (`ShoulderCoverage.type` is only extensible-bound, not fixed) — and implemented it in the unified frontend's `StepPatient.tsx`. It named the SDC frontend as a known, deliberate gap, not an oversight.

Per the Clinical Feedback Integration Workflow, this is classification **(b) structural gap fix**: nothing clinical or terminological is being decided here that ADR-0061 didn't already decide. This ADR documents how the existing decision gets ported into the SDC frontend's different architecture, not a new decision.

The porting problem is architectural, not clinical: the SDC frontend's extractor (`extractor.ts`) is definition-driven — every resource it builds comes from either an `itemExtractionContext`-tagged Questionnaire group (one resource, fields filled per-leaf via `item.definition`) or a per-leaf-extraction group (one Observation per leaf, again via `item.definition`). `Coverage` fits neither shape well: it isn't one resource assembled field-by-field from several leaves (there's exactly one meaningful input — the yes/no/unknown answer itself), and its one fixed field (`type` = WCBPOL) has no `item.definition` target because the profile doesn't fix that value, so there is nothing in the compiled StructureDefinition for the runtime resolver (ADR-0103/ADR-0122) to read it from.

The precedent this ADR follows is the Follow-Up Questionnaire's `encounter.timepoint` item (`ShoulderFollowUpQuestionnaire.fsh`): a `#choice` item with plain-string `answerOption`s and no `item.definition` at all — a "loose leaf" whose answer is read out of band rather than assigned onto some element path. Inspecting that precedent found it's a syntax match only: `encounter.timepoint` is written into the `QuestionnaireResponse` by `buildQuestionnaireResponse` but never read back out anywhere downstream (the Q11 follow-up schedule is actually derived from the index procedure's date, not from that answer). So the new `coverage.workersCompensation` item is the first loose leaf in this codebase whose answer is genuinely consumed — a new, small, generic `findAnswerByLinkId` walker had to be written for it, since no reusable "find a QR answer by linkId anywhere in the tree" helper existed (`buildItemMap` walks the *Questionnaire* item tree for a different purpose — `item.definition`/extraction-context lookup — not QR answers).

## Decision

1. **`ShoulderRegistrationQuestionnaire.fsh`**: add `coverage.workersCompensation` as a loose leaf inside the existing `patientHistory` group (Hurley's Q1 patient-history items already live there) — `#choice`, plain-string `answerOption`s `"Yes"`/`"No"`/`"Unknown"`, no `item.definition`. Bumped `Questionnaire.version` 0.2.0 → 0.3.0.
2. **`extractor.ts`**: added `coverage?: Coverage` to `ExtractedResources`; a small recursive `findAnswerByLinkId(items, linkId)` helper (new — no equivalent existed); a hardcoded `buildWorkersCompCoverage()` builder producing the fixed `status: 'active'` / `type: v3-ActCode#WCBPOL` shape — same "required-but-not-SD-derivable" bucket the module's own `submissionDefaults()` already documents, for the same reason (no profile-fixed value to resolve generically). Called once, after the main per-group extraction loop, checking for `valueString === 'Yes'`.
3. **`bundleAssembler.ts`**: `assembleRegistrationBundle` wires `subscriber`/`beneficiary` to the in-bundle `urn:uuid` Patient reference and a display-only `payor` (`"Berufsgenossenschaft (BG)"`, no `Organization` resource — matching the unified frontend, which also doesn't reference one), following the same conditional-entry pattern already used for `imagingStudyEntry`.
4. **No IG profile changes** — `ShoulderCoverage` and `RotatorCuffRegistrationBundle`'s `coverage 0..1` slice were already correct and unchanged; this ADR only adds a Questionnaire item and frontend wiring.
5. **`mapping/SECEC_FHIR_Mapping.csv`** rows `Q1.l`/`L3.I.1`: dropped the "SDC frontend deferred" / "SDC Questionnaire Coverage item (deferred)" language now that it's implemented. `Coverage Status` stays `Full` — it already was; this was never a Full/Partial gap, only a documented deferral note.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Model as a native `#boolean` item (SDC already renders a hardcoded Yes/No `<select>` for `boolean` type, zero new frontend rendering code) | Would have collapsed "No" and "Unknown" into a single UI state. Functionally this makes no difference to the submitted FHIR data (both already collapse to "no Coverage emitted" — the unified frontend's own three-state field produces byte-identical output for "no" and "unknown"), but the three-state `#choice` + plain-string-`answerOption`s form costs nothing extra (`QuestionnaireForm.tsx`'s choice-rendering path is already generic) and keeps the two frontends' *forms* visually consistent, not just their data. |
| Give `Coverage` its own `itemExtractionContext` resource-anchored group (mirroring `imaging`/`patient`/`condition`) | Rejected — that mechanism exists to fill a resource from several leaves via `item.definition`; `Coverage` here has exactly one meaningful input (the gate) and one fixed field with nothing in the SD to resolve it from. A resource-anchored group would still need the same hardcoded-type escape hatch this ADR adds, for no structural benefit over a loose leaf. |
| Resolve `WCBPOL` generically by tightening `ShoulderCoverage.type` to a fixed value in the profile | Rejected — would change `ShoulderCoverage`'s conformance contract (a fixed, non-extensible-in-practice value where the profile currently declares only an extensible binding), which ADR-0061 deliberately chose to keep flexible for downstream deployers who might want other coverage types. Not this ADR's decision to revisit. |

## Classification (Clinical Feedback Integration Workflow)

**(b) Structural gap fix.** Closes a limitation ADR-0061 itself already flagged and the mapping CSV already noted ("SDC frontend deferred"). No new clinical/terminology decision — `WCBPOL`, the profile shape, and the yes/no/unknown semantics were all already decided.

## Consequences

✅ Q1.l is now demonstrated by both frontends' write paths, closing the last asymmetry ADR-0061 left open.
✅ First loose-leaf Questionnaire item in this codebase whose answer is actually read back out of the QR — `findAnswerByLinkId` is a small, generic, reusable pattern for any future field that gates a whole resource rather than filling one element.
✅ No mapping status change (`Q1.l`/`L3.I.1` stay `Full`) — pure notes/To-Do cleanup, no thesis-chapter impact.
⚠️ `Coverage.type`'s WCBPOL code stays hardcoded client-side in two places now (unified frontend's `StepPatient.tsx`, SDC's `extractor.ts`) rather than one — the same duplication tradeoff ADR-0061 already accepted for the unified frontend, now doubled. Acceptable: the code is a single, stable, well-documented constant in both places, and generically resolving it would require loosening the profile's binding (see Alternatives Considered), a bigger and unrelated change.

## Sources

- ADR-0061 — sole clinical/terminology authority for this change; nothing here revisits it.
- `ig/input/fsh/instances/ShoulderFollowUpQuestionnaire.fsh` — `encounter.timepoint`, the loose-leaf syntax precedent.
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — new `item[5].item[6]` (`coverage.workersCompensation`).
- `ig/input/fsh/profiles/ShoulderCoverage.fsh`, `ig/input/fsh/profiles/RotatorCuffRegistrationBundle.fsh` — unchanged; confirmed the `coverage 0..1` slice was already correct.
- `sdc-frontend/src/lib/extractor.ts` (`findAnswerByLinkId`, `buildWorkersCompCoverage`, `ExtractedResources.coverage`), `sdc-frontend/src/lib/bundleAssembler.ts` (`coverageEntry` wiring), `sdc-frontend/src/types/fhir.ts` (`Coverage` interface, `PROFILE_URLS.COVERAGE`).
- `frontend/src/components/wizard/StepPatient.tsx` — reference implementation this ADR ports.
- `mapping/SECEC_FHIR_Mapping.csv` rows `Q1.l`, `L3.I.1` — notes/To-Do updated, `Coverage Status` unchanged.
- ADR-0103/ADR-0122 (the generic runtime-resolution mechanism this ADR's hardcoded escape hatch sits outside of, and why), ADR-0130 (same-session companion — the most recent prior instance of extending the SDC extractor's resource-bucket set, same "hardcoded because not SD-derivable" reasoning pattern).
