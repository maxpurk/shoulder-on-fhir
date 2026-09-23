# Functional limitations (Q12.c) is never re-captured at Follow-Up, though the mapping scopes it `Timepoint=FollowUp`

> **Status:** Limitation — open, consensus-coverage-integrity gap. Affects both frontends and
> both seed patients.

## Gap

`FunctionalLimitationsObservation` (local `ShoulderObservationCodes#functional-limitation-severity`,
5-tier ordinal per ADR-0105) realises **two** consensus elements: **Q1.n** (baseline functional
gestalt, captured in the registration bundle) and **Q12.c** ("Function / limitations" PROM
component, assigned to the follow-up bundle). Both are representable, and the Q12.c row
(`SECEC_FHIR_Mapping.csv`) explicitly states it "reuses FunctionalLimitationsObservation (also
Q1.n)".

In practice the observation is emitted **only at Registration**, in both paradigms:
- Unified: `frontend/src/components/wizard/StepPatient.tsx` builds it; the Follow-Up wizard
  (`components/followup/*.tsx`) never does — grep for `functionalLimit` there is empty.
- SDC: `item[5].item[7]` (`obs.functional-limitations`) exists in
  `ShoulderRegistrationQuestionnaire.fsh` but there is **no** corresponding item in
  `ShoulderFollowUpQuestionnaire.fsh` — grep is empty.
- Seed: neither Anna Müller nor Kemal Demir carries a functional-limitations Observation at any
  follow-up visit.

So Q12.c's representability rests on a follow-up realisation path that nothing in the running
system, or the reference seed data, ever exercises.

## Why it matters

This is distinct from the deliberately-intentional Follow-Up exclusions documented in ADR-0093
(Bear-Hug/Hornblower provocation tests, no Q1 patient-history re-ask), which were checked against
Hurley 2024 and confirmed consensus-correct. Here the mapping itself asserts a FollowUp timepoint
for Q12.c, so the non-capture is a genuine mismatch between the claimed coverage and the
demonstrated coverage, not a defensible scoping choice. A registry consumer querying longitudinal
functional-limitation trajectories gets a single baseline point and nothing after.

## Note

Before fixing, confirm the intended reading with the `shoulder-surgeon` subagent / Hurley 2024:
Q12.c may be adequately covered at follow-up by the Constant-Murley **ADL component**
(`component[ADL]`, captured at follow-up) — in which case the correct fix is a **mapping
correction** (Q12.c realised via the Constant ADL sub-score, not a standalone
FunctionalLimitationsObservation) rather than adding a follow-up form field. The Q1.n mapping note
already argues the two are "deliberately distinct", so this needs an explicit decision, not a
silent code change. Also fix the stale `http://loinc.org#10158-4` binding still cited on the Q12.c
CSV row (predates the ADR-0105 redesign to the local ordinal; the FSH local code is ground truth).
