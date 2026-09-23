# ADR-0087: Pain severity decomposed into 4 context-specific measurements

**Date:** 2026-07-18
**Status:** Accepted

## Context

Next point in the same surgeon review as ADR-0085/0086:

Pain should be captured in four contexts: on average, with movement (active and passive, parenthesised as two distinct cases), and at rest.

`PainSeverityObservation` (LOINC `72514-3`, generic 0–10 NRS `valueQuantity`) was a single profile deliberately reused across **three** Hurley elements simultaneously, differentiated only by `effectiveDateTime`: `Q1.h` (patient-history baseline pain, Registration), `Q8.a` (treatment-success "improved pain" criterion, Registration+FollowUp), and `Q12.a` (PROM pain component, FollowUp). Rendered in the Registration wizard's "Clinical Assessment" step and the Follow-Up wizard's PROMs step.

**Verified no dependency on Constant-Murley computation.** The Constant score has its own independent pain sub-item (`obs.constant-score.pain`, part of the SDC `calculatedExpression` block), unrelated to this field — this redesign is a clean, isolated change with no risk of breaking the Constant-Murley total.

**Classification against Hurley**: `Q1.h`/`Q8.a`/`Q12.a` each name only "Pain"/"improved pain"/"Pain" with zero mechanism specified — the mapping's own Interpretation notes already flagged this as a known limitation ("does not capture presence/character/location/frequency... a decomposition choice of this thesis"). This is a **Refinement** — full design freedom, `Full` status on all three elements unaffected.

## Terminology verification

Checked LOINC (`fhir.loinc.org` `$expand`) for "pain with movement," "pain at rest," "pain severity average," and related phrasing: no precoordinated question-level concept exists for any of these — matches returned were CMS-Assessment / PROMIS / NDI panel items belonging to unrelated instruments (e.g. `91148-7` PEG scale measures pain interference with daily life, not pain-by-context). Checked SNOMED CT (`observable_entity` domain) for "pain on movement" and "pain at rest": no shoulder/orthopedic-relevant match (`364626008` "Characteristic of pain at anatomical site" is a different, broader concept about pain quality, not context-specific severity). Local codes confirmed necessary for the axis — same pattern as every other context-specific decomposition this session (Sleep, Sports, Occupation, Inspection).

## Decision

**Retire `PainSeverityObservation` (LOINC `72514-3`) entirely** — matching the established full-removal precedent (ADR-0054, ADR-0082, ADR-0086) — replaced by **four separate profiles**, following this IG's "one profile per code × value[x]" rule (ADR-0008), each `value[x] only Quantity` preserving the exact UCUM `{score}` 0–10 shape the retired profile established:

1. **`PainAverageObservation`** — `code = ShoulderObservationCodes#pain-average`
2. **`PainActiveMovementObservation`** — `code = ShoulderObservationCodes#pain-active-movement`
3. **`PainPassiveMovementObservation`** — `code = ShoulderObservationCodes#pain-passive-movement`
4. **`PainRestObservation`** — `code = ShoulderObservationCodes#pain-rest`

**Four items, not three.** The surgeon's note explicitly parenthesises active and passive after "with movement" rather than treating movement as one undifferentiated concept. Distinguishing pain reproduced by patient-generated active motion from pain reproduced by examiner-generated passive motion is clinically meaningful (helps differentiate mechanical/structural pathology from muscular guarding) and mirrors a distinction this IG **already makes structurally** — every range-of-motion measurement in this IG is already split into Active/Passive pairs (`ShoulderFlexionObservation`/`ShoulderPassiveFlexionObservation`, etc.). Splitting pain-with-movement the same way is consistency with an existing convention, not a novel design choice.

**All four reused symmetrically across `Q1.h`/`Q8.a`/`Q12.a`, at both Registration and Follow-Up**, exactly mirroring how the single original profile was reused. This is not a new architectural pattern — the retired profile's own Description already stated it "captures three Hurley consensus elements simultaneously"; decomposing it once and keeping that same reuse pattern is the natural, lowest-risk choice. An asymmetric split (e.g. decomposing only the Registration exam-context use, leaving Q8.a/Q12.a on a generic field) was considered and rejected — it has no clean rationale and would recreate the exact ambiguity problem for two of the three original citations.

