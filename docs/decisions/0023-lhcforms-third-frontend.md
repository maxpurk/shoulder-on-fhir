# ADR-0023: LHC-Forms as Third Frontend — Questionnaire Renderer without Client-Side Extraction

**Date:** 2026-05-06
**Status:** Superseded by ADR-0041 (2026-05-19) — the LHC-Forms frontend was moved to the archived LHC-Forms frontend once the SDC frontend (ADR-0040) demonstrated SDC conformance with three Questionnaires aligned to the three-bundle architecture. Body preserved unedited for audit trail.

## Context

The project already demonstrates two distinct paradigms for submitting a shoulder registry entry:

- **Port 3000 (Wizard)** — a hand-crafted, step-by-step React wizard that constructs discrete FHIR resources directly from form state and bundles them into a `ShoulderRegistrationBundle`.
- **Port 3001 (SDC)** — fetches the `ShoulderRegistration` FHIR Questionnaire from HAPI, renders it, and performs client-side SDC extraction to turn `QuestionnaireResponse` answers into discrete FHIR resources before bundle submission.

Both frontends produce the same `ShoulderRegistrationBundle` as output. Neither uses an off-the-shelf Questionnaire renderer; both are custom React applications. A third paradigm is missing: using a **ready-made FHIR Questionnaire renderer** that does not perform any client-side extraction and simply submits a `QuestionnaireResponse` directly to HAPI.

NLM LHC-Forms (maintained by the National Library of Medicine) is the most widely deployed open-source FHIR Questionnaire renderer, available both as a CDN-hosted web component (`<wc-lhc-form>`) and as a React package.

## Decision

Add a third Docker service (`lhcforms-frontend`, port 3002) that:

1. Fetches the `ShoulderRegistration` Questionnaire from HAPI at runtime (same canonical URL as port 3001).
2. Renders it using the NLM LHC-Forms web component (`<wc-lhc-form>`), loaded via CDN.
3. On submission calls `LForms.Util.getFormFHIRData()` to extract a `QuestionnaireResponse` and POSTs it directly to `POST /fhir/DEFAULT/QuestionnaireResponse` — **no client-side extraction into discrete resources, no bundle**.

This service demonstrates a third, fully realistic data-capture approach: a clinician fills in the form and a structured `QuestionnaireResponse` is persisted. Downstream processes (e.g. $extract, mapping services) can later convert it into discrete resources.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Extend the SDC frontend with a "raw QR mode" | Conflates two paradigms in one UI; harder to explain in the thesis |
| Use the LHC-Forms React component (`@lhncbc/lforms-react`) | Web component CDN approach requires zero React-specific integration and is closer to what real EHRs embed; React package adds a large dependency for no functional gain in this demo context |
| Use a different renderer (FHIR-Works, Healthforms.io) | LHC-Forms is the de-facto reference implementation used by CMS, ONC, and HL7 for Questionnaire rendering; best recognized for the thesis audience |
| Submit a bundle wrapping the QR | The point of this frontend is to show the minimal path: Questionnaire → QuestionnaireResponse → HAPI; bundling would obscure the contrast with port 3001 |

## Consequences

✅ Three frontends cover three distinct levels of FHIR Questionnaire integration (custom FHIR JSON construction, SDC extraction, raw QR submission)  
✅ Demonstrates that off-the-shelf renderers can be dropped into a compliant FHIR server with minimal code  
✅ QuestionnaireResponse stored on HAPI is a valid FHIR artifact; could be processed by a $extract operation later  
⚠️ The submitted QuestionnaireResponse is not linked to a `ShoulderRegistrationBundle`; it stands alone as a QR resource — this is intentional but means no bundle-level completeness check applies  
⚠️ LHC-Forms web component is loaded from CDN; offline environments must mirror the CDN or switch to the npm package  
❌ No automatic mapping to discrete registry data elements (Patient, Condition, Procedure) — this frontend illustrates the data-capture step only, not the full registry workflow  

## Sources

- `lhcforms-frontend/` — new Docker service
- `docker-compose.yml` — service definition on port 3002
- ADR-0018 — SDC frontend rationale (port 3001, client-side extraction)
- ADR-0021 — Questionnaire as formal IG artifact
