# ADR-0173: SDC frontend populates `Condition.stage.assessment` — parity with unified per ADR-0073

**Date:** 2026-08-22
**Status:** Accepted
**Implements:** ADR-0073 (Observation→Condition three-bucket linkage)
**Relates to:** ADR-0135 (documented the root-cause blanket routing), ADR-0144 (mandatory same-pass SDC parity), ADR-0064/0076/0106 (evidence.detail members), limitation 0011 (logged this gap)

## Context

ADR-0073 established a three-bucket policy for linking `ShoulderObservation` instances back to the
`RotatorCuffCondition`:

- **`Condition.stage.assessment`** (formal grading): `PatteObservation`, `GoutallierObservation`,
  `TearSizeClassificationObservation` (Cofield) — they presuppose the diagnosis and grade its severity.
- **`Condition.evidence.detail`** (diagnostic evidence): `TendonsInvolvedObservation`,
  `TearLocationObservation`, `TearThicknessObservation`, and the provocation tests.
- **Neither** (encounter chain only): the raw `TearSizeObservation` (cm) — a measurement, not a
  grading or evidence.

The unified frontend, the two hand-authored longitudinal seed patients (Anna, Kemal), and the IG
example all implement this split correctly. The **SDC frontend did not**: `bundleAssembler.ts`
routed *every* `category=imaging` Observation — the gradings included — through a single
`attachConditionEvidence()` into `evidence.detail` (a blanket `isImagingObservation()` filter,
introduced as convenient reuse in ADR-0135 without awareness that it mis-files the gradings). Result:
`Condition.stage.assessment` — a Must-Support element — was silently never populated by one of the
two production frontends, and the grading observations were double-purposed as "evidence" for a
diagnosis they presuppose, exactly the semantics ADR-0073's "Not adopted" section rejects. Found by
a live `Patient/$everything` comparison of a unified-created vs. an SDC-created patient (limitation
0011). ADR-0144 makes SDC parity mandatory, so this is closed now rather than deferred.

## Decision

- **SDC `bundleAssembler.ts` splits imaging-classification Observations into two buckets** by profile,
  mirroring the unified frontend's `STAGE_PROFILE_KEYS`:
  - `STAGE_PROFILE_KEYS` = `patte-observation`, `goutallier-observation`,
    `tear-size-classification-observation` → `Condition.stage[0].assessment[]`.
  - `EVIDENCE_IMAGING_PROFILE_KEYS` = `tendons-involved-observation`, `tear-location-observation`,
    `tear-thickness-observation` → `Condition.evidence.detail`.
  - Raw `tear-size-observation` (cm) matches neither list and lands in neither bucket — matching the
    seed data and ADR-0073 (previously it was wrongly swept into `evidence.detail`).
  `attachConditionEvidence()` is replaced by `attachConditionStageAndEvidence()`; the observation
  loop collects `stageObservationUuids` / `evidenceObservationUuids` and wires both.
- **Documentation corrected to match ADR-0073** (it had drifted to a pre-split "everything via
  evidence.detail" description):
  - `RotatorCuffCondition.fsh` Description prose reworded to state the two buckets (element rules were
    already correct; only the human-readable narrative was stale).
  - `mapping/SECEC_FHIR_Mapping.csv`: row **L3.F.3** broadened to name both
    `Condition.stage.assessment` and `Condition.evidence.detail` (kept as **one** linkage row — Layer 2
    stays 44, no count change); the **Q5** note and the **Q4.a/Q4.d/Q4.e** rows now state the
    `stage.assessment` linkage for the gradings. `.md` Section-F summary + a new interpretation note.
  - Thesis prose (appendix Q4 rows + the L3.F.3 operational row + the cross-resource-reference lists
    in Methods/Results) now names `stage.assessment` alongside `evidence.detail`.
- **IG example** `RotatorCuffCondition.fsh` gains a `GoutallierObservation` reference in
  `stage[0].assessment` so it demonstrates two gradings, not just Patte.

## Consequences

- ✅ An SDC-created `RotatorCuffCondition` now carries `stage.assessment` = Patte/Goutallier/Cofield
  and `evidence.detail` = tendons/location/thickness — identical to the unified frontend and the seed
  data. Downstream consumers querying `stage.assessment` for formal gradings get complete results
  regardless of which frontend created the patient.
- ✅ Closes limitation 0011.
- ✅ No consensus-coverage change; no Layer-2 count change (the linkage stays one L3.F row covering
  both paths).
- ✅ SDC `npm run build` + ESLint clean; `sushi .` 0 errors / 0 warnings.
- ◽ The mapping/thesis had described all Observation→Condition linkage as `evidence.detail` since the
  pre-ADR-0073 era (ADR-0064 wording); this ADR is the point at which that documentation is brought
  in line with the model the code and seed already followed.

## Sources

- `sdc-frontend/src/lib/bundleAssembler.ts` (stage/evidence split)
- `ig/input/fsh/profiles/RotatorCuffCondition.fsh` (Description prose), `examples/RotatorCuffCondition.fsh`
- `mapping/SECEC_FHIR_Mapping.csv` (L3.F.3, Q5, Q4.a/d/e) + `.md` (Section-F, interpretation note)
- the thesis appendix,04_methods,05_results chapter(s)
- ADR-0073 (policy), ADR-0135 (root cause), ADR-0144 (mandatory parity); limitation 0011 (resolved)
