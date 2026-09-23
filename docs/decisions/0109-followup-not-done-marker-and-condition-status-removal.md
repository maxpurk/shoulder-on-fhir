# ADR-0109: Follow-up "not applicable/not possible" marker, submission-requirement review, and Condition-status-update removal (round-2 surgeon feedback, point 15)

**Date:** 2026-07-27
**Status:** Accepted

## Context

The final point of the round-2 surgeon feedback ( see ADR-0105/0106/0107/0108 for the earlier points) covered four "watch out" items on the Follow-Up flow:

**(a)** "some tests are not allowed immediately after surgery: add a selection option (like not applicable, not possible)."

**(b)** "Why do you need at least one observation when submitting the follow up?"

**(c)** "Update condition status, does it make sense? Delete that here."

**(d)** "When submitting, we have an issue. There is a bug" — no error message, repro steps, or screenshot provided.

## Decision

**(a) Not applicable / not possible marker.** Added a `{ kind: 'not-done' }` variant to `ObservationField.tsx`'s `FieldValue` union, surfaced as a checkbox ("Not applicable / not possible (e.g. contraindicated this soon after surgery)") that disables the normal input when checked. Scoped to the post-op exam groups a clinician might genuinely be unable to perform this soon after surgery — ROM (active/passive), strength, provocation tests — not visual inspection (always safely observable) or patient-reported PROMs (not physically constrained by surgical timing).

Built via a new `buildNotDoneObservation()` in `observationBuilder.ts`: `status` stays `'final'` (the assessment attempt concluded, just with no measurable result) and `Observation.dataAbsentReason = #not-performed` ("the observation procedure was not performed") explains the missing `value[x]`. **Correction of an earlier research assumption:** this ADR's research phase initially proposed `Observation.status = #not-done`, but live verification against the local `hl7.fhir.r4.core#4.0.1` package's `CodeSystem-observation-status.json` confirmed FHIR R4's `observation-status` ValueSet has no `not-done` code at all (`registered | preliminary | final | amended | cancelled | entered-in-error | unknown`) — that code exists on `Procedure.status`, not `Observation.status`. `dataAbsentReason` (verified via `CodeSystem-data-absent-reason.json`, which does define `not-performed`: "The value is not available because the observation procedure (test, etc.) was not performed") is the correct base-FHIR mechanism instead. No FSH/profile change was needed — `ShoulderObservation`'s `value[x] MS` already inherits base `Observation`'s `0..1` cardinality, and `dataAbsentReason` is unconstrained (available) on every derived profile already.

**(b) ≥1 Observation requirement — kept as-is, no change.** Traced to `RotatorCuffFollowUpBundle.fsh`'s `entry[observation] 1..*` cardinality, established by ADR-0030 specifically to prevent half-submitted visits from passing per-resource validation while carrying no clinical content. This is a genuine FHIR-conformance requirement, not an arbitrary frontend gate — the frontend's `canReview` pre-check merely surfaces the same constraint earlier, with a clearer message, than a validator-sidecar rejection at Review would. Decision (a) above is itself the correct answer to the surgeon's underlying concern: a visit where every test is "not applicable" now still produces `dataAbsentReason`-marked Observations, which count toward the `1..*` minimum — a genuinely observation-free visit was never really "no findings," it was "no findings recorded," and (a) makes that explicit and analyzable instead of silently absent.

**(c) Condition-status update — removed entirely.** `ReviewSubmit.tsx`'s "Update Condition Status" block (added six days earlier by ADR-0093 — a standalone `PUT Condition/{id}` outside the follow-up bundle transaction, letting a clinician set `clinicalStatus` to `recurrence`/`resolved` at a follow-up visit) is deleted per explicit user decision. Nothing else in the codebase read this back (no seed bundle, no example-data story, no other frontend component), so removal is a clean, low-risk revert of a very recent addition — `recurrence`/`resolved` become unreachable post-registration again, the same state as before ADR-0093 existed. `conditionId`/`currentClinicalStatus` props threaded through `FollowUpWizard.tsx` → `ReviewSubmit.tsx` for this feature are removed along with it.

