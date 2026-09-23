# ADR-0187: `ShoulderImagingStudy` carries the visit anchor

**Date:** 2026-09-12
**Status:** Accepted
**Found via:** the same live-data diff as ADR-0186 — reading a
frontend-produced patient back with `Patient/{id}/$everything` and comparing it
element path by element path against the seeded reference patients. The
registration study came back with no `encounter`; the follow-up study from the
same patient had one.

## Context

ADR-0184 constrained the visit anchor on `ShoulderObservation` and
`RotatorCuffProcedure` after finding that all three bundle profiles asserted it
in prose only. `ImagingStudy` was not part of that sweep, and the element was
left as base R4 leaves it.

Both frontends then behaved differently in the two flows. The follow-up flow
wired `encounter` to the visit, with a comment giving the reason: a patient has
several follow-up visits, so the study has to say which one it belongs to. The
registration flow omitted it, on the reasoning that a pre-operative study
"stands on its own."

That reasoning does not survive contact with the persisted record. It is true
that a patient has exactly one registration encounter, so within the
registration bundle the link is inferable. But a consumer does not read the
registration bundle; it reads a patient's resources. `ImagingStudy?subject=` on
a patient partway through the Q11 follow-up schedule returns the pre-operative
study alongside every follow-up re-imaging study, and only the follow-up ones
say which visit they belong to. The pre-operative one is left to be matched by
`started` against a visit date — an inference that is already fragile (a
registration consultation and its imaging need not share a date, and ADR-0172
made `started` reuse the registration date rather than a separate imaging date,
so the value is a visit date, not an acquisition date) and that has no answer at
all once two visits fall on one day.

The asymmetry also meant the two flows disagreed about the same element for no
stated reason, which is the kind of divergence that reads as an oversight rather
than a decision — and on inspection, was one.

## Decision

`ShoulderImagingStudy` constrains `encounter 0..1 MS` and
`only Reference(ShoulderEncounter)`, and both frontends set it in the
registration flow as they already did in the follow-up flow.

`0..1` rather than `1..1`, unlike the `1..1` ADR-0184 applied to Observations and
Procedures. An Observation or a Procedure in this registry is always produced at
a visit, so requiring the anchor is honest. An imaging study is not: a patient
can arrive with an outside radiograph taken before any contact with the
registry, which has no `ShoulderEncounter` to point at. Requiring the anchor
would force either a fabricated encounter or the loss of a real study.

The seeded registration bundles and the guide's own registration example gain
the reference. Both were consistent with the old frontend behaviour and are now
consistent with the new.

No new mapping row. The link is documented on the imaging rows the consensus
already names (Q3, Q6) rather than as a Layer 2 row of its own, the same
treatment other cross-resource references receive. Layer 2 stays at 43.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Leave it optional and undeclared, keep inferring from `started` | The inference is unsound the moment two visits share a date, and `started` is a visit date rather than an acquisition date (ADR-0172), so it was never really an imaging timestamp to match on. |
| `encounter 1..1`, matching ADR-0184's treatment of Observations and Procedures | Would make an outside study taken before registration unrecordable without inventing an encounter for it. The asymmetry with Observations and Procedures is deliberate and reflects a real difference: those are always produced at a visit, an imaging study is not. |
| Drop `encounter` from the follow-up flow instead, making both flows consistent the other way | Would remove information that is already correct and is needed more in the follow-up case, where several studies per patient exist. Consistency is worth having in the direction that keeps the data. |
| Add a local "imaging timepoint" coded element instead of a reference | Reinvents the encounter link as an enumeration, duplicating a fact the referenced `ShoulderEncounter` already states through its `type` and `period`. |

## Classification (Clinical Feedback Integration Workflow)

**(c) IG-operational addition.** The consensus names which imaging to obtain and
when (Q3, Q5, Q6, Q13); it says nothing about how a study is tied to the visit
that produced it. Layer 2 scaffolding, no effect on the 58-element denominator or
on representability.

## Verification

- `sushi .` — 0 errors, 0 warnings.
- `npx tsc --noEmit` clean on both frontends.
- Seed registration bundles for both reference patients updated; the guide's
  registration example (`AnnaPreOpMri`) now references
  `AnnaRegistrationEncounter`.
- End-to-end: re-entered registration through both frontends against a rebuilt
  server and confirmed via `Patient/{id}/$everything` that the pre-operative
  study resolves to the registration encounter.

## Consequences

✅ Every imaging study a registry flow produces says which visit it belongs to,
so pre-operative and follow-up imaging are separable by query rather than by
date arithmetic.
✅ The two flows in both frontends now treat the element the same way.
✅ The optional cardinality keeps an outside pre-registration study recordable.
⚠️ Studies submitted before this change carry no anchor; for those, the
`started`-versus-visit-date inference remains the only option. The seeded
patients are rebuilt from source and so are unaffected.

## Sources

- `ig/input/fsh/profiles/ShoulderImagingStudy.fsh` — `encounter 0..1 MS`.
- `frontend/src/components/wizard/StepImaging.tsx` — unified frontend.
- `sdc-frontend/src/lib/bundleAssembler.ts` — SDC frontend.
- `seed/bundles/{anna-mueller,kemal-demir}/*_01_registration.json`,
  `ig/input/fsh/examples/RotatorCuffRegistrationBundle.fsh` — example data.
- ADR-0184 — the visit-anchor sweep over Observations and Procedures this
  extends, and whose `1..1` this deliberately does not copy.
- ADR-0172 — `started` reuses the visit date, which is why matching on it is not
  a sound substitute.
- ADR-0130, ADR-0155, ADR-0153 — the imaging element and the per-modality and
  follow-up re-imaging studies.
