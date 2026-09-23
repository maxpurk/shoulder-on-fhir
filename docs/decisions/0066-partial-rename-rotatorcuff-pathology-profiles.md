# ADR-0066: Partial rename — pathology-specific profiles become `RotatorCuff*`; anatomy-region profiles keep `Shoulder*`

**Date:** 2026-06-07
**Status:** Accepted
**Builds on:** [ADR-0008](0008-abstract-base-27-derived-observation-profiles.md) (abstract base + derived child profiles — the layered-IG precedent inside this IG), [ADR-0034](0034-three-bundle-architecture.md) (three-bundle architecture — names the bundle profiles being renamed), [ADR-0037](0037-registration-bundle-encounter-and-linkage-closure.md) (the `ShoulderEncounter.reasonReference` constraint being relaxed here), [ADR-0057](0057-shoulder-patient-eu-core-ips-multiprofile.md) / [ADR-0058](0058-condition-family-eu-core-ips-multiprofile.md) / [ADR-0059](0059-shoulder-procedure-eu-core-ips-multiprofile.md) (EU Core + IPS alignment — the `ShoulderProcedure` rename amends ADR-0059's profile name)

## Context

Every profile in the IG except `RotatorCuffCondition` (and the local `RotatorCuffEtiology`) is named with a `Shoulder*` prefix, while the registry's clinical scope is rotator cuff tears — not the shoulder generally. The mismatch is visible at the constraint level, not just in prose:

- `ShoulderEncounter.reasonReference` is fixed to `Reference(RotatorCuffCondition)` (ADR-0037 §Decision §2 + `ig/input/fsh/profiles/ShoulderEncounter.fsh:77`).
- `ShoulderProcedure` is bound to RC-specific surgical / prior-treatment codes via `ShoulderProcedureType` + `ShoulderProcedureCategory` (ADR-0032, ADR-0033).
- `Shoulder{Registration,Surgery,FollowUp}Bundle` slice their Condition entry to `RotatorCuffCondition` (ADR-0034).
- `ShoulderResearchCarePlan`, `ShoulderServiceRequest`, `ShoulderQuestionnaireResponse` exist to wire the registry's longitudinal flow — they describe RC care, not generic shoulder care.

Conversely, other `Shoulder*` profiles really are anatomy-region:

- `ShoulderPatient` carries patient demographics + EU Core + IPS alignment; nothing about it is RC-specific.
- `ShoulderImagingStudy` / `ShoulderDiagnosticReport` use shoulder-region LOINC imaging codes that apply to any shoulder workup (arthroplasty, instability, frozen shoulder, fracture).
- `ShoulderCoverage` is insurance / WCBPOL admin (ADR-0061) — anatomy- and pathology-agnostic.
- `ShoulderObservation` is an abstract parent; its concrete ROM, strength, provocation-test, and patient-history children measure shoulder-region phenomena reusable across any shoulder pathology — LOINC itself names them "Shoulder Flexion ROM" (ADR-0045).
- `ShoulderComorbidityCondition` is IPS-bound to `ProblemsSnomedAbsentUnknownUvIps` (ADR-0055) — comorbidities (DM, HTN, smoking-related disease) are anatomy- and pathology-agnostic.

A full rebrand of every `Shoulder*` profile to `RotatorCuff*` was considered and rejected. The thought-experiment that decided it: a hypothetical shoulder-arthroplasty registry would legitimately reuse the anatomy-region profiles (Patient, Encounter, Coverage, ImagingStudy, DiagnosticReport, ROM/strength/provocation Observations) but would need fresh pathology-specific profiles for the surgical event (prosthesis components, manufacturer device data), its own PROMs (Constant + OSS + arthroplasty-specific instruments rather than the Hurley consensus), its own bundles, its own care plan and service requests. If `ShoulderPatient` were renamed `RotatorCuffPatient`, the arthroplasty IG either copy-pastes it (parallel maintenance) or has to depend on a rotator-cuff IG (semantically wrong — arthroplasty is not a kind of rotator cuff disease).

FHIR best practice for layered reusability is **loosen at the base, tighten in derived profiles** — the pattern used by IPS Patient ← US Core Patient (US Core tightens IPS), FHIR Observation ← ShoulderObservation ← ShoulderFlexionObservation in this very IG (ADR-0008), and Encounter ← shoulder-anatomy encounter ← pathology-specific encounter in the layering this ADR makes possible.

The IG identity, canonical URL, repo directory name, deliverable titles, and bibliography filenames are not changed. The IG legitimately spans both layers now, and changing the canonical is a once-only operation with cascading thesis / poster / defense churn that buys nothing.

## Decision

### 1. Rename the seven pathology-specific profiles + two value sets

| Old name (PascalCase / kebab-case `Id`) | New name |
|---|---|
| `ShoulderProcedure` / `shoulder-procedure` | `RotatorCuffProcedure` / `rotator-cuff-procedure` |
| `ShoulderQuestionnaireResponse` / `shoulder-questionnaire-response` | `RotatorCuffQuestionnaireResponse` / `rotator-cuff-questionnaire-response` |
| `ShoulderResearchCarePlan` / `shoulder-research-care-plan` | `RotatorCuffResearchCarePlan` / `rotator-cuff-research-care-plan` |
| `ShoulderServiceRequest` / `shoulder-service-request` | `RotatorCuffServiceRequest` / `rotator-cuff-service-request` |
| `ShoulderRegistrationBundle` / `shoulder-registration-bundle` | `RotatorCuffRegistrationBundle` / `rotator-cuff-registration-bundle` |
| `ShoulderSurgeryBundle` / `shoulder-surgery-bundle` | `RotatorCuffSurgeryBundle` / `rotator-cuff-surgery-bundle` |
| `ShoulderFollowUpBundle` / `shoulder-follow-up-bundle` | `RotatorCuffFollowUpBundle` / `rotator-cuff-follow-up-bundle` |
| `ShoulderProcedureType` / `shoulder-procedure-type` | `RotatorCuffProcedureType` / `rotator-cuff-procedure-type` |
| `ShoulderProcedureCategory` / `shoulder-procedure-category` | `RotatorCuffProcedureCategory` / `rotator-cuff-procedure-category` |

### 2. Relax `ShoulderEncounter.reasonReference` from `Reference(RotatorCuffCondition)` to `Reference(Condition)`

Single rule change in `ig/input/fsh/profiles/ShoulderEncounter.fsh`. Cardinality stays `1..1 MS` — every Encounter must still declare a reason. The pathology guarantee is preserved one layer up: each `RotatorCuff{Registration,Surgery,FollowUp}Bundle` profile slices the Condition entry to `RotatorCuffCondition`, so within those bundles the Encounter's reasonReference resolves to an RC Condition by construction. This amends ADR-0037 §Decision §2 in spirit — the Encounter-as-anchor pattern is preserved exactly; only the type-system tightness is moved from the base profile to the bundle slice, where it actually belongs after this rename.

A future shoulder-arthroplasty IG can declare `ArthroplastyEncounter` parenting `ShoulderEncounter` and re-tightening `reasonReference` to its own condition profile, without forking the base.

### 3. Keep the IG identity unchanged

`sushi-config.yaml` `id` / `canonical` / `name` / `title` stay (`shoulder-on-fhir`, `https://maxpurk.github.io/shoulder-on-fhir`, `ShoulderOnFHIR`, `Shoulder on FHIR Implementation Guide`). The repository directory name stays. Bibliography filenames (`shoulder_on_fhir.bib` × 4 LaTeX subprojects) stay. Patient-identifier system `https://maxpurk.github.io/shoulder-on-fhir/identifier/patient` is derived from the IG canonical and stays.

### 4. Keep the following `Shoulder*` profiles unchanged

`ShoulderPatient`, `ShoulderEncounter`, `ShoulderComorbidityCondition`, `ShoulderCoverage`, `ShoulderImagingStudy`, `ShoulderDiagnosticReport`, `ShoulderObservation` (abstract), and all 33 concrete Observation children that already bear the `Shoulder*` or pathology-named prefix (`ShoulderFlexionObservation`, `SupraspinatusStrengthObservation`, `JobeTestObservation`, `PainSeverityObservation`, etc., plus the already-correctly-pathology-named `TearSizeObservation`, `PatteObservation`, `GoutallierObservation`, `TendonsInvolvedObservation`, `TearSizeClassificationObservation`).

`ShoulderObservationCodes` (CodeSystem), `ShoulderObservationCode`, `ShoulderLaterality`, `ShoulderImagingProcedure`, `ShoulderEncounterType`, `ShoulderEtiology` are also kept — their scopes are either anatomy-region (laterality, imaging procedures, encounter types after §2 relaxation) or mixed-by-design (`ShoulderObservationCodes` carries both RC-specific concepts like `#tendons-involved` per ADR-0064 and anatomy-region concepts like `#hand-dominance`; ADR-0065 widened `ShoulderObservationCode` to span both layers).

### 5. Forward-pointers, not rewrites, on historical ADRs

Each historical ADR whose load-bearing name changes (0008, 0017, 0028, 0029, 0030, 0033, 0034, 0037, 0040, 0059, 0064) gets a single forward-pointer line at the top: `> **Update 2026-06-07 (ADR-0066):** Profile renamed from \`ShoulderX\` to \`RotatorCuffX\`.` The decision text and rationale are not rewritten — historical ADRs document what was decided at the time, not the current state.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **Full rebrand**: rename every `Shoulder*` profile to `RotatorCuff*`, change IG canonical to `https://hpi.de/fhir/rotator-cuff-on-fhir`, rename repo dir, retitle thesis/poster/defense. | Maximum honesty but defeats reusability. The arthroplasty / instability / frozen-shoulder / fracture sibling IGs would either copy-paste the anatomy-region profiles (parallel maintenance) or be forced to depend on an IG named "Rotator Cuff" (semantically wrong). Also: heavy thesis/poster/defense churn, canonical URL change is a once-only operation that buys no clinical clarity. |
| **No rename**: keep all `Shoulder*` names, add IG narrative explaining the scope is actually RC. | Leaves the type-system lie in place — `ShoulderProcedure` is bound to RC codes, `Shoulder*Bundle` slice for RC Condition, but the names hide that. Narrative is invisible to anyone reading FSH. |
| **Slice `ShoulderEncounter.reasonReference`**: one required slice for `RotatorCuffCondition`, additional Conditions allowed. | Anatomy-generic surface + RC-specific guarantee in one profile. More schema for an effect that the bundle-slice enforcement already provides. The layered pattern (loosen base, tighten in derived bundle) is the FHIR-idiomatic way to express "this base is reusable, this composition uses the RC-tight variant." |
| **Rename `ShoulderEncounter` → `RotatorCuffEncounter`** to preserve the existing tight `reasonReference` constraint. | Loses one anatomy-region profile from the reusable set for no semantic gain. The constraint is enforced at the bundle slice level for the RC use case already. |
| **Rename `ShoulderComorbidityCondition` → `RotatorCuffComorbidityCondition`** for strict prefix consistency with the seven renamed profiles. | Comorbidities are anatomy- and pathology-agnostic by definition; the name would lie. ADR-0055's IPS binding to `ProblemsSnomedAbsentUnknownUvIps` is explicitly anatomy-agnostic. |
| **Rename `ShoulderObservation` → `RotatorCuffObservation`** to bring the abstract base under the new prefix. | The abstract base is the layering pivot — its 33 concrete children include both anatomy-region (ROM, strength, hand dominance) and RC-specific (tear morphology, fatty infiltration, tendons involved) Observations. Renaming the base would force the anatomy-region children to live under a pathology-named parent. |
| **Centralize the brand under a neutral name** like `shoulder-registry-ig` or `de.hpi.shoulder-registry`. | Heavy churn (canonical change, repo rename, thesis/poster/defense title updates) for honesty no reader will notice. The current brand `Shoulder on FHIR` plus a partial-rename in the profile names is the cheapest accurate state. |

## Consequences

✅ Profile names tell the truth. `RotatorCuffProcedure` is RC-specific; `ShoulderPatient` is not. The constraints inside each profile now match what the name claims.
✅ The IG is layered. A future shoulder-arthroplasty (or instability, or frozen-shoulder) sibling IG can declare its own `Arthroplasty*` pathology profiles parenting from `Shoulder*` anatomy bases, reusing Patient / Encounter / Coverage / ImagingStudy / DiagnosticReport / ROM / strength Observations without copy-paste. This is the same pattern as IPS Patient ← US Core Patient and the abstract-Observation-base chain already in this IG (ADR-0008).
✅ Bundle-slice enforcement of RC Condition is preserved exactly. The relaxation of `ShoulderEncounter.reasonReference` does not weaken any guarantee for the three RC bundles — the bundle profiles still slice the Condition entry to `RotatorCuffCondition`.
✅ IG canonical, repo directory, deliverable titles, bibliography filenames all stay — no cascading thesis/poster/defense churn beyond inline profile-name references in prose.
✅ Patient identifier system stays `https://maxpurk.github.io/shoulder-on-fhir/identifier/patient` — no data migration of existing seed/example bundles' identifier slots.
⚠️ Any external consumer that wrote bundles claiming `meta.profile = …/StructureDefinition/shoulder-registration-bundle` (etc.) must update to the `rotator-cuff-*` kebab. The IG is pre-1.0; this break is acceptable. The IG version of every renamed profile bumps to `0.4.0` (bundles) / `0.3.0` (others) to make the break visible in tooling.
⚠️ Eleven historical ADRs gain a forward-pointer line. Decision text is not rewritten; readers of those ADRs must follow the pointer to see the current name.
⚠️ Idempotence canary in `seed/load-profiles.sh` (`StructureDefinition/shoulder-follow-up-bundle`) and its mirror in `build-and-deploy.sh` change to `rotator-cuff-follow-up-bundle`. A `--clean` run is required on first deploy after this ADR; otherwise the loader short-circuits on the stale canary.
⚠️ Frontend constants in `frontend/src/types/fhir.ts` and `sdc-frontend/src/types/fhir.ts` change at the URL-value level only; constant keys (e.g. `PROFILE_URLS.PROCEDURE`) stay so call-site code is unchanged. Anatomy-region UI labels ("Affected Shoulder", "Prior Shoulder Injection", `SHOULDER_LATERALITY`, `SHOULDER_OBS_SYSTEM`) stay — they describe the body part, not the registry.
⚠️ The `RotatorCuffProcedure` rename amends ADR-0059 §Decision (EU Core `procedure-eu-core` parent + IPS `Procedure-uv-ips` multi-profile) — the inheritance / claim story is unchanged, only the profile name on this IG's side moves.

## Sources

- `ig/input/fsh/profiles/ShoulderEncounter.fsh:77` — the `Reference(RotatorCuffCondition)` line being relaxed
- `ig/input/fsh/profiles/Shoulder{Procedure,QuestionnaireResponse,ResearchCarePlan,ServiceRequest,RegistrationBundle,SurgeryBundle,FollowUpBundle}.fsh` — files being renamed
- `ig/input/fsh/valuesets/Shoulder{ProcedureType,ProcedureCategory}.fsh` — VS files being renamed
- `frontend/src/types/fhir.ts` + `sdc-frontend/src/types/fhir.ts` — `PROFILE_URLS` and ValueSet URL constants
- `seed/load-profiles.sh` + `build-and-deploy.sh` — idempotence canary
- ADR-0008 (abstract base + derived profiles — layered-IG precedent inside this IG)
- ADR-0034 (three-bundle architecture — names the bundle profiles)
- ADR-0037 (registration bundle encounter linkage — `reasonReference` constraint being relaxed)
- ADR-0059 (ShoulderProcedure → EU Core + IPS — inheritance unchanged, profile name updated)
- ADR-0065 (`ShoulderObservationCode` mixed-scope enumeration — precedent for keeping anatomy-scoped VS names)
- The naming concern raised in review that prompted this ADR
