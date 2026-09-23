# ADR-0081: Sleep disturbance redesigned as a shoulder-attributed 3-tier ordinal, wired into `Condition.evidence.detail`

**Date:** 2026-07-17
**Status:** Accepted

## Context

A shoulder surgeon reviewing the frontend flagged the "Sleep Disturbance" field as imprecise: it was a plain `valueBoolean` "is your sleep disturbed?" with no link to whether the disturbance is actually caused by the shoulder pathology being registered — a patient with unrelated insomnia would answer identically to a patient whose shoulder wakes them at night. The surgeon's own suggested phrasings (does the shoulder wake the patient at night; is sleep restricted because of the shoulder) and explicit ask ("Best idea: just ask for the data item sleep disturbance due to shoulder pathology. So we just have one item?") both point at the same fix: keep it one item, but make the shoulder-attribution structural, not just implied by wording.

Checked the consensus paper directly: Q1's unanimous-consensus patient-history list names only "i) Sleep disturbance," with no mechanism specified — no wording, no scale, no instrument named. Per this project's clinical-feedback classification workflow this is a **Refinement**: Hurley is silent on the mechanism, so the IG has design freedom without touching the `Full` status on `Q1.i`.

Two further data points shaped the redesign:

- The Constant-Murley score (Hurley Q12's own preferred outcome instrument, already modeled in this IG as `ConstantScoreObservation`, though only as a single composite total there) has a well-established 3-tier ADL sleep sub-item — unaffected / occasionally disturbed / nightly disturbed (Constant JF, Murley AH. *A clinical method of functional assessment of the shoulder.* Clin Orthop Relat Res. 1987;214:160-4) — worth 2/1/0 of its 20-point ADL section. This paper is not in the project's Zotero library; the scoring convention is treated here as a widely-reproduced domain fact, not a locally-verified citation.
- SNOMED CT was checked directly (via the SNOMED MCP lookup/related-concept tools) for a pre-coordinated "sleep disturbed by pain" concept: none exists, generically or shoulder-specifically. `301345002` "Difficulty sleeping" (the prior code) has no child or sibling concept that adds causal attribution. No LOINC panel-item code exists for a Constant-Murley sleep sub-item either.

## Decision

**1. 3-tier ordinal `valueCodeableConcept`**, not boolean. New local `SleepDisturbanceSeverityCodes` CodeSystem / `SleepDisturbanceSeverity` ValueSet (`unaffected` / `occasional` / `nightly`), matching the Constant-Murley sleep sub-item's own wording and grading rather than inventing a new scale. Richer than boolean, still "one item" per the surgeon's own framing.

**2. `Observation.code` moved from a direct external SNOMED code to a local `ShoulderObservationCodes` catalog entry** (`#sleep-disturbance`), matching the established `TendonsInvolvedObservation`/`TearLocationObservation` pattern: `code` names the axis, `value` carries the graded answer. No SNOMED/LOINC concept exists for the graded, shoulder-attributed axis (verified above), so this follows the same local-CodeSystem convention already used for `#tear-location`/`#tendons-involved`.

**3. Wired into `Condition.evidence.detail`.** Added `sleep-disturbance-observation` to `RegistrationWizard.tsx`'s `EVIDENCE_PROFILE_KEYS`, reusing the exact mechanism already used for the provocation tests (Jobe/Lift-off/Belly-press/Bear-hug/Hornblower) — visit-level evidence, captured once in `StepPatient` before any diagnosis card exists, glued onto the principal Condition. Nocturnal pain/sleep disruption is a recognized supportive clinical feature of symptomatic rotator cuff tears (already noted in this profile's own pre-existing Description), so this is a legitimate use of `evidence.detail`, not overreach. This makes "attributed to this diagnosis" a queryable FHIR relationship instead of only implied by question wording — directly answering the surgeon's "this doesn't mean it is linked to the pathology of interest" concern.

**Frontend** (`StepPatient.tsx`, unified frontend only): the yes/no `<select>` is replaced with a 3-option `<select>` fetched via `useValueSet(VALUESET_URLS.SLEEP_DISTURBANCE_SEVERITY)` (same pattern as hand dominance / smoking status), relabeled "Sleep Disturbance (due to shoulder)" with a one-line helper naming the Constant-Murley correspondence. `handleSubmit` emits `valueCodeableConcept` instead of `valueBoolean`.