**(d) Submission bug — not fixed, insufficient information.** A full review of the submission code path (`FollowUpWizard.tsx`, `ReviewSubmit.tsx`, `followUpBundleBuilder.ts`, `observationBuilder.ts`, `fhirClient.ts`) found no TODO/FIXME markers, no obvious type mismatch, and no missing required-field construction. No error message, stack trace, or repro steps were provided. Per this project's standing discipline (verify, don't invent), this is left explicitly unresolved — logged as an open item requiring the surgeon (or user) to reproduce the failure and capture the actual `OperationOutcome`/error banner text and browser console output before a fix can be scoped. One structural note for whoever investigates: `runStatusUpdate()`'s removal (fix (c)) eliminates a theoretical version-conflict/timing interaction between the Condition PUT and the bundle POST that existed in the prior code — if the surgeon's bug report coincides with having used that now-removed feature, it may already be moot.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| `Observation.status = #not-done` for the "not applicable" marker | Does not exist in FHIR R4's `observation-status` ValueSet (verified against the local core package) — would have produced a non-conformant resource that `tools/validate.sh` (FHIR Validator CLI) would reject. |
| A fake numeric sentinel value (e.g. `-1`) for "not applicable" | Silently corrupts downstream numeric analysis (a naive query for "average flexion" would include the sentinel) — `dataAbsentReason` with no `value[x]` is the FHIR-idiomatic way to make absence itself queryable and excludable. |
| Loosen `RotatorCuffFollowUpBundle`'s `entry[observation]` cardinality to `0..*` | Would let a genuinely contentless bundle (no findings, no PROMs, nothing) pass validation — exactly the "half-submitted visit" problem ADR-0030 introduced this cardinality to prevent. Fix (a) addresses the surgeon's actual scenario (tests not safely performable) without loosening the conformance guarantee. |
| Relocate the Condition-status-update feature to a dedicated case-management page instead of deleting it | Considered as an option in the go/no-go question put to the user; explicit user decision was to delete rather than relocate. |
| Guess at a fix for the reported submission bug | No error signal was available to diagnose against; guessing risks masking the real defect with an unrelated change. Explicitly deferred pending reproduction. |

## Consequences

✅ Post-op exam fields (ROM/strength/provocation) can now honestly represent "not safely assessable at this visit" instead of forcing either a fabricated value or silent omission.
✅ The `≥1 Observation` requirement's rationale is now documented and connects directly to fix (a) — a "nothing could be tested" visit is representable without weakening the conformance guarantee.
✅ The Condition-status-update feature (six days old) is fully removed with no orphaned references; `sushi .` compiles with 0 errors / 0 warnings; frontend `npm run build` (tsc + vite) compiles cleanly.
⚠️ SDC frontend (port 3001) never had the Condition-status-update feature (deferred at ADR-0093), so no parity work is needed there for fix (c); it also does not yet have the "not applicable" marker from fix (a) — a separate call, per this IG's standing precedent.
*Amended by ADR-0144 (2026-08-03): this standing precedent is retired going forward. The missing "not applicable" marker on SDC remains open, tracked as an ordinary parity item in the cross-frontend parity audit.*
❌ The reported submission bug (point d) remains open — needs a reproduction with actual error output before it can be diagnosed and fixed.

## Sources

- Clinical review by the reviewing shoulder surgeon (round 2), point 15 (a)-(d)
- `hl7.fhir.r4.core#4.0.1` local package — `CodeSystem-observation-status.json`, `CodeSystem-data-absent-reason.json` (live verification, corrects the initial `#not-done` assumption)
- ADR-0030 (`RotatorCuffFollowUpBundle` `observation 1..*` rationale), ADR-0093 (Condition-status-update original addition, now reverted)
- `frontend/src/components/followup/{ObservationField.tsx,FollowUpWizard.tsx,ReviewSubmit.tsx}`, `frontend/src/lib/observationBuilder.ts`
- `ig/input/fsh/profiles/{ShoulderObservation.fsh,RotatorCuffFollowUpBundle.fsh}` (cardinality confirmation, no changes needed)
