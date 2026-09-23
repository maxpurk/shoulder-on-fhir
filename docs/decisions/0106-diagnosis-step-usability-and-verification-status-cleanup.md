# ADR-0106: Diagnosis-step usability remodel and verificationStatus cleanup (round-2 surgeon feedback, points 7-8)

**Date:** 2026-07-27
**Status:** Accepted

## Context

Continuing the round-2 surgeon feedback ( see ADR-0105 for points 1-6), two points concerned the Registration wizard's diagnosis step (`StepCondition.tsx`):

**Point 7 — Principal Diagnosis.** The surgeon called the current diagnosis modeling a critical usability gap and asked for: side, diagnosis (rotator cuff tear), which tendons (select of 4), partial/complete tear, tear location, and etiology — "think about how it makes sense."

**Point 8 — Shoulder Status.** "side was already captured before, why again there?" and "remove verification status."

Tracing the current implementation found that almost everything the surgeon asked for in point 7 **already exists as structured data**: tendon involvement (Q4.b, `TendonsInvolvedObservation`, ADR-0064), tear location (Layer 2 `L3.E.4`, ADR-0076), and etiology (Q1.e, `condition-dueTo` extension, ADR-0046) are all already decoupled into their own elements. The one exception was **partial vs. full thickness (Q4.c)**: distinguished only by which SNOMED code the clinician picked on `RotatorCuffCondition.code` (`RotatorCuffDiagnosis` bundled two thickness-specific tear codes — `202843000` full-thickness, `202842005` partial-thickness — alongside thickness-neutral codes like `926335004` "Rupture of rotator cuff of shoulder"). This entangled disease-entity choice with thickness: picking "Rupture" left thickness unspecified, while picking a thickness-specific code specified both simultaneously — the same kind of overlapping-axis problem that ADR-0046 (etiology) and ADR-0076 (tendon/tear-location) already fixed for other Q4/Q1 elements, just not yet applied to thickness. This is the concrete cause behind the surgeon's "lacks usability" complaint — the UI presented "which tendon" / "tear location" / "etiology" as clean, separate fields but silently smuggled a fourth axis (thickness) inside the diagnosis dropdown.

For point 8, tracing every place laterality is asked in the unified frontend (port 3000) found no literal second prompt in code — `formData.laterality` is set once in `StepCondition.tsx`'s "Shoulder & Visit Status" card and propagated read-only into later steps. The felt redundancy is better explained by card ordering: the shared "Shoulder & Visit Status" card (laterality + onset + clinical/verification status) was positioned **after** all diagnosis cards, so a clinician who has already picked tendons/diagnosis/tear-location/etiology for a specific shoulder is then asked "which shoulder?" as if it were an afterthought. (The SDC frontend, port 3001, does have a genuine second `laterality` item on a separate Questionnaire section — out of scope here per this project's standing precedent of SDC parity being a separate call, not automatic. *Amended by ADR-0144 (2026-08-03): that precedent is retired going forward; this SDC duplicate-laterality item remains open, tracked in the cross-frontend parity audit.*)

`verificationStatus` (Layer 2, `L3.B.2`, FHIR-required) was prompted as a 4-option dropdown (confirmed/provisional/differential/unconfirmed) in both `StepCondition.tsx` and the standalone `ConditionForm.tsx`. Every diagnosis reaching this registry at the point of entry is, by construction, clinically confirmed — there is no differential-diagnosis workflow this registry supports — so the prompt added a decision with only one clinically sensible answer.

## Decision

1. **Decouple tear thickness** into a new `TearThicknessObservation` profile (`code = ShoulderObservationCodes#tear-thickness`, `valueCodeableConcept` `required`-bound to new `TearThickness` ValueSet reusing SNOMED `202843000`/`202842005` as Observation values — the same precoordinated-concept-reuse pattern `TendonsInvolvedObservation` already applies to anatomy codes), linked via `Condition.evidence.detail` alongside the tendon/tear-location Observations. `RotatorCuffDiagnosis` trimmed to disease-entity-only, thickness-neutral codes (the two thickness-specific tear codes removed; `926335004` "Rupture" retained as the sole tear/rupture entry).
2. **Reorder the diagnosis step**: the "Shoulder & Onset" card (laterality + onset date + clinical status) now renders **first**, before the diagnosis cards — "set the side once, then diagnose that shoulder" — resolving the felt redundancy without changing the underlying data model (still `Condition.bodySite`, `1..1 MS`, `ShoulderLaterality` required, set exactly once).
3. **Remove the `verificationStatus` prompt** from both `StepCondition.tsx` and `ConditionForm.tsx`'s rotator-cuff-diagnosis variant (the comorbidity variant of `ConditionForm.tsx` is untouched — a comorbidity's confirmation status is a materially different clinical judgment, not in scope of this feedback point). Both now hardcode `verificationStatus.coding[0].code = 'confirmed'` at submission. `RotatorCuffCondition.verificationStatus` stays `1..1 MS` (FHIR-required) — only the UI prompt disappears.
4. **Within the rotator-cuff diagnosis card**, field order now matches the surgeon's stated mental model: Diagnosis (disease entity) → Which Tendons → Tear Thickness → Tear Location → Etiology, with laterality set once above in the reordered "Shoulder & Onset" card.

