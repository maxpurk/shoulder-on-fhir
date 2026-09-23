# ADR-0171: SDC registration — prior-treatment frequency regrouped, and prior-treatment laterality derived (not re-asked)

**Date:** 2026-08-21
**Status:** Accepted
**Builds on:** ADR-0090 (hand-rolled-regex FHIRPath pitfall), ADR-0100 (real `fhirpath` package adopted for `itemPopulationContext`/`initialExpression`), ADR-0118 (Constant-Murley complete-only gating), ADR-0133 (port of the patient-history redesign that placed the count items), ADR-0142 (laterality display unified via `answerValueSet`)
**Resolves:** `limitations_items/0005` (redundant prior-treatment Side field), `limitations_items/0006` (prior-treatment frequency disconnected)

## Context

Two SDC/unified parity gaps in the registration `Questionnaire`
(`ShoulderRegistrationQuestionnaire.fsh`), surfaced again by a live review of the
LHC-Forms renderer:

1. **Frequency disconnected (0006).** The prior-treatment session/injection **count**
   items (`obs.prior-physical-therapy-session-count`, `obs.prior-injection-count`) —
   both `Observation`s — lived in the `patientHistory` group (`item[5]`), three groups
   after `priorTreatment` (`item[2]`). A user filling prior treatment had no indication
   that "how many sessions/injections" was asked, several screens later.

2. **Redundant Side (0005).** `priorTreatment.laterality` ("Side", → `Procedure.bodySite`)
   re-asked a laterality already answered once at Diagnosis (`Condition.bodySite`), risking
   a silently inconsistent submission (the two are independent elements, no cross-check).

The unified frontend (typed builders) has neither problem; it is the reference.

## Decision

Both fixed in the `Questionnaire` (the source of truth), keeping the data model —
single laterality capture + `Procedure.bodySite 1..1` — intact.

### 1. Frequency → a new adjacent group (not nested)

The count items moved into a **new top-level `priorTreatmentFrequency` group placed
immediately after `priorTreatment`**. They stay **per-leaf Observations** (the group has
no `itemExtractionContext`), because they cannot be nested *inside* `priorTreatment`:
that group's `itemExtractionContext` targets a **Procedure**, and definition-based
extraction is flat (context-group → one resource; no-context group → per-leaf
Observations, no mixed nesting — the ADR-0090 constraint). **Empirically confirmed**:
`POST QuestionnaireResponse/$extract` on HAPI with a count Observation nested inside the
Procedure group **silently drops the Observation** and emits only the Procedure. The new
sibling group co-locates the frequency in the form while preserving correct extraction
in every engine.

### 2. Laterality captured once, derived declaratively

`priorTreatment.laterality` is now a **hidden item** (`questionnaire-hidden`) carrying a
**`calculatedExpression`** that copies the Diagnosis answer:
`%resource.repeat(item).where(linkId='condition.laterality').answer.valueCoding`.
Laterality is authored **once** (Diagnosis); `Procedure.bodySite` is derived from it.
Not re-asked, not shown, conformant.

This derivation is **declarative and portable**: standard SDC engines that evaluate
`calculatedExpression` against the `%resource` QuestionnaireResponse do the right thing —
**verified end-to-end in NLM LHC-Forms and in HAPI `QuestionnaireResponse/$extract`**
(the extracted `Procedure.bodySite` = the diagnosis laterality). Extending the real
`fhirpath` package to `calculatedExpression` is the natural completion of ADR-0100's own
direction (it already rejected hand-rolled regex evaluators for the sibling expression
features after ADR-0090 found the codebase's regex evaluator silently broken for years).

**SDC frontend (port 3001).** Its `calculatedExpression` evaluator is a narrow regex
matched to the Constant-Murley sum pattern (ADR-0090/0118), operating on a flat
`formState`; the laterality is a `Coding` in a **repeating** group (suffixed state keys),
which that evaluator does not model. Rather than risk the heavily-invested Constant-Murley
calc, this frontend reaches the same single-source-of-truth result idiomatically:
- **`questionnaire-hidden` support** added to the renderer (`QuestionnaireForm.tsx`) — the
  hidden item is not rendered.
- **`Procedure.bodySite` defaulted from `Condition.bodySite` in `bundleAssembler.ts`** for
  prior-treatment Procedures (the per-resource wiring step ADR-0133 already notes) — the
  same value the declarative `calculatedExpression` produces for standard engines.

So the *data model and Questionnaire* are one clean declarative design; the SDC frontend,
a custom limited engine, achieves the identical outcome at its assembly step.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Nest the count items inside `priorTreatment` | Extraction drops them (flat model; empirically confirmed). |
| Keep the visible Side field | Redundant re-ask (the reported bug); risks inconsistent laterality. |
| Default `Procedure.bodySite` in `bundleAssembler` only, remove the field entirely | Standard SDC engines (LHC, HAPI `$extract`) then produce a non-conformant Procedure — the derivation would live only in this app's imperative code, not the portable artifact. |
| Upgrade the SDC frontend's calc to full `fhirpath` for this expression | Correct long-term, but the repeating-group + `Coding` + flat-`formState` bridge is deep surgery next to the Constant-Murley calc; deferred as a clean-up (the declarative artifact already makes it optional). |

## Consequences

- **No coverage change.** Q1.f stays Full; laterality still captured once; the count
  Observations are unchanged profiles, just relocated in the form.
- **Frontends.** Unified: unaffected (does not consume the Questionnaire). SDC frontend:
  hidden Side + assembler-derived bodySite (rebuilt). LHC experiment: declarative calc
  (validated). Constant-Murley calc untouched.
- **Test data / thesis / mapping:** unaffected (seed bundles carry no QuestionnaireResponse
  and set Procedure.bodySite directly; thesis names only the profiles + Q1.f).
