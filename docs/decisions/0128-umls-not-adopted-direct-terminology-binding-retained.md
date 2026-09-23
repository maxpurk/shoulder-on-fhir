# ADR-0128: UMLS not adopted for terminology binding — direct SNOMED CT/LOINC/ICD-10 binding retained

**Date:** 2026-08-02
**Status:** Accepted

## Context

During registry-landscape related-work research (comparing this IG against ARCR_Pred, a Swiss-led
academic rotator-cuff-repair cohort — see the ARCR_Pred landscape note),
ARCR_Pred's protocol (Audigé et al. 2021, *BMJ Open* 11:e045702) surfaced a terminology practice not
previously considered for this IG: **UMLS (Unified Medical Language System) Concept Unique Identifier
(CUI) annotation**. Verified directly against the protocol PDF: "all variables will be annotated by
their Unified Medical Language System Concept Unique Identifier to improve accessibility to other
clinicians," with case report forms uploaded to a public medical-data-models portal
(medical-data-models.org) for that purpose.

UMLS is a meta-thesaurus maintained by the US National Library of Medicine (NLM) that links equivalent
concepts across many source vocabularies (SNOMED CT, LOINC, ICD-10, MeSH, RxNorm, and others) under a
shared CUI. It is designed for two purposes this IG does not have: (1) crosswalking between
*already-existing* data coded in different, incompatible vocabularies, and (2) NLP-driven concept
extraction from unstructured free text. ARCR_Pred's use is narrower than either of those: it tags
**CRF variable definitions** (the form schema) with a CUI for cross-study discoverability, not
individual patient-record values — a metadata-level gesture, not per-instance semantic coding.

This IG already has an established, terminology-server-first binding strategy (ADR-0045: ROM
observations migrated to LOINC; ADR-0050: SNOMED CT resolution delegated to `tx.fhir.org`; ADR-0049/
ADR-0052: validator CLI and IG Publisher both default to the same TX server). Every profiled element
that the expert consensus (Hurley et al. 2024) or IG-operational (Layer 2) design calls for is bound
directly to a verified SNOMED CT, LOINC, or ICD-10-GM code at the `Coding` level on the resource
instance itself — not to an intermediate cross-vocabulary identifier. This ADR records why UMLS is not
being added as a second terminology layer alongside that existing strategy, now that a concrete
alternative practice has actually been encountered in a comparable registry, rather than leaving the
question un-addressed.

## Decision

**Do not adopt UMLS in any form.** Continue binding every coded element directly to its native
terminology (SNOMED CT via `tx.fhir.org`, LOINC via the verified LOINC FHIR terminology server, ICD-10-GM
where used) as already established by ADR-0045/ADR-0049/ADR-0050/ADR-0052. No UMLS CUI annotation is
added to FSH profile definitions, ValueSets, or CodeSystems, and no UMLS-mediated crosswalk layer is
introduced anywhere in the IG or its frontends.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **UMLS CUI annotation of FSH element/profile definitions** (ARCR_Pred-style: tag the form-schema/StructureDefinition level for cross-study discoverability) | Solves a problem this IG does not have. ARCR_Pred needs this because its case report forms live inside REDCap with no other public semantic anchor — a UMLS CUI is the only thing making its variables discoverable to an outside researcher at all. This IG's profiles are already discoverable and semantically anchored *at the instance level*: every `Observation.code`/`Condition.code`/etc. carries a real, resolvable SNOMED CT or LOINC `Coding`, published in a versioned IG with its own canonical URLs. Adding a CUI on top would annotate the schema with a *weaker* identifier than the codes already bound to every instance of it. |
| **UMLS as a runtime crosswalk layer** (map between SNOMED CT, LOINC, ICD-10-GM automatically via UMLS Metathesaurus relationships) | Would be the right tool for reconciling *legacy* data already coded in incompatible vocabularies, or supporting deployments that must accept both SNOMED CT- and ICD-10-only source systems. This IG is not in that position: it defines its own value sets from the start and controls capture at the point of entry via the frontends' typeahead/coded pickers, so there is no pre-existing multi-vocabulary corpus to reconcile. |
| **UMLS-driven NLP extraction from free text** (map unstructured clinical notes to coded concepts) | Out of scope entirely — this IG has no free-text clinical-note ingestion pipeline anywhere in its architecture; all structured data is captured directly through profiled Questionnaire/QuestionnaireResponse or typeahead-coded forms, not extracted from narrative text. |
| **Status quo: direct terminology-server binding only** (**chosen**) | Already the established strategy (ADR-0045, ADR-0050, ADR-0049, ADR-0052). Provides genuine per-instance semantic interoperability — the actual FHIR resource carries the code, not just its form definition — without adding a second terminology-licensing dependency alongside the terminology servers already integrated. |