No `RotatorCuffRegistrationBundle` profile changes were needed — `TearThicknessObservation` fits the bundle's existing generic `entry[observation] 0..* only ShoulderObservation` slice, same as the five new profiles from ADR-0105.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep thickness folded into `RotatorCuffDiagnosis` | Directly contradicts the "one axis, one element" principle this same diagnosis step was already redesigned around twice (ADR-0046 etiology, ADR-0076 tendon/tear-location) — leaving thickness as the one remaining exception is the specific inconsistency the surgeon flagged. |
| Model thickness as a `Condition.extension` (mirroring etiology's `condition-dueTo`) | `condition-dueTo` is FHIR's standard extension specifically for *causal* attribution; thickness is not a causal relationship — the Observation pattern (mirroring `TendonsInvolvedObservation`/`TearLocationObservation`) is the established idiom for non-causal diagnostic sub-axes in this IG. |
| Remove the "Shoulder & Visit Status" card entirely and inline laterality into each diagnosis card | Laterality is genuinely one value per registration entry (one patient, one shoulder, one visit — bilateral cases are two registrations), so duplicating the input per diagnosis card would itself reintroduce a redundant-prompt problem, just in the other direction. |
| Keep `verificationStatus` as a dropdown defaulted to "confirmed" | Still prompts the user for a decision with one clinically sensible answer in this workflow — the surgeon's ask was to stop asking, not merely to default the initial value (the field already defaulted to 'confirmed' before this change). |

## Consequences

✅ Q4.c "Partial vs full thickness" and `L3.B.2` verificationStatus both stay Full — no headline coverage change.
✅ All four diagnosis sub-axes the surgeon asked for (tendons, thickness, tear location, etiology) are now uniformly modeled as sibling Observations/extension off `RotatorCuffCondition`, closing the one remaining inconsistency.
✅ `sushi .` compiles with 0 errors / 0 warnings; frontend `npm run build` (tsc + vite) compiles cleanly.
⚠️ `RotatorCuffDiagnosis` version bumped 0.2.0 → 0.3.0 (breaking change to a versioned ValueSet with existing seed data) — seed bundles referencing the retired thickness-specific codes on `Condition.code` need updating as part of the batch checkpoint across all round-2 feedback points.
⚠️ SDC frontend (port 3001) parity not implemented for either point — its genuine duplicate `laterality` item and its own `verificationStatus` handling are unaffected by this ADR, consistent with this IG's standing precedent of SDC parity being a separate call.
*Amended by ADR-0144 (2026-08-03): this standing precedent is retired going forward. These two SDC gaps remain open, tracked as ordinary parity items in the cross-frontend parity audit.*
❌ Seed bundles and their narrative stories not yet updated to reflect the new `TearThicknessObservation` / reordered UI / removed verificationStatus prompt — tracked as follow-up work alongside the remaining round-2 points.

## Sources

- Clinical review by the reviewing shoulder surgeon (round 2), points 7-8
- ADR-0046 (etiology decoupling), ADR-0064 (tendon involvement decoupling), ADR-0076 (tear location decoupling) — precedent for the "one axis, one element" principle
- `ig/input/fsh/profiles/observations/TearThicknessObservation.fsh`
- `ig/input/fsh/valuesets/{RotatorCuffDiagnosis,TearThickness}.fsh`
- `mapping/SECEC_FHIR_Mapping.csv` rows Q4.c, L3.B.2
- `frontend/src/components/{wizard/StepCondition.tsx,ConditionForm.tsx}`
