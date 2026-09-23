# ADR-0126: Fix `Condition.verificationStatus` directly, `Encounter.class` at the bundle level

**Date:** 2026-08-01
**Status:** Accepted
**Builds on:** ADR-0105 (surgeon feedback establishing `verificationStatus=confirmed`), ADR-0124 (`Encounter.class` for Surgery), ADR-0125 (the `status`/`category` fixes this continues)

## Context

Closing out the last two items from the `submissionDefaults` audit (ADR-0122→0125): which app-level defaults are genuinely constant and safe to promote into the IG itself.

**`Condition.verificationStatus`.** `RotatorCuffCondition.fsh` already requires it (`1..1 MS`), inherited unchanged from the EU Core parent (`condition-eu-core`) — it cannot be removed; FHIR profiling only narrows a cardinality, never loosens one an ancestor already fixed. The question was only ever about the *value*. It is not a fresh guess: `frontend/src/wizard/stepFormData.ts`'s own comment already documents that this was decided via real surgeon feedback (ADR-0105) — "no longer asked in the UI ... every registered diagnosis is clinically confirmed at this point in the workflow" — and every example bundle, every seed bundle, and both frontends already use `confirmed` with zero deviation (confirmed by grep before touching FSH).

**`Encounter.class` for Registration/Follow-Up.** ADR-0124 fixed this correctly for Surgery (a real per-case question, since ambulatory vs. inpatient genuinely varies there) but left Registration/Follow-Up as an unpromoted app-level `AMB` default, since `ShoulderEncounter` is the one Encounter profile shared by all three bundle contexts and Surgery needs `class` open. Three options were discussed:

- **A** — split `ShoulderEncounter` into a new derived profile for Registration/Follow-Up. Biggest change: new profile identity, bundle entry-slice type changes, `meta.profile` changes in both frontends, Questionnaire `itemExtractionContext` changes.
- **B** — fix it at the *bundle* level instead, constraining `entry[encounter].resource.class` directly inside `RotatorCuffRegistrationBundle`/`RotatorCuffFollowUpBundle`'s own entry slice, leaving `ShoulderEncounter` itself untouched and open.
- **C** — leave as-is.

**Chosen: B.**

## Decision

**`RotatorCuffCondition.fsh`**: replaced the `verificationStatus` required binding with a fix —
```
* verificationStatus 1..1 MS
* verificationStatus = #confirmed
```

**`RotatorCuffRegistrationBundle.fsh` and `RotatorCuffFollowUpBundle.fsh`**: added, immediately after each file's existing `entry[encounter].resource only ShoulderEncounter` line —
```
* entry[encounter].resource.class = $V3_ACT_CODE#AMB "ambulatory"
```
This mechanism — constraining a nested element on a specific Bundle-entry slice's resource, rather than on the resource's own shared profile — was not invented for this change; it is already proven working in this exact codebase (`RotatorCuffRegistrationBundle.fsh`'s pre-existing `entry[priorTreatment].resource.category from PriorTreatmentCategory (required)`, a live binding using the identical `entry[slice].resource.path` addressing). The one thing that specific precedent didn't prove was a *fix* (`=`) rather than a *binding* (`from`) at the same nesting depth — confirmed directly by a clean `sushi .` compile (0 errors, 0 warnings) and inspecting the compiled output, which correctly emits `patternCoding` on `Bundle.entry:encounter.resource.class`.

`ShoulderEncounter.fsh`'s own `class` element stays exactly as ADR-0124 left it (`1..1 MS`, no binding, no fix) — its comment was extended to point a future reader at where Registration/Follow-Up actually close this (the bundle profiles), since it's no longer accurate to read the shared profile alone as "still fully open everywhere."

`extractor.ts`'s `submissionDefaults()` keeps its own copies of both values (no functional change) — same reasoning as ADR-0125: the resolver's fixed-value reading isn't generic yet, so the app still needs to supply these itself; the duplication is explicitly commented as known and low-risk, not left implicit.

## Classification (Clinical Feedback Integration Workflow)

**(a) Refinement** for both. `verificationStatus` and `Encounter.class` are FHIR-required resource scaffolding (Layer 2), never named by the SECEC expert consensus — no `% Full`/`% Partial` impact. Neither change adds new data-collection burden; both close gaps where a value the app was already submitting silently wasn't derivable from the published IG.

## Consequences

✅ An independent SDC engine reading only the published IG package now knows the correct `verificationStatus` for every `RotatorCuffCondition`, and the correct `Encounter.class` for Registration and Follow-Up bundles specifically — Surgery's genuinely-variable case remains a real question (ADR-0124), untouched.
✅ Zero example or seed bundle needed changing — confirmed by exhaustive grep before touching FSH and again by a clean `sushi .` after (0 errors, 0 warnings).
✅ Confirms the `entry[slice].resource.path` fix pattern (not just binding) works in this SUSHI version — a reusable technique for any future field that's constant within one bundle context but not shared-profile-wide.
⚠️ `extractor.ts` still hardcodes both values rather than reading them back from the resolved profile — same known, commented, low-risk duplication ADR-0125 already accepted; a future ADR could close it for real by generalizing the resolver's fixed-value reading.
⚠️ Surgery's `Encounter.class` remains the one genuinely open case, correctly — a real per-instance answer (ADR-0124), not a candidate for fixing anywhere.

## Sources

- `frontend/src/wizard/stepFormData.ts` — the existing comment documenting ADR-0105's surgeon-feedback provenance for `verificationStatus=confirmed`.
- `ig/input/fsh/profiles/RotatorCuffCondition.fsh`, `RotatorCuffRegistrationBundle.fsh`, `RotatorCuffFollowUpBundle.fsh`, `ShoulderEncounter.fsh` — the four edited files.
- `ig/fsh-generated/resources/StructureDefinition-rotator-cuff-registration-bundle.json` / `-rotator-cuff-follow-up-bundle.json` — compiled output confirming `patternCoding` on `Bundle.entry:encounter.resource.class`.
- `grep` sweep of `ig/input/fsh/examples/*.fsh` and `seed/bundles/*/*.json` — zero deviations found for either field, the empirical basis for calling both "genuinely constant."
- ADR-0105, ADR-0124, ADR-0125 — see Context/Builds-on above.
