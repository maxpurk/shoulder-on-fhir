# ADR-0151: `CarePlan.activity.detail.code` discriminates the 5 Q11 timepoints — no out-of-band `outcomeReference` update

**Date:** 2026-08-04
**Status:** Accepted

## Context

the field-level cross-frontend comparison (2026-08-04) found that the Q11 follow-up timepoint (6 weeks / 3 months /
6 months / 1 year / 2 years) has no structured, queryable FHIR representation anywhere: the
`RotatorCuffResearchCarePlan`'s 5 `activity` entries are distinguished only by a free-text
`description` ("Q11 research follow-up — 6 wk post-surgery") and a computed `scheduledTiming`
date; nothing ties a completed Follow-Up `Encounter` back to the specific planned activity it
fulfilled. A registry consumer wanting "which timepoints has this patient completed" today has
to parse description strings or infer it from `Encounter.id` naming conventions (the seed data's
own workaround, e.g. `anna-mueller-encounter-fu-6wk`).

An initial proposal considered closing this with **`CarePlan.activity.outcomeReference`** (the
FHIR-standard "Appointment, Encounter, Procedure, etc. that resulted from this activity" element)
— populated via a standalone PUT to the already-submitted `CarePlan` at Follow-Up submission
time, once the resulting `Encounter` exists. **Rejected on user instruction** after re-checking
this project's own ADR history: `ADR-0129`'s own Alternatives Considered table explicitly
rejected "keep the [CarePlan] slice on `RotatorCuffRegistrationBundle`, populate it later
out-of-band (like the existing `Condition.clinicalStatus` update pattern, ADR-0093)"; separately,
`ADR-0109` deleted that exact `Condition.clinicalStatus` standalone-PUT pattern entirely, per
explicit user decision ("Update condition status, does it make sense? Delete that here"). Adding
a new standalone PUT to `CarePlan` at Follow-Up time would repeat a pattern this project has
already considered and rejected twice, even though the target field
(`outcomeReference`, semantically designed for after-the-fact population) is not the same
element `ADR-0129`/`ADR-0109` were about.

## Decision

Add **`CarePlan.activity.detail.code`** only — a discriminator set once, at `CarePlan`-creation
time, inside the same transaction that already builds the other 4 activity fields
(`status`/`scheduledTiming`/`description`), by both frontends' existing auto-generator
(`buildResearchCarePlan`, ADR-0129). No out-of-band mutation of an already-submitted resource is
involved.

New local `Q11Timepoint` CodeSystem + ValueSet (`ig/input/fsh/codesystems/Q11Timepoint.fsh`,
`valuesets/Q11Timepoint.fsh`) — 5 codes (`6-weeks`/`3-months`/`6-months`/`1-year`/`2-years`)
matching Hurley's own Q11.a–e lettering. `RotatorCuffResearchCarePlan.fsh` gains
`activity.detail.code MS`, required-bound to `Q11Timepoint` (profile `0.2.0` → `0.3.0`).

Both frontends' `Q11_TIMEPOINTS` constant (`frontend/src/lib/patientStage.ts`,
`sdc-frontend/src/lib/bundleAssembler.ts`) gained a `code` field alongside the existing
`label`/`days`, threaded through to `activity.detail.code` in each `buildResearchCarePlan`. Both
seed patients' surgery-bundle `CarePlan`s gained the matching code on each of their 5 activities.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| `CarePlan.activity.outcomeReference`, populated via out-of-band PUT at Follow-Up submission | Repeats the standalone-resource-mutation pattern `ADR-0129` explicitly rejected as an alternative and `ADR-0109` separately deleted for `Condition.clinicalStatus` — a real, twice-established project precedent against this shape of change, independent of whether `outcomeReference`'s semantics happen to fit. |
| `Encounter.basedOn → CarePlan` (pointing the Follow-Up `Encounter` at the whole `CarePlan`, not a specific activity) | Weaker than a `code` discriminator — identifies "this visit is part of the plan" but not "which of the 5 timepoints", the actual ambiguity being closed. |
| Leave as a `docs/limitations_items/` item, change nothing | Considered; rejected once the lighter `activity.detail.code`-only version was identified as achievable without the out-of-band-update problem — a real, low-risk improvement was available, not just a documented gap. |
| A new extension for the timepoint code instead of reusing `activity.detail.code` | `CarePlan.activity.detail.code` is already a base-FHIR `0..1 CodeableConcept` element with exactly this purpose (per its own R4 definition: "Detailed description of the type of planned activity"); no extension needed — best-interoperability-practice preference for base elements over custom extensions. |

## Classification (Clinical Feedback Integration Workflow)

**(c) IG-operational addition.** `L3.G.4` (`RotatorCuffResearchCarePlan` profile) already exists
and is `Full`; this refines its internal structure to close a real gap between "the profile
exists" and "the timepoint identity is actually queryable" — not a new Hurley-named element, no
`% Full`/`% Partial` impact.

## Consequences

✅ Each of the 5 Q11 activities is now discriminable by a real coded value, not only free text —
"find all patients with a completed/scheduled 3-month activity" becomes a real query.
✅ No out-of-band mutation of an already-submitted `CarePlan` — avoids repeating the pattern this
project rejected twice (ADR-0129, ADR-0109).
✅ `sushi .` compiles clean (0 errors/warnings) after the profile + CS/VS additions; both
frontends' `npm run build`/`npm run lint` clean.
⚠️ **Not fully closed**: a completed Follow-Up `Encounter` still isn't linked back to its specific
`CarePlan.activity` (the `outcomeReference` half of the original proposal, deliberately dropped).
"Which timepoints has this patient completed" still requires cross-referencing `Encounter`s
against the `CarePlan`'s scheduled dates (via `patientStage.ts`'s existing `computeTimepoints`
tolerance-window matching) rather than reading a direct FHIR reference. Logged as a residual
`docs/limitations_items/` candidate if a future need for a direct link arises — but not via a
standalone PUT, per the rejected-pattern reasoning above; a future fix would need to find a way
to set it within an existing transaction instead (e.g. if `RotatorCuffFollowUpBundle` ever gains
its own write-path to the `CarePlan` as part of the same submission).

## Sources

- the field-level cross-frontend comparison (2026-08-04) — the field-level audit that surfaced this gap.
- ADR-0129 (`RotatorCuffResearchCarePlan` moved to Surgery bundle, auto-generated) — its own
  Alternatives Considered table is the precedent this ADR declines to repeat.
- ADR-0109 (Condition-status-update removed) — the second, independent precedent against
  standalone out-of-band resource updates in this codebase.
- `ig/input/fsh/codesystems/Q11Timepoint.fsh`, `valuesets/Q11Timepoint.fsh`,
  `ig/input/fsh/profiles/RotatorCuffResearchCarePlan.fsh`.
- `frontend/src/lib/patientStage.ts`, `frontend/src/components/SurgeryWizard.tsx`.
- `sdc-frontend/src/lib/bundleAssembler.ts`.
- `seed/bundles/anna-mueller/anna_mueller_02_surgery.json`, `seed/bundles/kemal-demir/kemal_demir_02_surgery.json`.
- Hurley et al. (2024), A11 — the 5 named timepoints this discriminator encodes.
