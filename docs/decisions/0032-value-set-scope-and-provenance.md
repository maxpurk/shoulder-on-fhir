# ADR-0032: Value set scope and provenance — RotatorCuffDiagnosis and ShoulderProcedureType

**Date:** 2026-05-12
**Status:** Accepted; the `RotatorCuffDiagnosis` content list in §Decision (Step 1) is superseded by ADR-0076 (tendon/etiology codes removed) and then ADR-0111 (narrowed to a single fixed tear code — Hurley defines no disease-entity choice at all). `ShoulderProcedureType` and this ADR's general editorial-provenance argument (§Context point 2) are unaffected.

## Context

Two ValueSets in this IG enumerate the coded values used for the index diagnosis and the index procedure:

- `RotatorCuffDiagnosis` bound (extensible) on `RotatorCuffCondition.code` and reused on `ShoulderServiceRequest.reasonCode` (ADR-0029).
- `ShoulderProcedureType` bound (extensible) on `ShoulderProcedure.code`.

The SECEC consensus paper (Hurley et al., 2024 — *European Society for Surgery of the Shoulder and Elbow rotator cuff tear registry Delphi consensus*, JSES International 8(3):478–482) is the IG's data-dictionary anchor (`mapping/SECEC_FHIR_Mapping.md`, ADR-0027). A review prompted by the question "where did these codes come from?" established two facts that this ADR records:

1. **Hurley et al. (2024) does not enumerate diagnostic or procedural codes.** The paper specifies *data elements* (Q1–Q13: what fields to capture) and *classification axes* (Patte, Goutallier, size, tendons involved, partial vs. full thickness). It does not reference any coding system in its body text — SNOMED CT, ICD-10, CPT, and LOINC are not mentioned. Supplementary Appendix S1 contains the three Delphi rounds (questionnaire text and vote tallies), not coded value sets.
2. **The codes presently enumerated in both ValueSets were an editorial selection** drawn from SNOMED CT during IG authoring (verified via the `mcp-snomed-ct` MCP server against the CSIRO Ontoserver, per ADR-0010). They are a defensible baseline of common SECEC-relevant entities but are not exhaustive and were not prescribed by the consensus.

ADR-0019 already records that for production deployments an external SNOMED CT terminology server (e.g. CSIRO Ontoserver, Snowstorm) can be wired into HAPI via a one-line configuration. With such a server in place, SNOMED Expression Constraint Language (ECL) implicit value sets become operationally feasible — the ValueSet definition can name a SNOMED parent and the terminology server returns the full subsumption set at expansion time, rather than the IG carrying a frozen enumeration.

## Decision

Adopt a **two-step approach** to the scope of `RotatorCuffDiagnosis` and `ShoulderProcedureType`:

### Step 1 (this release): bounded, enumerated, verified

Keep both ValueSets as explicit enumerations of SNOMED CT codes, modestly expanded beyond the original 6/9 to cover obvious SECEC-relevant entities. All codes are verified via `mcp-snomed-ct` against the CSIRO Ontoserver (FHIR R4) at authoring time.

`RotatorCuffDiagnosis` — 12 codes:
- Core tear types (6): `926335004`, `202843000`, `202842005`, `399346004`, `209754000`, `209755004`
- Etiology distinction for SECEC Q1.5 (2): `698299009` (Traumatic rupture of rotator cuff), `424175006` (Nontraumatic rotator cuff tear)
- Related rotator cuff pathology (4): `415352004` (Rotator cuff tear arthropathy), `789754007` (Tendinitis of rotator cuff tendon), `359532006` (Rotator cuff impingement syndrome), `27741009` (Calcific tendinitis of shoulder)

`ShoulderProcedureType` — 16 codes:
- Rotator cuff repair granularity (5): `699120002`, `56060000`, `304384006` (Complete repair of rotator cuff), `304385007` (Partial repair of rotator cuff), `429598009` (Revision of repair of rotator cuff)
- Shoulder arthroscopy and bony decompression (3): `281812007`, `77474007`, `298672007` (Anterior decompression of shoulder joint)
- Frequent concomitant procedures (3): `439861005` (Arthroscopy of shoulder with biceps tenodesis), `847191000168109` (Tenotomy of biceps), `734057006` (Excision of distal clavicle)
- Shoulder arthroplasty (2): `308681004`, `785850002`
- Prior non-surgical treatments for SECEC Q1.6, Q1.7 (3): `91251008`, `27813003`, `290035003`

Both bindings remain `extensible` (per ADR-0014b binding policy) so an implementing site can add a site-specific SNOMED concept without IG modification.

