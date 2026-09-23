# ADR-0092: Procedure valueset completeness review — 3 SNOMED CT additions

**Date:** 2026-07-21
**Status:** Accepted

## Context

Next point in the surgeon-review notes, Part 2 ("2. Teil"):

On recording the surgical event: capture the perioperative hospital stay and the operation itself (incision to suture); allow multiple codes; and go over the procedures.

This bundles four sub-points. Investigation (two parallel Explore agents covering the IG/FHIR modeling side and the Surgery-wizard frontend side) plus direct clarification with the user resolved each:

1. **Perioperative hospital stay** — `ShoulderEncounter.period` (start/end) already exists and is the only thing needed for this. User confirmed sufficient as-is. **No change.**
2. **Allow multiple codes** — `RotatorCuffSurgeryBundle.procedure` is already `1..*`; both frontends already support an index + repeatable "concomitant procedure" UI (unified `ProcedureStep.tsx`; SDC `ShoulderSurgeryQuestionnaire.fsh` procedure group with `repeats = true`). User confirmed already covered. **No change.**
3. **The operation itself, incision to suture** (incision-to-suture timing) — `RotatorCuffProcedure.performed[x]` already permits `Period` (MS-flagged) alongside `dateTime`, but nothing populates it today; switching would also require updating the Q11 follow-up-timepoint-anchor logic, which currently reads `performedDateTime` specifically. User explicitly asked to **skip this sub-point for now** — it stays open/unsolved in the notes for a future pass, not addressed by this ADR.
4. **Go over the procedures** — user clarified this means: review/expand the SNOMED procedure valueset for clinical completeness. **This is the actionable item this ADR addresses.**

### Clinical review, bounded by the existing ADR-0032 scope

`RotatorCuffProcedureType` (`ig/input/fsh/valuesets/RotatorCuffProcedureType.fsh`) had 15 SNOMED CT codes before this ADR, governed by **ADR-0032**, which already established a deliberate scope boundary: "stay inside rotator cuff pathology and rotator-cuff-related surgery," explicitly naming and deferring salvage procedures (superior capsular reconstruction, latissimus dorsi tendon transfer) and co-existing-but-distinct conditions (biceps tendon rupture, AC joint OA, adhesive capsulitis) to a future "Step 2" (SNOMED ECL implicit valuesets, not yet implemented). This review works *within* that boundary, not against it.

The `shoulder-surgeon` subagent reviewed the 15-code list against this boundary (having first confirmed, via the verified Hurley 2024 fulltext, that the SECEC consensus paper does not enumerate procedure codes at all — this valueset has always been an editorial baseline, exactly as ADR-0032 already documented) and recommended three candidate additions, all argued as genuinely missing rotator-cuff-surgery concepts rather than adjacent-anatomy or salvage cases already deferred: a distinct subacromial decompression concept, a debridement-only option (for irreparable/partial tears where formal repair is not performed), and a graft/patch-augmented repair concept. It explicitly recommended **against** adding SLAP repair (a labral/biceps-anchor procedure, a different anatomical entity) or the two named salvage procedures, endorsing ADR-0032's existing deferral rather than second-guessing it.

### Terminology verification (live SNOMED CT server, never guessed)

Each candidate was checked against the live SNOMED CT terminology server before any FSH change:

- **Subacromial decompression**: search surfaced that the *existing* code `298672007` "Anterior decompression of shoulder joint" already carries **"Subacromial decompression" as a literal synonym** — so the concept the surgeon asked about is technically already present, just not obviously labeled under that exact term. A genuinely distinct, additive concept does exist, though: `430263007` "Arthroscopic shoulder decompression" — the arthroscopic-technique-specific variant, paralleling how the repair section already distinguishes `699120002` "Arthroscopic repair of rotator cuff" from the generic/open `56060000` "Repair of musculotendinous cuff of shoulder." **Added.**
- **Debridement**: search surfaced two precise, standard, precoordinated concepts that mirror the valueset's own existing complete/partial repair distinction: `18856005` "Arthroscopy of shoulder with extensive debridement" and `29563005` "Arthroscopy of shoulder with limited debridement." **Both added** — a real gap, since the prior list could code "complete repair," "partial repair," and "revision," but had no way to represent a debridement-only operative decision (common for massive irreparable tears in older/low-demand patients, where degenerate tissue is removed without reattaching tendon to footprint).
- **Graft/patch-augmented repair**: no clean rotator-cuff-specific precoordinated SNOMED concept was found. Searches for "repair of rotator cuff with graft," "repair of rotator cuff using patch graft," etc. surfaced only generic tendon/ligament-graft concepts (`1348289000` "Repair of tendon with graft," not shoulder-specific) or wrong-body-site matches (aorta, arterial, epispadias/hypospadias patch repairs). This confirms the shoulder-surgeon's own caveat that this addition was "the shakiest on terminology availability." **Not added** — same resolution already established in this file for the previously-dropped AU-national biceps-tenotomy code: recordable via `Procedure.code.text` free text under the existing extensible binding, or deferred to ADR-0032's Step 2 (SNOMED ECL) once available.

## Decision

