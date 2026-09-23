# ADR-0169: EU Core / IPS alignment — maturity re-check and risk register

**Date:** 2026-08-17
**Status:** Accepted
**Relates to:** ADR-0038 (soft alignment, superseded direction), ADR-0057/0058/0059/0060 (the profile-level EU Core parenting + instance-level IPS multi-profile posture actually in force), ADR-0166 (honest-reporting posture)

## Context

A reader review of the alignment narrative surfaced a genuine confusion: ADR-0038 is titled "Soft
alignment … (no re-parent)" and states the profiles parent from FHIR R4 base, whereas the artifact
in force does the opposite — ADR-0057/0058/0059 re-parent Patient / Condition / Procedure from EU
Core, and ADR-0057/0058/0059/0060 add instance-level IPS `meta.profile[]` claims. ADR-0038 is the
first draft of the posture; the 005x series is the final state. Nothing in the FSH is wrong; the
confusion is purely narrative (an early ADR whose title reads as if it were still current, plus a
thesis §5 sentence that walked the reader through the superseded soft-alignment step).

Verified current state (FSH, `sushi-config.yaml`, 2026-08-17):

- **EU Core = StructureDefinition parent** — `ShoulderPatient` ← `patient-eu-core`;
  `RotatorCuffCondition`, `ShoulderComorbidityCondition`, `ShoulderDiagnosisCondition` ←
  `condition-eu-core`; `RotatorCuffProcedure` ← `procedure-eu-core`. Address-eu datatype,
  `condition-assertedDate`, and R5-backport `Procedure.recorded` are inherited, not redeclared.
- **IPS = instance-level multi-profile via `meta.profile[]`** — Patient (`Patient-uv-ips`),
  comorbidity Condition (`Condition-uv-ips`), every Procedure (`Procedure-uv-ips`), smoking
  Observation (`Observation-tobaccouse-uv-ips`); plus IPS ValueSet bindings on comorbidity `code`
  and smoking status.
- **Deliberate asymmetry** — the index-diagnosis `RotatorCuffCondition` parents EU Core but does
  *not* claim IPS: an encounter diagnosis is not an IPS problem-list entry (ADR-0058).
- **The 57 shoulder-specific Observation profiles** parent from the local abstract
  `ShoulderObservation` and claim no EU Core / IPS lineage — no international reference profile
  defines these specialty measures (ADR-0008).

### EU Core maturity re-verification

Re-checked `https://hl7.eu/fhir/base/` on 2026-08-17: the R4 line is **still `hl7.fhir.eu.base`
v2.0.0, STU2 (Standard for Trial-Use), published 2026-04-27** — unchanged since the alignment was
built. A parallel R5 line now exists but is not this IG's target (the IG is FHIR R4, ADR-0001). The
exact pin in `sushi-config.yaml` is therefore current; no re-parenting or re-validation is triggered.

### Risk observations (three)

The direction is correct — EU Core as jurisdiction-correct structural parent, IPS as
use-case-correct instance-level conformance claim — but the review named three standing risks worth
recording rather than leaving implicit:

1. **Structural core coupled to a pre-normative parent.** Five load-bearing profiles inherit from
   EU Core STU2, pinned exactly. Any EU Core release can change inherited cardinalities / bindings /
   invariants; the pin means each bump needs manual reconciliation + re-validation. Inert for the
   frozen thesis artifact; a real maintenance liability for any deployment outliving it. The earlier
   soft-alignment posture (dependency-only) was lower-risk on this axis, but forfeited the
   conformance strength the 005x series bought. Logged as a limitation.
2. **IPS `Procedure-uv-ips` claimed on non-surgical Procedures.** The claim is stamped on *every*
   Procedure instance, including prior physiotherapy / injection treatments — semantically a stretch
   (IPS Procedures are summary-worthy procedures) and a latent validation fragility, since the IG
   retains a `Procedure.code.text` free-text fallback (ADR-0092) that an IPS coded-`code` expectation
   could reject. Today all instances carry coded procedures and validate against IPS 1.1.0, so this
   is latent, not a live failure. Logged as a limitation.
