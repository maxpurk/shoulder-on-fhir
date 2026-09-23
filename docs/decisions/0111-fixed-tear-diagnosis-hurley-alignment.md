# ADR-0111: Fix `RotatorCuffCondition.code` to the tear inclusion diagnosis; retire the 5-entity disease dropdown

**Date:** 2026-07-28
**Status:** Accepted

## Context

Reopening round-2 surgeon feedback point 7 ( see ADR-0105/0106 for the earlier pass at "Principal Diagnosis" usability). Live testing surfaced a concrete complaint: the `RotatorCuffDiagnosis` disease-entity dropdown (5 SNOMED codes — rupture/tear, tear arthropathy, tendinitis, impingement syndrome, calcific tendinitis) let a user pick options that appear to overlap for the same patient, specifically "Rupture of rotator cuff of shoulder" and "Rotator cuff tear arthropathy." The surgeon's proposed fix was that rupture is a subcategory of arthropathy and should be removed, since a full-thickness tear is "the same concept."

Two verifications were run before touching anything (per this project's standing terminology-verification discipline):

**1. SNOMED hierarchy (`fhir.loinc.org`/SNOMED terminology server, live lookup).** `926335004` "Rupture of rotator cuff of shoulder" and `415352004` "Rotator cuff tear arthropathy" are **not** parent/child in either direction — they sit in disjoint branches. Rupture's parent is `718539004` "Injury of rotator cuff"; arthropathy's parents are `35524003` "Arthropathy associated with another disorder" and `444003007` "Disorder of joint of shoulder region" (a joint-disease branch). Confirmed independently by the `shoulder-surgeon` subagent: cuff tear arthropathy (Neer 1983) is the end-stage sequela of a chronic, massive, long-standing tear that has additionally caused glenohumeral joint destruction and humeral head migration — clinically distinct from, not a superset of, an isolated repairable tear, and typically a reverse total shoulder arthroplasty indication rather than a repair indication. The surgeon's stated premise did not hold.

**2. Re-read of Hurley et al. 2024 (SECEC Delphi, Zotero item `TU27GN8G`) in full**, not just the mapping CSV's summary. This settled the actual design question. **The consensus defines no disease-entity selection at all.** Every one of the 13 questions is scoped "in the setting of a suspected/known **rotator cuff tear**" — the tear is the registry's inclusion criterion, never a variable to be chosen. The only classification element in the whole consensus is **Q4** ("How should rotator cuff tears be graded/classified?") → **A4: a) Size, b) Tendons involved, c) Partial vs. full thickness, d) Patte, e) Goutallier.** Tendinitis, impingement syndrome, calcific tendinitis, and tear arthropathy appear nowhere in the 13 questions or their consensus answers.

