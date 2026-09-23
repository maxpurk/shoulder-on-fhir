# ADR-0046: `condition-dueTo` for Q1.e traumatic etiology

**Date:** 2026-05-19
**Status:** Accepted

## Context

Hurley et al. (2024) names **Q1.e "Traumatic etiology"** as a unanimous-consensus Patient History element. The mapping (`SECEC_FHIR_Mapping.csv` row Q1.e, pre-ADR-0046 wording) classified it as **Full**, mapped to `Condition.code + Condition.onset`, with rationale: *"Distinguish traumatic vs degenerative via diagnosis code + onset dating."* Close reading shows two problems.

**(1) The rationale conflates timing with causation.** `Condition.onset[x]` records *when* a condition began, not *how*. A degenerative tear can have a precise onset date too (e.g. the day pain first became disabling). The etiology signal comes exclusively from `Condition.code` choice — the `onset` half of the cited mechanism does no work. This is the same class of honesty gap that drove the ADR-0036 (denominator re-baseline) and ADR-0039 (Q12/Q7 corrections) interventions.

**(2) Code-choice etiology is fragile.** `RotatorCuffDiagnosis` (12 codes, ADR-0032) contains exactly two etiology-pre-coordinated SNOMED concepts:
- `698299009` — Traumatic rupture of rotator cuff
- `424175006` — Nontraumatic rotator cuff tear

The other 10 codes (e.g. `202843000` Full-thickness tear, `399346004` Supraspinatus tear, `415352004` Rotator cuff tear arthropathy) are etiology-neutral. SNOMED pre-coordinates anatomy + pathology + etiology into a single concept, so a clinician must choose: anatomic specificity **or** etiology, never both. There is also no representation for mixed / acute-on-chronic etiology, which is clinically common (a degenerative tear extended by a discrete traumatic event).

The result: Q1.e's prior "Full" classification was contingent on clinician-side code selection luck. If the clinician picked the more anatomically specific code, the etiology axis disappeared from the resource — yet the mapping still reported the element as Full. FHIR R4 base defines a dedicated extension for exactly this case (`http://hl7.org/fhir/StructureDefinition/condition-dueTo`, value `CodeableConcept` or `Reference`), which the IG was not using. Adopting it post-coordinates etiology onto whatever anatomic code is chosen, decoupling the two axes.

## Decision

Add the FHIR R4 standard `condition-dueTo` extension to `RotatorCuffCondition` and require it. Same precedent and pattern as ADR-0038's import of `condition-assertedDate` and `Procedure.recorded` (R5 backport) — a FHIR-standard slot, not a locally minted extension.

- **Profile** (`ig/input/fsh/profiles/RotatorCuffCondition.fsh`): add a named `dueTo` slice alongside the existing `assertedDate` slice. Cardinality **1..1 MS**. `value[x]` constrained to `CodeableConcept`. Binding strength **required**.

- **ValueSet** (`ig/input/fsh/valuesets/RotatorCuffEtiology.fsh`): new `RotatorCuffEtiology`, four mutually-exclusive codes:
  - `SCT#773760007` — Traumatic event *(event domain)*
  - `SCT#362975008` — Degenerative disorder *(disorder domain)*
  - `ShoulderEtiology#mixed` — Mixed (acute-on-chronic) etiology *(local)*
  - `SCT#54690008` — Unknown (origin) *(qualifier domain; synonyms: idiopathic, cryptogenic)*

- **Local CodeSystem** (`ig/input/fsh/codesystems/ShoulderEtiology.fsh`): new `ShoulderEtiology` with one code, `mixed`. SNOMED `255212004 Acute-on-chronic` is a qualifier-value concept, not a cause concept, and is semantically wrong in the `condition-dueTo` slot; a dedicated local code is used instead. Follows the same standard-terminology-first rule documented in ADR-0010 and ADR-0027 (use a local code only when SNOMED has no apt concept in the required role).

- **SDC Questionnaire** (`ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`): new item `condition.etiology`, `type = choice`, `required = true`, `definition = .../rotator-cuff-condition#Condition.extension[condition-dueTo]`, `answerValueSet = RotatorCuffEtiology`. SDC extractor (`sdc-frontend/src/lib/extractor.ts`) maps this path to `Condition.extension[].url = condition-dueTo` with the chosen CodeableConcept.

- **Unified frontend** (`frontend/src/components/wizard/StepCondition.tsx` + `frontend/src/components/ConditionForm.tsx`): new "Etiology" select in the diagnosis section, sourced via `useValueSet(VALUESET_URLS.ROTATOR_CUFF_ETIOLOGY)`. Initial value `''` per the project's no-pre-populated-defaults rule; HTML `required` matches the profile cardinality.

- **Mapping** (`mapping/SECEC_FHIR_Mapping.csv` + `.md`): Q1.e row rewritten — FHIR Path now `Condition.extension[condition-dueTo].valueCodeableConcept`, rationale corrected (drops the misleading `onset[x]` claim), Status remains **Full** but is now structurally Full (independent of `Condition.code`). Headline figures unchanged (42 Full + 16 Partial / 58 Hurley elements).

