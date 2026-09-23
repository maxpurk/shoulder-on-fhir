# ADR-0154: First FHIR invariant in the IG — Constant-Murley component-sum check

**Date:** 2026-08-05
**Status:** Accepted
**Found via:** comparative architecture review logged 2026-07-31 in `docs/limitations_items/` ("Zero FHIR invariants (`Invariant`/`obeys`) across all ~90 profiles") — a `grep -rl "^Invariant:\|obeys" ig/input/fsh/` sweep at the time returned zero hits, confirmed still zero when picked up now.

## Context

Peer IGs (US Core, IPS, mCODE) all define at least a handful of targeted FHIRPath invariants (`Invariant:`/`obeys` in FSH) on their highest-value profiles, catching cross-field consistency violations that no `value[x]`/binding constraint alone can express. This IG had none — every cross-field rule (e.g. "the Constant-Murley total must equal the sum of its four sub-scores when all four are present") was enforced only in prose (the profile's own `Description:` text) and in application code (`ADR-0113`/`ADR-0118`'s frontend gating logic), never as a machine-checkable constraint on the `StructureDefinition` itself. Any FHIR client that isn't one of this project's own two frontends — a validator run against a third-party submission, a future data-quality audit tool — could not catch this specific consistency violation from the profile alone.

`ConstantScoreObservation`'s own Description already states the rule in prose: "All four are required together when this mode is used, to avoid a partial sum silently masquerading as a real total." This is the single most concrete, well-understood candidate named in the original limitations-log entry ("a small, high-value set of invariants... could be added incrementally without a redesign") — picked as the first one to implement, not an attempt to close the broader "zero invariants" finding in one pass.

## Decision

Add one invariant, `constant-score-component-sum`, to `ConstantScoreObservation` (`^version` 0.2.0 → 0.3.0):

```
component.empty() or (component.count() = 4 and valueQuantity.value = component.where(code.coding.code = 'constant-score-pain').valueQuantity.value + component.where(code.coding.code = 'constant-score-adl').valueQuantity.value + component.where(code.coding.code = 'constant-score-rom').valueQuantity.value + component.where(code.coding.code = 'constant-score-strength').valueQuantity.value)
```

Severity `#error`. Semantics: direct-total entry mode (no `component[]`) is untouched (`component.empty()` short-circuits true); component-derived entry mode requires all four named sub-scores present (`component.count() = 4`) and the total to equal their exact sum.

Explicit per-component `.where(code.coding.code = '...')` summation, not a `sum()`/`aggregate()` built-in — a first implementation attempt used `component.valueQuantity.value.sum()` and failed at validator load time with `The name sum is not a known function name`. FHIRPath as implemented by this validator (6.9.7) has no `sum()`; `aggregate()` was not tried as a second option once the explicit-filter form was confirmed working, since it's more portable across FHIRPath engine versions and self-documents which four codes are expected.

## Verification