**SDC Questionnaire** (`ShoulderRegistrationQuestionnaire.fsh`): `item[5].item[2]` type `#boolean` → `#choice` with `answerValueSet` bound to the new ValueSet. SDC/LHC-Forms-style rendering is schema-driven, so no `sdc-frontend` code changes are needed — confirmed by inspection, not just assumed.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep `valueBoolean`, only retarget the question wording to be shoulder-specific | Simplest change, and defensible on its own — but ignores that Hurley's own preferred outcome instrument (Constant-Murley) already has a validated, more informative 3-tier convention for exactly this concept; discarding that precedent for a same-effort boolean would be a missed opportunity, not a genuine simplification |
| Keep SNOMED `301345002` as `Observation.code` with severity carried on a qualifier extension | Inconsistent with this IG's established pattern for un-terminologized ordinal axes (`TearLocation`, `TendonsInvolved`, Patte, Goutallier, Cofield) — all use a local catalog code + local bound ValueSet, not code-plus-qualifier-extension |
| Adopt a full PROMIS Sleep Disturbance instrument (LOINC has several PROMIS short-form codes, e.g. `62197-9`) | Squarely the "convenience PROM" territory ADR-0054 already excluded (ASES/WORC/DASH/QuickDASH removed for not passing Hurley's 80% Delphi threshold) — a multi-item generic sleep instrument is disproportionate to a single Q1 patient-history item and directly contradicts the surgeon's "make it rather slim" framing |
| Leave the Observation unlinked to the Condition, fix wording only | Addresses the surgeon's concern only in text a human reads, not in the data structure — the exact gap the surgeon flagged ("this doesn't mean it is linked to the pathology of interest") would remain structurally true even after a wording fix |

## Consequences

✅ `Q1.i` remains `Full` in `mapping/SECEC_FHIR_Mapping.csv` — no denominator or percentage change; realisation notes updated to describe the new shape.

✅ Sleep disturbance is now explicitly scoped to the shoulder pathology, both in the question a clinician answers and in the FHIR structure (`Condition.evidence.detail`) a downstream consumer can query.

⚠️ Breaking `value[x]` type change (`boolean` → `CodeableConcept`) on `SleepDisturbanceObservation` — acceptable given the profile's `draft`/pre-1.0 status (bumped 0.1.0 → 0.2.0); any existing conformant data predating this ADR would need remediation, but this is a pre-production research registry with no external consumers yet.

⚠️ SDC frontend (`sdc-frontend/`, port 3001) is expected to render the new `#choice` item correctly via its generic schema-driven rendering (no field-specific code there), but this should be spot-checked rather than assumed during verification.

## Sources

- Clinical review by the reviewing shoulder surgeon (2026-07-17)
- the consensus paper (Hurley et al. 2024, Q1 patient-history list)
- Constant JF, Murley AH. A clinical method of functional assessment of the shoulder. Clin Orthop Relat Res. 1987;214:160-4 (not in the project's Zotero library — domain knowledge, flagged as such)
- SNOMED CT MCP lookup/related-concept queries (2026-07-17) — no pre-coordinated "sleep disturbed by pain" or graded shoulder-attributed sleep-disturbance concept found
- `ig/input/fsh/profiles/observations/SleepDisturbanceObservation.fsh`, `codesystems/ShoulderObservation.fsh`, `codesystems/SleepDisturbanceSeverity.fsh` (new), `valuesets/SleepDisturbanceSeverity.fsh` (new)
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`
- `frontend/src/components/wizard/StepPatient.tsx`, `frontend/src/components/RegistrationWizard.tsx`, `frontend/src/types/fhir.ts`
- ADR-0054 (Supplementary/convenience-PROM retirement — precedent for rejecting a full PROMIS instrument here)
- ADR-0073/ADR-0076/ADR-0077 (`Condition.evidence.detail` linkage pattern precedent)
- ADR-0045/ADR-0064 (local-CodeSystem-when-no-terminology-exists precedent)
- ADR-0080 (server-only TX-dependent testing policy — followed for this ADR's own verification)
