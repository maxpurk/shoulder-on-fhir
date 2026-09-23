# ADR-0099: Retire the cross-sectional seed file; adopt a second longitudinal patient case; generalize the seed loader

**Date:** 2026-07-25
**Status:** Accepted

> **Status update (2026-08-16, ADR-0168):** step 5's note that the `example_data/` stories,
> loaders and validators sit outside the deploy-mirror subtree no longer holds. ADR-0168 moved
> `example_data/` (and `mapping/`) into the published subtree, so those files now ship alongside
> the seed bundles. The rest of this ADR is unaffected.

## Context

The demo dataset had accumulated two structurally incompatible paradigms side by side:

- `seed/bundles/example-patients.json` — a single hand-maintained file holding three **cross-sectional**, one-shot patients (Hans Peter Schmidt / `PAT-001`, Maria Müller / `PAT-002`, Klaus Weber / `PAT-003`), loaded by `seed/load-seed-data.sh`. Each patient was a flat bundle of Patient + Condition + Procedures + Observations with no encounter structure or temporal progression — a batch loader, not a patient journey. `tools/validate.sh` even carried a standing comment explaining that this file *couldn't* conform to `RotatorCuffRegistrationBundle` (3 patients in one bundle violates the profile's 1..1 cardinality), which had been true and accepted since the file's introduction.
- `seed/bundles/anna-mueller/` — the clean, realistic **longitudinal** Anna Müller case introduced later: 7 sequential transaction bundles (registration → surgery → 5 follow-ups over 24 months, `PAT-LONG-001`), each independently conformant to its own declared bundle profile, with a narrative walkthrough (`example_data/anna_mueller_story.md`) as the project's best end-to-end reference.

A direct user instruction: delete the three cross-sectional patients, keep Anna, and author a second realistic longitudinal patient in the same mould — then wire it through the full local → git → server deploy loop so it loads automatically.

The workers'-compensation demonstration was a specific casualty of deleting Schmidt: `Coverage.type = v3-ActCode#WCBPOL` (ADR-0061, "Q1.l workmen's compensation" Partial→Full) had exactly one exerciser in the whole seed dataset — Schmidt's Coverage resource — and losing it without replacement would have left the WCBPOL modeling decision undemonstrated in any loadable example data.

## Decision

**1. Delete the cross-sectional seed file and its loader.** `seed/bundles/example-patients.json` and `seed/load-seed-data.sh` are removed outright; `build-and-deploy.sh`'s call to the latter is removed.

**2. Generalize `build-and-deploy.sh`'s longitudinal-seed loading from one hardcoded case to N auto-discovered cases.** The prior implementation had `ANNA_MUELLER_DIR` hardcoded and a single if-block gated on `PAT-LONG-001`. This is replaced with a loop over every subdirectory of `seed/bundles/`: for each case directory, the loader reads the Patient identifier out of that case's own `*_01_*.json` (registration) bundle via `jq`, checks presence in HAPI by that identifier, and — only if absent — POSTs every bundle in the directory in filename order. Adding a third, fourth, ... longitudinal patient in the future requires zero changes to `build-and-deploy.sh`; dropping a new `seed/bundles/<slug>/` directory in is sufficient.

**3. Add a second longitudinal case: Kemal Demir (`PAT-LONG-002`).** Deliberately contrasts Anna on every axis rather than being a palette-swap of the same story:

