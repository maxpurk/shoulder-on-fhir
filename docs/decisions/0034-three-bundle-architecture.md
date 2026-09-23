# ADR-0034: Three-bundle architecture — separate surgical event from registration

**Date:** 2026-05-13
**Status:** Accepted — bundle profiles renamed by ADR-0066 (2026-06-07)
**Supersedes (scope):** ADR-0017 (the original `ShoulderRegistrationBundle` carried the surgical procedure; that role moves here)
**Refines:** ADR-0027 (prior PT / injection now live under a dedicated slice with required category binding), ADR-0030 (the "7 submissions per patient" cadence is now realised by three distinct profiles), ADR-0033 (`ShoulderProcedureCategory` now also serves as the bundle-level filter that separates registration from surgery)

> **Rename update (2026-06-07, ADR-0066):** The three bundle profiles named throughout this ADR were renamed `Shoulder{Registration,Surgery,FollowUp}Bundle` → `RotatorCuff{Registration,Surgery,FollowUp}Bundle` (kebab ids `shoulder-*-bundle` → `rotator-cuff-*-bundle`). `ShoulderProcedure` and `ShoulderProcedureCategory` were also renamed (`RotatorCuffProcedure`, `RotatorCuffProcedureCategory`). The three-bundle architecture and the category-driven bundle-level filter described below are unchanged; only the names moved.

## Context

ADR-0017 (April 2026) created a single `ShoulderRegistrationBundle` that conflated the pre-operative submission with the surgical event. The procedure slice was `1..1`, later relaxed to `1..*` by ADR-0027 to also carry SECEC Q1.6 / Q1.7 prior non-surgical treatments. ADR-0030 (May 2026) added `ShoulderFollowUpBundle` for post-operative visits and explicitly noted that "a single registry case is the sum of **up to 7 FHIR submissions**" — an index `ShoulderRegistrationBundle` at T0 (pre-op), a surgery update at T1, and a per-visit increment at five Q11 timepoints.

Three problems with that arrangement:

1. **Missing artifact for T1.** ADR-0030 named seven submissions but provided no named bundle profile for the surgical event. In practice the surgical procedure was folded into the Registration bundle, so "T0" had to mean "post-op" rather than "pre-op" — contradicting the ADR's own framing.
2. **Mixed semantics in a single slice.** With `procedure 1..*` accepting both surgical procedures (SNOMED `387713003`) and prior non-surgical treatments (`91251008` Physical therapy, `18629005` Administration of medication), the validator could not enforce "exactly one index surgery". A bundle with two prior-PT entries and no surgical procedure validated as conformant — semantically empty for a research registry whose central event is the surgical intervention.
3. **Implicit referencing rules.** Re-examination during the 2026-05-13 architecture review (see the three-bundle restructure plan) made explicit that Hurley et al. (2024) implies three phases: pre-operative data collection (Q1 history, Q2 pre-op exam, Q3–Q7 imaging, Q1.6/Q1.7 prior treatments), the surgical event itself (not Q-numbered but central to the registry), and the post-operative follow-up stream (Q9 post-op exam, Q10/Q11 timepoints, Q12 PROMs, Q13 research imaging). The 2-bundle model collapsed phases 1 + 2 with no structural support for keeping them temporally separate.

## Decision

Adopt a **three-bundle submission architecture** that mirrors Hurley's three phases:

| Phase | Bundle profile | Required entries | References |
|---|---|---|---|
| T0 — Pre-operative | `ShoulderRegistrationBundle` (narrowed) | Patient 1..1, Condition 1..1 | First submission per patient; establishes context for all later submissions |
| T1 — Surgical event | `ShoulderSurgeryBundle` (new) | Encounter 1..1, Procedure 1..* (category=Surgical) | References Patient + Condition by persisted ID |
| Tn — Post-operative follow-up | `ShoulderFollowUpBundle` (unchanged) | Encounter 1..1, Observation 1..* | One bundle per Q11 timepoint; references Patient + Condition by persisted ID |

### `ShoulderRegistrationBundle` — narrowed scope (version 0.2.0)

Required slices: `patient 1..1`, `condition 1..1`. Optional slices: `priorTreatment 0..*` (Procedure with category from `PriorTreatmentCategory`), `observation 0..*` (Q1, Q2, Q4, Q8 baseline), `imagingStudy 0..1`, `diagnosticReport 0..1`, `serviceRequest 0..1` (Q5.1/Q6.1 imaging order), `carePlan 0..1` (Q11 schedule), `coverage 0..1`, `questionnaireResponse 0..*`.

The `procedure 1..*` slice from the prior revision is removed. Prior non-surgical treatments live in the new `priorTreatment` slice whose `category` is `required`-bound to `PriorTreatmentCategory` (`91251008` Physical therapy, `18629005` Administration of medication). Any surgical-category procedure entry now fails validation — it must be submitted in `ShoulderSurgeryBundle` instead.

### `ShoulderSurgeryBundle` — new profile

Required slices: `encounter 1..1` (`ShoulderEncounter`), `procedure 1..*` (`ShoulderProcedure`). Optional slice: `observation 0..*` (intra-operative findings). Patient and Condition are referenced by persisted ID from the prior Registration submission.

By convention the first `procedure` entry is the primary / index intervention; additional entries are concomitant procedures (biceps tenodesis, distal clavicle resection, etc.). If the concomitant relationship needs to be machine-readable, use `Procedure.partOf` to link concomitants to the index — the example bundle demonstrates this pattern.

### New ValueSet: `PriorTreatmentCategory`

Required binding on `ShoulderRegistrationBundle.entry[priorTreatment].resource.category`. Two SNOMED CT codes: `91251008` Physical therapy procedure, `18629005` Administration of medication. Acts as the bundle-level filter that keeps surgical procedures out of the Registration bundle.

