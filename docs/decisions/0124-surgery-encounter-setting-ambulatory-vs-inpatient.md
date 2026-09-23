# ADR-0124: Surgical Encounter setting (ambulatory vs. inpatient) as a real SDC question, not a silent default

**Date:** 2026-08-01
**Status:** Accepted
**Found via:** a discussion of ADR-0122's `submissionDefaults` table — auditing which of its constants are genuinely invariant vs. context-dependent surfaced this one as wrong for the Surgery flow.

## Context

`ShoulderEncounter.class` (FHIR `Encounter.class`, the ambulatory/inpatient/etc. distinction, v3-ActCode) has always been `1..1 MS` on the profile with no fixed value or binding — deliberately left open, per its own FSH comment noting "typically outpatient ambulatory" as informative text only, not a constraint.

Auditing where each of `extractor.ts`'s `submissionDefaults` values actually come from (a follow-up to ADR-0122's own residual-defaults disclosure) found that the SDC frontend silently defaults `class` to `AMB` for Registration/Follow-Up and `IMP` for Surgery (`bundleAssembler.ts`), with **no Questionnaire item ever asking the user** — `grep` across all three Questionnaires found zero `item.definition` references to `Encounter.class`.

For Registration and Follow-Up, `AMB` is genuinely always correct (both are outpatient office visits). For Surgery, it is not: real rotator cuff repairs are legitimately performed both as ambulatory day surgery and as an inpatient stay, and the unified frontend (port 3000) already models this correctly — `SurgicalEventStep.tsx` has a real "Day surgery (outpatient) / Inpatient" dropdown, feeding a genuinely chosen `AMB`/`IMP` into `Encounter.class`. The SDC frontend's Surgery flow never got the equivalent treatment: it always emitted `IMP`, meaning every ambulatory rotator cuff repair submitted through the SDC demonstrator would be silently mislabeled as an inpatient stay.

## Decision

Add a real coded item to `ShoulderSurgeryQuestionnaire.fsh`'s Encounter group, mirroring the unified frontend's existing dropdown exactly:

```
* item[0].item[4].linkId = "encounter.setting"
* item[0].item[4].text = "Setting"
* item[0].item[4].type = #choice
* item[0].item[4].required = true
* item[0].item[4].definition = ".../shoulder-encounter#Encounter.class"
* item[0].item[4].answerOption[0].valueCoding = $V3_ACT_CODE#AMB "Day surgery (outpatient)"
* item[0].item[4].answerOption[1].valueCoding = $V3_ACT_CODE#IMP "Inpatient"
```

No frontend code changes were needed. `Encounter.class` is FHIR type `Coding` (confirmed against the base FHIR R4 `Encounter` StructureDefinition); the ADR-0122 generic extractor already has a `Coding` case in `buildValue` and already resolves the element generically from the target profile — this is exactly the kind of new field the refactor was meant to support without touching `extractor.ts` again. Verified before implementing: `bundleAssembler.ts`'s `applyEncounterDefaults` only sets `subject`/`reasonReference`, never touches `class`, and its `IMP` fallback literal only fires when `extracted.encounter` is entirely absent (a defensive last resort, not a normal-path overwrite) — so a real answer flows through untouched.

Registration and Follow-Up's `class` stays exactly as-is (an app-level `AMB` default, not promoted into FSH) — see the companion discussion in `docs/limitations_items/` on why fixing it there would require splitting `ShoulderEncounter` into context-specific derived profiles (it's shared by all three bundle types, and FHIR profiling can only narrow, never re-open a constraint), deferred as a separate, lower-priority decision.

## Classification (Clinical Feedback Integration Workflow)

**(c) IG-operational addition.** `Encounter.class` is FHIR-required scaffolding (Layer 2), not a SECEC consensus element — this doesn't touch the `% Full`/`% Partial` coverage claim. It also isn't new *clinical* data-collection burden in the sense classification (d) warns about: the fact already had to be decided somehow for every submission; this closes a real silent-misclassification bug rather than asking the surgeon anything new.

## Consequences

✅ Every SDC-submitted Surgery bundle now correctly reflects whether the case was ambulatory or inpatient, instead of always claiming inpatient.
✅ SDC/unified frontend parity restored for this specific field (both now ask a real "Day surgery / Inpatient" question).
✅ No `extractor.ts`/`profileMetadataResolver.ts` changes needed — direct evidence the ADR-0122 generic writer supports a brand-new coded field with zero code changes, only IG content.
⚠️ Registration/Follow-Up's `Encounter.class = AMB` remains an unpromoted app-level default, not a fixed IG value — intentionally deferred (see `docs/limitations_items/`), since doing it properly needs a profile split this ADR's scope didn't warrant.

## Sources

- `frontend/src/components/surgery/SurgicalEventStep.tsx` — the unified frontend's existing, correct "Day surgery / Inpatient" dropdown this mirrors.
- `frontend/src/types/fhir.ts` — `ENCOUNTER_CLASS_AMBULATORY`/`ENCOUNTER_CLASS_INPATIENT` constants, whose exact `display` strings (`"ambulatory"`, `"inpatient encounter"`) this ADR's answer-option labels stay consistent with in spirit (the Questionnaire uses the friendlier "Day surgery (outpatient)"/"Inpatient" wording a patient-facing form needs).
- `ig/input/fsh/profiles/ShoulderEncounter.fsh` — confirms `class 1..1 MS` has no binding or fixed value today.
- Live verification: base FHIR R4 `Encounter` StructureDefinition confirms `Encounter.class` type `Coding`.
- ADR-0122 — the generic extractor this addition tests without modifying.
