# ADR-0064: Tendons involved as a structured Observation linked via Condition.evidence.detail

**Date:** 2026-05-24
**Status:** Accepted
**Supersedes:** the dual-content `bodySite` convention introduced by [ADR-0014b](0014b-precoordinated-snomed-bodysite.md) ("first entry laterality, additional entries may name specific tendon(s)")
**Builds on:** [ADR-0008](0008-abstract-base-27-derived-observation-profiles.md) (one profile per Observation type), [ADR-0010](0010-custom-codesystems-orthopedic-terminology.md) (custom CodeSystems for orthopedic terminology), [ADR-0037](0037-registration-bundle-encounter-and-linkage-closure.md) (registration Encounter + linkage closure), [ADR-0043](0043-tendon-codes-replace-muscle-codes.md) (laterality-neutral SNOMED tendon codes), [ADR-0047](0047-tear-size-dual-encoding.md) (sibling pattern — Cofield bucket as a dedicated Observation)

## Context

`RotatorCuffCondition.bodySite` was previously bound to `ShoulderLaterality (extensible)` `1..*`, and the IG documented a convention (ADR-0014b) that the **first** `bodySite` entry carried laterality (`91774008` / `91775009` shoulder region codes) while **additional** entries named the affected tendon(s) using SNOMED tendon-structure codes from `TendonsInvolved` (`5580002` / `59713001` / `80108009` / `700027005`). This convention was the fallback after ADR-0014a's slicing attempt was rejected by the IG Publisher's snapshot generator (HTTP 422 on open-pattern slicing of a CodeableConcept).

The validator surfaced two warnings on every multi-entry instance:

```
None of the codings provided are in the value set 'ShoulderLaterality'
  …#5580002  "Structure of tendon of supraspinatus muscle"
  …#700027005 "Structure of tendon of teres minor"
```

The warnings were a symptom of a deeper categorical mistake. `Condition.bodySite` is "anatomical location of the condition" — a single semantic slot. *Which tendons are involved in the tear* is **structured clinical detail derived from imaging or intra-operative inspection**, not a body location. Mixing the two categories in one element forces the binding to either (a) cover only laterality (and emit warnings on tendon entries, as observed), (b) widen to a union of unrelated semantic categories (silencing the warning by making the binding less informative — an anti-pattern), or (c) re-attempt slicing (already known to fail in the IG Publisher snapshot generator).

The IG already has the canonical FHIR home for structured clinical detail about a Condition: **`Condition.evidence.detail → Observation`**, the pattern used by `PatteObservation` (Q4.d, tendon retraction), `GoutallierObservation` (Q4.e, fatty infiltration), and `TearSizeClassificationObservation` (Q4.a categorical bucket, ADR-0047). The mapping CSV at row `L3.F.3` already names "Q4.b tendons" alongside Patte and Goutallier in the evidence-detail linkage path — i.e., the mapping's own cross-resource-linkage row had drifted ahead of the Q4.b implementation row by treating tendons as evidence.detail content.

Two alternatives — adopt the mCODE laterality-qualifier extension pattern across all `bodySite` elements, or drop tendon detail entirely and rely on tendon-specific diagnosis codes in `RotatorCuffDiagnosis` — were considered and rejected. The mCODE pattern is the right answer when both anatomy granularity and laterality need to live together on the same element; here, the natural separation is *anatomy code on the Observation, laterality on the Condition's bodySite*, so adopting mCODE would be over-engineering. The diagnosis-code-only version loses multi-tendon granularity (notably for teres minor, which has no tendon-specific SNOMED diagnosis code), which would force an honest Q4.b Full → Partial downgrade. The Observation pattern preserves Q4.b Full and remains internally consistent with the IG's existing structured-evidence pattern.

## Decision

1. **Introduce `TendonsInvolvedObservation`** (`ig/input/fsh/profiles/observations/TendonsInvolvedObservation.fsh`):
   - `Parent: ShoulderObservation` (so `Condition.evidence.detail only Reference(ShoulderObservation)` already accepts it without further constraint change).
   - `code = ShoulderObservationCodes#tendons-involved` (new local concept added to `ShoulderObservationCodes` CS; no fitting SNOMED CT `observable_entity` or LOINC concept exists, verified May 2026 against `tx.fhir.org` SNOMED and the LOINC FHIR terminology server — same standard-terminology-first methodology applied in ADR-0010 / ADR-0045 / ADR-0047).
   - `value[x] only CodeableConcept`; `valueCodeableConcept 1..1 MS from TendonsInvolved (extensible)`.
   - One Observation per affected tendon — natural multi-tendon support, including teres minor.