Local, offline (`-tx n/a`, no server-side/network dependency — safe per this project's own TX-testing policy):

1. `sushi .` — 0 errors/0 warnings; compiled `StructureDefinition-constant-score-observation.json` confirmed carrying the constraint (`differential.element[Observation].constraint`).
2. Isolated direct validator run (`java -jar tools/validator_cli.jar`, not through the full seed-bundle pipeline) against two hand-extracted single-resource instances: (a) Anna Müller's real registration `ConstantScoreObservation` (total 38, components [4, 4, 20, 10], genuinely summing to 38) — 0 errors, only expected offline-mode UCUM/terminology warnings; (b) the same resource with `valueQuantity.value` forced to 999 — correctly failed with `error - Constraint failed: constant-score-component-sum: ...` (plus an unrelated, also-correct `maxValueQuantity` violation, since 999 also exceeds the existing 0–100 bound).
3. Cross-checked all 4 real component-derived `ConstantScoreObservation` instances across both longitudinal seed patients (Anna Müller registration + 12mo follow-up, Kemal Demir registration + 12mo follow-up) by hand: every one's stated total already equals its four components' sum, so this invariant introduces zero new validation failures against existing seed data.

Not yet re-verified against the full seed-bundle pipeline or live the deployment server `validator-service` — a `SocketTimeoutException` unrelated to this invariant (reproduced identically before this invariant existed, tied to some other aspect of the full `anna_mueller_01_registration.json` bundle specifically, not general to every file — a different seed file validated cleanly offline in the same session) blocked a full-bundle local run; isolating the invariant to a single-resource instance (step 2 above) was used instead to get a clean signal. Flagged for the next live the deployment server `--validate` pass rather than chased further locally, consistent with this project's "TX-dependent testing runs on the deployment server, not locally" policy (ADR-0080) — logged as a fresh, separate observation in `docs/limitations_items/`.

## Side finding, fixed in the same pass

While building the isolated test case, discovered that `ConstantScoreObservation.fsh`'s own comment describing the four components' `minValueQuantity`/`maxValueQuantity` extensions as "UI-hint extensions... not validator-enforced hard constraints" was **incorrect** — the isolated broken-instance test above hit exactly this bound (999 > max 100) and the validator raised a hard `error`, not a warning. Comment corrected in place to state the bounds are real, validator-enforced constraints (standard FHIR `minValueQuantity`/`maxValueQuantity` extensions, checked by the core validator regardless of terminology-server availability). No `.fsh` structural change — documentation-accuracy fix only, caught as a direct byproduct of testing this ADR's invariant, not a separate investigation.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| `component.valueQuantity.value.sum()` | Rejected — not a recognized FHIRPath function in this validator's engine (`6.9.7`), confirmed by a failing trial run (`The name sum is not a known function name`). |
| `component.valueQuantity.value.aggregate($this + $total, 0)` | Not tried — once the explicit `.where(code=...)` form was confirmed working, there was no reason to introduce a second, less-tested mechanism; the explicit form is also more self-documenting (names all four expected codes directly in the expression). |
| Add several invariants in one pass (component-sum + Condition category/dueTo exclusivity + status/effective[x] presence, all three named in the original limitations-log entry) | Rejected for this pass — the other two candidates need their own design work (a precise "exclusivity" rule between `RotatorCuffCondition`/`ShoulderDiagnosisCondition` was never concretely specified, and an effective[x]-presence check needs confirming `ShoulderObservation` doesn't already require it unconditionally) that risks introducing a wrong or redundant constraint under time pressure. One well-verified invariant beats three rushed ones; the "zero invariants" finding remains a valid Future Work item for the rest. |
| Leave the "zero invariants" gap fully open, defer entirely | Rejected — the original log entry explicitly named this as incrementally addable "without a redesign," and this one had a ready-made, already-stated-in-prose rule to formalize. |

## Classification (Clinical Feedback Integration Workflow)

**(c) IG-operational addition.** A machine-checkable formalization of a rule the profile's own Description and both frontends' application code already state/enforce — no new data-collection burden, no SECEC/coverage-count impact.

## Consequences

✅ The IG now has a non-zero, real, tested FHIR invariant — closes the zero-invariants finding to a genuine first increment rather than leaving it purely theoretical.
✅ A third-party client submitting directly against this profile (bypassing both frontends' own UI-level gating) now gets the same "no partial sums" protection those frontends already provide, at the conformance-artifact level.
✅ Corrected a real, previously-wrong claim about `minValueQuantity`/`maxValueQuantity` enforcement in the same profile, found as a direct byproduct of this work.
⚠️ The broader "zero invariants across ~90 profiles" finding is not closed — this is one invariant on one profile; the other two originally-named candidates (Condition category/dueTo exclusivity, status/effective[x] presence) remain open Future Work, now with a concrete worked example (this ADR) to follow for FHIRPath-portability pitfalls (no `sum()`/possibly-unsupported `aggregate()`).
⚠️ Not yet re-verified end-to-end against a live server deploy/`tools/validate.sh` full run — isolated single-resource testing was used instead after an unrelated pre-existing timeout blocked the full local seed-bundle run. Next live `--validate` pass should confirm the full seed bundles (which do contain component-derived `ConstantScoreObservation` instances) still pass end-to-end.

## Sources

- `docs/limitations_items/` — "Zero FHIR invariants" entry, the finding this ADR partially closes.
- ADR-0090 — original `component[]` sub-score design this invariant formalizes.
- ADR-0113, ADR-0118 — the frontend-side "all four required together, no partial sum" enforcement this invariant now mirrors at the IG level.
- `ig/input/fsh/profiles/observations/ConstantScoreObservation.fsh` — the invariant definition and corrected comment.
- `seed/bundles/{anna-mueller,kemal-demir}/*.json` — real component-derived instances used for both the sum-correctness spot-check and the isolated validator test.
- ADR-0080 — the local-VPN/TX-testing policy this ADR's "not yet server-verified" caveat follows.