**Conclusion:** the 5-entity `RotatorCuffDiagnosis` ValueSet was never consensus-derived — it was an editorial baseline (ADR-0032, which explicitly reserves design freedom for value-set contents Hurley doesn't fix). Every Q4 sub-axis already has its own orthogonal FHIR element in this IG (tendons → `TendonsInvolvedObservation`; thickness → `TearThicknessObservation`, ADR-0105; Patte/Goutallier → `stage.assessment`; size → `TearSizeObservation`/`TearSizeClassificationObservation`), the postcoordination endpoint ADR-0076 set out to reach. Once every characterizing axis has its own home, `Condition.code` carries no remaining information — it can be fixed to the one diagnosis this registry exists to document.

## Decision

**`RotatorCuffCondition.code` is fixed to `http://snomed.info/sct#926335004` "Rupture of rotator cuff of shoulder"** (thickness-/tendon-neutral) — 1..1, no longer a clinician-facing choice. `RotatorCuffDiagnosis` ValueSet narrowed from 5 codes to this 1 code; binding stays `extensible` (a deployer may still substitute/add a code for local practice, but this registry's own frontends no longer offer a choice). The four non-tear entities (tendinitis, impingement, calcific tendinitis, tear arthropathy) are **dropped entirely, not relocated** — out-of-consensus per Hurley's own scoping, and not added to `ShoulderDiagnosis` (the `otherDiagnosis` "coexisting non-RC pathology" mechanism), since three of the four (tendinitis/impingement/calcific tendinitis) are RC-pathology, not non-RC coexisting findings, and the fourth (arthropathy) is out of scope for a repair registry specifically.

Both frontend surfaces (`StepCondition.tsx` in the registration wizard; `ConditionForm.tsx`, the standalone edit form) replace the "Diagnosis" `<select>` with a read-only "Rotator Cuff Tear" label for the rotator-cuff diagnosis kind, and hardcode the SNOMED coding at submit via a new `ROTATOR_CUFF_TEAR_DIAGNOSIS` constant (`types/fhir.ts`) rather than reading from a fetched ValueSet. `Condition.code.text` stays free — populated from the existing "Additional Description" field if present, else the plain-language label "Rotator Cuff Tear."

`RotatorCuffCondition.code`'s cardinality (1..1 MS) is unchanged; only the binding mechanism (extensible ValueSet choice → fixed value) changed. `RotatorCuffServiceRequest.reasonCode` (extensible-bound to the same VS) required no change — it isn't wired into either frontend today, and an extensible binding to a narrowed 1-code VS still validates structurally.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Remove only "Rupture of rotator cuff," keep arthropathy + the rest, per the surgeon's literal request | Verified clinically wrong: would remove the ability to code the registry's own primary, common diagnosis (an isolated repairable tear), leaving only entities that don't describe most patients. SNOMED hierarchy confirms rupture and arthropathy are not parent/child. |
| Keep the 5-code dropdown, add an editorial mutual-exclusivity note ("code arthropathy only when Hamada-stage joint destruction is present") | Clinically accurate as a standalone fix and considered — but re-reading Hurley showed the deeper problem: none of the 5 entities are consensus-defined at all, so a note papering over the "pick two" symptom would leave an editorial (not consensus) axis presented as a clinical choice. Fixing the code is strictly more faithful to the source paper. |
| Curated narrower dropdown (e.g. tear + one or two disambiguated variants) instead of a single fixed code | Rejected once Hurley's Q1–Q13 confirmed zero disease-entity variables exist in the consensus — any dropdown beyond one option reintroduces a choice the source paper never asks for. |
| Relocate tendinitis/impingement/calcific tendinitis into `ShoulderDiagnosis` (otherDiagnosis) as coexisting findings | Considered; not adopted for this pass — these three are rotator-cuff pathology, not the "non-RC coexisting shoulder finding" category `ShoulderDiagnosisCondition` exists for (per ADR-0076/ADR-0077's scope). Reintroducing them there would blur that boundary. If a future need for capturing them as differential/coexisting findings arises, that's a fresh category-(d) decision, not a byproduct of this one. |

## Consequences

✅ The "pick two overlapping options" usability complaint is resolved at the root — a 1-code ValueSet cannot present a choice.
✅ Strictly more faithful to Hurley et al. 2024: the registry's inclusion diagnosis is no longer modeled as if it were a consensus-defined variable.
✅ Coverage-neutral: no mapped Hurley element was a disease-entity selection; Q4.a–e (size, tendons, thickness, Patte, Goutallier) are untouched and still Full/Partial as before.
✅ Matches the surgeon's own point-7 mental model ("Diagnosis: Rotator Cuff Tear" as a fixed label, with tendons/thickness/location/etiology as the real data items).
⚠️ SDC frontend (`sdc-frontend/src/questionnaire/ShoulderRegistration.ts`) still binds its diagnosis item to the now-1-code `rotator-cuff-diagnosis` ValueSet rather than a fixed/read-only item — functionally harmless (the dropdown just shows one option) but not yet converted to match the unified frontend's read-only treatment. Deferred as a known follow-up, consistent with this IG's standing precedent of not always mirroring every change onto the SDC frontend in the same pass (e.g. ADR-0064).
*Amended by ADR-0144 (2026-08-03): this standing precedent is retired going forward. This SDC gap remains open, tracked as an ordinary parity item in the cross-frontend parity audit.*
❌ None identified — no mapped element's Full/Partial status changes, and both longitudinal seed patients' `RotatorCuffCondition.code` already used the retained tear code (`926335004`), not one of the four removed entities.

## Sources

- Clinical review by the reviewing shoulder surgeon (round 2), point 7, follow-up clarification
- Hurley et al. 2024, "European Society for Surgery of the Shoulder and Elbow (SECEC) rotator cuff tear registry Delphi consensus," *JSES International* 8(3):478-482 (Zotero `TU27GN8G`) — full text (Appendix 1, Rounds 1–3), specifically Q4/A4
- SNOMED CT terminology server (`mcp__snomed-ct__snomed_get_related`) — live hierarchy lookup for `926335004` and `415352004`
- `shoulder-surgeon` subagent consultation — clinical verdict on cuff tear arthropathy vs. rotator cuff tear
- ADR-0032 (value-set scope/provenance rule — this ADR supersedes its disease-entity-choice aspect only), ADR-0076 (diagnosis axis orthogonalization), ADR-0105/ADR-0106 (round-2 diagnosis-step usability, same feedback point)
- `ig/input/fsh/valuesets/RotatorCuffDiagnosis.fsh`, `ig/input/fsh/profiles/RotatorCuffCondition.fsh`
- `frontend/src/components/wizard/StepCondition.tsx`, `frontend/src/components/ConditionForm.tsx`, `frontend/src/types/fhir.ts`
