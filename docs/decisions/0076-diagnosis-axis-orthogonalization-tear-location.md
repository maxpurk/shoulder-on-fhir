# ADR-0076: Orthogonalize `RotatorCuffDiagnosis` (remove tendon/etiology overlap) + add tear-location as a Q4 refinement

**Date:** 2026-07-13
**Status:** Accepted

## Context

A shoulder surgeon reviewing the live Registration frontend flagged that the diagnosis-capture step "does not work perfect": `RotatorCuffDiagnosis` (bound on `RotatorCuffCondition.code`) mixed codes describing four different, overlapping axes in a single pick-one dropdown:

- **disease entity** — rupture, tear arthropathy, tendinitis, impingement, calcific tendinitis
- **which tendon** — `399346004` Supraspinatus tear, `209754000` Rupture of infraspinatus tendon, `209755004` Rupture subscapularis tendon
- **thickness** — full-thickness vs. partial-thickness (a genuine Q4.c distinction)
- **etiology** — `698299009` Traumatic rupture of rotator cuff, `424175006` Nontraumatic rotator cuff tear

Two of those four axes were pure redundancy: which tendon is already captured by `TendonsInvolvedObservation` (Q4.b, `Condition.evidence.detail`, ADR-0064), and traumatic/non-traumatic etiology is already captured by the required `condition-dueTo` extension (Q1.e, ADR-0046). A clinician picking "Supraspinatus tear" as the diagnosis code, while ALSO recording "supraspinatus" in `TendonsInvolvedObservation` and "traumatic" in `condition-dueTo`, was recording the same facts twice through structurally different mechanisms — a genuine data-quality hazard (the two could silently disagree) that predates this fix: the seed bundle's `COND-002` example carried both `202842005` (Partial thickness rotator cuff tear) and `424175006` (Nontraumatic rotator cuff tear) as sibling `code.coding[]` entries on one Condition that *already* had a `condition-dueTo` extension recording "Degenerative disorder" separately.

Separately, the surgeon asked for tear location along the tendon's course (ansatznah / musculotendinös / intratendinös — near the insertion / at the musculotendinous junction / intratendinous) — a distinct axis from Patte (which grades how far the torn stump has *retracted*, not where the tear originated). After discussion, this was scoped as **in-scope of the Hurley Q4 consensus** (a decomposition/refinement choice this thesis is free to make, since Hurley names "tear classification" without fixing its sub-axes — the same status Patte and Goutallier already have), not an out-of-consensus addition.

## Decision

