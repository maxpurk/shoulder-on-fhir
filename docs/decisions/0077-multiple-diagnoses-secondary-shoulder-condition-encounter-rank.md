# ADR-0077: Multiple diagnoses per registration — `condition 1..*`, new `ShoulderDiagnosisCondition` secondary slice, `Encounter.diagnosis.rank` for the principal

**Date:** 2026-07-13
**Status:** Accepted; corrected 2026-07-17 (see §Correction) — `ShoulderDiagnosisCondition` now forbids `condition-dueTo`

## Context

`RotatorCuffRegistrationBundle.condition` was fixed `1..1` — a registration could carry exactly one diagnosis. A shoulder surgeon reviewing the frontend pointed out two real cases this doesn't cover: (1) a combined tear coded as more than one `RotatorCuffCondition` (e.g. a supraspinatus tear and a separately-coded infraspinatus tear rather than a single combined code), and (2) a coexisting **non**-rotator-cuff shoulder diagnosis found alongside the tear (AC joint osteoarthritis, biceps tendinopathy, adhesive capsulitis, etc.) — routine findings on the same imaging study that are not rotator cuff pathology at all and so cannot be forced into `RotatorCuffCondition.code`'s (now-slimmed, ADR-0076) disease-entity value set.

The surgeon's ask — "mehrere Diagnosen … dann am besten noch [eine] Info was die Hauptdiagnose [ist]" (there can be multiple diagnoses; best to also record which one is the principal) — raised a genuinely open design question: what is the FHIR-idiomatic way to rank multiple diagnoses on one visit? `Reference` cardinality alone doesn't express order or a "primary" flag.

## Decision

**Two independent-but-related structural changes:**

**1. `condition 1..* ` + new `otherDiagnosis 0..*` slice** on `RotatorCuffRegistrationBundle`. `condition` (unchanged type: `only RotatorCuffCondition`) now allows more than one rotator-cuff diagnosis; the new `otherDiagnosis` slice (`only ShoulderDiagnosisCondition`) carries zero or more coexisting non-RC shoulder diagnoses. The bundle's pathology guarantee is unaffected — every entry in `condition` is still structurally constrained to `RotatorCuffCondition` regardless of how many there are.

**2. New `ShoulderDiagnosisCondition` profile** (parent `condition-eu-core`, anatomy-region — `Shoulder*`, not `RotatorCuff*`, following the ADR-0066 naming convention since these are not rotator cuff tears) bound to a new `ShoulderDiagnosis` (7 SNOMED codes, verified against the SNOMED terminology server, laterality-neutral where a neutral concept exists — same convention as `TendonsInvolved`, ADR-0043): biceps tendinitis, biceps LHB rupture, AC joint osteoarthritis, glenoid labrum tear, adhesive capsulitis, glenohumeral osteoarthritis, shoulder joint instability). Deliberately carries none of `RotatorCuffCondition`'s RC-specific apparatus — no required `condition-dueTo`, no `stage`/`evidence` staging machinery — since Patte/Goutallier/tendons-involved/tear-location do not apply to e.g. adhesive capsulitis.

**3. `Encounter.diagnosis.rank` as the "Hauptdiagnose" mechanism.** Added `ShoulderEncounter.diagnosis` (`0..*`; `condition 1..1 only Reference(Condition)`; `use` extensible-bound to the FHIR core `diagnosis-role` VS; `rank 1..1`). Rank 1 marks the principal diagnosis; `Encounter.reasonReference` (unchanged, still `1..1`) continues to point at that same principal Condition. `diagnosis` is populated by the frontend only when more than one Condition is submitted — with exactly one, rank is unambiguous and the existing `reasonReference` alone already identifies it, so nothing new needs to be asserted.

