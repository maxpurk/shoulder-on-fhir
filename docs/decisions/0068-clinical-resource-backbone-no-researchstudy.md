# ADR-0068: Use clinical FHIR resources as registry backbone; do not adopt ResearchStudy/ResearchSubject

**Date:** 2026-06-28
**Status:** Accepted

## Context

A FHIR-based research registry can be organised around two different resource layers:

1. **Clinical model** — Patient → Encounter → Condition → Observation → Procedure. Every clinical resource references `subject` (Patient); observations link to encounters; encounters link to conditions. This is the FHIR star-graph described in Oeppert et al. (ADR: see §Information Model vs. Data Model in the thesis).
2. **Research model** — `ResearchStudy` (the protocol, one instance for the whole registry) + `ResearchSubject` (per-patient enrollment record, with lifecycle status `enrolled / withdrawn / completed / off-study-screen-failure`). Observations and Procedures can then reference `ResearchSubject` via `derivedFrom` or `basedOn`.

The question arose during the IG review: should this IG have been built around `ResearchStudy` / `ResearchSubject` as the central organizing concept, with the clinical resources attached underneath?

## Survey of Comparable IGs

| IG | ResearchStudy/ResearchSubject usage |
|---|---|
| **mCODE STU 4** (oncology registry, largest FHIR registry IG) | Zero — not a single profile or reference. Core is Patient → Condition → Observation → Procedure |
| **SenologieOnFHIR** (German breast cancer registry) | `ResearchSubject` used as an optional add-on for formal clinical trial enrollment (`Studienteilnahme`). Core clinical model is identical to mCODE's pattern. |
| **DART** (Deutschsprachiges Arthroskopieregister) | No published FHIR IG. The FHIR mappings in the DART data-element inventory are our own analysis of what DART elements *could* map to, not DART's actual implementation. |

## Decision

Use the clinical FHIR resource model as the IG backbone. `ResearchStudy` and `ResearchSubject` are not adopted as structural resources.

## Rationale

**1. Comparable registry IGs do not use ResearchStudy as a backbone.**
mCODE — the largest and most mature FHIR registry IG — has zero references to ResearchStudy/ResearchSubject. The pattern across all surveyed IGs is: clinical resources are the data model; research enrollment is an optional add-on at most.

**2. The clinical model is the research model for observational registries.**
The registry's primary output is structured clinical observations at defined timepoints (Q2 pre-op exam, Q9 post-op exam, Q12 PROMs). FHIR's Patient → Encounter → Observation graph captures this directly and is what EHR systems already produce. ResearchStudy/ResearchSubject add a research enrollment layer but do not change the fundamental data elements captured.

**3. ResearchStudy is designed for interventional clinical trials, not observational registries.**
ResearchStudy has explicit fields for randomisation arms, eligibility criteria, phases, and intervention descriptions — none of which apply to an observational surgical outcomes registry. Adopting ResearchStudy would import a clinical-trial vocabulary that misrepresents the registry's nature.

**4. EU Core / EHDS alignment is served by the clinical layer.**
EHDS Article 51 and the EU Base/Core profiles this IG parents from are all clinical resources. The interoperability target (cross-border clinical data reuse) is addressed at the clinical data level, not the research protocol level.

**5. Lost-to-follow-up is handled via the Observation pattern.**
`ResearchSubject.status = off-study-intent` is one pattern for LTFU tracking. This IG uses a dedicated `ShoulderLostToFollowUpObservation` pattern at Layer 2 (L3.H.4, ADR-0054), which is more granular and aligns with the Observation-centric architecture.

## CarePlan vs ResearchSubject

The IG carries `RotatorCuffResearchCarePlan` (optional, 0..1 in `RotatorCuffRegistrationBundle`) as a per-patient follow-up schedule (Q11 timepoints). This is a pragmatic use of CarePlan for "what activities are planned for this patient" — distinct from ResearchSubject, which models "is this patient enrolled in study X." Neither demo frontend currently populates the CarePlan. A future iteration could replace or supplement it with `ResearchSubject` for formal enrollment tracking, paired with a `ResearchStudy` instance representing the SECEC registry protocol.

## Consequences

✅ Architecture matches the mCODE precedent — the most widely adopted FHIR registry IG.  
✅ EU Core / IPS alignment unaffected — clinical resources are the target layer.  
✅ Simpler: no registry-level `ResearchStudy` to manage; no `ResearchSubject` lifecycle to track.  
✅ EHR vendors can contribute data without a research-protocol abstraction layer.  
⚠️ A production deployment integrating with a clinical trial management system would want to add `ResearchSubject` for formal enrollment tracking — this is a documented extension point, not an architectural barrier.  
⚠️ `RotatorCuffResearchCarePlan` uses CarePlan semantics (clinical care plan) for a research schedule — semantically imprecise. The canonical FHIR pattern would be `ResearchStudy` + `PlanDefinition` + per-patient `CarePlan` instantiation, which is significantly more complex and out of scope for this proof-of-concept IG.

## Sources

- mCODE STU 4 FSH source — zero ResearchStudy/ResearchSubject references verified
- SenologieOnFHIR docs (`snomed-expo-2026-supplemental.md`) — ResearchSubject for Studienteilnahme only
- HL7 FHIR R4 ResearchStudy resource — http://hl7.org/fhir/R4/researchstudy.html
- HL7 FHIR R4 ResearchSubject resource — http://hl7.org/fhir/R4/researchsubject.html
- Oeppert et al. 2021 — information model vs data model distinction (cited in thesis §6.2)
- ADR-0054 — Layer 2 / lost-to-follow-up pattern (L3.H.4)
