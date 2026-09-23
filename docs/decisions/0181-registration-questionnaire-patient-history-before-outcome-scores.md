# ADR-0181: Order the Registration Questionnaire so Patient History precedes Outcome Scores

**Date:** 2026-09-07
**Status:** Accepted — resolves the open limitation "SDC's Constant-Murley Total silently never calculates for a user filling the form top-to-bottom" (`docs/limitations_items/0007-sdc-constant-murley-adl-never-calculates/`, to be removed under the delete-on-resolution policy). Refines the SDC calculator port established by ADR-0158 (which itself ported ADR-0112's POOS-15 calculator and ADR-0113's read-only sub-score fix).

## Context

`shared/constantScore.ts` derives the Constant-Murley ADL sub-score from four inputs. Three (`adlOccupation`, `adlLeisure`, `adlArmUse`) are asked directly in the Outcome Scores group. The fourth, `adlSleep`, is derived from the patient's Sleep Disturbance answer (`obs.sleep-disturbance`), which lives in the Patient History group.

`isSubscoreComplete()` requires all four inputs before the ADL sub-score shows a value at all, and the Total's `calculatedExpression` only sums sub-scores that already have a value. An incomplete ADL therefore blanks the Total as well, with no error and no partial value.

In `ShoulderRegistrationQuestionnaire.fsh` the Patient History group sat *after* the Outcome Scores group in the top-level item array. The SDC frontend renders groups in array order, so a user filling the form in document order reached the Constant-Murley calculator before they had been asked the one input it silently also depends on. ADL, and therefore the Total, never completed for the natural fill order. The four sub-score rows are labelled "calculated", which implies the value should simply appear; when it silently did not, the form read as broken.

The unified frontend never hit this: its wizard captures Sleep Disturbance in step 1, well before the Outcome Scores step. The calculator logic is shared and identical between the two frontends. Only the document order of the questions feeding it differed, and that was enough to break the observable behaviour, defeating ADR-0158's own goal of matching the unified frontend's live-calculator behaviour.

The Follow-Up Questionnaire is not affected. It asks `constant-calc.adl-sleep` directly inside its own Outcome Scores group, and its Post-Op Exam group (carrying pain average, flexion, abduction, and internal rotation) already precedes Outcome Scores.

## Decision

Swap the two top-level groups in `ShoulderRegistrationQuestionnaire.fsh` so that Patient History is `item[5]` and Outcome Scores is `item[6]`. The rendered order becomes:

`patient` → `condition` → `priorTreatment` → `priorTreatmentFrequency` → `clinicalAssessment` → **`patientHistory`** → **`outcomeScores`** → `imaging` → `otherDiagnosis`

This mirrors the unified wizard's step order and guarantees that every one of the calculator's five derived inputs is asked before the calculator itself. Four of them (`obs.pain-average`, `obs.forward-flexion`, `obs.abduction`, `obs.internal-rotation`) already sat in Clinical Assessment; `obs.sleep-disturbance` is the one this change moves ahead.

Only the top-level group index is renumbered. Nested child indices, `linkId` values, `item.definition` targets, and every FHIRPath expression are untouched: the calculated expressions address answers by `linkId` through `%resource.repeat(item)`, so they are order-independent by construction. No frontend code changes, in either paradigm: the SDC frontend is definition-driven and takes its order from the Questionnaire.

## Alternatives considered

**Move only the `obs.sleep-disturbance` item into an earlier group.** Rejected: Sleep Disturbance is a Q1 patient-history element, and hoisting it out of the group that carries the rest of Q1 would misrepresent the consensus decomposition to keep a calculator happy.

**Surface which sub-item is missing when a sub-score is incomplete.** Not rejected, and not implemented here. It is an independent usability improvement that would have made the failure legible rather than silent, and it remains worth doing on its own merits. It does not remove the need for a sensible question order.

**Leave the order and document the workaround.** Rejected: the failure is the default experience for anyone filling the form top-to-bottom, not an edge case.

## Consequences

- The Constant-Murley Total now computes for the natural fill order in the SDC Registration form, matching the unified frontend.
- Patient History is presented after Clinical Assessment rather than at the end of the form. This reads acceptably (history follows examination), and it is the minimal change that fixes the dependency.
- `sushi .` compiles clean (0 errors, 0 warnings), and the generated `Questionnaire-shoulder-registration.json` carries the new group order with all four sub-score items and the total's `calculatedExpression` intact.
- Cross-paradigm parity (ADR-0144) is restored for this behaviour: both frontends now compute the same score from the same shared calculator under their natural fill order.
