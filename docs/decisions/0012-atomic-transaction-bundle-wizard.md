# ADR-0012: Atomic FHIR transaction bundle for wizard submission

**Date:** 2026-04-16
**Status:** Accepted

## Context

The Registration Wizard collects data across 7 steps (Patient → Condition → Procedure → Clinical Assessment → Imaging → Outcome Scores → Summary), creating multiple FHIR resources that reference each other (e.g., Condition and Procedure reference the Patient; Observations reference the Condition and Patient).

The original implementation submitted each resource to HAPI via a separate `fhirClient.create()` call at the end of each wizard step. This had two problems:

1. **Partial failure**: if the user completed steps 1–4 then encountered a network error on step 5, four resources were already persisted and orphaned.
2. **Forward references**: resources created in step 3 needed to reference the Patient created in step 1. This required passing `patientId` and `conditionId` as props through every subsequent step.

## Decision

Generate UUIDs for Patient, Condition, and Condition at wizard mount (via `useMemo`). Each step accumulates its resources as `WizardEntry[]` in wizard state. On the final step, all entries are submitted as a single **FHIR transaction bundle** via `fhirClient.submitBundle()`.

Cross-resource references within the bundle use `urn:uuid:` prefixes — HAPI resolves these within the transaction, so no real server IDs are needed until submission.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Sequential per-step `create()` calls | Not atomic; partial failure leaves orphaned resources; forward references require server round-trips |
| FHIR batch bundle (not transaction) | Batch bundles do not guarantee atomicity — individual entries can fail independently |
| Two-phase commit (create patient first, then accumulate) | Still requires a real `patientId` from step 1 before subsequent steps; partial failure risk remains for later resources |
| Questionnaire + QuestionnaireResponse for all wizard data | Loses the individual FHIR resource types (Patient, Condition, Procedure, Observation) that make the data queryable and profile-validatable |

## Consequences

✅ All-or-nothing: if any resource fails validation, HAPI rejects the entire transaction and nothing is persisted  
✅ Single network round-trip for the entire wizard flow  
✅ Referential integrity guaranteed within the bundle (HAPI resolves `urn:uuid:` references)  
✅ `patientUuid` / `conditionUuid` generated at mount — no prop-drilling of server-issued IDs through steps  
⚠️ The full bundle is visible in HAPI only after the final step — partial drafts cannot be saved  
⚠️ Large transaction bundles (many observations) are validated entirely server-side before any response — may produce long HAPI response times  
⚠️ `fhirClient.submitBundle()` must correctly set `request.method: POST` and `request.url` per entry, and `Bundle.type: transaction`  

## Sources

- git commit `9849e3b` — "refactor(wizard): submit all resources as atomic FHIR transaction bundle"
- `frontend/src/components/wizard/RegistrationWizard.tsx` — `useMemo` UUID generation, `WizardEntry[]` accumulation, `submitBundle()` call on final step
- `frontend/src/lib/fhirClient.ts` — `submitBundle()` implementation
- `frontend/src/types/fhir.ts` — `Bundle`, `BundleEntry`, `WizardEntry` type definitions
