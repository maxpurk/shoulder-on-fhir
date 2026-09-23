# ADR-0162: Fix `constant-score-component-sum` invariant's FHIRPath choice-type accessor

**Date:** 2026-08-15
**Status:** Accepted

## Context

A live inspection of the deployed IG's validation report (`qa.html`) surfaced a hard error repeated on every Constant-Murley
instance:

> Error in constraint 'constant-score-component-sum' … Error evaluating FHIRPath
> expression: The name 'valueQuantity' is not valid for any of the possible types:
> [http://hl7.org/fhir/StructureDefinition/Observation]

The `constant-score-component-sum` invariant on `ConstantScoreObservation`
(added to machine-enforce the "all four sub-scores present together, total = their
sum" rule the profile's Description and both frontends' UI already state) wrote its
expression using the FHIR choice-type **shorthand** `valueQuantity.value` — both at
the `Observation.value[x]` root and inside each `component.where(...).valueQuantity.value`
term.

`valueQuantity` is a FHIR-convenience suffix form for `value[x]`. The FHIR reference
runtime tolerates it in some paths, but the IG Publisher's FHIRPath **static
type-checker** rejects it: on `Observation` the element is the polymorphic `value[x]`,
so `valueQuantity` is not a statically-known child name. The net effect was that the
invariant never compiled — the constraint it was written to enforce was effectively
dead, and every Constant-Murley resource carried a spurious hard error. SUSHI does not
perform this FHIRPath type analysis, so `sushi .` reported 0 errors; only the IG
Publisher (`--genonce`) surfaced it.

## Decision

Rewrite the invariant expression in two ways, both semantics-preserving:

1. **Choice-type accessor** — replace the `valueQuantity.value` shorthand with the
   type-safe canonical form `value.ofType(Quantity).value` in all five positions (the
   root total plus the four `component.where(...)` sub-score terms). This is the form
   FHIR core's own value-choice invariants use.
2. **Coding-match accessor** — replace each `component.where(code.coding.code = 'X')`
   discriminator with `component.where(code.coding.where(code = 'X').exists())`. Fixing
   #1 un-masked a second, pre-existing issue: with the expression now compiling past the
   `valueQuantity` error, the IG Publisher's FHIRPath type-checker surfaced four warnings
   that `code.coding.code = 'X'` compares an inherently-multi-cardinality collection
   (`Coding` is `0..*`) against a singleton string with `=`, which "may fail or return
   false if there is more than one item." Moving the equality inside
   `code.coding.where(code = 'X')` makes it a singleton-to-singleton comparison
   (`Coding.code` is `0..1`), which is warning-free.

No profile structure, cardinality, binding, code, or component slice changes.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep `valueQuantity` shorthand | Rejected by the IG Publisher's FHIRPath static type-checker; leaves the constraint uncompiled and a hard error on every instance |
| `(value as Quantity).value` | Equivalent and valid, but `.ofType(Quantity)` is the form FHIR core invariants use and reads consistently with `component.where(...).value.ofType(Quantity)` |
| Drop the invariant entirely | The sum/all-four-together rule is a real data-integrity guarantee for third-party submissions that bypass both frontends' UI; deleting it would remove the only validator-level enforcement |

## Consequences

✅ The invariant now compiles; the hard error clears from `qa.html` and the constraint actually enforces the total = sum-of-four rule at validation time.
✅ The four collection-comparison warnings the choice-type fix un-masked are also cleared, so the constraint contributes zero errors and zero warnings to the IG build.
✅ `package.tgz` regenerated with the corrected `StructureDefinition`, so downstream validators consuming the IG get the working constraint.
✅ All 39 example + seed bundles pass `tools/validate.sh` (0 failures) with the live constraint — confirmed on the deployment server build.
⚠️ Any Constant-Murley instance that was silently non-conformant to the sum rule (total ≠ sum of its four components) will now fail validation as intended — the IG's own examples/seed bundles are internally consistent (verified).

## Sources

- git commit `e1ee781` — "Fix constant-score-component-sum invariant FHIRPath choice-type accessor"
- `ig/input/fsh/profiles/observations/ConstantScoreObservation.fsh` line 101 (Invariant `Expression`)
- IG Publisher `qa.html` on the deployed demo server (pre-fix: 100 errors incl. this constraint)
- ADR-0090 — Constant-Murley `Observation.component[]` sub-scores (the components this invariant relates)