`ig/input/fsh/valuesets/RotatorCuffProcedureType.fsh`:
- Added `18856005` "Arthroscopy of shoulder with extensive debridement" and `29563005` "Arthroscopy of shoulder with limited debridement" as a new grouped block.
- Added `430263007` "Arthroscopic shoulder decompression" to the existing "Shoulder arthroscopy and bony decompression" group, alongside a new disambiguating comment for what is now a 3-code decompression cluster (Acromioplasty = bone resection; Anterior/subacromial decompression = generic Neer-type; Arthroscopic shoulder decompression = arthroscopic-technique-specific) — flagged by the shoulder-surgeon subagent as needed once a third, closely-related concept joined the cluster.
- No existing code changed, removed, or flagged as questionable — the shoulder-surgeon's sanity check found all 15 prior codes clinically correct and non-redundant.
- `^version` 0.2.0 → 0.3.0; header comment updated to point to both ADR-0032 (original scope/provenance) and this ADR (completeness review).

Net: 15 → 18 codes. This is an incremental Step-1 expansion under ADR-0032's existing framework — it does not supersede that ADR, and Step 2 (SNOMED ECL implicit valuesets) remains future work.

No IG profile, cardinality, Questionnaire, or frontend code changes are needed: `RotatorCuffProcedure.code`'s extensible binding to this valueset is unchanged, and both frontends (`ProcedureStep.tsx` via `useValueSet`, the SDC Surgery Questionnaire via `answerValueSet`) render the dropdown generically from the IG-hosted valueset content — no hardcoded duplicate list exists anywhere in either frontend.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Add SLAP repair | Recommended against by the shoulder-surgeon subagent — a labral/biceps-anchor procedure, a distinct anatomical entity from the rotator cuff; admitting it would open the same door as the biceps-rupture/AC-arthritis cases ADR-0032 already deliberately excluded |
| Promote superior capsular reconstruction and/or latissimus dorsi transfer out of deferral | Both are genuine, rising-prevalence salvage options for massive irreparable tears, but remain lower-frequency alternatives to cuff repair rather than cuff-repair procedures themselves; ADR-0032 named them explicitly as deferred, the binding stays extensible for a site that needs them now, and Step 2's ECL expansion (`<< 129269003 \|Procedure on shoulder\|`) will capture them systematically. Not a present gap that overrides the ADR's deliberate deferral. |
| Add a fabricated/approximate code for graft/patch-augmented repair | Explicitly rejected — no verified precoordinated SNOMED concept exists; guessing a code violates this project's standing verify-every-terminology-code policy. `Procedure.code.text` free text is the honest interim answer under the extensible binding. |
| Address the incision-to-suture timing sub-point in the same pass | User explicitly asked to skip this sub-point for now — a `performedDateTime` → `performedPeriod` switch is a larger change (touches the Q11-anchor logic) better handled as its own point later, not bundled opportunistically into a valueset review. |

## Consequences

✅ Closes a real, surgeon-identified gap: debridement-only procedures (a common operative decision for massive irreparable tears) are now codeable; previously only "complete repair," "partial repair," or "revision" existed, none of which correctly represent a debridement-only decision.

✅ No mapping coverage change — this valueset was never tied to a specific mapping CSV row's coverage count; the one existing mapping reference (`.md`, provenance pointer to ADR-0032) stays accurate and generic, no edit needed.

✅ No frontend, SDC, or example-data changes needed — confirmed (not assumed) via direct exploration that both frontends consume this valueset generically and no example currently uses a code this ADR touches.

⚠️ The incision-to-suture timing sub-point and the two already-satisfied-but-unconfirmed-in-writing sub-points (hospital stay, multiple codes) remain tracked in the surgeon-review notes — the first stays genuinely open for a future pass, the latter two are annotated as already-satisfied with no ADR of their own (a no-op confirmation doesn't warrant one).

⚠️ The "298672007 already has 'Subacromial decompression' as a synonym" finding is a reminder that a literal-term gap analysis (does the exact word appear anywhere) can produce false negatives when SNOMED's preferred term differs from common clinical phrasing — worth checking synonyms, not just preferred terms, before concluding a concept is missing.

## Sources

- Clinical review by the reviewing shoulder surgeon, part 2
- Explore agent reports (2026-07-21) — IG/FHIR modeling of the surgical event (`RotatorCuffSurgeryBundle.fsh`, `ShoulderEncounter.fsh`, `RotatorCuffProcedure.fsh`, mapping rows L3.B.4/L3.B.5/L3.C.1/L3.C.2/L3.E.2/L3.E.3/L3.G.2, ADR-0069) and the Surgery wizard frontend (`SurgeryWizard.tsx`, `EncounterStep.tsx`, `ProcedureStep.tsx`, SDC `ShoulderSurgeryQuestionnaire.fsh`, `extractor.ts`)
- `shoulder-surgeon` subagent review (2026-07-21) — completeness assessment within the ADR-0032 boundary, citing the verified Hurley 2024 fulltext (confirms the paper never enumerates procedure codes)
- SNOMED CT MCP terminology-server lookups (2026-07-21): `430263007` (Arthroscopic shoulder decompression), `18856005` (Arthroscopy of shoulder with extensive debridement), `29563005` (Arthroscopy of shoulder with limited debridement) — all verified present and active; graft/patch-augmented repair searched and found to have no rotator-cuff-specific precoordinated match
- ADR-0032 (governing scope/provenance ADR for this valueset — not superseded, incrementally extended)
- `ig/input/fsh/valuesets/RotatorCuffProcedureType.fsh`
