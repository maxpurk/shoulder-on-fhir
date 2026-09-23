# ADR-0174: SDC frontend evaluates calculatedExpression with real fhirpath (one mechanism), removing the bundleAssembler laterality default

**Date:** 2026-08-22
**Status:** Accepted
**Builds on:** ADR-0090 (the hand-rolled-regex FHIRPath pitfall — a paren miscount made the calc evaluator a silent no-op for years), ADR-0100 (the real `fhirpath` npm package adopted for `itemPopulationContext`/`initialExpression`), ADR-0118 (Constant-Murley complete-only gating), ADR-0171 (prior-treatment laterality derived via a hidden `calculatedExpression`, with the SDC frontend bridging it imperatively — and explicitly deferring this refactor)

## Context

The SDC frontend (`sdc-frontend/`) evaluated the SDC
`sdc-questionnaire-calculatedExpression` extension with a hand-rolled regex
(`evaluateCalcExpr` in `QuestionnaireForm.tsx`). That regex understood exactly
one FHIRPath shape — `linkId.startsWith('PREFIX')` followed by an implicit
decimal sum — enough for the Constant-Murley total and nothing else. The IG's
**second** `calculatedExpression`, prior-treatment laterality
(`%resource.repeat(item).where(linkId='condition.laterality').answer.valueCoding`,
→ `Procedure.bodySite`), returns a `Coding` from a repeating group and could not
be expressed in that regex at all. ADR-0171 therefore made this frontend reach
the same result **imperatively**: hide the item, and default `Procedure.bodySite`
from `Condition.bodySite` inside `bundleAssembler.ts`. That worked, but left the
derivation living in this app's code rather than in the portable artifact —
a standard SDC engine (NLM LForms) and HAPI `$extract` already do it declaratively
from the Questionnaire. ADR-0171 named the fix ("upgrade the SDC calc to full
`fhirpath`") and deferred it as "deep surgery next to the Constant-Murley calc."

ADR-0100 had already brought the real `fhirpath` package into the build for the
sibling `initialExpression`/`itemPopulationContext` features, after ADR-0090
found the regex evaluator silently broken. The calc path was the last place still
on the hand-rolled evaluator.

## Decision

Replace the regex evaluator with the real `fhirpath` package, so the SDC frontend
evaluates **any** `calculatedExpression` the same way LForms and HAPI `$extract`
do — one mechanism everywhere — and **delete** the `bundleAssembler` laterality
default. No FHIR artifact changes: both expressions were already correctly
authored (this is a frontend/consumer change only).

### 1. A small, pure evaluation module

`sdc-frontend/src/lib/calculatedExpression.ts`:
- `evaluateCalc(expression, qrShim, dependencyLinkIds, env)` runs the expression
  with `fhirpath.evaluate` against a `QuestionnaireResponse` built from the
  current form state (the **same** `buildQuestionnaireResponse` serializer used at
  submit, so the calc sees exactly what would be extracted). `%resource` is bound
  to the shim in the environment (fhirpath does not auto-bind it; an unbound
  `%resource` throws). Returns a typed outcome: `number`, `coding`, or
  `incomplete`.
- `dependencyLinkIdsOf(expression, flatItems)` reads **only** the `linkId`
  predicate (`linkId.startsWith('X')` or `linkId='X'`) from the flattened
  Questionnaire to name the leaves the expression depends on. This is the one
  piece of string matching retained — but it does **no value computation** (that
  is now entirely fhirpath's job), so it is not the fragile ADR-0090 arithmetic
  regex. It exists solely to preserve the ADR-0118 completeness gate.

### 2. Completeness gate preserved (ADR-0118), no behavior change to the total

A raw `.sum()` over the shim would show a **partial** Constant-Murley total once
any sub-score is filled — which ADR-0118 forbids. The gate: `evaluateCalc`
returns `incomplete` unless every dependency leaf has an answer in the shim
(relying on the verified fact that `buildQuestionnaireResponse` omits
empty-string answers, so an unfilled sub-score is simply absent). The calc effect
then applies a `number` outcome to the total but, on `incomplete`, **leaves the
field untouched** — byte-identical to the prior behavior, preserving the two
entry modes (direct total vs. component-derived). Only the evaluation *engine*
changed, not the total's behavior.

### 3. Laterality derived declaratively, per repeating instance

`priorTreatment` is a repeating group. The calc effect evaluates the laterality
expression against the shim and, for each prior-treatment instance the user has
actually started (`instanceHasRealAnswer` — mirrors the serializer's own
emit condition, so an empty repetition never gains a lone bodySite and no
spurious bodySite-only `Procedure` is fabricated), stores the derived `Coding`
in a dedicated `calcCodingState` channel keyed by the suffixed stateKey. At
submit this channel is merged into the typeahead codings so the hidden item
serializes as `valueCoding` under its repetition; `extractor.ts` then produces
`Procedure.bodySite` generically. The imperative default in `bundleAssembler.ts`
is removed — the loop now only wires subject/encounter/reasonReference. (The
unrelated `ShoulderDiagnosisCondition` bodySite copy stays; it is a different
element on a different resource.)

### 4. Unit tests + live verification

The SDC frontend had no test harness; `vitest` is added with pure-function tests
for both expressions, the completeness gate, dependency derivation, and the
repeating-group serialization contract. ADR-0090's lesson stands — calc bugs are
invisible to `tsc`/ESLint — so a live click-through (Constant-Murley total,
laterality-derived `Procedure.bodySite`) is part of acceptance, alongside the
cross-engine checks already done in LForms and HAPI `$extract` (ADR-0171).

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the regex, keep the bundleAssembler default | The asymmetry ADR-0171 flagged: the derivation lives in this app's imperative code, not the portable artifact; the regex still can't evaluate any new expression. |
| Encode the completeness gate declaratively in the FSH (`iif(count()=4, sum(), {})`) | Hardcodes the sub-score count, depends on empty-answer semantics, and changes the tested LForms behavior; a partial total during data entry is a presentation concern, not a data-model one — keep it a frontend display policy. |
| Fully generic dependency discovery for the gate (maximal-QR diff) | Requires synthesizing a type-correct answer for every leaf (fragile for coded/typeahead leaves) — more brittle than the two-line `linkId`-predicate reader, for no gain. |
| Remove the hidden laterality item entirely, default bodySite only in the assembler | Standard SDC engines (LForms, HAPI `$extract`) would then produce a non-conformant Procedure — the opposite of the "one mechanism" goal. |

## Consequences

- **No coverage change.** Q1.f stays Full; Q12-Constant stays Full; laterality is
  still captured once (Diagnosis) and derived. Mapping counts unchanged.
- **Frontends.** SDC frontend: real fhirpath calc engine; hidden laterality now
  evaluated natively and flows through the QR; Constant-Murley behavior unchanged.
  Unified frontend: unaffected (typed TS, no Questionnaire consumption). LHC-Forms
  experiment: unaffected (LForms evaluates calc natively — the cross-engine check).
- **Test data / thesis / mapping:** unaffected. Seed carries no
  QuestionnaireResponse and sets `Procedure.bodySite` directly; the thesis names
  only the profiles + that the SDC frontend uses `fhirpath` (now more accurate).
- **Edge case:** if the required diagnosis laterality is left blank, no bodySite is
  derived and `Procedure.bodySite 1..1` is unsatisfied — caught by the validator
  pre-flight and the field's own `required`, the same precondition the deleted
  default had.
- Completes ADR-0100's direction: no hand-rolled FHIRPath evaluators remain.
