# ADR-0035: Unified registry frontend — merge wizard + follow-up into one app

**Date:** 2026-05-13
**Status:** Accepted
**Builds on:** ADR-0034 (three-bundle architecture)

## Context

Prior to ADR-0034 the IG had four frontend services, each demonstrating a different data-entry paradigm:

| Service | Port | Paradigm | Bundle target |
|---|---|---|---|
| `frontend/` (Wizard) | 3000 | Typed builders, 7-step guided flow | `ShoulderRegistrationBundle` (old shape: Registration + Surgery folded) |
| `sdc-frontend/` | 3001 | HL7 SDC pattern — fetch Questionnaire, render, client-side `$extract` | `ShoulderRegistrationBundle` |
| `lhcforms-frontend/` | 3002 | NLM LHC-Forms web component, bare `QuestionnaireResponse` submission | `QuestionnaireResponse` only — later retired per ADR-0041 |
| `followup-frontend/` | 3003 | Longitudinal per-visit capture | `ShoulderFollowUpBundle` |

The Wizard (3000) and Follow-Up (3003) frontends are paradigmatically identical — both use typed FHIR builders, both produce a transaction bundle, both target the same HAPI store. They differ only in flow content (registration vs. visit capture). Their separation as two Docker services produced incidental complexity: duplicated `fhirClient.ts`, duplicated `terminologyService.ts`, duplicated `package.json`, duplicated build chain. With ADR-0034 splitting the registration submission into Registration + Surgery, the same logic would have to be duplicated a third time if we built a separate `surgery-frontend/`.

## Decision

Merge `frontend/` (Wizard, port 3000) and `followup-frontend/` (port 3003) into a **single unified registry frontend at port 3000** with three flows behind a landing page:

```
http://localhost:3000/
├── /                  → Landing (3 cards: Register / Surgery / Follow-Up)
├── /register          → RegistrationFlow → POST ShoulderRegistrationBundle
├── /surgery           → SurgeryFlow      → POST ShoulderSurgeryBundle
└── /follow-up         → FollowUpFlow     → POST ShoulderFollowUpBundle
```

Routing uses `react-router-dom` (already a dependency in `frontend/package.json`). Each flow shares a common shell (header, Bundle/$validate banner pattern, FHIR client) and exposes its own step components under `components/{registration,surgery,followup,shared}/`. Patient lookup (find an already-registered patient by HPI identifier) is promoted to a shared component because both the Surgery flow and the Follow-Up flow need it.

The Surgery flow is new (it did not exist before ADR-0034). It consumes the persisted Patient identifier from a successful Registration submission or from a free-form lookup, then captures: Encounter (admission/discharge), index Procedure, optional concomitant Procedures, intra-operative Observations.

The Registration flow loses its old `StepProcedure.tsx` (which mixed prior treatments with the index surgery); the index-surgery portions move into the Surgery flow's procedure step, while the prior-PT / prior-injection portions remain in the Registration flow as a renamed `StepPriorTreatments.tsx`.

`fhirClient.ts` is refactored to take `bundleProfile` as a parameter so the same `validateBundle()` / `submitBundle()` functions work for all three flows.

`followup-frontend/` is removed from the filesystem and from `docker-compose.yml`. The `build-and-deploy.sh` frontend list drops to three entries (`frontend`, `sdc-frontend`, `lhcforms-frontend`). *(The `lhcforms-frontend` entry was subsequently removed by ADR-0041; the list is now `frontend`, `sdc-frontend`.)*

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Keep four separate frontends and add a fifth `surgery-frontend/` for the new bundle | Duplicates the shared client + terminology code a third time; runs four containers where one suffices; obscures the architectural simplicity that comes from ADR-0034 |
| Merge `sdc-frontend/` and `lhcforms-frontend/` into the unified app as well | These exist as deliberate demonstration paradigms (SDC `$extract` vs. off-the-shelf renderer). Folding them in would erase that didactic separation. Kept as distinct services |
| One-page app with a mode switcher instead of separate routes | Loses deep-linking. The three flows are genuinely separate user journeys with different starting states; separate routes match that |
| Auto-chain Registration → Surgery into one continuous wizard (single user experience, two HTTP calls under the hood) | Useful in the common "surgeon enters everything post-op" case but coercive when registration and surgery are temporally separated (patient registered pre-op, surgery scheduled later). Default to two explicit submits; offer a "Continue to surgery" affordance after Registration succeeds — the convenience without the coupling |

## Consequences

✅ One package.json, one build, one Docker image for the typed-builder paradigm — reduces drift and duplicated logic

✅ The three-bundle architecture of ADR-0034 has matching client-side flows; the IG and the frontend communicate the same workflow model

✅ Shared `PatientLookup` component used by both Surgery and Follow-Up — single point of truth for HPI-identifier resolution

✅ The number of running frontend containers drops from four to three (3000, 3001, 3002). *(Subsequently dropped to two — 3000 + 3001 — by ADR-0041.)*

⚠️ The merge is a one-shot restructure: rolling back requires restoring `followup-frontend/` from its pre-restructure snapshot (`.bak` tarball produced before Phase 4 starts per the restructure plan)

⚠️ Existing bookmarks or test scripts hitting `http://localhost:3003` need to be updated to `http://localhost:3000/follow-up`

⚠️ Two demonstration paradigms (SDC at 3001, LHC-Forms at 3002) still target the old single-bundle Registration shape. Their alignment with the three-bundle architecture is deferred — a future ADR will decide whether to split the underlying Questionnaire into three or to annotate items with their target bundle. *(Closed by ADR-0040 and ADR-0041 in May 2026: SDC adopts three SDC Questionnaires; LHC-Forms retired to the archive directory.)*

## Sources

- `frontend/src/` — unified app structure (Home + three flows + shared components)
- `docker-compose.yml` — `followup-frontend` service removed
- `build-and-deploy.sh` — frontend list updated
- ADR-0034 — three-bundle architecture (driver for the merge)
- ADR-0030 — original `ShoulderFollowUpBundle` (the follow-up flow's profile target, unchanged)
- ADR-0017, ADR-0018, ADR-0023 — context on the original 4-frontend split (SDC, LHC-Forms, Wizard rationale)