Scope discipline for Step 1: stay inside rotator cuff pathology and rotator-cuff-related surgery. Co-existing-but-distinct conditions (biceps tendon rupture, AC joint osteoarthritis, adhesive capsulitis, subacromial impingement as a non-RC entity) and salvage procedures (superior capsular reconstruction, latissimus dorsi tendon transfer) are deliberately deferred to Step 2 to keep the enumerated list small and reviewable.

### Step 2 (future work): SNOMED ECL implicit value sets

Once an external SNOMED CT terminology server is configured (the one-line HAPI change documented in ADR-0019), reformulate both ValueSets as SNOMED ECL implicit value sets. For example:

```
http://snomed.info/sct/900000000000207008?fhir_vs=ecl/<<414033006
```

`<< 414033006 |Disorder of rotator cuff|` returns the full subsumption tree at expansion time; analogous expressions exist for procedures (the natural parent for shoulder procedures is `129269003 |Procedure on shoulder|`, with refinement by site or surgical-procedure-type as needed). This step:

- Removes the enumeration-maintenance burden from this IG;
- Lets the value set follow SNOMED CT release content;
- Naturally covers co-pathology and complex procedures without an IG release;
- Makes the IG's scope statement crisper: "we accept any descendant of these named SNOMED parents."

Step 2 is **not implemented in this change**. It depends on the production-deployment decision documented in ADR-0019 and would, when adopted, supersede the Step-1 enumerations in this ADR.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Status quo — leave the 6/9 enumerated codes unchanged | Defensible (binding is extensible), but readers of the IG and thesis could reasonably misread the small list as authoritative or exhaustive. Modest expansion + an explicit provenance record is more honest. |
| Switch to SNOMED ECL implicit value sets now | Technically clean, but requires either an external terminology server at runtime (not configured in this prototype per ADR-0019) or bundling a SNOMED CT release into HAPI (rejected in ADR-0019 for operational reasons). Deferring this is the correct sequencing. |
| Broad enumeration covering biceps/AC/capsulitis and salvage procedures | Would grow the enumerations without a principled cutoff; every reviewer would propose different additions. The extensible binding already admits these at runtime, and Step 2's ECL approach handles them systematically. |
| Cite registry data dictionaries (Norwegian, Swedish, German DVSE) as the source | Would give an empirical anchor, but the publicly available registry data dictionaries are not standardised between countries and would create a comparable provenance question (which registry's list?). SNOMED CT is the cross-registry common denominator. |

## Consequences

✅ The IG's documentation now accurately reflects what Hurley et al. fixes (the elements) and what is editorial (the codes).  
✅ Step 1 modestly expands clinical usefulness — etiology distinction (Q1.5) and concomitant-procedure granularity (Q5.1 surgical-planning context) are better supported.  
✅ Extensible binding strength is preserved, so implementers retain runtime freedom.  
✅ The Step-2 path is concrete (ECL expression, terminology-server config) rather than aspirational.  
⚠️ The enumerated list will inevitably miss codes that some user expects; this is acceptable for a prototype and is exactly what Step 2 resolves.  
⚠️ This ADR may itself be superseded by a future "switch to ECL implicit ValueSets" ADR once Step 2 is enacted.  

## Sources

- `ig/input/fsh/valuesets/RotatorCuffDiagnosis.fsh` — Step 1 enumeration
- `ig/input/fsh/valuesets/ShoulderProcedureType.fsh` — Step 1 enumeration
- `mapping/SECEC_FHIR_Mapping.md` — provenance note linking back to this ADR
- ADR-0010 — SNOMED CT verification via `mcp-snomed-ct` during authoring; standard-terminology-first rule
- ADR-0014b — extensible binding policy on RotatorCuffCondition; pre-coordinated SNOMED CT preferred over post-coordination
- ADR-0019 — terminology-server strategy; HAPI now, external SNOMED server in production
- ADR-0027 — complete SECEC element coverage via standard terminologies; documents the May 2026 expansion of ShoulderProcedureType for prior PT/injection (Q1.6/Q1.7), now incorporated in this ADR's Step 1 list
- Hurley ET, Calvo E, Collin P, Claro R, Magosch P, Schoierer O, Karelse A, Rasmussen J, SECEC Committee Members. "European Society for Surgery of the Shoulder and Elbow (SECEC) rotator cuff tear registry Delphi consensus." *JSES International* 8(3):478–482, 2024. DOI: 10.1016/j.jseint.2024.01.015 — the SECEC consensus paper; specifies data elements and classification axes, does not enumerate codes