2. **Tighten `RotatorCuffCondition.bodySite`** to its semantically correct single purpose:
   - `bodySite 1..1 MS` (was `1..*`).
   - `bodySite from ShoulderLaterality (required)` (was `extensible`). The binding can now be safely tightened to `required` because the only legitimate content is one of the two pre-coordinated SNOMED shoulder-region codes; ADR-0014b's pre-coordinated SNOMED region choice stands for laterality.
   - Drop the "first entry laterality, additional entries may name specific tendon(s)" convention text from the FSH header and the inline comment block.

3. **Update `RotatorCuffCondition.evidence.detail` short text** to mention the four classification Observations now populated by the registration bundle builder: Patte, Goutallier, tear size (linear + Cofield bucket), **tendons involved**. No structural change to `evidence.detail` itself.

4. **Retain `TendonsInvolved`** (per ADR-0043 corrected to laterality-neutral SNOMED tendon-structure codes). The binding moves from `RotatorCuffCondition.bodySite` to `TendonsInvolvedObservation.valueCodeableConcept`. No VS edit required.

5. **Update `SECEC_FHIR_Mapping.csv` row Q4.b** to reflect the new structural home (`Condition.evidence.detail → TendonsInvolvedObservation.valueCodeableConcept`); also refresh the codes column from the pre-ADR-0043 muscle codes to the corrected tendon codes. **Q4.b coverage stays Full** — the structured slot still binds extensibly to four standard SNOMED tendon concepts.

6. **Frontend (unified, port 3000):**
   - Remove the tendon multi-select from `ConditionForm.tsx`.
   - Add the tendon multi-select to the Imaging step (`StepImaging.tsx`) next to the existing Patte and Goutallier inputs — tendon involvement is imaging-derived, so it semantically belongs there.
   - `RegistrationWizard.tsx` emits one `TendonsInvolvedObservation` per selected tendon and appends `evidence.detail` references on the Condition, mirroring the existing Patte/Goutallier wiring.
   - `PatientDetail.tsx` renders tendons from `Condition.evidence.detail` (resolved to `TendonsInvolvedObservation.valueCodeableConcept`), no longer from `Condition.bodySite[*]`.
   - The SDC frontend (port 3001) is **out of scope** for this change and will continue to emit the old dual-content `bodySite` shape until a follow-up update. Captured as a known follow-up.
     *Amended by ADR-0144 (2026-08-03): this ADR is the origin of the "SDC parity is a separate call" precedent later ADRs cited as standing policy — that policy is retired going forward. This specific SDC gap remains open and untouched by the amendment; it is tracked as an ordinary parity item in the cross-frontend parity audit.*

7. **Seed bundle (`seed/bundles/example-patients.json`):** rewrite each of the three RotatorCuffCondition instances — strip tendon entries from `bodySite` (keeping only the laterality entry), add a `TendonsInvolvedObservation` per previously-listed tendon, and append `evidence.detail` references. Patient 3's massive multi-tendon tear (supraspinatus + infraspinatus) becomes the canonical multi-tendon demonstration.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **Widen the `bodySite` binding** to a union VS (`ShoulderLaterality ∪ TendonsInvolved`) | Silences the validator warning by making the binding less informative; an anti-pattern. Bindings exist to express intent, not to suppress warnings. Mixes semantically distinct categories (region vs. tendon) in one slot. |
| **Re-attempt `bodySite` slicing** with newer IG Publisher | The ADR-0014a HTTP 422 snapshot-generator failure may have been resolved upstream, but reintroducing slicing complexity to enforce a convention that is better expressed by separating concerns across resources is solving the wrong problem. |
| **mCODE laterality-qualifier extension** (anatomy in `bodySite[*]`, laterality as a per-element extension qualifier) | The canonical FHIR answer when both anatomy granularity and laterality must live on the same element. Here the natural separation is *laterality on the Condition.bodySite, tendon anatomy on a dedicated Observation* — adopting mCODE would over-engineer the case where pre-coordinated SNOMED region codes already cleanly serve `bodySite`. Documented for future reference if anatomy granularity ever needs to coexist with laterality on `bodySite` (e.g., for partial-shoulder-region structures). |
| **Drop tendon detail entirely** and rely on `Condition.code` (tendon-specific SNOMED diagnoses in `RotatorCuffDiagnosis`) | Loses multi-tendon granularity when `Condition.code` is generic ("Rupture of rotator cuff of shoulder", "Full thickness rotator cuff tear"). Forces Q4.b honest re-baseline Full → Partial. Teres minor has no tendon-specific diagnosis code and would become unrecordable. |
| **One `RotatorCuffCondition` per torn tendon** | Cleanest FHIR semantics (Condition per problem), but changes the clinical idiom — surgeons think of "one rotator cuff tear" not "two Conditions". Complicates `Procedure.reasonReference` (which Condition does the surgery target?) and runs against the existing one-Condition-per-shoulder pattern. |
| **Custom `tendons-involved` extension on `RotatorCuffCondition`** | Treats tendon involvement as ad-hoc registry metadata rather than the structured clinical observation it actually is. Misses the existing IG pattern (Patte / Goutallier / Cofield bucket) and the mapping's own cross-resource-linkage row L3.F.3 which already classifies tendons as evidence.detail content. |

