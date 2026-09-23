# ADR-0054: Remove convenience PROMs from the IG; relocate lost-to-follow-up tracking into Layer 3

**Date:** 2026-05-22
**Status:** Accepted (supersedes the Supplementary-layer dispositions in ADR-0036; revises the three-layer accounting in ADR-0039 to two-layer); **per-element Full/Partial classification replaced by the code/value provenance axis in ADR-0178 (2026-08-25)**

> **Status update (2026-08-25, ADR-0178):** The per-element Full/Partial "coverage status" classification this two-layer accounting carried was replaced by a two-facet code/value **terminology-provenance** axis (`Reused` / `Local` / `Numeric`). The two-layer (Consensus / IG-Operational) accounting itself and representability (0 Missing) remain in force; only the per-element status column changed. Body below unedited for audit trail.

## Context

ADR-0036 introduced a "Supplementary" layer in the SECEC→FHIR mapping to honestly accommodate non-Hurley shoulder PROMs (ASES, WORC, DASH, QuickDASH) and a lost-to-follow-up tracking pattern, while explicitly excluding them from the SECEC coverage denominator. ADR-0039 formalised this as **Layer 2** in the three-layer accounting (Hurley / Supplementary / IG-Operational).

This arrangement was internally consistent but in retrospect mixes two different things:

1. **Four PROM scores** (ASES, WORC, DASH, QuickDASH) — added as convenience for adopters. None passed Hurley's 80% Delphi consensus threshold. Hurley A12 explicitly names only **Constant-Murley** and **SSV/SANE** as preferred instruments. Keeping ASES/WORC/QuickDASH as local-coded profiles and DASH as a SNOMED-bound profile creates ongoing pressure to add more (Penn Shoulder, Oxford Shoulder Score, OSS, etc.) without principled boundaries.
2. **One operational data-quality pattern** (S5 lost-to-follow-up tracking via `Observation.status = #unknown`) — *not a PROM at all*. Mis-categorised: it's the same DNA as the Layer-3 FHIR-required metadata rows, not a clinical instrument.

The IG's stated discipline (ADR-0036 honesty class, ADR-0039 layer separation) is that the IG carries:
- **Hurley consensus elements** (count toward `% Full`), plus
- **Layer 3 — IG-Operational** structural scaffolding the IG cannot function without (patient identity, temporal anchors, laterality, transaction bundles).

The four convenience PROMs satisfy neither: they are not consensus, and the IG would still function without them.

## Decision

1. **Delete** the four PROM profiles and their CSV / mapping.md / IG / frontend / SDC / example-data surfaces:
   - `S1 — ASES` → delete; remove `AsesScoreObservation` FSH profile, `ases-score` local concept, frontend enum + metadata + form field, SDC linkId + extractor entry.
   - `S2 — WORC` → delete; same as S1 with `worc-score`.
   - `S3 — DASH` → delete; remove `DashScoreObservation` FSH profile (also drops the only IG reference to SNOMED `444875003`), frontend enum + metadata + form field, SDC linkId + extractor entry.
   - `S4 — QuickDASH` → delete; same as S1 with `quickdash-score`.
