# Back-link a completed Follow-Up `Encounter` to the `RotatorCuffResearchCarePlan.activity` it fulfilled

> **Status:** Future work item — deliberate deferral, not a defect.

## Gap

ADR-0151 (2026-08-04) added `CarePlan.activity.detail.code` (new local `Q11Timepoint` CS/VS) so the
5 *planned* research follow-up timepoints (6wk / 3mo / 6mo / 1y / 2y) are coded and queryable rather
than only free-text-described. It deliberately stopped short of tying a *completed* Follow-Up
`Encounter` back to the specific planned activity it fulfilled: nothing links the submitted visit to
its `CarePlan.activity`. A consumer asking "which timepoints has this patient actually completed"
must still infer it from `Encounter.id` naming conventions (the seed data's own workaround, e.g.
`anna-mueller-encounter-fu-6wk`) or from `Observation.effectiveDateTime` proximity to a scheduled
date. Confirmed still open in the current tree: no `basedOn` / `partOf` / `outcomeReference` wiring
from Follow-Up Encounter to CarePlan activity in either `frontend/src/lib/followUpBundleBuilder.ts`
or `sdc-frontend/src/lib/bundleAssembler.ts`, and no ADR after 0151 revisits it.

## Why it matters

`CarePlan.activity.outcomeReference` is the FHIR-standard element for "the Encounter/Procedure that
resulted from this activity"; populating it would make follow-up completion a first-class,
queryable relationship instead of a naming-convention inference — the natural next increment on
ADR-0151's coded-schedule work.

**Confirmed against Hurley et al. 2024 (Q11/A11, read in full 2026-08-15):** the paper asks only
*when* to follow up ("at a) 6 weeks, b) 3 months, c) 6 months, d) 1 year, and e) 2 years") — a
schedule recommendation. It does not request any data element recording *which* scheduled
checkpoint a completed visit fulfilled, nor a machine-readable visit→activity link. Q11 is
therefore already Full purely on the generated 5-activity schedule; this back-link is an
above-consensus queryability enrichment, which is why it belongs in future work rather than being
a limitation of consensus coverage.

## Note

Filed as **future work**, not a limitation, because ADR-0151 explicitly *considered and rejected*
closing it, on user instruction: the only mechanism available (a standalone out-of-band PUT to the
already-submitted `CarePlan` at Follow-Up time) repeats a pattern this project has twice rejected —
ADR-0129's Alternatives-Considered table rejected out-of-band CarePlan population, and ADR-0109
deleted the analogous standalone `Condition.clinicalStatus` PUT ("does it make sense? Delete that
here"). Reopening this means either accepting that out-of-band-PUT pattern after all, or finding a
way to carry the fulfilled-activity link inside the Follow-Up transaction bundle itself (the bundle
does not currently contain the CarePlan, which is created once in the Surgery bundle). Needs an
explicit decision on which, before any implementation.

## Related limitations

- The `carePlan` entry slice on `RotatorCuffSurgeryBundle` is in place, so that part of the rebuild
  cost is already paid. This item remains a profile and wiring change to the same CarePlan, and
  `activity` is now sliced on the timepoint code, which gives each timepoint an element id a
  back-link could name.
