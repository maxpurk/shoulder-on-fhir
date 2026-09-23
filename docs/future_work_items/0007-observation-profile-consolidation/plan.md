# Consolidate composite-exam Observation profiles via `component` slicing

> **Status:** Future work item — not implemented, not approved.

## Gap

All 57 `profiles/observations/*.fsh` files follow the same one-concept-per-profile skeleton (fixed
`code`, fixed `category`, one `value[x]`); only `ConstantScoreObservation` uses `component`
slicing. mCODE uses a genuinely mixed strategy — independently-orderable concepts get separate
Observations linked by `hasMember`, while single multi-attribute findings get one Observation with
sliced `component`s. The ROM angle profiles — captured together in the same exam — are the most
plausible consolidation candidate.

## Why it matters

ADR-0008's one-profile-per-concept defense still holds for genuinely independent facts, but the
ROM cluster could plausibly collapse ~14 profiles into one `component`-sliced panel without losing
modeling fidelity, following mCODE's own precedent.

## Note

A deliberate re-examination of which of the 57 profiles are "composite exam" candidates vs.
genuinely independent facts — not a wholesale redesign.

## Limitations / trade-offs if the ROM cluster is consolidated

Concrete costs of collapsing the ~14 ROM angle profiles into one `component`-sliced "ROM panel"
Observation. Assessed 2026-08-22.

- **Validation is *not* the blocker.** At the component level each slice fixes its own
  `component.code` *and* its own `component.value[x]` type — spec-legal per ADR-0160. The
  code→type correlation problem that rules out the general single-code case does not apply here,
  because each measurement keeps a distinct code on its own component. Do not reject this on
  validation grounds.

- **The ROM set is no longer value-type-uniform (premise now stale).** After ADR-0088, at-side
  internal rotation (`ShoulderInternalRotationObservation` / `ShoulderPassiveInternalRotationObservation`)
  is `valueCodeableConcept` (vertebral-level ordinal); the other 12 angle profiles are
  `valueQuantity` in degrees. A merged panel would mix 12 Quantity components with one
  CodeableConcept component — legal, but semantically messy and weaker as a clean reusable panel.
  The original "8 uniform Quantity profiles" framing above predates ADR-0088.

- **Loss of per-measurement top-level LOINC coding and discrete-Observation queryability.** Today
  each ROM angle is a standalone Observation with a real LOINC code at `Observation.code` (e.g.
  `41389-8` flexion), so `Observation?code=http://loinc.org|41389-8` returns flexion values
  directly. In a panel, `Observation.code` becomes a grouping code and the LOINC moves to
  `component.code` — queried via the coarser `component-code` surface. The
  discrete-Observation-per-LOINC pattern is what IPS / US Core expect, and this IG already leans on
  IPS alignment (ADR-0055–0060), so this is a genuine interop regression.

- **Loss of one-concept-per-IG-page documentation and canonicals.** ADR-0008's main practical
  benefit: each measurement gets its own StructureDefinition, its own generated IG page, and its own
  canonical URL — individually discoverable and referenceable. Merged into components, the
  measurements no longer have individual profile pages/canonicals.

- **Arguably mis-models per mCODE's own rule** — the precedent this item cites. mCODE uses
  `component` slicing only for a *single multi-attribute finding*, and separate Observations linked
  by `hasMember` for *independently-orderable* concepts. ROM angles are independently measurable
  (flexion may be recorded while rotation is skipped), which by that rule points *toward* separate
  Observations, not components. So consolidation is not obviously the correct mCODE-style move.

- **Frontend + SDC-extractor rework.** Both frontends build one Observation per profile. The SDC
  extractor (`extractor.ts`) was hardcoded to a flat group→leaf hierarchy (ADR-0090); the
  merge-leaves-into-components machinery exists (Constant-Murley uses it) but ROM would need its own
  grouping wiring. Cost, not a hard blocker.

- **Reuse across a sibling shoulder IG (ADR-0066 rationale).** The `Shoulder*` anatomy-region
  profiles are meant to be reusable by, e.g., an arthroplasty IG. Individual ROM profiles are a
  cleaner reuse unit than a bundled panel.

**Net:** the reason to leave it as-is is not "can't validate" — it is that consolidation trades away
discrete LOINC-coded queryable Observations, per-measurement IG documentation, and IPS-style interop
for a modest reduction in profile count, while the post-ADR-0088 mixed value types and mCODE's own
separate-vs-component rule both undercut the case that ROM is even the right cluster to merge.
