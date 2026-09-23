# Structural core parented from EU Core STU2 (pre-normative), pinned exactly

> **Status:** Limitation — open, maintenance/robustness. Logged 2026-08-17 during a reader review of
> the EU Core / IPS alignment narrative (ADR-0169). Classified against the expert consensus:
> **none** — this touches the L3 operational/administrative envelope, not any `Q#.#` consensus
> element.

## Gap

Five load-bearing profiles inherit structurally from `hl7.fhir.eu.base` v2.0.0, **STU2**
(Standard for Trial-Use), pinned exactly in `sushi-config.yaml`: `ShoulderPatient` ←
`patient-eu-core`; `RotatorCuffCondition`, `ShoulderComorbidityCondition`,
`ShoulderDiagnosisCondition` ← `condition-eu-core`; `RotatorCuffProcedure` ← `procedure-eu-core`.
STU2 is trial-use / pre-normative: any EU Core minor or major release may change inherited
cardinalities, bindings, or invariants, and because the dependency is pinned to an exact version,
each bump requires manual reconciliation plus a full re-validation before it can be adopted.

Re-verified 2026-08-17 (`https://hl7.eu/fhir/base/`): the EU Core R4 line is still v2.0.0 STU2
(published 2026-04-27) — the pin is current, so nothing is broken today. A parallel R5 line now
exists but is not this IG's target (the IG is FHIR R4).

## Why it matters

The demographic / administrative / comorbidity / social-history envelope — the exact layer that
carries the EU Core + IPS interoperability claim — depends on an evolving parent. For the frozen
thesis artifact this is inert. For any registry deployment that outlives the thesis it is a real
maintenance liability: the conformance strength gained by hard re-parenting (over the earlier
dependency-only posture) is paid for with breaking-change exposure on every EU Core release.

## Note

Mitigation is cheap and already partly in place: re-verify EU Core status each edit cycle and
re-run `tools/validate.sh` (which pins IPS 1.1.0 and would surface an inherited-constraint break) on
any bump. No modelling change is warranted under thesis-freeze — the current pin validates. The
sibling IPS-scoping concern (IPS claim on non-surgical procedures) was resolved in ADR-0170;
national-base layering is tracked separately in `future_work_items/0008-german-national-base-ig-layering`.