- **Relationship to ADR-0032 (RotatorCuffDiagnosis scope).** The two etiology-pre-coordinated SNOMED codes (`698299009`, `424175006`) remain in `RotatorCuffDiagnosis` (extensible binding) for backwards tolerance — existing data using them validates and is still readable. The *preferred* mechanism going forward is the extension. ADR-0032's editorial scope is otherwise unchanged.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Reclassify Q1.e from Full → Partial (docs only) | Honest at the documentation level but leaves the structural gap unfixed. A future implementer reading the IG cannot find a deterministic etiology slot. Headline becomes 41 Full + 17 Partial — still 100% Full+Partial, but the IG remains silent on FHIR's standard cause mechanism. |
| Add a dedicated `EtiologyObservation` profile (post-coordinated via Observation) | Heavier. Provides flexibility (multiple etiologies, certainty, evidence references) but the consensus axis is binary-plus-edge-cases; the four-code classifier doesn't justify a separate Observation. `condition-dueTo` is the FHIR-intended slot for "cause of a Condition." |
| Tighten `RotatorCuffDiagnosis` binding to require one of the two etiology-pre-coordinated codes as a companion code on `Condition.code` | Fights SNOMED's pre-coordination hierarchy. Forces clinicians to choose between anatomic specificity and etiology, with no resolution for the mixed case. |
| Mint a fully local `ShoulderEtiology` for all four codes | Cleaner classifier semantics (all four codes from one hierarchy), but violates the standard-terminology-first rule from ADR-0010/0027 — SNOMED has apt cause-domain concepts for three of the four. Hybrid (3 SNOMED + 1 local) was chosen instead. |
| Use `Condition.note` free-text "traumatic" / "degenerative" | Not machine-readable. Defeats the purpose of a consensus minimum data set element. |

## Consequences

✅ Q1.e is **structurally Full**: etiology is captured regardless of which anatomic SNOMED code is chosen for `Condition.code`.
✅ The mapping rationale no longer conflates timing with causation. Honesty restored at the same level achieved by ADR-0036 / ADR-0039.
✅ Uses a FHIR R4 standard extension; no local extension defined. Same pattern as ADR-0038's `condition-assertedDate` import.
✅ Required cardinality (1..1) + `Unknown (origin)` option means missing data is recorded explicitly rather than silently omitted — the field is always populated, "unknown" is a first-class value.
⚠️ Existing seed data and examples must be updated to include the extension; without backfill, validation fails against the now-required slice. Done in this change: `seed/bundles/example-patients.json` (3 Conditions), `example_data/anna_mueller_01_registration.json`, `ig/input/fsh/examples/RotatorCuffCondition.fsh`, `ig/input/fsh/examples/ShoulderBundle.fsh`.
⚠️ External submitters who follow the prior code-choice-only convention must update their bundles. Migration cost is one extension entry per Condition; the two pre-coordinated SNOMED codes remain readable.
⚠️ The Hurley-named binary (traumatic vs not) is extended to a 4-way classifier (traumatic / degenerative / mixed / unknown). This is a decomposition choice of this thesis, not Hurley wording; documented as such in `mapping/SECEC_FHIR_Mapping.md` § Interpretation notes (alongside the Q1.h and Q1.j decomposition notes).
❌ The mapping headline (42 Full + 16 Partial / 58) is unchanged — Q1.e was Full before and is Full now. No additional uplift is claimed; the value of this change is structural robustness and honesty of the rationale, not coverage uplift.

## Sources

- `mapping/SECEC_FHIR_Mapping.csv` row Q1.e — pre- and post-rewrite
- `ig/input/fsh/profiles/RotatorCuffCondition.fsh` — `dueTo` slice
- `ig/input/fsh/valuesets/RotatorCuffEtiology.fsh` — new ValueSet
- `ig/input/fsh/codesystems/ShoulderEtiology.fsh` — new local CodeSystem for `mixed`
- ADR-0010 — standard-terminology-first rule
- ADR-0027 — complete SECEC coverage via standard terminologies
- ADR-0032 — RotatorCuffDiagnosis editorial scope (etiology-pre-coordinated SNOMED codes retained for tolerance)
- ADR-0036 — denominator re-baseline (Q12 fabrication correction)
- ADR-0038 — standard-extension import precedent (`condition-assertedDate`, `Procedure.recorded`)
- ADR-0039 — three-layer SECEC accounting (Q12 SSV/SANE collapse, Q7 removal)
- FHIR R4 extension: `http://hl7.org/fhir/StructureDefinition/condition-dueTo`
- SNOMED CT concepts verified via `mcp__snomed-ct__snomed_lookup` (2026-05-19): `773760007`, `362975008`, `255212004` (qualifier — not used), `54690008`
