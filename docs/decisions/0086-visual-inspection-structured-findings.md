# ADR-0086: Visual Inspection redesigned from free text into 3 structured present/absent findings

**Date:** 2026-07-18
**Status:** Accepted

## Context

Next point in the same surgeon review as ADR-0084/0085:

Visual Inspection as free text cannot be evaluated or analysed. Inspection should instead be converted into yes/no questions: atrophy present, deformity present, normal shoulder contour.

`InspectionObservation` was a single free-text `valueString` profile shared by both SECEC Q2.a (pre-treatment inspection) and Q9.a (post-treatment inspection), distinguished only by `effectiveDateTime`. Used in the unified frontend's Registration (`StepClinicalAssessment.tsx`) and Follow-Up (`Q9ExamForm.tsx` via `followupObservationMetadata.ts`) flows. The surgeon's complaint is literal and correct: free text is not analyzable across a registry.

**Classification against Hurley**: Q2.a and Q9.a both name only "Inspection," zero mechanism specified — the same single-word-ambiguity pattern already closed for Pain (Q1.h), Sleep (Q1.i), Sports (Q1.j), Occupation (Q1.k). This is a **Refinement** — full design freedom, `Full` status on both `Q2.a` and `Q9.a` unaffected.

## Decision

**Retire `InspectionObservation`** entirely (matching the established full-removal precedent — ADR-0054, ADR-0082, ADR-0083) and replace with **three separate Observation profiles**, one per named finding, following this IG's established "one profile per code × value[x]" rule (ADR-0008):

1. **`AtrophyObservation`** — `code = ShoulderObservationCodes#atrophy`
2. **`DeformityObservation`** — `code = ShoulderObservationCodes#deformity`
3. **`NormalShoulderContourObservation`** — `code = ShoulderObservationCodes#normal-shoulder-contour`

All three: `Parent: ShoulderObservation`, `value[x] only CodeableConcept` bound `required` to a new shared **`PresentAbsent`** ValueSet, `category = exam` with `bodySite` (physically-anchored per the ADR-0074 convention already applied to the retired profile). Still shared across Q2.a/Q9.a via `effectiveDateTime`, matching the retired profile's scope.

**Value axis is standard terminology**: verified via SNOMED lookup — `52101004 |Present|` and `2667000 |Absent|` are real, general-purpose qualifier-value concepts, the idiomatic FHIR pattern for presence/absence findings. `PresentAbsent` directly enumerates these two codes, no local CodeSystem needed — exact same shape as the existing `PositiveNegative` ValueSet already shared across the five provocation-test profiles (Jobe/Lift-off/Belly-press/Bear-hug/Hornblower).

**Code axis stays local**: checked SNOMED for a laterality-neutral, general-purpose "atrophy/deformity present" observable-entity axis — none exists. Only laterality-baked-in *finding* concepts were found (e.g. `15704441000119108` "Bilateral muscle atrophy of shoulders"), which would conflict with this IG's established laterality-on-`bodySite`-not-code convention (ADR-0043). Local codes are consistent with how every other shoulder-specific exam axis in this IG is modeled.

**Not wired into `Condition.evidence.detail`** — matching the retired profile's non-wired status; no scope expansion beyond the surgeon's ask.

**Questionnaire item shape**: inline `answerOption[]` with `$SCT#code` literals, matching the sibling `PositiveNegative`-bound provocation-test items exactly (rather than `answerValueSet`, which this questionnaire also uses elsewhere for larger/less-stable VSs) — consistency with the most structurally similar existing items.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Single combined profile with a 3-way (or more) coded enum | Conflates three clinically distinct findings into one axis, breaking the "one profile, one code, one value[x]" convention this IG has followed since ADR-0008 |
| Precoordinated SNOMED finding concepts baked with laterality (e.g. "Bilateral muscle atrophy of shoulders") as `Observation.code` | Conflicts with ADR-0043's laterality-neutral code convention — laterality belongs on `bodySite`, not baked into `code` |
| Keep free text with a "structured hint" placeholder | Does not address "kann man nicht auswerten" — the surgeon's complaint is specifically that free text cannot be analyzed |
| Plain `valueBoolean` instead of SNOMED-coded `valueCodeableConcept` | No active `valueBoolean` precedent remains in this IG (Sleep Disturbance migrated away from it, ADR-0081); a coded value using verified standard SNOMED qualifiers is more consistent with how every other qualitative finding in this IG is modeled and keeps the door open for a future "not assessed" value without a schema change |

## Consequences

✅ `Q2.a` and `Q9.a` remain `Full` — no denominator or percentage change.

✅ Both Registration (`StepClinicalAssessment.tsx`) and Follow-Up (`Q9ExamForm.tsx`/`ObservationField.tsx`) flows updated; the Follow-Up flow required no component code changes since it renders `codeable`-type fields generically from metadata.

✅ Standard-terminology win on the value axis (SNOMED `52101004`/`2667000`) — no new local CodeSystem needed, unlike most of this session's other redesigns.

⚠️ Breaking: `InspectionObservation` removed entirely (`valueString`) — acceptable given the profile's `draft`/pre-1.0 status, same precedent as ADR-0054/0082/0083.

⚠️ SDC frontend (`sdc-frontend/`) PROFILE_METADATA updated for consistency, but no active questionnaire renders any of the three findings (same gap as Sports Participation, ADR-0083) — documented, not silently skipped.

## Sources

- Clinical review by the reviewing shoulder surgeon
- SNOMED CT MCP lookup (2026-07-18) — `52101004 Present`, `2667000 Absent` (qualifier value domain); checked `clinical_finding` domain for a laterality-neutral shoulder atrophy/deformity observable-entity axis — none found
- `ig/input/fsh/profiles/observations/AtrophyObservation.fsh`, `DeformityObservation.fsh`, `NormalShoulderContourObservation.fsh`, `valuesets/PresentAbsent.fsh`, `codesystems/ShoulderObservation.fsh`
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`
- `frontend/src/components/wizard/StepClinicalAssessment.tsx`, `config/observationMetadata.ts`, `config/followupObservationMetadata.ts`, `types/fhir.ts`
- `sdc-frontend/src/lib/extractor.ts`
- ADR-0008 (one-profile-per-code convention), ADR-0043 (laterality-neutral code convention), ADR-0074 (bodySite-on-exam-category convention), ADR-0081 (sibling single-word-decomposition redesign), ADR-0083 (SDC-not-rendering precedent)
