# ADR-0075: `RotatorCuffCondition.clinicalStatus` — registry-specific semantics, aligned across both edit surfaces

**Date:** 2026-07-13
**Status:** Accepted

## Context

A shoulder surgeon reviewing the live frontend flagged that `clinicalStatus` (active / recurrence / inactive / resolved, offered on the Registration wizard's `StepCondition.tsx`) has no explanation attached — nothing tells a clinician what "active" vs. "inactive" is supposed to mean for a structural diagnosis like a rotator cuff tear, as opposed to e.g. an infection or a chronic inflammatory condition where the base FHIR `condition-clinical` value set reads naturally.

Investigating the codebase surfaced a second, related gap: `ConditionForm.tsx` (the standalone edit page reached from the patient detail view, used to revise a Condition's status after registration — the point in the workflow where a status transition such as `active → resolved` would actually happen) offered all **six** `condition-clinical` codes (adding `relapse` and `remission`), while the Registration wizard offered only **four**. Nothing explained any of them on either page.

## Decision

Adopt a registry-specific gloss for the four codes that are clinically distinguishable for a structural tear diagnosis, and expose only those four consistently on **both** edit surfaces:

- **active** — the tear is currently present and clinically relevant (symptomatic and/or structurally confirmed, not yet surgically addressed). Default at registration; surgery itself does not change this status — treatment outcome does.
- **recurrence** — a new tear (re-tear) at a repair site previously marked `resolved`.
- **inactive** — the patient is currently asymptomatic despite a structurally persistent or unrepaired tear (e.g. compensated on conservative management). Imaging may still show the defect; symptoms could return. Distinct from `resolved`, which implies the underlying pathology itself is gone, not just quiet.
- **resolved** — the repair is confirmed intact and healed on follow-up exam or imaging, with no ongoing symptoms expected to recur.

`relapse` and `remission` are dropped from both frontends. Per FHIR core, `relapse` means "return of a condition after a period of improvement" and `remission` means "no longer experiencing the condition, but at risk of it returning" — both read naturally for a condition that waxes and wanes (e.g. an inflammatory disease), not for a mechanical tendon tear, and they overlap `recurrence`/`inactive` closely enough to be a net source of data-entry ambiguity rather than added precision for this registry. The profile's `clinicalStatus` binding remains `required` to the full base `http://hl7.org/fhir/ValueSet/condition-clinical` — the six values stay legal per FHIR conformance; the IG simply chooses not to surface two of them in its own tooling, the same pattern already used elsewhere for local UI simplification.

Text is carried in two places, both reviewed for clinical plausibility via the `shoulder-surgeon` subagent before being finalized:
- `RotatorCuffCondition.fsh` — a `^comment` on `clinicalStatus`, published in the IG's generated profile page.
- Matching help text (`<p className="text-xs text-gray-500">`) directly under the Clinical Status dropdown in `StepCondition.tsx` and both variants of `ConditionForm.tsx`, mirroring the existing etiology help-text pattern already used on the same forms.

## Consequences

✅ Clinicians on either edit surface now see the same four-value explanation, phrased for a structural tear diagnosis rather than the generic FHIR gloss.

✅ `ConditionForm.tsx`'s dropdown now matches the Registration wizard's four options — no more silent inconsistency between where a Condition is created and where it is later revised.

⚠️ `relapse`/`remission` remain legal on the wire (required binding to the full base ValueSet) but unreachable from either frontend; a future deployer wanting them back only needs to re-add the two `<option>` lines — no profile change required.

This is a Layer 2 (IG-operational) documentation/consistency fix — `clinicalStatus` is FHIR-required scaffolding, not a Hurley-named element, so it does not change `mapping/SECEC_FHIR_Mapping.csv` coverage counts.

## Sources

- `ig/input/fsh/profiles/RotatorCuffCondition.fsh`
- `frontend/src/components/wizard/StepCondition.tsx`
- `frontend/src/components/ConditionForm.tsx`
- Clinical review by the reviewing shoulder surgeon (2026-07-13)