**No LOINC `72514-3` retained as a dual-coding sibling** on any of the four — keeping it as an additional `coding[]` entry would recreate exactly the ambiguity being fixed (a generic "pain severity" code doesn't say which of the four contexts it means). Same reasoning as Occupation's full retirement of LOINC `85658-3` (ADR-0082).

**Not wired into `Condition.evidence.detail`** — matching the retired profile's non-wired status. `category = exam` and `bodySite` retained in the Registration flow (physically-anchored, per the pre-existing convention). In the Follow-Up flow, `pain-severity` sits in the `prom-score` group (not `exam-finding`) — but `FollowUpWizard.tsx`'s `isLateralizedField` special-cased the literal key `'pain-severity'` to still receive `bodySite` despite the group, because pain is inherently site-specific even when captured as a PROM item. This special case was caught during the final grep sweep (a hardcoded string literal that would have silently stopped matching once the key was renamed) and updated to cover all four new keys (`pain-average`/`pain-active-movement`/`pain-passive-movement`/`pain-rest`), preserving the exact prior behavior.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Three items, merging active/passive movement into one "with movement" axis | Inconsistent with this IG's own established ROM active/passive convention; loses a clinically meaningful distinction the surgeon's parenthetical explicitly calls out |
| Keep LOINC `72514-3` as a dual-coding sibling on all four | Recreates the disambiguation problem the redesign exists to fix |
| Scope the decomposition to only the Registration exam-context use, leave `Q8.a`/`Q12.a` on the retired generic field | Breaks the profile's own stated symmetric-reuse design; no clean rationale for an asymmetric split, and would leave two of the three original Hurley citations on a field the surgeon explicitly flagged as inadequate |
| Plain `valueBoolean` or a 3-tier ordinal instead of preserving the 0–10 NRS shape | Hurley's preferred PROM instruments (Constant, SSV/SANE) and the retired profile itself already establish 0–10/point-scale numeric ratings as this IG's pain-measurement convention; changing the value shape was not requested and would break comparability with the pre-existing Constant-Murley pain sub-item's own descriptor logic |

## Consequences

✅ `Q1.h`, `Q8.a`, and `Q12.a` all remain `Full` — no denominator or percentage change; realisation notes updated for all three rows.

✅ Both Registration (`StepClinicalAssessment.tsx`) and Follow-Up (`Q12_FIELDS`/`Q12PromForm.tsx`) flows updated; the Follow-Up flow required no component code changes since it renders `quantity`-type fields generically from metadata.

⚠️ Breaking: `PainSeverityObservation` removed entirely (LOINC `72514-3` no longer fixed by any profile in this IG) — acceptable given the profile's `draft`/pre-1.0 status, same precedent as ADR-0054/0082/0086.

⚠️ SDC frontend (`sdc-frontend/`) PROFILE_METADATA updated for consistency, but no active questionnaire renders any of the four findings (same gap as Sports Participation, ADR-0083, and Visual Inspection, ADR-0086) — documented, not silently skipped.

⚠️ A pre-existing IG-authored `Questionnaire` instance example (`ShoulderFollowUpQuestionnaire.fsh`, Q9-group placement of the pain item) and an IG example `Bundle` instance (`RotatorCuffFollowUpBundle.fsh`, `ExampleFu6wPainSeverity`) both referenced the retired profile directly by `InstanceOf`/`definition` canonical — caught and fixed during this ADR's own `sushi .` verification (the `InstanceOf` reference failed the build; the `definition` string reference did not, since SUSHI does not structurally validate `Questionnaire.item.definition` canonical strings — a reminder that grep sweeps must cover `ig/input/fsh/examples/` and `instances/`, not just frontend/mapping/example-data paths).

⚠️ `FollowUpWizard.tsx`'s `isLateralizedField` helper hardcoded the literal string `'pain-severity'` as a special-case carve-out (pain is site-specific even inside the non-lateralized `prom-score` group) — a genuine regression risk that a code-only string rename (without this exact grep pattern) would have silently broken, since the field would have just quietly stopped getting `bodySite` rather than erroring. Caught during the final grep sweep, not by the build or by TypeScript (the string literal typechecks fine either way) — a reminder that renaming a field key requires grepping for the *old string literal* specifically, not just the profile/code names.

## Sources

- Clinical review by the reviewing shoulder surgeon
- LOINC FHIR terminology server (`fhir.loinc.org`) `$expand` queries (2026-07-18) — "pain with movement," "pain at rest," "pain severity average," "pain intensity," "pain during," "NRS pain"
- SNOMED CT MCP lookup (2026-07-18) — `observable_entity` domain, "pain on movement" / "pain at rest" — no shoulder/orthopedic-relevant match
- `ig/input/fsh/profiles/observations/PainAverageObservation.fsh`, `PainActiveMovementObservation.fsh`, `PainPassiveMovementObservation.fsh`, `PainRestObservation.fsh`
- `ig/input/fsh/codesystems/ShoulderObservation.fsh`, `valuesets/ShoulderObservationCode.fsh`
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`, `ShoulderFollowUpQuestionnaire.fsh`
- `ig/input/fsh/examples/RotatorCuffFollowUpBundle.fsh`
- `frontend/src/components/wizard/StepClinicalAssessment.tsx`, `config/observationMetadata.ts`, `config/followupObservationMetadata.ts`, `types/fhir.ts`
- `sdc-frontend/src/lib/extractor.ts`
- ADR-0008 (one-profile-per-code convention), ADR-0086 (freshest sibling redesign, full-removal precedent, "verify built assets" deploy lesson), existing ROM active/passive convention (established prior to this session)
