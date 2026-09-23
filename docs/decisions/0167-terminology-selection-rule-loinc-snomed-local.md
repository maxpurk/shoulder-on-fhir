# ADR-0167: Consolidated terminology-selection rule — LOINC for the observation code, SNOMED CT for clinical entities and coded answers, local codes at the frontier

**Date:** 2026-08-16
**Status:** Accepted

## Context

The IG binds coded elements to a mix of LOINC, SNOMED CT, UCUM, DICOM, HL7 code systems (v3-ActCode, THO), and local CodeSystems. That mix has been applied **consistently** since the earliest terminology work, but the *rule* governing it — which system is used where, and why — has only ever been stated implicitly and scattered across the ADR chain:

- **ADR-0010** — the original "standard-terminology-first" rule and the two-condition test for adding a local code.
- **ADR-0027** — standard terminologies used directly in `Observation.code` where they exist; local reserved for domain-specific concepts with no international equivalent.
- **ADR-0045** (LOINC sweep) and **ADR-0115** (SNOMED sweep) — the auditable "verify, then fall back to local" practice.
- **ADR-0056/0060** (smoking → IPS LOINC), **ADR-0070** (satisfaction → LOINC), **ADR-0046** (etiology SNOMED+local hybrid), **ADR-0116** (atrophy reverted to local because its real SNOMED concept does not resolve on the served tx.fhir.org edition).
- **ADR-0087/0088** — the reverse direction: LOINC codes deliberately abandoned for local ones where the standard code did not fit the clinical construct (four context-specific pain axes; at-side internal-rotation vertebral-level ordinal).

No single ADR states the division of labour, and the thesis and the published IG narrative described it only in fragments. An audit (for a thesis section on "when LOINC vs when SNOMED, and why") also surfaced two accuracy issues: (a) ICD-10-GM is described in places (the project guide, the mapping) as "used where available," when in fact **no element ever binds or fixes an ICD-10-GM code** — it is permitted only as an optional additional comorbidity coding for deployment-time dual-coding; and (b) one drift defect: `valuesets/ShoulderObservationCode.fsh` still enumerated `http://loinc.org#10158-4` "History of Functional status Narrative" after `FunctionalLimitationsObservation` migrated to a local `#functional-limitation-severity` ordinal (ADR-0105), so the extensible VS advertised a LOINC code the IG no longer emits.

## Decision

Record the terminology-selection rule explicitly as the IG's standing convention, aligned with the established LOINC–SNOMED CT division of labour (Bodenreider, Cornet & Vreeman 2018). The rule, as already implemented:

1. **The code and the value of an observation are chosen independently.**
2. **SNOMED CT** binds the *clinical entities and coded answers*: anatomy/laterality (`bodySite`), the diagnosis (`Condition.code`), procedures (`Procedure.code`), etiology, and coded finding values (provocation positive/negative, present/absent inspection, tendons, tear thickness, hand dominance, reconstruction extent). It also codes the few `Observation.code`s for which SNOMED has a precoordinated concept (Constant total, Jobe, lift-off, deformity, handedness, pack-years).
3. **LOINC** binds the *observation code* — the "what is measured" — of a quantitative measure or standard assessment where a shoulder-specific LOINC exists (ROM flexion/abduction/at-side ER; smoking status; employment status; satisfaction; the RSG sex-at-birth `type`), together with its LOINC answer lists (LA/LL codes).
4. **UCUM** for units; **DICOM** for imaging modality; **HL7 v3-ActCode** for the workers'-compensation coverage type; **FHIR-core/THO** for status/category housekeeping.
5. **Local CodeSystems** are the deliberate fallback — the *terminology frontier* — used only where neither LOINC nor SNOMED CT has the shoulder-specific concept at the required granularity (Goutallier/Patte/Cofield, registry ordinals, muscle-specific strength, the three provocation tests SNOMED does not precoordinate).
6. **ICD-10-GM is permitted but not exercised** — admitted only as an optional additional `coding[]` on comorbidity, never as a primary binding.
7. **Closest clinical fit first, not standard code always:** where a standard code exists but does not fit the construct, the closest-fitting local code is preferred (ADR-0087/0088); and local fallback is sometimes forced by terminology-server coverage rather than by the absence of a concept (ADR-0116).

Also fix the one drift defect: remove the stale `10158-4` enumeration from `ShoulderObservationCode.fsh`. Document the rule in the published IG narrative (`ig/input/pagecontent/terminology.md` §Design Principles, without ADR numbers per the repo's IG-output rule) and in the thesis (Background §Terminologies, Methods §Terminology Binding Strategy, and a new Results §"Terminology Choice: LOINC, SNOMED CT, and Local Codes").

**Scope:** this ADR consolidates and cross-references ADR-0010/0027/0045/0115/0116; it **supersedes none** — every existing code/value binding stands. The only code change is the VS cleanup.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Leave the rule implicit across the existing ADRs | A reader/examiner needs one consolidated statement, and the thesis section needs a single anchor; the rule was re-derived ad hoc in ~20 later ADRs |
| Make sibling groups terminologically uniform (e.g. force all provocation tests or all inspection findings onto one system) | Fights the standard-first rule and terminology-server coverage; the mixed cases (Jobe/lift-off SNOMED vs the other three local; deformity SNOMED vs atrophy local) are each correct per-element and documented |
| Keep `10158-4` in the ValueSet | Genuine drift — no profile has emitted it since ADR-0105; the `extensible` binding hides it from the validator, so it is silently misleading |
| Re-describe ICD-10-GM as actively used | Factually wrong — no ICD-10-GM code is bound or fixed anywhere in the FSH/seed/frontends |

## Consequences

✅ The terminology-selection rule is now stated once, consistently, in the IG narrative and across Background → Methods → Results in the thesis.
✅ The `ShoulderObservationCode` ValueSet no longer advertises a LOINC code the IG does not emit; `sushi .` remains clean.
✅ ICD-10-GM is accurately described as *permitted but not exercised* wherever the terminology rule is stated.
✅ The independent code/value choice and the "closest clinical fit first" nuance (including the ADR-0116 tooling-driven fallback) are captured as the honest characterisation of the local codes as the terminology frontier.
⚠️ Root the project guide and `mapping/SECEC_FHIR_Mapping.md` still describe terminology as "SNOMED CT / LOINC / ICD-10-GM / DICOM used where available"; aligning that wording to "ICD-10-GM permitted, not exercised" is a minor future touch-up, flagged but out of scope here.
❌ No binding changes: this ADR documents the rule, it does not re-decide any element's code or value.
