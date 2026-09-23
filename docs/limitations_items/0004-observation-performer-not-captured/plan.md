# No Practitioner/performer concept on Observations; "surgeon/performer" exists only as a free-text display string on Surgery Procedures

> **Status:** Limitation — open, needs clarification on scope before any fix. Logged 2026-08-06,
> surfaced by the FHIR Validator's repeated `Best Practice Recommendation: In general, all
> observations should have a performer` warning — every one of the 51 Observations in a live
> registration submission triggered it.

## Gap

The IG has no `Practitioner` resource anywhere in its data model. The only place "who performed
this" is captured at all is a free-text `performerName` string (`sdc-frontend/src/lib/extractor.ts`
line 598, `encounter.performer` loose leaf) wired to `Procedure.performer.actor.display`
(`bundleAssembler.ts` line 478) — Surgery-only, one name per surgical event, applied uniformly to
every Procedure in that bundle. `RotatorCuffProcedure.performer` is `MS` (Must Support) but only
this one SDC-frontend path ever populates it; the unified frontend's Surgery flow doesn't appear
to set it either (not verified in this pass). Every Observation across all three flows —
Registration exam findings, ROM, strength, provocation tests, pain scores, PROMs, imaging
classifications, Follow-Up exam — has no `performer` at all, and `ShoulderObservation` doesn't
constrain the base FHIR `Observation.performer` element in either direction.

## Why it matters

Clinically, who made a finding matters — an attending surgeon's provocation-test read carries
different weight than a resident's or a physical therapist's, and a registry meant to support
outcomes research arguably needs to distinguish that. Right now there's no way to answer "who
recorded this ROM measurement" for any Observation in the system, and even the one place a
clinician name is captured (Surgery's `performerName`) is a bare display string, not a reference
to a real `Practitioner`/`PractitionerRole` resource — so it can't be queried, deduplicated, or
used to compare inter-rater variability across the registry.

## Note

Flagged for clarification, not scoped yet — needs a decision (per the Clinical Feedback
Integration Workflow's (a)/(b)/(c)/(d) classification) on: whether this is in-consensus at all
(Hurley's Delphi elements don't appear to name a "performer/examiner" axis — needs checking
against `SECEC_FHIR_Mapping.csv`), whether a full `Practitioner` resource + reference is
warranted or a lighter display-string convention (matching the existing Surgery pattern) is
enough, and whether it should apply per-Observation, per-Encounter, or stay Surgery-only. Not
implemented here.
