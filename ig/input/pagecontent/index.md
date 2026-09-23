# Shoulder on FHIR Implementation Guide

**Version:** 1.0.0-thesis &nbsp;|&nbsp; **Status:** Draft &nbsp;|&nbsp; **FHIR:** R4 (4.0.1) &nbsp;|&nbsp; **Jurisdiction:** Europe

## Overview

Rotator cuff tears are a common shoulder injury, yet there is no shared, machine-readable format for documenting their diagnosis, surgical repair, and post-operative follow-up. Existing shoulder surgery registries, including the DART arthroscopy registry and the SEPR arthroplasty registry operated by the DVSE, use proprietary web platforms with custom data models. None publishes an HL7 FHIR profile or a standard interoperability interface.

**Shoulder on FHIR** is a FHIR R4 Implementation Guide (IG) for rotator cuff injury documentation in research registries. It defines FHIR profiles, CodeSystems, and ValueSets that cover the data elements of a published expert consensus. This lets shoulder surgery data move between systems with shared meaning, without changing clinical workflows.

The consensus is a Delphi study of shoulder surgeons published by Hurley et al. It is the source data dictionary for this IG: Hurley ET et al. *JSES International* 2024;8(3):478–482. [doi:10.1016/j.jseint.2024.01.015](https://doi.org/10.1016/j.jseint.2024.01.015)

This IG was developed at the **Hasso Plattner Institute (HPI)** as a master thesis artifact. It is standards-based, demonstrated end to end, and refined through iterative review of the running demonstrator with a consulting shoulder surgeon. That review is design input; the guide has not been balloted by HL7 and has not been validated by an independent expert panel.

## Clinical Research Scenario

A surgeon in Germany documents a rotator cuff repair in a DART-compatible system through a Shoulder-on-FHIR plugin. The system builds a `RotatorCuffRegistrationBundle` and posts it to the local FHIR server: SNOMED CT `91774008` for the right shoulder, a Constant-Murley score coded with SNOMED CT `273383002`, a Goutallier grade for the supraspinatus, each as a structured FHIR resource. Months later, a colleague at another SECEC member centre records the same pathway against the same IG. Both centres now hold conformant FHIR bundles with identical terminology bindings.

A federated FHIR query, `GET /Observation?code=273383002` across both endpoints grouped by `Procedure.code`, returns comparable Constant-Murley trajectories from both cohorts with no extract-transform-load step and no column mapping. A study that would have needed bespoke ETL scripts and a bilateral data agreement becomes a FHIR export and a shared IG version number.

FHIR gives the syntactic and structural layer. This IG adds the semantic layer: each data element is bound to a verified international terminology code, or to a documented local code where no international code exists.

## Scope

This IG covers the data elements for **rotator cuff tear** documentation in the expert consensus ([Hurley et al. 2024](https://doi.org/10.1016/j.jseint.2024.01.015)). The consensus is decomposed, using the paper's own letter notation, into **58 elements** across the 12 questions that reached the 80% Delphi threshold (Q1: 13 patient-history factors; Q2: 9 physical-exam aspects; Q4: 5 classification axes; Q8: 5 treatment-success criteria; Q9: 7 post-op exam aspects; Q11: 5 research timepoints; Q12: 7 required PROM components plus the Constant score and the SSV/SANE pair, counted once; Q3, Q5, Q6, Q10, Q13: 1 statement each). Q7 (ultrasound) reached only 60% and is excluded from this denominator.

| Domain | Profiles | Coverage |
|--------|----------|---------|
| Patient registration | `ShoulderPatient` | Demographics, hand dominance |
| Patient history (Q1) | `SmokingStatusObservation`, `PainAverageObservation` (plus 3 other pain-context axes), `EmploymentStatusObservation`, `OccupationalPhysicalDemandObservation`, `SleepDisturbanceObservation`, `FunctionalLimitationsObservation`, `SportsParticipationObservation` | Smoking, pain, occupation, sleep, functional limits, sports |
| Diagnosis | `RotatorCuffCondition` with `TendonsInvolvedObservation` and `TearLocationObservation` | Tear diagnosis, laterality, chronicity; tendons involved and tear location as linked evidence Observations |
| Prior treatment (Q1.f) | `RotatorCuffProcedure` | Prior physical therapy and shoulder injections |
| Surgical procedure | `RotatorCuffProcedure` | Procedure type, laterality, approach |
| Clinical assessment | 57 derived `ShoulderObservation` profiles | Visual inspection, range of motion (LOINC-coded), strength, provocation tests, imaging classifications, PROMs |
| Imaging | `ShoulderImagingStudy` | Modality obtained: radiograph, MRI, CT, ultrasound |
| Patient-reported outcomes | `RotatorCuffQuestionnaireResponse`, plus the consensus-preferred instruments (Constant-Murley via SNOMED CT `273383002` with `component[]` sub-scores; SSV and SANE) | Structured PROM instruments |
| Insurance and follow-up | `ShoulderCoverage`, `RotatorCuffResearchCarePlan`, `ShoulderEncounter` | Coverage type, 5 research timepoints (6 wk, 3 mo, 6 mo, 1 y, 2 y), routine post-op visits |

**Representability:** every one of the 58 consensus elements is representable in the IG, and none is unmodellable in FHIR (0 Missing). The residual constraint is terminology rather than structure: 38 of the 58 draw on at least one local code because no verified international concept exists at the needed granularity; of the remaining 20, 17 are carried entirely by reused external terminology and 3 carry no coded facet at all. Alongside the 58 consensus elements, the IG carries a second layer of 43 operational rows (patient identity, temporal anchors, laterality, transaction bundles, cross-resource references) that the consensus does not name; these are counted separately and are not part of the consensus denominator. The element-by-element breakdown, with its two-facet code and value terminology-provenance classification, is maintained in the project's consensus-to-FHIR mapping.

## Design Principles

### Standard terminologies first

The IG binds a verified international code wherever one exists at the needed granularity, and a local code only where none does. SNOMED CT codes anatomical sites (shoulder laterality `91774008` and `91775009`, tendon structures), the diagnosis, procedures, and coded finding values (for example a positive or negative provocation test). LOINC codes the observation itself for range-of-motion angles (`41389-8` and siblings), smoking status (`72166-2`), employment status (`67875-5`), and patient satisfaction (`77218-6`). Local CodeSystems cover orthopaedic-specific scales with no international equivalent, such as Goutallier grading, Patte staging, return-to-activity, and visual inspection.

### One profile per observation type

The IG defines 57 derived Observation profiles, one per clinical observation type, instead of one generic profile with a polymorphic `value[x]`. Each profile fixes its `Observation.code` and constrains `value[x]` to a single FHIR type: Quantity for range-of-motion angles, strength grades, and scores; CodeableConcept for provocation tests, imaging classifications, present or absent findings, and coded ordinals. A FHIR validator can then check the correct value type for each observation.

### FHIR R4 with European scope and IPS interoperability

`ShoulderPatient`, `RotatorCuffCondition`, `ShoulderComorbidityCondition`, `ShoulderDiagnosisCondition`, and `RotatorCuffProcedure` derive from HL7 Europe Core 2.0.0 profiles. `ShoulderObservation` parents from base `Observation`, and the 57 derived profiles parent from `ShoulderObservation`. EU Core publishes no generic Observation profile that fits this IG's scope, because `medicalTestResult-eu-core` is scoped to laboratory results.

### Conformance with HL7 Europe Core and IPS

The IG conforms on two layers. **Profile-level:** the five profiles above derive from [HL7 Europe Core 2.0.0](https://hl7.eu/fhir/base/), so they align with the EHDS realm by construction and inherit EU `Address` formatting, `condition-assertedDate`, and the R5 backport `Procedure.recorded`. **Instance-level:** applicable instances additionally claim [IPS 1.1.0](http://hl7.org/fhir/uv/ips/) conformance through `meta.profile[]`, so the same data can be consumed as IPS resources in cross-border exchange (for example MyHealth@EU) without remapping.

IPS claims are carried by the instance. No profile in this guide constrains `meta.profile`, so a submission that omits the claim still conforms to its bundle profile. The worked examples and the template-based forms carry these claims:

- `Patient` also claims `Patient-uv-ips`. `name.family 1..1 MS` satisfies both the `eu-pat-1` and `ips-pat-1` invariants.
- `ShoulderComorbidityCondition` also claims `Condition-uv-ips` (a problem-list match). `RotatorCuffCondition` and `ShoulderDiagnosisCondition` do not, because an encounter diagnosis is not a problem-list entry.
- `Procedure` instances claim `Procedure-uv-ips`.
- Smoking `Observation` instances claim `Observation-tobaccouse-uv-ips`. The profile stays parented to `ShoulderObservation` to keep the abstract-parent hierarchy.

### Conformance with the HL7 Structured Data Capture IG

The IG declares a dependency on the [HL7 SDC IG v4.0.0](https://hl7.org/fhir/uv/sdc/) (`hl7.fhir.uv.sdc`). Six Questionnaire artifacts are published, one per transaction bundle profile under each of the two declarative extraction mechanisms the specification provides. All extraction runs on the client; the IG does not rely on a server `$extract` operation.

| Bundle profile | Definition-based form | Template-based form |
|---|---|---|
| [`RotatorCuffRegistrationBundle`](StructureDefinition-rotator-cuff-registration-bundle.html) | [`shoulder-registration`](Questionnaire-shoulder-registration.html) | [`shoulder-registration-full-template`](Questionnaire-shoulder-registration-full-template.html) |
| [`RotatorCuffSurgeryBundle`](StructureDefinition-rotator-cuff-surgery-bundle.html) | [`shoulder-surgery`](Questionnaire-shoulder-surgery.html) | [`shoulder-surgery-full-template`](Questionnaire-shoulder-surgery-full-template.html) |
| [`RotatorCuffFollowUpBundle`](StructureDefinition-rotator-cuff-follow-up-bundle.html) | [`shoulder-follow-up`](Questionnaire-shoulder-follow-up.html) | [`shoulder-followup-full-template`](Questionnaire-shoulder-followup-full-template.html) |

The three definition-based forms declare `meta.profile = http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extr-defn`, the three template-based forms `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extr-template`.

**Definition-based extraction.** An engine reading these forms must resolve the target profile and apply the values it pins. The codes that identify every extracted resource live there and nowhere else: `Observation.code`, `Observation.category` and the UCUM unit on a quantity are supplied by the profile, not restated in the form. The specification words that step as a recommendation, so a conformant engine may skip it; a form here does not work without it.

A `definitionExtract` extension names the profile to create in its `definition` sub-extension, on the group whose answers populate that resource or, for a resource no question describes, on the Questionnaire itself. Leaf items carry `item.definition` pointing at the element an answer fills. `definitionExtractValue` supplies a fixed or computed value for an element no question asks for, and `extractAllocateId` allocates the uuid that `definitionExtract.fullUrl` places on the bundle entry and that `definitionExtractValue` writes into each referring element. An element's FHIR type, cardinality and profile-fixed values are resolved from the compiled `StructureDefinition` at extraction time rather than restated in the form, which is the asymmetry the specification itself names between the two mechanisms. Two resources are declared at the Questionnaire root, where extraction is not conditional on an answer beneath it: the registration `ShoulderEncounter`, and the `RotatorCuffResearchCarePlan` whose five follow-up timepoints derive from the index procedure date.

These three forms also carry the retired `itemExtractionContext` extension on the nine groups that predate `definitionExtract`, naming the same target profile, for an earlier client that reads only that extension. `definitionExtract` is authoritative and covers every extracted resource; a consumer should read it and ignore the retired extension. Note that in SDC v4.0.0 the definition-based and template-based extraction extensions themselves carry standards status `draft`, while the Questionnaire profiles they attach to are trial-use.

**Template-based extraction.** A `templateExtractBundle` extension on the Questionnaire references a contained transaction `Bundle` that is the whole submission, and `templateExtractValue` on each element names the answer that fills it. No `StructureDefinition` is read, so every profile-fixed value is restated inside the form; `tools/check-template-fidelity.sh` resolves each contained entry to the profile its own `meta.profile` names and holds the restated literals to it. Because the template is the envelope, these forms are the ones that state `Bundle.meta.profile`.

**Population.** `launchContext` on the two surgery and the two follow-up forms takes the Patient in scope at launch, an `itemPopulationContext` query resolves that patient's `RotatorCuffCondition`, and `initialExpression` seeds the identifiers a visit refers to. The two registration forms declare no `launchContext`, because a registration creates the patient. `calculatedExpression` computes the Constant-Murley total from its four sub-scores. Population is declared independently of extraction and works the same way under either mechanism.

**What travels with a form, and what does not.** A definition-based form declares the connected submission: the cross-resource reference graph, the required values no question asks for (resource status codes, `Condition.clinicalStatus`, a recorded date), the registration visit and the research follow-up schedule. Several things sit outside it, none of them a validity failure, because each is optional in the bundle profile, and all of them losses of meaning. Workers' compensation and the comorbidity list are asked by the form and targeted by no extraction declaration, so a receiver loses both. `Encounter.diagnosis` and its rank are targeted by no form. The `QuestionnaireResponse` itself is never placed in the bundle, though two bundle profiles carry a slice for it. Three more are properties of the mechanism rather than of these forms. The instance-level IPS claims are not declared, because extraction stamps only the profile named in the extraction context. `Condition.evidence.detail` and `Condition.stage.assessment` are not declared, because the extract rules for a resource referencing a repeating item have to sit inside that repeating group, and the Condition group sits outside the observation groups. And `Bundle.meta.profile` is not reachable, because `definitionExtract` carries six sub-extensions and every one of them is scoped to a single bundle entry; no bundle profile in this guide constrains `Bundle.meta`, so a definition-based submission is valid against its bundle profile but does not assert which profile that is. A receiver either validates against the profile it requires, or is handed the template-based form, which states the claim and pays for it by restating every fixed value.

## How to Use This IG

### Implementers

1. Load all StructureDefinitions, CodeSystems, ValueSets, and Extensions into your FHIR server from the provided `package.tgz`.
2. Include a `meta.profile` reference to the relevant profile canonical URL on each resource.
3. Validate with a FHIR R4 validator with this IG's package loaded.

### Exploring the IG

- **[Profiles](profiles.html)**: the base profiles (including the three transaction bundles) and the 57 derived observation profiles, with constraints and differentials
- **[Terminology](terminology.html)**: CodeSystems and ValueSets, with the rationale for each local code
- **[Examples](examples.html)**: a single patient followed from registration through surgery to a follow-up visit
- **[Artifacts](artifacts.html)**: the full list of defined resources

## Dependencies

{% include dependency-table.xhtml %}

## IP Statements

{% include ip-statements.xhtml %}

## Cross-Version Analysis

{% include cross-version-analysis.xhtml %}

## Global Profiles

{% include globals-table.xhtml %}