2. **Relocate** S5 → **`L3.H.4`** (`H: Provider / operational`, alongside Procedure.performer / outcome / note). Lost-to-follow-up is an operational data-quality pattern, not a PROM; H is the best fit. CSV `Layer` becomes `IG-Operational`; Notes are updated to remove the "not in Hurley A11" framing (it is now structural, not a Hurley extension).
3. **End state — two-layer accounting** (Hurley + Layer 3 only):
   - Mapping CSV: 96 data rows → **58 Hurley + 39 IG-Operational + 0 Supplementary**.
   - IG: **33 derived Observation profiles** (down from 37) — only `ConstantScoreObservation`, `SsvScoreObservation`, `SaneScoreObservation` remain in the PROM family.
   - `ShoulderObservationCodes` CodeSystem: **19 concepts** (down from 22) — `ases-score`, `worc-score`, `quickdash-score` removed.
   - No remaining IG reference to SNOMED `444875003` (DASH).

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep all five rows but tighten the "not mandatory" flagging | The Supplementary layer already flagged them as non-mandatory and excluded from `% Full`. Adding more flagging is cosmetic; the underlying scope question (Hurley-only vs kitchen-sink) is not resolved. |
| Demote the four PROMs to an "extension pack" — keep the FSH profiles, remove from bundles / frontends / questionnaires by default | "Available but unused" is a fuzzy state that creates maintenance overhead (validator must still resolve the profiles; documentation must still describe them) without clear adopter benefit. Adopters who want them can fork or write a downstream IG. |
| Keep S3 DASH only because it has a real SNOMED concept (`444875003`) | The SNOMED binding is a clean property of the DASH instrument, not a Hurley warrant. Keeping DASH and removing the other three would be inconsistent ("we carry consensus + DASH because we like the binding"). The principle is consensus-only, regardless of binding quality. |
| Move S5 to `L3.B.7` (FHIR-required metadata) by merging with the structural `Observation.status` row | Blurs the distinction between FHIR-mandated structure (`Observation.status` always required) and an operational *usage pattern* of that field (`= #unknown` as a sentinel). Keeping them separate (structural `L3.B.6`; pattern `L3.H.4`) makes the IG's operational posture more discoverable. |
| Create a new subsection `L3.J — Operational data-quality patterns` | Cleanest semantically, but lost-to-follow-up is currently the only row in this class. Creating a subsection for one row is over-engineering; `L3.H` already covers operational additions and accommodates this cleanly. Revisit if more such patterns accumulate. |

## Consequences

✅ Two-layer accounting (Hurley + Layer 3) — cleaner story for the thesis and the IG.
✅ The IG now carries exactly Hurley consensus + the FHIR scaffolding Hurley structurally implies, nothing else.
✅ Adopters who need ASES / WORC / DASH / QuickDASH can profile them in a downstream IG without colliding with this one's namespace.
✅ One less SNOMED concept in the IG's footprint (`444875003`); slightly smaller terminology resolution surface.
✅ Removes a recurring point of expansion pressure (which PROM to add next?) — the principle now answers that question (none, unless consensus-named).
⚠️ Adopters previously using the four removed PROMs against this IG must either fork the deleted FSH profiles or write their own.
⚠️ Mapping.md and project-guide narratives lose the "Supplementary" framing; downstream documentation that referenced this layer needs minor updates.
⚠️ ADR-0036 and ADR-0039 are **partially superseded** for these specific rows — their broader contributions (honesty rebaseline; layer accounting framework) remain in force. Status banners on both ADRs point here.
❌ Mapping.md and the project guide headline figures change: row count 100 → 96 (CSV had 100 originally; L3.A.6 from the SFCU adoption in ADR-0053 brought it to 101; this ADR removes 4 and relocates 1, ending at 97 rows total; previously-claimed "37 IG-Operational" is now 39 after L3.A.6 + L3.H.4).

## Sources

- Hurley et al. (2024) JSES International 8(3):478–482, A12 — names only Constant-Murley and SSV/SANE as preferred PROMs.
- ADR-0036 — Honest SECEC re-baseline; originally introduced the Supplementary layer.
- ADR-0039 — Three-layer accounting; formalised Layer 2 (Supplementary).
- ADR-0053 — EU Base SFCU adoption; precedent for adding L3 rows for non-Hurley structural elements (companion honesty-class decision).
- Mapping CSV rows `S1`, `S2`, `S3`, `S4` (deleted) and `S5` → `L3.H.4` (relocated).
- IG FSH: `profiles/observations/{Ases,Worc,Dash,QuickDash}ScoreObservation.fsh` (deleted); `codesystems/ShoulderObservation.fsh` lines 78–85 (deleted); `instances/ShoulderRegistrationQuestionnaire.fsh` items 5–8 of item[4] (deleted, remainder renumbered).
- Frontend: `frontend/src/types/fhir.ts`, `config/observationMetadata.ts`, `components/wizard/{stepFormData.ts, StepOutcomeScores.tsx}`.
- SDC frontend: `sdc-frontend/src/questionnaire/ShoulderRegistration.ts`, `sdc-frontend/src/lib/extractor.ts`.
- Thesis: Discussion §6.1 (Feedback to Hurley Consensus), Methods §4.2.2–4.2.3 (layer framing), Results §5.6.2 (formerly Supplementary coverage; now removed), Appendix §A.3 (mapping tables).