## Consequences

✅ `Condition.bodySite` returns to its single semantic purpose (laterality). Binding tightens from `extensible` to `required`, cardinality from `1..*` to `1..1`. Two validator warnings on `RotatorCuffCondition` are eliminated at the root.
✅ Tendon involvement is captured in the IG-canonical FHIR home for structured clinical evidence, mirroring Patte / Goutallier / Cofield-bucket. Multi-tendon involvement is natural (one Observation per tendon).
✅ SECEC Q4.b coverage stays **Full**. The mapping CSV row points at the new home; row L3.F.3 (which already named "Q4.b tendons" alongside Patte and Goutallier) is now consistent with the Q4.b implementation row.
✅ `TendonsInvolved` (ADR-0043 corrected SNOMED tendon-structure codes) is preserved unchanged, just rebound.
✅ The IG ValueSet count rises by 0 (no new VS), the derived-Observation-profile count rises from 37 → 38, the `ShoulderObservationCodes` CS gains one concept (`tendons-involved`).
✅ Frontend (port 3000) UX improves: tendon multi-select now lives next to the imaging classifications (Patte, Goutallier, Cofield bucket) where it semantically belongs.
⚠️ SDC frontend (port 3001) is intentionally not updated in this change. The SDC extractor will continue to emit the old dual-content `bodySite` shape and will surface validation warnings against the new tighter binding when SDC submissions are tested. Follow-up work tracked.
⚠️ ADR-0014b's pre-coordinated SNOMED shoulder-region codes for laterality are retained; only the "additional entries may name specific tendon(s)" convention is superseded.

## Longitudinal tendon involvement

A multi-tendon tear that emerges over time (e.g., supraspinatus tear diagnosed in January; infraspinatus tear added on a follow-up MRI a month later) admits two FHIR-valid shapes under the pattern above:

- **Shape 1 — one evolving Condition.** Append a second `TendonsInvolvedObservation` to the existing `RotatorCuffCondition.evidence.detail` list. The Condition models *rotator cuff disease* as one entity; each Observation carries its own `effectiveDateTime`, preserving when each tendon's involvement became known.
- **Shape 2 — one Condition per diagnostic event.** Create a new `RotatorCuffCondition` with its own `onsetDateTime` and its own evidence Observations. Each tear has an independent clinical lifecycle (active / resolved).

Both shapes are structurally supported (`Condition.evidence.detail` is `0..*` and FHIR does not constrain when references are added). The current Registration wizard implements **Shape 2** by default — every registration encounter creates a fresh `RotatorCuffCondition`; the UI does not expose updating an existing Condition's evidence list. If a future SECEC workflow analysis identifies longitudinal Condition updates as a registry requirement, Shape 1 can be wired in without changing the data model — a follow-up ADR can document the wizard / lookup changes needed.

## Sources

- `ig/input/fsh/profiles/observations/TendonsInvolvedObservation.fsh` — the new profile (parent ShoulderObservation, code ShoulderObservationCodes#tendons-involved, value CodeableConcept bound to TendonsInvolved).
- `ig/input/fsh/codesystems/ShoulderObservation.fsh` — `#tendons-involved` concept added; CS count bumped 19 → 20.
- `ig/input/fsh/profiles/RotatorCuffCondition.fsh` — `bodySite 1..1 required`; FSH header updated.
- `ig/input/fsh/examples/ShoulderObservation.fsh` + `ig/input/fsh/examples/ShoulderBundle.fsh` + `ig/input/fsh/examples/RotatorCuffCondition.fsh` — new example wired through.
- `seed/bundles/example-patients.json` — three RotatorCuffCondition instances rewritten; four new `TendonsInvolvedObservation` resources added (OBS-CLASS-003 / 004 / 005 / 006).
- `mapping/SECEC_FHIR_Mapping.csv` row Q4.b — repointed; codes refreshed to ADR-0043 corrected values.
- `frontend/src/components/ConditionForm.tsx`, `frontend/src/components/wizard/StepImaging.tsx`, `frontend/src/components/RegistrationWizard.tsx`, `frontend/src/components/PatientDetail.tsx` — multi-select moved from Condition step to Imaging step; bundle assembly emits one Observation per tendon; detail view reads tendons from evidence.detail.
- Validator output before/after this change: two `ShoulderLaterality` warnings on `RotatorCuffCondition.bodySite` removed (verified against the validator warning report from that run).