**`RotatorCuffDiagnosis` slimmed to disease-entity codes only** (`ig/input/fsh/valuesets/RotatorCuffDiagnosis.fsh`, v0.1.0 → v0.2.0): removed the three tendon-specific codes and the two etiology codes; kept `926335004` (Rupture of RC), `202843000`/`202842005` (full/partial thickness — Q4.c), `415352004` (tear arthropathy), `789754007` (tendinitis), `359532006` (impingement), `27741009` (calcific tendinitis). `RotatorCuffCondition.code` binding stays `extensible` (unchanged — ADR-0032's editorial-baseline stance).

**New `TearLocationObservation`** (child of `ShoulderObservation`), bound `required` to a new local `TearLocation` CodeSystem/ValueSet (`insertion-near` / `musculotendinous` / `intratendinous`) — the same modeling pattern as `PatteObservation`/`GoutallierObservation` (local classification, `required` binding, since no precoordinated SNOMED CT concept exists for this axis — verified July 2026 via the SNOMED terminology server, same verification discipline as ADR-0027/ADR-0045). Linked to its Condition via `evidence.detail` (`RotatorCuffCondition.evidence`, alongside `TendonsInvolvedObservation`) — a diagnostic-evidence-not-staging classification per ADR-0073's Bucket 3, since tear location is descriptive of the tear itself rather than a post-diagnosis severity grade like Patte/Goutallier (Bucket 2).

`RotatorCuffCondition`'s `Description` updated to state explicitly which axes `code` does and does not carry, and to note that multiple `RotatorCuffCondition` instances may coexist (see ADR-0077) and that a coexisting non-RC diagnosis uses a separate profile.

**Example data fixed to remove the pre-existing overlap**, not just to avoid the now-slimmed VS's extensible-binding warning:
- `ig/input/fsh/examples/RotatorCuffCondition.fsh` — `code` changed from `399346004` (Supraspinatus tear) to `202843000` (Full thickness rotator cuff tear); a new `ExampleTearLocationObservation` added to `evidence.detail`.
- `seed/bundles/example-patients.json` — two occurrences of `698299009` (Traumatic rupture of rotator cuff, on a Condition whose `condition-dueTo` already said "Traumatic event") corrected to `202843000`; the `COND-002` double-coding described above (`202842005` + redundant `424175006`, sitting alongside its own already-correct `condition-dueTo` extension) reduced to the single disease-entity code.
- `example_data/anna_mueller_01_registration.json` (the longitudinal reference case) — same `399346004` → `202843000` fix, plus a new `TendonsInvolvedObservation` (supraspinatus) and `TearLocationObservation` (insertion-near) added and wired into `evidence.detail`, so the "which tendon" fact that used to live implicitly in the diagnosis code is still present in the story, just through the correct structural mechanism. `anna_mueller_story.md` updated to narrate the new resources.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep tendon/etiology codes in `RotatorCuffDiagnosis` as a convenience for sites that don't want to populate the separate mechanisms | The `extensible` binding already tolerates a site adding its own codes if truly needed; keeping known-redundant codes in the IG's own editorial baseline invites exactly the double-coding-that-can-disagree failure mode the seed data already exhibited |
| Model tear location as free text on `Condition.code.text` or the existing "Additional Description" field | Not queryable/comparable across registry entries — defeats the purpose of a structured registry element, and inconsistent with how Patte/Goutallier are already modeled as dedicated Observations |
| Treat tear location as an out-of-consensus addition requiring a separate go/no-go | Superseded by the explicit scoping decision that this is a Q4 refinement (Hurley names "tear classification" generically; the sub-axes are a design choice already exercised for Patte/Goutallier) |

## Consequences

✅ A rotator-cuff diagnosis is now coded exactly once per axis: disease entity (`Condition.code`), tendon (`TendonsInvolvedObservation`), etiology (`condition-dueTo`), retraction (`PatteObservation`), fatty infiltration (`GoutallierObservation`), tear size (`TearSizeObservation`/`TearSizeClassificationObservation`), and now tear location (`TearLocationObservation`) — no two elements can disagree about the same fact because no two elements state the same fact.

✅ Closes a real, pre-existing data-quality gap in the seed example data (`COND-002`'s redundant etiology coding), not just a hypothetical one.

⚠️ `RotatorCuffDiagnosis` version bump (0.1.0 → 0.2.0) is a narrowing of an `extensible`-bound ValueSet — non-breaking for conformance (extensible only requires *a* member code be present, and the disease-entity codes remain), but any external consumer that was relying on the removed tendon/etiology codes appearing in this specific VS's `$expand` will need to read them from `TendonsInvolved`/`RotatorCuffEtiology` instead.

Mapping impact: `L3.E.1` (diagnosis code value set, Layer 2) notes updated to describe the narrower scope; Q4.b (`SECEC_FHIR_Mapping.csv`) unaffected (still Full via `TendonsInvolvedObservation`); tear location is a new Layer-2 row under the Q4 refinement family (not a new Hurley element — no denominator change).

## Sources

- `ig/input/fsh/valuesets/RotatorCuffDiagnosis.fsh`
- `ig/input/fsh/profiles/RotatorCuffCondition.fsh`
- `ig/input/fsh/profiles/observations/TearLocationObservation.fsh` (new)
- `ig/input/fsh/codesystems/TearLocation.fsh` (new)
- `ig/input/fsh/valuesets/TearLocation.fsh` (new)
- `ig/input/fsh/examples/RotatorCuffCondition.fsh`, `ig/input/fsh/examples/ShoulderObservation.fsh`
- `seed/bundles/example-patients.json`
- `example_data/anna_mueller_01_registration.json`, `example_data/anna_mueller_story.md`
- `frontend/src/components/wizard/StepCondition.tsx` — Tendons Involved field moved above Diagnosis ("erst Sehne, dann … welche Erkrankung"); new Tear Location field
- ADR-0064 (`TendonsInvolvedObservation` precedent), ADR-0046 (`condition-dueTo`), ADR-0032 (`RotatorCuffDiagnosis` editorial scope), ADR-0073 (evidence/stage linkage buckets)
- Clinical review by the reviewing shoulder surgeon (2026-07-13)