This was an open FHIR-modeling question, not something Hurley or the existing IG architecture dictated. `Encounter.diagnosis[].rank` was chosen over alternatives (below) because it is the standard element FHIR defines for exactly this purpose, and because it keeps the ranking metadata on the visit (which diagnosis mattered most **for this encounter**) rather than on the Condition itself (a Condition has no opinion about its own rank — the same tear could be the principal reason for a registration visit and a secondary finding on a later, unrelated visit).

**Registry convention made explicit** (already implicit in the single-laterality-selection UI, now stated in both `RotatorCuffRegistrationBundle` and `RotatorCuffCondition`'s `Description`): one registration entry = one patient + one shoulder side. Every Condition in a bundle — RC or non-RC — must carry the same `bodySite` laterality; a bilateral case is submitted as two separate registrations.

**Frontend** (`StepCondition.tsx`, unified frontend only — SDC frontend parity deferred per the established precedent, ADR-0064): the Diagnosis step now renders a repeatable list of diagnosis cards. The first is always the principal `RotatorCuffCondition` and cannot be removed or retyped; "+ Add another diagnosis" appends entries the clinician can mark `rotator-cuff` or `other`, each rendering the appropriate field set. Laterality, onset date, and status fields are shared across all diagnoses in the entry (one visit, one shoulder). On submit, `RegistrationWizard.buildAllEntries` locates the principal Condition **by its pre-allocated UUID**, not by "first Condition found" (now meaningless with multiple Conditions present), and builds `Encounter.diagnosis[]` from the `{uuid, rank}` list `StepCondition` returns only when more than one diagnosis was submitted.

**Evidence-wiring consequence** (see ADR-0076 for the full before/after): since `TendonsInvolvedObservation`/`TearLocationObservation` are now per-diagnosis and wired directly onto their owning Condition inside `StepCondition` itself, `RegistrationWizard`'s global `EVIDENCE_PROFILE_KEYS` filter — which used to glue *all* tendon observations found anywhere in the bundle onto the single Condition — is trimmed to provocation tests only (Jobe/lift-off/belly-press/bear-hug/hornblower, which remain visit-level, not per-diagnosis, and still get merged onto the principal Condition's `evidence.detail` alongside whatever `StepCondition` already put there).

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| `Condition.extension` custom "is-principal" boolean flag | Reinvents an element FHIR core already defines (`Encounter.diagnosis.rank`); a custom extension for ranking is worse for interoperability than the standard mechanism |
| Order-implies-rank (first entry in the bundle = principal, no explicit field) | Fragile — bundle entry order is not semantically meaningful in FHIR and a downstream consumer has no reliable way to recover intent; `Encounter.diagnosis.rank` makes it explicit and queryable |
| Force secondary shoulder pathology into `RotatorCuffCondition.code` via an "other/unspecified" catch-all code | Defeats the ADR-0076 orthogonalization just completed; a non-RC diagnosis is not a rotator cuff disease entity under any coding, catch-all or otherwise |
| One combined `ShoulderCondition` profile for both RC and non-RC diagnoses (parameterized by code) | Loses the RC-specific required elements (`condition-dueTo`, `stage`, `evidence`) as compile-time guarantees — would need conditional/business-rule validation instead of profile-level cardinality, which is exactly the kind of gap FHIR profiling exists to prevent |

## Consequences

✅ A combined multi-tendon tear or a coexisting non-RC finding no longer has to be squeezed into a single `Condition.code`, force-omitted, or misrecorded as free text.

✅ "Which diagnosis is the Hauptdiagnose" is now a first-class, queryable FHIR element rather than convention-by-omission.

✅ `RotatorCuffRegistrationBundle` version bumped 0.4.0 → 0.5.0 (widening `condition` `1..1` → `1..*` is non-breaking for existing conformant submissions; the new `otherDiagnosis` slice is `0..*` and additive). `ShoulderEncounter` bumped 0.3.0 → 0.4.0 (new `0..*` `diagnosis` element, additive).