3. **IPS conformance is assertional.** Nothing generates an IPS summary document; the
   `meta.profile[]` entries are conformance assertions validated as such, never exercised by an
   actual IPS export. Legitimate and honest for a demonstration artifact — it proves
   interoperability-readiness — but should be stated as a claim, not implied as a working pipeline.
   Logged as future work.

## Decision

- **Reaffirm the EU Core profile-level + IPS instance-level posture as the final, correct
  alignment.** ADR-0038's title and "no re-parent" wording are retained as historical record;
  ADR-0057/0058/0059/0060 remain the operative decisions. No FSH change.
- **Record the maturity re-check:** EU Core R4 remains v2.0.0 STU2 (2026-08-17); the pin is current.
- **Keep the broad IPS Procedure claim for now** (it validates today) and log the surgical-only
  scoping reconsideration as a limitation rather than changing modeling under thesis-freeze.
- **Correct the reader-facing wording** so it neither implies the specialty Observations align with
  EU Core / IPS nor walks the reader through the superseded soft-alignment step:
  - Thesis abstract (EN + DE): the EU Core / IPS alignment now attaches to the *sixteen base
    profiles*, not to the whole enumeration that includes the 57 specialty Observations.
  - Thesis §Results "Alignment with HL7 EU Base / Core and IPS": added the scope statement (the
    alignment covers the patient-identity / administrative / comorbidity / social-history envelope;
    the 57 specialty Observation profiles carry no EU/IPS lineage and are the IG's own
    contribution), the index-vs-comorbidity Condition asymmetry, and the assertional nature of the
    IPS claim; removed the superseded-alternative "original soft-alignment direction … later
    decisions lifted it" sentence per the deliverables positive-framing rule.
- **Log the three risks:** two limitation items (STU2 parent coupling; IPS Procedure claim on
  non-surgical procedures) and one future-work item (IPS summary-document generation).

## Consequences

- ✅ The narrative confusion is closed: one ADR now states plainly that 005x supersedes 0038's
  "soft / no re-parent" direction, with the verified current state enumerated.
- ✅ The thesis no longer over-attributes EU/IPS alignment to the specialty clinical layer, and no
  longer leaks the superseded internal soft-alignment step to the reader.
- ✅ The EU Core maturity dependency and the two modelling loosenesses are now on the open-items
  log instead of living only in reviewer commentary.
- ⚠️ EU Core status must be re-verified on each future edit cycle; a normative or breaking EU Core
  release would trigger re-parenting review + full re-validation.
- ⚠️ The IPS Procedure claim stays broad for now; if a free-text-only Procedure code is ever
  emitted, the IPS conformance obligation on that instance must be revisited (see limitation).

## Sources

- HL7 Europe Base and Core FHIR IG v2.0.0 — https://hl7.eu/fhir/base/ (re-verified 2026-08-17: still STU2, R4, published 2026-04-27)
- ADR-0038 — Soft alignment with HL7 Europe Base + Core (superseded direction)
- ADR-0057/0058/0059/0060 — profile-level EU Core parenting + instance-level IPS multi-profile
- `ig/input/fsh/profiles/ShoulderPatient.fsh`, `RotatorCuffCondition.fsh`, `RotatorCuffProcedure.fsh`, `ShoulderComorbidityCondition.fsh`
- `ig/sushi-config.yaml` (`hl7.fhir.eu.base: 2.0.0`, `hl7.fhir.uv.ips`)
- `docs/limitations_items/0018-eu-core-stu2-parent-coupling/`, `docs/limitations_items/0019-ips-procedure-claim-on-nonsurgical-procedures/` (resolved by ADR-0170; directory removed per the "delete when resolved" convention), `docs/future_work_items/0023-ips-summary-document-generation/`
