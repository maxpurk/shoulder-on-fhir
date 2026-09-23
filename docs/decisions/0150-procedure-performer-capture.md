# ADR-0150: Capture `RotatorCuffProcedure.performer` (surgeon identity) in both frontends and seed data

**Date:** 2026-08-04
**Status:** Accepted

## Context

the field-level cross-frontend comparison — a field-level comparison of every data point captured across the
unified frontend, the SDC frontend, the IG, and the seed data, built 2026-08-04 — found that
`RotatorCuffProcedure.performer.actor` is `MS` on the profile (`L3.H.1`, "Needed for any
multi-surgeon registry") but captured nowhere: not the unified frontend's Surgery wizard, not
the SDC Surgery Questionnaire, not either longitudinal seed patient's surgery bundle. Before
building UI for this, the open question was whether Hurley et al. (2024) actually names
surgeon/performer identity anywhere, which would make this a consensus-classification decision
rather than a free Layer 2 addition.

**Verified against the full Hurley et al. 2024 text** (fetched via Zotero, all 13 questions
across all 3 Delphi rounds, not guessed): surgeon/performer/provider identity is never
mentioned. Q1–Q13 cover patient history, physical exam, imaging, tear classification, treatment
success, follow-up duration/timepoints, and PROM components — nothing about who performed the
procedure. This confirms `L3.H.1` is correctly classified as Layer 2 (IG-operational), not a
missed consensus element.

## Decision

**(c) IG-operational addition** per the Clinical Feedback Integration Workflow — not
Hurley-named, structurally already modeled (`performer.actor MS`), free to add without a
go/no-go.

Capture as a **free-text name via `Reference.display` only**, not a managed `Reference(Practitioner)`:
this IG has no `Practitioner` profile and no practitioner directory/lookup anywhere. Adding one
would be new IG surface (a new resource type, a new profile, registry/lookup UI) for a registry
that has no other practitioner-management need today. `Reference.display` with no `.reference`
is a valid FHIR "logical reference" — the same shape this IG already uses for
`Coverage.payor` (`[{ display: 'Berufsgenossenschaft (BG)' }]`, no `Organization` resource).

**One performer per surgical event, not per procedure** — same pattern as incision/closure time
(ADR-0121): a concomitant procedure is performed by the same surgeon, in the same operative
session, as the index procedure. The unified frontend's `SurgicalEventStep.tsx` gained a
"Surgeon / Performer" free-text field alongside Day of Surgery / Setting / Incision / Closure;
`SurgeryWizard.tsx`'s `buildProcedureResource` applies the same name to every `Procedure` in the
event. The SDC frontend's `ShoulderSurgeryQuestionnaire.fsh` gained a loose-leaf
`encounter.performer` item (no `item.definition` — the plain-text answer doesn't map to a single
resource element the generic per-path resolver could place; it gates a `Reference.display`
construction the way `coverage.workersCompensation` and `patient.sexAssignedAtBirth` already do),
extracted once and applied to every `Procedure` in `bundleAssembler.ts`'s Surgery loop —
implemented together, per ADR-0144, not unified-first with SDC deferred.

Both longitudinal seed patients' surgery bundles (Anna Müller, Kemal Demir) gained
`performer.actor.display = "Dr. med. Sabine Hoffmann"` on every `Procedure` — a single fictional
attending surgeon across both cases, consistent with a demo registry's shoulder-service reference
data (not implying anything about a real practitioner).

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Add a minimal `ShoulderPractitioner` profile + `Reference(Practitioner)` | Real new IG scope (new resource type, profile, and some kind of picker/lookup UI) for a capability nothing else in this registry needs; `Reference.display` already has precedent in this IG (Coverage.payor) for exactly this "known name, no managed resource" case. |
| Skip entirely, log as a `docs/limitations_items/` item | Rejected on user instruction (2026-08-04) once Hurley-paper verification confirmed this is pure Layer 2 scaffolding with no consensus-classification ambiguity — nothing blocks building it. |
| Per-procedure performer (asked once per row, like the pre-ADR-0121 per-procedure date) | Same redundancy ADR-0121 already eliminated for incision/closure — a concomitant procedure in the same operative session has the same surgeon by construction; asking twice invites contradictory answers for no benefit. |

## Consequences

✅ `L3.H.1`'s `Full` mapping status (already claimed) is now actually backed by both frontends and
both seed patients, not just the profile existing — same class of closure as ADR-0129 found for
the Research CarePlan.
✅ `sushi .` unaffected (no profile change — `performer.actor` was already `MS`); `frontend`/`sdc-frontend`
`npm run build`/`npm run lint` both clean.
✅ Consistent event-level sharing model across incision/closure (ADR-0121) and performer.
⚠️ No Practitioner directory means no structured practitioner ID, specialty, or cross-encounter
identity resolution (e.g. "how many cases has this surgeon performed") — acceptable for a
registry-scale demonstrator; a real multi-site deployment wanting that would need the
`Practitioner` profile alternative above.

## Sources

- the field-level cross-frontend comparison (2026-08-04) — the field-level audit that surfaced this gap.
- Hurley, Calvo, Collin, et al. (2024), "European Society for Surgery of the Shoulder and Elbow
  (SECEC) rotator cuff tear registry Delphi consensus," *JSES International* 8(3):478-482 — full
  text verified via Zotero, confirms performer/surgeon identity is absent from all 13 questions.
- `ig/input/fsh/profiles/RotatorCuffProcedure.fsh` (`performer.actor MS`, unchanged by this ADR).
- `frontend/src/components/surgery/SurgicalEventStep.tsx`, `SurgeryWizard.tsx` — unified frontend implementation.
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh`, `sdc-frontend/src/lib/extractor.ts`,
  `bundleAssembler.ts` — SDC implementation.
- `seed/bundles/anna-mueller/anna_mueller_02_surgery.json`, `seed/bundles/kemal-demir/kemal_demir_02_surgery.json`.
- ADR-0121 (single incision/closure per surgical event — the sharing pattern this follows), ADR-0144
  (mandatory both-frontends-together parity), `mapping/SECEC_FHIR_Mapping.csv` row `L3.H.1`.