⚠️ SDC frontend (`sdc-frontend/`, port 3001) does not yet support multiple diagnoses or the `ShoulderDiagnosisCondition` profile — known, deliberate deferral matching the ADR-0064 precedent for the unified-frontend-first rollout of a diagnosis-modeling change.
*Amended by ADR-0144 (2026-08-03): the ADR-0064 "SDC parity is a separate call" precedent this note relies on is retired going forward. This gap remains open, tracked as an ordinary parity item in the cross-frontend parity audit, not a permanently accepted deferral.*

⚠️ `ConditionForm.tsx` (the standalone edit-existing-condition page reached from patient detail) still edits one `RotatorCuffCondition` at a time and does not yet support creating/editing `ShoulderDiagnosisCondition` instances or re-ranking `Encounter.diagnosis` after the fact — post-hoc multi-diagnosis editing is a known follow-up, not addressed here (new diagnoses are entered at registration time via `StepCondition.tsx`).

Mapping impact: no Hurley denominator change (this is Layer 2 / IG-operational structure — `L3.E.1` and a new row for `ShoulderDiagnosisCondition` + `Encounter.diagnosis.rank`); `SECEC_FHIR_Mapping.csv`/`.md` updated accordingly.

## Correction (2026-07-17)

End-to-end validation of a frontend-submitted registration bundle — driven through the actual Registration wizard against the real validator sidecar on the deployment server, per the new TX-testing policy (ADR-0080) — surfaced a real bug in this ADR's slicing design: `RotatorCuffRegistrationBundle`'s `entry` slicing uses a `#profile`-type discriminator, which differentiates slices by full structural conformance, not by the literal `meta.profile` string. `ShoulderDiagnosisCondition` turned out to be a structural *subset* of `RotatorCuffCondition` (same `clinicalStatus`/`verificationStatus`/`category`/`bodySite`/`subject` cardinalities; both `code` bindings are `extensible`, so a mismatched code only warns, never fails conformance) with nothing to stop a `RotatorCuffCondition` instance — which carries the required `condition-dueTo` extension — from also structurally satisfying `ShoulderDiagnosisCondition`, whose `extension` was left open. Every principal diagnosis therefore failed validation with `Element matches more than one slice - condition, otherDiagnosis`.

Fix: `ShoulderDiagnosisCondition` now explicitly forbids `condition-dueTo` (`0..0`) rather than merely omitting it — enforcing in the profile what its own Description already claimed ("carries none of RotatorCuffCondition's RC-specific apparatus"). This makes the two profiles structurally disjoint, restoring an unambiguous `#profile` discriminator without touching the bundle's slicing scheme or any of the other ten (already-working) `entry` slices. `ShoulderDiagnosisCondition` bumped 0.1.0 → 0.1.1. Verified by re-running the same frontend → sidecar smoke test on the deployment server: the ambiguous-slice error is gone, no other slice is affected.

## Sources

- `ig/input/fsh/profiles/RotatorCuffRegistrationBundle.fsh`
- `ig/input/fsh/profiles/ShoulderDiagnosisCondition.fsh` (new)
- `ig/input/fsh/valuesets/ShoulderDiagnosis.fsh` (new)
- `ig/input/fsh/profiles/ShoulderEncounter.fsh`
- `frontend/src/components/wizard/StepCondition.tsx`, `stepFormData.ts`, `RegistrationWizard.tsx`, `lib/encounterBuilder.ts`, `types/fhir.ts`
- `ig/input/fsh/examples/RotatorCuffCondition.fsh` (`ExampleShoulderDiagnosisCondition`)
- `example_data/anna_mueller_01_registration.json`, `example_data/anna_mueller_story.md`
- ADR-0037 (Encounter-as-anchor pattern, `reasonReference` precedent), ADR-0043 (laterality-neutral SNOMED convention), ADR-0064/ADR-0066 (anatomy-region vs. RC-pathology naming), ADR-0076 (diagnosis axis orthogonalization, the companion decision this ADR depends on)
- Clinical review by the reviewing shoulder surgeon (2026-07-13)