### Workflow consequence

Per patient, a complete registry case is now up to **seven explicit named submissions**:

1. `ShoulderRegistrationBundle` (T0, pre-op)
2. `ShoulderSurgeryBundle` (T1)
3–7. `ShoulderFollowUpBundle` (Q11: 6 wk, 3 mo, 6 mo, 1 y, 2 y)

ADR-0030's "7 submissions" framing now corresponds to three named profiles instead of two-and-a-gap. T0 and T1 may be temporally separated (patient registered pre-op, surgery scheduled later) or submitted back-to-back in one sitting; the architecture supports both without conflating them.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Keep the 2-bundle model and fix the index-OP guarantee via slicing on `Procedure.code` inside the existing Registration bundle | Brittle: requires enumerating which `ShoulderProcedureType` codes are "index-level"; breaks every time a new surgical code is added; does not address the phase-1/phase-2 conflation, only the validator gap |
| Single mega-bundle covering Registration + Surgery + all Follow-Ups | Breaks per-visit atomicity over the 24-month follow-up period; forces retrospective submission of all visits in one transaction; collides with the iterative nature of longitudinal data capture |
| Document bundle (`Bundle.type = #document`) with a Composition table of contents | Designed for snapshot exchange (IPS pattern), not for registry write. Adds Composition overhead without registry value. Transaction semantics, not document semantics, fit the use case |
| Three-bundle split with `procedure 1..1` exact in SurgeryBundle (rather than 1..*) | Excludes concomitant procedures. `1..*` with the first-entry convention is more flexible; `Procedure.partOf` can model the concomitant relationship when needed |
| Slicing `indexProcedure 1..1` vs `concomitantProcedure 0..*` in SurgeryBundle | Requires a third discriminator (pattern on `Procedure.code` or a custom extension); brittle and adds complexity. Convention + `partOf` is sufficient |
| Add a `priorTreatment` discriminator on `Procedure.category` in the existing Registration bundle but keep the surgical slice | Possible but leaves the phase-1 / phase-2 conflation in place; the validator gap is fixed but the temporal model is not |

## Consequences

✅ Validator now guarantees, at the bundle-profile level, that:
  - Registration bundles cannot contain a surgical procedure (required `category` binding rejects it)
  - Surgery bundles must contain at least one procedure (slice cardinality `1..*`)
  - Pre-operative and surgical phases are structurally separated

✅ ADR-0030's "7 submissions per patient" cadence is now fully realised — every named timepoint has a corresponding bundle profile

✅ Registration bundle gains explicit slices for `serviceRequest` (Q5.1/Q6.1 imaging order) and `carePlan` (Q11 follow-up schedule), making those SECEC elements bundle-level addressable

✅ Reference mechanic is now consistent across the IG: only the first submission (Registration) creates Patient + Condition; every subsequent submission (Surgery, Follow-Up) references them by persisted ID via the same pattern

✅ The IG's base profile count rises from 13 to 14 (adding `ShoulderSurgeryBundle`); the new ValueSet `PriorTreatmentCategory` brings the count from 14 to 15

⚠️ Clients submitting both Registration and Surgery in one sitting now make two HTTP requests instead of one. Mitigation: after Registration succeeds, the unified frontend (port 3000, ADR-0035) offers a "Continue to surgery" button with the new Patient identifier pre-filled. The cost is one extra round-trip; the gain is atomic per-phase validation.

⚠️ The SDC frontend (`sdc-frontend/`, port 3001) still emits a single bundle of the old shape. Resolving this — either by splitting the `shoulder-registration` Questionnaire into three phase-specific questionnaires, or by annotating each item with its target bundle — is deferred to a separate ADR. Documented limitation.

⚠️ The seed loader idempotence key in `seed/load-profiles.sh` continues to check for `StructureDefinition/shoulder-follow-up-bundle`. This is still valid (the FollowUpBundle profile is unchanged), but the comment in the script will be updated to mention the new SurgeryBundle artifact.

⚠️ The `process_diagram.drawio` architecture diagram is not updated by this ADR (binary XML, deferred for manual update). The current README is the authoritative narrative until the diagram is refreshed.

⚠️ The Registration bundle deferred adding an Encounter (and the corresponding cross-resource linkage from Observations / Procedures / `Condition.evidence`) — this was revisited and closed by ADR-0037 (May 2026), which makes `entry[encounter]` 1..1 and `ShoulderEncounter.reasonReference` 1..1.

## Sources

- `ig/input/fsh/profiles/ShoulderSurgeryBundle.fsh` — new bundle profile
- `ig/input/fsh/profiles/ShoulderRegistrationBundle.fsh` — narrowed scope (v0.2.0)
- `ig/input/fsh/profiles/ShoulderFollowUpBundle.fsh` — header comment updated, structure unchanged
- `ig/input/fsh/valuesets/PriorTreatmentCategory.fsh` — new VS
- `ig/input/fsh/examples/ShoulderBundle.fsh` — modified registration example (no surgical procedure)
- `ig/input/fsh/examples/ShoulderSurgeryBundle.fsh` — new surgery example with concomitant procedure
- the three-bundle restructure plan — design rationale and phased execution plan
- ADR-0017 — original `ShoulderRegistrationBundle` (scope now narrowed)
- ADR-0027 — prior PT / injection in `ShoulderProcedureType`
- ADR-0030 — `ShoulderFollowUpBundle` (sibling profile)
- ADR-0033 — `ShoulderProcedureCategory` extensible binding on `Procedure.category`
- Hurley et al. (2024), "European Society for Surgery of the Shoulder and Elbow (SECEC) rotator cuff tear registry Delphi consensus", _JSES International_ 8(3):478-482
