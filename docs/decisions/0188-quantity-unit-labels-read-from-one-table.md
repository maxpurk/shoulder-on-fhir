# ADR-0188: One display label per quantitative Observation in the unified frontend, seed data, and examples

**Date:** 2026-09-12
**Status:** Accepted
**Found via:** the same live-data diff as ADR-0186 and ADR-0187. Comparing
`valueQuantity` across a frontend-produced patient and the seeded reference
patients showed four profiles where the human-readable `unit` differed, including
one where two flows of the same frontend disagreed with each other.

## Context

`Quantity` carries both a machine-readable `code` (UCUM, in `system`) and a
human-readable `unit`. Only `code` is constrained by any profile here, so `unit`
is free text and no divergence in it is a validation error. It is, however, what
a consumer renders.

The unified frontend keeps a `unitDisplay` table beside the UCUM code in
`observationMetadata.ts` and `followupObservationMetadata.ts`, and
`observationBuilder.ts` reads it (`unitDisplay ?? unit`). Three places bypassed
the table and hard-coded the string instead: `StepClinicalAssessment.tsx` wrote
`kg` for the supraspinatus dynamometry where the table says `kilograms`, so the
same profile came out labelled `kg` from registration and `kilograms` from
follow-up for one patient. The seeded reference bundles and two of the guide's own
examples carried `score` for the Constant-Murley total, its four sub-score
components, and the average-pain axis, where the frontends emit `points` and
`pain score`.

Nothing was wrong in the UCUM codes; `{score}`, `kg`, `deg`, `%`, `cm` were
correct and identical on both sides throughout. The divergence was confined to
the label.

## Decision

Within the unified frontend, the `unitDisplay` table is the single source for the
label, and every producer reads it rather than restating it. Seed data and the
guide's own examples are aligned to the same labels.

- `StepClinicalAssessment.tsx` emits `kilograms`, matching the table and the
  follow-up flow.
- Seed bundles: Constant-Murley total and components `score` → `points`;
  average pain `score` → `pain score`. Twelve of the fourteen bundles touched.
- The guide's own examples in `RotatorCuffRegistrationBundle.fsh` and
  `RotatorCuffFollowUpBundle.fsh` follow the same labels.

Deliberately **not** in scope: the SDC frontend, which emits no `unit` at all on
any quantitative Observation. That is a wider parity gap with its own root cause
in `extractor.ts`'s generic `buildValue()` Quantity branch, already logged as
limitation 0020's sibling `docs/limitations_items/0012-...`. Closing it properly
means one table both frontends read, which the `shared/` codegen mechanism
(ADR-0157) is the right home for; keyed by Observation code rather than by UCUM
code, because `{score}` legitimately renders as `points`, `MMT grade`, or
`pain score` depending on which measurement carries it. That refactor touches
every consumer of `unitDisplay` in the unified frontend and is not taken on here.
Until it is, "one label per measurement" holds for the unified frontend, the seed
bundles, and the examples, and the SDC frontend carries none.

No profile change. Fixing `unit` to a literal in the FSH would make a legal
`Quantity` invalid over a rendering detail, and would have to be repeated on every
quantitative profile; the label belongs to the producer, and the producer already
has a table for it.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Fix `unit` by pattern in each profile | Turns a display string into a conformance surface. A third-party submission with a correct UCUM code and a different label would fail validation for no interoperability reason. |
| Drop `unit` and emit only `code` | Legal, and `code` is what machines read, but it pushes UCUM-annotation decoding (`{score}`, `deg`) onto every consumer's renderer for no gain. |
| Leave it alone as cosmetic | The intra-application case is not cosmetic: one profile rendering two labels in one patient's record reads as two different measurements. |
| Fix the SDC frontend in the same pass, giving both frontends one shared table | The correct end state, and the shape is already known (see the Decision). It is a refactor across every `unitDisplay` consumer in the unified frontend, which is disproportionate risk for a display string at this point; deferred to the existing limitation rather than half-done. |

## Classification (Clinical Feedback Integration Workflow)

**(a) Refinement.** The consensus names the measurements and, for the
Constant-Murley score, the sub-score structure; it says nothing about display
labels. No mapping row, count, or binding is affected.

## Verification

- `sushi .` — 0 errors, 0 warnings.
- `npx tsc --noEmit` clean on both frontends.
- Inventoried every `valueQuantity` in the seed bundles by profile: after the
  change, all 26 quantitative profiles carry one label each, and each matches the
  frontends' table.

## Consequences

✅ A given profile renders one label wherever its data came from.
✅ Seed data, IG examples, and unified-frontend output agree, so a diff between
them surfaces real differences instead of this noise.
⚠️ The label stays unconstrained, so a third-party submitter can still pick its
own. That is the correct tradeoff for a display string.
⚠️ The unified and SDC frontends still differ here, because the SDC frontend emits
no `unit`. A cross-frontend diff of the same data point will show it, and the
existing limitation entry remains the record.

## Sources

- `frontend/src/components/wizard/StepClinicalAssessment.tsx`,
  `frontend/src/config/observationMetadata.ts`,
  `frontend/src/config/followupObservationMetadata.ts`,
  `frontend/src/lib/observationBuilder.ts`.
- `seed/bundles/{anna-mueller,kemal-demir}/*.json`.
- `ig/input/fsh/examples/RotatorCuffRegistrationBundle.fsh`,
  `ig/input/fsh/examples/RotatorCuffFollowUpBundle.fsh`.
- ADR-0183 — the SSV/SANE UCUM `%` migration, the prior unit decision.
- ADR-0157 — the `shared/` codegen mechanism a future one-table fix would use.
- `docs/limitations_items/0012-sdc-quantity-observations-omit-unit-display/` —
  the open SDC-side gap this ADR does not close.
