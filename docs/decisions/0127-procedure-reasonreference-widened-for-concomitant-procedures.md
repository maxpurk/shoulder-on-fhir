# ADR-0127: Widen `RotatorCuffProcedure.reasonReference` so a concomitant procedure can cite a non-RC diagnosis

**Date:** 2026-08-01
**Status:** Accepted
**Found via:** auditing whether the two longitudinal example patients (Anna Müller, Kemal Demir) exercise ADR-0121's one-incision/one-closure-per-surgical-event model — both currently record only one `Procedure` per surgery bundle, so the model was never demonstrated with more than one procedure sharing an event.

## Context

`RotatorCuffSurgeryBundle` has always allowed `Procedure 1..*` (ADR-0034), and its own Description text names concomitant procedures explicitly ("the index procedure ... and any concomitant surgical procedures (biceps tenodesis, distal clavicle resection, etc.)"). The IG's own bundled example instance (`ExampleSurgeryBundle`) already demonstrates a second, concomitant `RotatorCuffProcedure` (`ExampleConcomitantBicepsTenodesis`), linked to the index procedure via `Procedure.partOf`.

But that example's concomitant procedure carries **no `reasonReference` at all** — and inspecting why shows a real gap: `RotatorCuffProcedure.reasonReference` is constrained `only Reference(RotatorCuffCondition)`. A concomitant procedure frequently doesn't treat the rotator cuff tear itself — it treats a *coexisting* pathology found alongside it (AC joint arthritis → distal clavicle excision, biceps tendinopathy → tenodesis, a labral tear → repair). Since ADR-0077, exactly this kind of coexisting-but-distinct pathology already has a home in the data model: `ShoulderDiagnosisCondition`, used via `RotatorCuffRegistrationBundle.otherDiagnosis` (its own Description text names AC joint osteoarthritis, biceps tendinopathy, and a labral tear as its worked examples). But `RotatorCuffProcedure.reasonReference`'s type constraint made it structurally impossible for a concomitant Procedure to reference one — the only two options were "reference the RC diagnosis" (wrong, if that's not what the procedure treats) or "reference nothing" (which is what the IG's own example silently does).

This surfaced while trying to close a real example-data gap: neither longitudinal patient (Anna Müller, Kemal Demir) demonstrates more than one `Procedure` in a surgery bundle, so ADR-0121's shared-incision/closure model has no reference data showing it applied across two procedures. Anna Müller already has a coded secondary diagnosis, `Condition/anna-mueller-ac-oa` (`ShoulderDiagnosisCondition`, "Mild osteoarthritis of the right acromioclavicular joint"), established at Registration — the natural, zero-invented-facts way to add a second procedure to her surgery bundle is a concomitant distal clavicle excision that treats *that* diagnosis, not the rotator cuff tear. Attempting this exposed the reference-type gap above.

## Decision

Widen `RotatorCuffProcedure.reasonReference` from `only Reference(RotatorCuffCondition)` to `only Reference(RotatorCuffCondition or ShoulderDiagnosisCondition)`. Cardinality (`MS`, unbounded optional) is unchanged — this only widens *what* may be referenced, not *whether* a reference is required. Profile bumped `0.2.0` → `0.3.0`.

Same relaxation pattern ADR-0066 already used for `ShoulderEncounter.reasonReference` (there: `Reference(RotatorCuffCondition)` → `Reference(Condition)`, so the shared anatomy-region Encounter profile could still anchor a bundle whose Condition slice is deliberately not RC-tight). This case is narrower and more targeted — rather than opening to the fully generic base `Condition`, it enumerates exactly the two Condition profiles this IG defines that a Procedure could legitimately be "for": the index RC diagnosis, or a coexisting non-RC shoulder diagnosis captured via the same registration.

Kept the mapping CSV row (`L3.F.2`, Procedure reasonReference) in sync — Notes updated to describe the widened reference; still `Full`, Layer 2 (IG-Operational), no `% Full`/`% Partial` impact.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Leave `reasonReference` unset on concomitant procedures (what the IG's own bundled example already does) | Valid FHIR, but throws away real, already-captured information — the registry knows exactly which diagnosis a concomitant procedure addresses (it's sitting right there as a `ShoulderDiagnosisCondition`); recording it is strictly more useful for a research registry than leaving the link implicit. |
| Widen to bare `Reference(Condition)`, mirroring ADR-0066 exactly | Over-broad for this profile: `RotatorCuffProcedure` (unlike `ShoulderEncounter`) is pathology-specific by name and design; enumerating the two IG-defined Condition profiles it can legitimately reference keeps the constraint meaningful instead of accepting any Condition on the server. |
| Add a third Condition profile just for "concomitant-procedure indications" | Unnecessary new profile for a relationship `ShoulderDiagnosisCondition` already models correctly (a coexisting shoulder diagnosis) — would duplicate, not clarify. |

## Classification (Clinical Feedback Integration Workflow)

**(c) IG-operational addition / refinement.** `Procedure.reasonReference` is Layer 2 cross-resource-linkage scaffolding (`L3.F.2`), never named by the SECEC expert consensus — no `% Full`/`% Partial` impact. Not new clinical data-collection burden (classification (d)): the fact (which diagnosis a concomitant procedure treats) is already known at the point of surgery: docmentation, not new burden.

## Consequences

✅ A concomitant procedure can now correctly cite the specific coexisting diagnosis it treats, closing a real modeling gap the IG's own bundled example was silently working around by omitting `reasonReference` entirely.
✅ Unblocks adding a second, non-invented-fact `Procedure` to a longitudinal example patient's surgery bundle, demonstrating ADR-0121's shared-incision/closure model with more than one procedure (see companion seed-data change, same date).
✅ `sushi .` compiles clean (0 errors, 0 warnings) after the widening.
⚠️ No frontend UI change: the unified frontend's Surgery wizard still assigns the *same* `conditionReference` (the RC diagnosis) to every procedure in the event, index and concomitant alike (`SurgeryWizard.tsx`'s `buildProcedureResource`) — it has no per-procedure diagnosis picker. This widening makes the correct modeling *possible* (and is exercised by the hand-authored seed data), but a surgeon using the live wizard to record a concomitant procedure for a coexisting diagnosis still can't wire that specific reference through the UI today. Logged as a `docs/limitations_items/` follow-up, not fixed here — scope was the data model + example data, not a new wizard feature.

## Sources

- `ig/input/fsh/profiles/RotatorCuffProcedure.fsh` — the widened `reasonReference`.
- `ig/input/fsh/profiles/ShoulderDiagnosisCondition.fsh` — the target profile, whose own Description already names AC joint OA / biceps tendinopathy / labral tear as its worked examples.
- `ig/input/fsh/examples/RotatorCuffSurgeryBundle.fsh` — `ExampleConcomitantBicepsTenodesis`, the pre-existing bundled example this ADR's gap was found in (still carries no `reasonReference`; not retrofitted here — out of scope, the gap it demonstrates is now merely optional to leave unfixed, not structurally required).
- ADR-0034 (three-bundle architecture, `Procedure 1..*` on the Surgery bundle), ADR-0066 (the `ShoulderEncounter.reasonReference` relaxation this follows the pattern of), ADR-0077 (`ShoulderDiagnosisCondition` / `otherDiagnosis`), ADR-0121 (shared incision/closure per surgical event — the model this unblocks demonstrating with example data).
- `mapping/SECEC_FHIR_Mapping.csv` row `L3.F.2`.
