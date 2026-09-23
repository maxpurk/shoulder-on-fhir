# ADR-0098: LLM-assisted extraction frontend — evaluated, deferred

**Date:** 2026-07-25
**Status:** Accepted
**Builds on:** `docs/future_work_items/0001-llm-assisted-extraction-frontend/plan.md`

## Context

A fourth frontend concept was scoped alongside ADR-0095/0096/0097: a clinician pastes free clinical
text (a clinic note or op report), an LLM (`claude-sonnet-5`, with `claude-opus-4-8` as an escalation
option) extracts structured values into the matching wizard's fields, and the clinician
reviews/corrects before the existing, unchanged submit path runs. The scoping locked several concrete
design choices — model selection, no local inference (so no deployment server upgrade needed), a genuinely
standalone third frontend rather than a route bolted onto the unified frontend, port assignments
(frontend 3002, sidecar 3600), and a same-process single-use draft hand-off mechanism for the
cross-origin frontend-to-frontend redirect — and recorded them in
`docs/future_work_items/0001-llm-assisted-extraction-frontend/plan.md`. Nothing has been implemented.

That plan's own status line marks it "not yet approved for implementation," but no ADR recorded
the deferral decision itself — this ADR closes that gap, matching the treatment given to the two
other work items scoped alongside it (ADR-0096, ADR-0097).

## Decision

**Defer.** Do not implement now. The plan — including its already-locked implementation
decisions on model choice, hardware footprint, and delivery shape — stays in
`docs/future_work_items/0001-llm-assisted-extraction-frontend/` for future pickup, unapproved.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Implement now | This is a genuinely new, larger capability — a new sidecar, a new frontend, a new external API dependency and its cost — for an already-late-stage thesis project. A scope and priority call of this size needs an explicit approval decision before implementation starts. |
| Approve for later implementation but don't record the deferral | Exactly the inconsistency this ADR (and its siblings, ADR-0096/0097) corrects — "not now" is itself a decision worth a short paper trail, per this project's own precedent of ADRs for evaluated-and-deferred options (ADR-0068, ADR-0071, ADR-0095). |
| Defer to `docs/future_work_items/`, record via this ADR | **Chosen.** |

## Consequences

✅ The plan's nontrivial locked-in design decisions are now anchored to a numbered ADR, not left to live only in a plan file that could drift or get lost.
⚠️ The plan's dated specifics — the exact model identifiers and their pricing, and the `3002`/`3600` port assignments — were captured on 2026-07-25 and must be re-verified before any implementation, as the plan itself states.
❌ A fourth frontend paradigm (LLM-assisted prefill) remains unbuilt; the thesis narrative is unaffected either way since this was never a committed feature.

## Sources

- `docs/future_work_items/0001-llm-assisted-extraction-frontend/plan.md` — the locked design decisions this ADR defers
- ADR-0068, ADR-0071 — this project's precedent for ADRs recording evaluated-and-rejected/deferred options
- ADR-0095, ADR-0096, ADR-0097 — the sibling deferral ADRs from this same date
