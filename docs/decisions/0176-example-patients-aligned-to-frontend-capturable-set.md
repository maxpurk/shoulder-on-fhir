# ADR-0176: Example patients aligned to the frontend-capturable set

**Date:** 2026-08-22
**Status:** Accepted
**Relates to:** ADR-0061 (Coverage = workers-compensation flag only), ADR-0105 (prior-treatment date dropped for bucketed counts), ADR-0099 (longitudinal example patients Anna Müller / Kemal Demir)

## Context

A three-frontend gap analysis (unified, SDC, LHC-Forms) created the Anna Müller
registration through each frontend and diffed the result against her seed
bundles, with the IG as ground truth. It found a handful of elements in the seed
that **no frontend can produce** — not because they violate the IG *profiles*
(they don't), but because they sit outside the *capture surface* (the demo
Questionnaires / typed wizard):

- a statutory `ShoulderCoverage` (`PUBLICPOL`, "AOK Brandenburg") — the registry
  captures only a workers'-compensation yes/no (ADR-0061), so a non-workers'-comp
  patient emits **no** `Coverage`;
- per-comorbidity `recordedDate` (historical dates predating registration);
- free-text `Observation.note`;
- `ImagingStudy.started` (a form creates the study from modality alone, dated at
  submission).

These are cases where the hand-authored seed carried more real-world detail than
the registry is designed to collect. For a thesis whose claim is *"these patients
are created through the frontends,"* a seed patient that cannot be reproduced via
those frontends is an internal inconsistency.

## Decision

Align the structured seed of both example patients **down** to the
frontend-capturable set, so every element in a seed bundle is reproducible through
the demonstration frontends. Real-world colour beyond the capture surface is
retained in the **narrative** story markdown, not the structured bundles.

Removed from the seed:
- **Anna:** the `ShoulderCoverage` resource (she is statutory, not workers'-comp →
  no `Coverage`, matching the form); comorbidity `recordedDate`s; all
  `Observation.note`; `ImagingStudy.started`.
- **Kemal:** all `Observation.note`; `ImagingStudy.started`. His `WCBPOL` Coverage
  **stays** (workers'-compensation *is* form-reproducible), including its "BG BAU"
  payer display — the specific insurer name is narrative colour, not one of the
  analysed resource/element gaps, so it is left intact.

Kept (form-reproducible or required): patient business identifiers; prior-treatment
`performed` dates (`RotatorCuffProcedure.performed[x]` is 1..1); `Procedure.note`
(a form field, L3.H.3); the principal/secondary diagnosis `recordedDate`s (≈
registration date).

The Anna↔Kemal insurance contrast is **preserved and sharpened**: it is now
absence-of-Coverage (statutory) vs a `WCBPOL` Coverage (workers'-comp) — exactly
what the frontends produce.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the seed rich, document the extras as "profiles exceed the demo capture surface" | Legitimate, but leaves the "create these patients via the frontends" claim with un-reproducible outliers. |
| Extend the Questionnaires/frontends to capture the extras (insurer type, imaging date, obs notes) | Scope creep beyond the expert consensus (ADR-0061/ADR-0105 deliberately excluded them); adds data-collection burden for no consensus need. |
| Also default prior-treatment dates and strip the identifier | Rejected: `performed[x]` is required and the real dates are harmless/realistic; the identifier is form-settable (unified) and every patient needs one. |

## Consequences

- **No profile / Questionnaire / mapping change.** Only example data + the two
  story markdowns (narrative colour retained; now-false structural claims fixed —
  Anna's `Coverage` row and both "study date" mentions removed).
- **No coverage-metric change.** These are Layer-2/administrative or free-text
  elements, not expert-consensus `% Full` items.
- **Anna registration bundle:** 48 → 47 entries.
- Every structured element in both example patients is now reproducible through at
  least one frontend.
- **Out of scope (engine, not data):** the LHC-Forms path uses standard HAPI
  `$extract`, which `HAPI-0389 NullPointerException`s building
  `Observation.valueQuantity` from a decimal answer (ROM etc.); the *form* has the
  fields (identical Questionnaire to SDC), the standard *engine* cannot extract
  them. Not fixable by editing the seed; the custom extractor and typed wizard both
  handle it.