| Axis | Anna Müller (`PAT-LONG-001`) | Kemal Demir (`PAT-LONG-002`) |
|---|---|---|
| Sex / age | Female, 52 | Male, 48 |
| Etiology | Degenerative (insidious onset) | Traumatic (fall from a ladder at work) |
| Tendons involved | Supraspinatus only | Supraspinatus (full) + infraspinatus (partial) |
| Prior conservative trial | 12wk PT + 1 injection, both failed | None — clinically appropriate for an acute 2-tendon trauma, not a data gap |
| Coverage | `PUBLICPOL` (statutory, AOK) | `WCBPOL` (Berufsgenossenschaft der Bauwirtschaft) — restores the ADR-0061 demonstration lost with Schmidt |
| Occupation | Schoolteacher (overhead-repetitive) | Roofer (heavy-manual) |
| Surgery | Arthroscopic single-row repair | Arthroscopic double-row repair |
| Recovery trajectory | Steady, near-full (Constant 38→89, SSV 35→92) | Starts lower, trails throughout, good-but-not-full plateau (Constant 28→82, SSV 28→84) |
| Secondary diagnosis / comorbidities | AC joint OA + hypertension + T2 diabetes | None — demonstrates these slices are legitimately optional (0..\*) |

Structurally, Kemal's 7 bundles are an exact mechanical mirror of Anna's template: same PUT-if-referenced/POST-if-standalone convention, same Encounter-as-anchor pattern, same diagnosis-modeling split (`Condition.code` = disease entity; tendon involvement via `evidence.detail` → `TendonsInvolvedObservation`, one instance per tendon per the ADR-0064 pattern — two instances here, versus Anna's one; classification grades via `stage.assessment`), same per-visit Observation histogram (6wk minimal → 12mo fullest with satisfaction + return-to-activity + 90°-abduction rotations → 24mo confirmatory). No new profiles, ValueSets, or CodeSystems were added — every code used already exists in the IG.

Clinical parameters (exam findings, imaging classification, PROM trajectory) were reviewed by the `shoulder-surgeon` subagent before authoring: confirmed the no-prior-treatment framing, set Goutallier 0 and a Cofield "large" (not "massive") tear-size bucket to stay consistent with an acute, low-chronicity mechanism, and set the slower/lower-plateauing recovery numbers reflecting the two-tendon repair and heavier occupational return-to-work demand. All terminology codes were verified against authoritative sources before use — new ones for this case: SNOMED `59713001` (infraspinatus tendon, from the IG's existing `TendonsInvolved` ValueSet), LOINC `LA18976-3` (current every day smoker, verified by extracting the actual IPS `current-smoking-status-uv-ips` package tarball rather than guessing), LOINC `LA27752-7` / `LA24974-0` (satisfaction scale answers, read directly from `SatisfactionScale.fsh`).

**4. Repoint `tools/validate.sh`'s seed-validation stage from the single deleted file to a glob over every case directory** (`seed/bundles/*/*.json`). This is a strictly stronger check than before: the old file's batch-of-3-patients structure could never conform to its own bundle-level profile by design (documented as accepted in the script's own comment); every bundle in every longitudinal case directory is individually conformant to its declared bundle profile, so this stage now validates real profile conformance instead of only per-entry `meta.profile` conformance.

**5. Add `example_data/kemal_demir_story.md`, `load-kemal-demir.sh`, `kemal_demir_validate.sh`**, mirroring Anna's equivalents exactly (same section structure, same script logic parameterized by identifier/directory). These stay in the top-level `example_data/` — outside `shoulder_on_fhir/` — so they are not part of the deploy-mirror subtree split, identical to Anna's arrangement; only the JSON bundles under `shoulder_on_fhir/seed/bundles/kemal-demir/` reach the server.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep `example-patients.json`, just remove the three patient entries from it | Leaves the cross-sectional/longitudinal paradigm split in place for zero remaining content; the file's only reason to exist (batch-loading multiple flat patients) goes away entirely once all three are gone |
| Hardcode a second `if`-block in `build-and-deploy.sh` for Kemal, mirroring Anna's original block | Doubles the maintenance surface for every future patient added; the generalized loop costs no extra runtime and removes all future hardcoding |
| Give Kemal a similar degenerative single-tendon story to Anna's, for a "safer" smaller diff | Defeats the purpose of a second example — a near-duplicate case demonstrates nothing a downstream consumer (analytics, a second frontend developer, a thesis reviewer) couldn't already see from Anna alone. Deliberate contrast (trauma/WCBPOL/multi-tendon/no-comorbidity) exercises IG paths Anna's case cannot |
| Give Kemal a prior conservative-treatment trial for narrative parity with Anna | Checked with the `shoulder-surgeon` subagent first — clinically inappropriate to fabricate for an acute traumatic 2-tendon tear in a physically demanding occupation; primary surgical referral without a PT/injection trial is the correct pathway here, and the Registration bundle's `priorTreatment` slice being legitimately empty is itself a useful structural demonstration |

## Consequences

✅ Seed data now consists of exactly two internally consistent longitudinal patient journeys instead of a three-patient batch file plus one longitudinal outlier — "the mess" the user flagged is gone.

✅ Adding a third longitudinal patient in the future is a drop-in operation (new `seed/bundles/<slug>/` directory) — no `build-and-deploy.sh` changes required.

✅ The ADR-0061 WCBPOL (workers'-compensation) demonstration survives the cleanup, now inside a full longitudinal case rather than a cross-sectional one-shot.

✅ `tools/validate.sh`'s seed-validation stage is strictly stronger than before (real bundle-profile conformance, not just per-entry checks against a structure that could never pass its own bundle profile).

⚠️ `fhir-requests/fhir-requests-clinical.http` and `fhir-requests-validate.http` (VS Code REST Client scratch files) previously hardcoded HAPI-assigned resource IDs for the deleted patients (and were already internally inconsistent — different UUIDs for "PAT-001" across different requests in the same file, predating this change). Rewritten to use identifier-based lookups and Kemal Demir's fixed logical IDs, which stay valid across `--clean` rebuilds — a net improvement, not just a like-for-like swap.

⚠️ The architecture sequence diagram (the sequence.drawio architecture diagram) still had one edge labeled `27: load-seed-data.sh` from before this change. Rather than relabel it, the diagram was later retired to the archived sequence diagram (source + rendered PDF); it is no longer part of any deliverable, so the stale edge is now historical.

❌ None — no Hurley/SECEC coverage numbers changed (no new profiles, ValueSets, or CodeSystems were introduced), so `mapping/SECEC_FHIR_Mapping.md` required no update.

## Sources

- User instruction (this session, 2026-07-25): remove the three cross-sectional patients, keep Anna Müller, author a second longitudinal patient in the same mould, wire the full local → git → server deploy loop
- `example_data/anna_mueller_story.md`, `seed/bundles/anna-mueller/*.json` — the template mirrored structurally
- `shoulder-surgeon` subagent review (2026-07-25) — clinical plausibility of the no-prior-treatment framing, exam findings, imaging classification (Goutallier/Cofield chronicity consistency), and post-op recovery trajectory for an acute traumatic 2-tendon tear
- `seed/.fhir-ips-cache/hl7.fhir.uv.ips-1.1.0.tgz` (`ValueSet-current-smoking-status-uv-ips.json`) — verified `LA18976-3` "Current every day smoker" directly from the IPS package rather than guessing
- `ig/input/fsh/valuesets/{TendonsInvolved,SatisfactionScale,RotatorCuffProcedureType,RotatorCuffEtiology,CofieldTearSizeClassification,PatteClassification,GoutallierClassification,InternalRotationVertebralLevel,SleepDisturbanceSeverity,SportsParticipationLevel,OccupationalPhysicalDemand,EmploymentStatus,ReturnToActivity}.fsh` — every code used verified against its FSH source
- ADR-0061 (WCBPOL workers'-compensation Coverage — demonstration relocated, not changed), ADR-0034 (three-bundle architecture), ADR-0064 (`TendonsInvolvedObservation` one-per-tendon pattern), ADR-0080 (TX-dependent validation runs on the deployment server, not locally — applies to validating this new seed data too)