## Consequences

✅ No regression: the IG's existing per-instance SNOMED CT/LOINC/ICD-10-GM binding strategy already
exceeds what ARCR_Pred's UMLS-CUI form-annotation achieves — every coded value on every resource
instance is directly resolvable against `tx.fhir.org`/the LOINC terminology server today, which is a
stronger interoperability guarantee than a CUI tag on a form field.
✅ No new dependency introduced: adopting UMLS would require every deployer to independently sign the
UMLS Metathesaurus License Agreement and activate an individual NLM UTS account (free, but a
per-person registration/license step, reviewed by NLM — verified via NLM's own UTS documentation) for
no benefit this IG's existing terminology-server pipeline does not already provide.
✅ Consistent with the "verify every terminology code against its authoritative source" discipline
already applied throughout the IG (LOINC via the official LOINC FHIR server, SNOMED via `tx.fhir.org`)
— UMLS CUIs would be one more layer of indirection between a claimed code and its authoritative
source, not a verification improvement.
⚠️ This IG's ValueSets/CodeSystems are not cross-referenced in the UMLS Metathesaurus the way
NLM-indexed vocabularies are, so a researcher doing cross-vocabulary discovery *purely through UMLS
tooling* would not find this IG's codes that way. Mitigated: the IG publishes its own versioned,
canonically-URLed ValueSets/CodeSystems as a FHIR Implementation Guide, which is a stronger, more
standard discovery mechanism within the FHIR ecosystem than UMLS registration would be.
❌ If a future deployment needed to reconcile this IG's data against a *legacy* dataset captured in an
incompatible vocabulary (e.g. a pre-existing OPS/ICD-10-only source system), UMLS-mediated crosswalking
would need separate evaluation at that time — this ADR does not rule it out as a future integration
tool, only as a layer within the IG's own data model today.

## Sources

- Audigé L, Bucher HCC, Aghlmandi S, Stojanov T, et al. Swiss-wide multicentre evaluation and
  prediction of core outcomes in arthroscopic rotator cuff repair: protocol for the ARCR_Pred cohort
  study. *BMJ Open* 2021;11(4):e045702. doi:10.1136/bmjopen-2020-045702 — direct quote verified via
  PMC8070866 fetch, 2026-08-02: "all variables will be annotated by their Unified Medical Language
  System Concept Unique Identifier to improve accessibility to other clinicians," case report forms
  uploaded to https://medical-data-models.org/.
- the ARCR_Pred landscape note — landscape note this decision responds to.
- NLM UMLS Terminology Services (UTS) license/account requirements —
  https://uts.nlm.nih.gov/uts/license, https://www.ncbi.nlm.nih.gov/books/NBK9686/ (verified 2026-08-02:
  free but requires an individually signed UMLS Metathesaurus License Agreement + NLM-reviewed UTS
  account per user).
- ADR-0045 — ROM Observation.code bindings migrated to LOINC.
- ADR-0049 / ADR-0052 — validator CLI and IG Publisher TX server defaults (`tx.fhir.org`).
- ADR-0050 — SNOMED CT resolution delegated to `tx.fhir.org` via `remote_terminology_service`.
- The project guide, §LOINC FHIR Terminology Server — the project's standing "verify every code against its
  authoritative source" discipline this decision is consistent with.
