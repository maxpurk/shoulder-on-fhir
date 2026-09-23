# ADR-0016: SECEC consensus model as primary data dictionary; Encounter/Appointment out of scope

**Date:** 2026-04-16
**Status:** Superseded by ADR-0028 (Encounter is now in scope) and ADR-0029 (ServiceRequest is now in scope); the SECEC-as-data-dictionary decision (point 1) remains in effect

> **May 2026 update:** The "Encounter/Appointment out of scope" decision (point 2 below) and the "9 base profiles" scope ceiling (point 3) were revisited in May 2026 during the push to complete SECEC addressability. See ADR-0027 (coverage rationale), ADR-0028 (`ShoulderEncounter`), and ADR-0029 (`ShoulderServiceRequest`). The original Q1 / Q10 coverage figures shown below are outdated, as is every later Full/Partial figure — that classification was retired entirely by ADR-0178 in favour of a two-facet code/value terminology-provenance axis. The current position is that all 58 consensus elements are representable (0 Missing); consult `mapping/SECEC_FHIR_Mapping.md` for the live figures. The SECEC-as-primary-data-dictionary principle (point 1) is retained and reinforced by the May 2026 work.

## Context

The IG targets two European shoulder surgery registries: **DVSE** (German) and **SECEC** (European). Both currently use REDCap as their data collection platform. The SECEC consensus element set defines 69 standardized data elements across 13 sections (Q1–Q13):

| Section | Coverage |
|---------|---------|
| Q1 Patient History | Partial (50%) |
| Q2 Pre-op Physical Exam | Full (88.9%) |
| Q3 X-ray Imaging | Full (100%) |
| Q4 Tear Classification | Full (100%) |
| Q5–Q6 MRI/CT Imaging | Partial (66.7%) |
| Q7 Ultrasound | Full (100%) |
| Q8 Treatment | Full (100%) |
| Q9 Post-op Physical Exam | Full (85.7%) |
| Q10 Routine Follow-up (Encounter) | **0% — not profiled** |
| Q11 Research Follow-up | Full (100%) |
| Q12 PROMs | Full structurally (Questionnaire definitions missing) |
| Q13 Follow-up Imaging | Full (100%) |

Section Q10 (Encounter/Appointment scheduling and routine follow-up visit metadata) is the only section with zero coverage. This was a deliberate scope decision.

## Decision

1. Use the **SECEC consensus element set** as the primary data dictionary for profile design — every profile element traces back to a SECEC data requirement.
2. **Do not profile `Encounter` or `Appointment`** (Q10). Visit scheduling and routine follow-up metadata are outside the scope of the rotator cuff research registry use case addressed in this thesis.
3. Limit the IG to **9 base profiles** covering patient registration, diagnosis, procedure, observations, PROMs, imaging, and research follow-up.

Overall SECEC coverage achieved: **82.6%** (full + partial).

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Profile Encounter + Appointment (Q10) | Adds significant scope without a clear research registry use case; out of scope for this thesis |
| Use DVSE element set as primary source | SECEC is the pan-European consensus standard; DVSE is a subset. SECEC coverage implies DVSE coverage. |
| Use ICD-10-GM / OPS as the data model driver | Billing codes, not research data elements; would produce a coding-centric IG rather than a research registry IG |
| Target a full EHR integration (all FHIR resource types) | Out of scope for a master thesis artifact; DSRM scope constraint: 9 profiles, rotator cuff reconstruction only |

## Consequences

✅ All 9 profiles have traceable requirements from the SECEC consensus set  
✅ 82.6% SECEC coverage is a quantifiable thesis evaluation metric  
✅ Scope is bounded and defensible for DSRM evaluation  
✅ `ShoulderResearchCarePlan` covers Q11 research follow-up timepoints — the registry-relevant complement to routine Encounter scheduling  
⚠️ Q10 (Encounter) gap means the IG cannot represent routine post-op visit scheduling — a documented limitation  
⚠️ Full Questionnaire resource definitions for PROM instruments are missing (Q12 structural coverage only)  
⚠️ Future work: add Encounter profile for Q10 coverage (post-op visit scheduling)  

## Sources

- `mapping/SECEC_FHIR_Honest_Mapping.md` — full 69-element coverage analysis with Q10 = 0% documented
- the thesis design notes — DSRM scope constraint: "rotator cuff reconstruction, 9 FHIR profiles, SECEC consensus elements"
- the FHIR landscape analysis — DVSE/SECEC registry context and REDCap baseline
- The project guide — "SECEC coverage (68 elements, Q1–Q13): 62.9% fully covered by standard FHIR, 14.5% partial, 6.5% local CodeSystems, 1.6% extension — 77.4% overall"
