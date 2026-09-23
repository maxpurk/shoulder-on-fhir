# ADR-0095: Server-side SDC `$extract` — evaluated, not implemented

**Date:** 2026-07-25
**Status:** Accepted
**Builds on:** ADR-0023 (LHC-Forms as third frontend, superseded), ADR-0031 (HAPI as storage-only), ADR-0040 (SDC IG v3.0.0 conformance), ADR-0041 (LHC-Forms deprecated), ADR-0051 (`validator-service` sidecar precedent)

> **Update 2026-07-26 (ADR-0102):** A sharper caveat belongs alongside this ADR's "no server-side `$extract`" finding: even wrapping `extractor.ts`/`bundleAssembler.ts` in a sidecar (this ADR's own preferred path, §Decision 1) would not make the *Questionnaires themselves* processable by an independent, off-the-shelf SDC engine — fixed `Observation.code`/`category`/`unit` per profile live in `extractor.ts`'s hardcoded `PROFILE_METADATA` table, not derived from the target StructureDefinition's own fixed values. A truly generic engine would need to additionally resolve those StructureDefinitions at runtime, which nothing in this codebase does. This is a limitation of this implementation's shortcut, not of the SDC spec or of definition-based extraction as a mechanism.

## Context

ADR-0023 (May 2026) added the LHC-Forms frontend, which posted a bare `QuestionnaireResponse` to HAPI with **no** client-side extraction into discrete resources. That ADR left the gap open explicitly: *"Downstream processes (e.g. `$extract`, mapping services) can later convert it into discrete resources"* — but named no such process, and none was ever built. LHC-Forms was subsequently archived (ADR-0041) once the SDC frontend (port 3001) reached full SDC v3.0.0 conformance with client-side definition-based extraction (`sdc-frontend/src/lib/extractor.ts`).

No ADR has since evaluated whether the QuestionnaireResponse→Bundle gap should be closed with a real, server-side HL7 SDC `$extract` operation — the formal FHIR operation that takes a `QuestionnaireResponse` (+ its source `Questionnaire`, which must carry `item.definition`/extraction extensions) and returns a `Bundle` of discrete resources. `ADR-0031` documents that HAPI runs storage-only (`requests_enabled=false`) and doesn't serve `$extract`, but that is a byproduct of the general three-tier stance, not a dedicated evaluation of `$extract` itself, its alternatives, or whether a *separate* service should provide it. This ADR closes that gap.

## Decision

**Do not implement a server-side `$extract` operation at this time.** No current caller needs it: both live frontends (unified at 3000, SDC at 3001) already extract client-side before submitting, and the one frontend that would have needed it (LHC-Forms, bare-QR-only) is archived. Building a service with no exercised caller would be speculative infrastructure.

The feasibility analysis and preferred implementation path are recorded here so a future need (e.g. a revived off-the-shelf-renderer demo) doesn't have to re-derive them:

1. **Preferred path if ever built: wrap the existing extractor as a new sidecar.** `sdc-frontend/src/lib/extractor.ts` (795 lines) and `bundleAssembler.ts` are already renderer-agnostic — pure functions over a `{Questionnaire, QuestionnaireResponse}` pair, no DOM/React dependency. Wrapping them in a small Node/Express service exposing `POST /$extract` reuses ~1,100 lines of already-correct, IG-matched logic almost verbatim, and follows the same architectural pattern this project already established with `validator-service` (Java sidecar wrapping `validator_cli.jar`, port 3500, ADR-0051) — a small, purpose-built sidecar sitting beside HAPI rather than inside it.
2. **Formal-spec polish, if warranted later:** wrap the same logic in the officially-named SDC `$extract` Operation shape (`Parameters` resource in/out) instead of a bespoke REST endpoint — same underlying logic, more conformant HTTP contract. Deferred as unnecessary until a first version has a real caller.
3. **HAPI hosting this itself is out of scope regardless of caller demand** — consistent with ADR-0031's deliberate storage-only stance. Any implementation is a new sidecar, not a HAPI config flip.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **Do nothing (status quo, client-side extraction only)** | **Chosen.** No concrete consumer needs server-side `$extract` today; both live frontends already extract before submit. |
| Reuse `extractor.ts` + `bundleAssembler.ts` in a new Node sidecar (`POST /$extract`) | Recorded as the preferred *future* path (see Decision §1) — not built now for lack of a caller, but cheapest option if one appears. |
| Formal SDC `$extract` Operation (`Parameters` wrapper) | Same logic as above with a more spec-conformant HTTP shape; the extra ceremony isn't worth it before a first version even has a caller. |
| StructureMap-based extraction (`$transform`, FHIR Mapping Language) | This IG's Questionnaires already declare **definition-based** extraction metadata (`item.definition` + `itemExtractionContext`) — the other SDC extraction mechanism. Authoring FML from scratch would solve a modeling problem the IG doesn't have, for zero functional gain over option 1. |
| Enable `$extract` inside HAPI itself | HAPI doesn't implement `$extract`; and even if it did, running it in-process conflicts with the storage-only architecture (ADR-0031). |

## Consequences

✅ Records a real, previously-implicit gap (ADR-0023's "downstream processes... can later convert it" was never followed up) so a future reader doesn't have to re-derive the feasibility analysis from scratch.
✅ If a future off-the-shelf-renderer demo is ever revived (e.g. LHC-Forms — see `docs/future_work_items/0002-lhcforms-frontend-parity/`), this ADR hands it a ready-made, low-effort path to conformant bundles instead of raw-QR-only storage.
✅ Keeps the current architecture minimal — no sidecar running with zero callers.
⚠️ Any bare `QuestionnaireResponse` that ended up in HAPI from the LHC-Forms era has no automatic path to becoming a conformant bundle until this is built.
❌ ADR-0023's original "downstream processing" claim remains aspirational, not demonstrated, until someone picks this up.

## Sources

- `sdc-frontend/src/lib/extractor.ts`, `sdc-frontend/src/lib/bundleAssembler.ts` — the reusable, renderer-agnostic logic identified as the cheap implementation path
- `validator-service/src/ValidatorServer.java` — sidecar architecture precedent
- ADR-0023 — original "downstream processes" deferral
- ADR-0031 — HAPI storage-only stance
- ADR-0040 — SDC v3.0.0 conformance, definition-based extraction choice
- ADR-0041 — LHC-Forms deprecation (the frontend that would have been this operation's only caller)
- ADR-0051 — `validator-service` sidecar precedent
- `docs/future_work_items/0002-lhcforms-frontend-parity/plan.md` — the future work item this ADR's Decision §1 would unblock
