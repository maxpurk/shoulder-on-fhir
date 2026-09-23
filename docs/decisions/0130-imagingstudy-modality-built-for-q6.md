# ADR-0130: Build the already-designed `ShoulderImagingStudy.modality` for Q6; realise Q5 via the existing imaging-classification Observations

**Date:** 2026-08-02
**Status:** Accepted, except §Decision 4's "keep as optional" stance for `RotatorCuffServiceRequest` / `ShoulderDiagnosticReport`, superseded by ADR-0172 (2026-08-21), which retired both profiles. The Q5/Q6 realisation via `ImagingStudy.modality` is unchanged.
**Found via:** same resource-linkage review that produced ADR-0129 — `grep -rl "ServiceRequest\|ImagingStudy\|DiagnosticReport" frontend/src sdc-frontend/src` returned zero hits, meaning Q5/Q6/Q13's `Full` status rested entirely on IG profiles existing, not on anything either frontend ever submitted. Re-reading Hurley et al. (2024) directly (full text in the consensus paper) to check what Q5/Q6 actually ask for, rather than accepting the mapping's own prior interpretation, found the gap was conceptual as well as unimplemented. **Self-corrected mid-implementation**: the first draft of this ADR proposed a new `ImagingModalityObservation` profile; a second, independent pass questioned that choice against the base FHIR R4 spec (verified locally against the cached `StructureDefinition-ImagingStudy.json`) and found it was solving an already-solved problem the wrong way — see Alternatives Considered.

## Context

The mapping's prior realisation of Q5 chained three resources: `RotatorCuffServiceRequest` (the imaging order + indication), `ShoulderImagingStudy` (the modality actually used), and `ShoulderDiagnosticReport` (the findings). **Q6's own row never depended on that chain** — its sole realisation was always `ImagingStudy.modality` alone. Neither frontend instantiates any of these three resources, so all of Q5/Q6/Q13 counted `Full` on profile existence alone (same defect class as ADR-0129's finding for Q11) — but the *fix* each one needs is different, and an earlier draft of this ADR conflated Q5's genuinely over-built chain with Q6's already-minimal, already-correct one.

Re-reading Hurley et al. (2024) directly: Q5 and Q6 are clinical-practice guidance, not data-capture instructions —

- Q5/A5: *"Advanced imaging (MRI or CT) should be performed in a patient presenting with suspected/known rotator cuff tear when planning or considering surgery."* — a statement about **when** to image.
- Q6/A6: *"An MRI should be performed except when planning for an arthroplasty, in which case CT is preferable."* — a statement about **which** modality to prefer.

Neither says "record an order" or "record a report." Q5's substance (advanced imaging occurred as part of the pre-surgical work-up) is already evidenced by the mere presence of the Patte/Goutallier/tear-size/tendons-involved Observations at the same registration encounter — no registry participant can have those without imaging having happened. That part holds regardless of what happens to Q6.

Q6's substance is exactly one fact: **which modality was used, MRI or CT** — and FHIR R4 already has a purpose-built home for exactly that: `ImagingStudy.modality`, a top-level `0..*` `Coding` element (confirmed against the locally-cached `hl7.fhir.r4.core@4.0.1` package, not assumed from memory). The IG's own `ShoulderImagingStudy` profile already declares it (`* modality MS`), and `RotatorCuffRegistrationBundle` already has an unused `imagingStudy 0..1` slice declared for it. Nothing about Q6 was ever "too heavy" — it was already the right, minimal shape; it just was never built by either frontend.

Confirming this isn't purely theoretical: both longitudinal example patients (Anna Müller, Kemal Demir) already carry a complete, hand-authored `ServiceRequest → ImagingStudy → DiagnosticReport` chain in their seed data — Anna Müller's `ImagingStudy` even has four real DICOM series with UIDs. This is a good worked example of what a real PACS/RIS-integrated deployment's output would look like; it was simply never produced by either live application.

Q13 ("no routine follow-up imaging except in research") is left out of this ADR's scope — its own mapping row was never realised via `ServiceRequest` in the first place (only `ImagingStudy` + `CarePlan`), and the "correct" behaviour it describes is the *absence* of a follow-up `ImagingStudy` in the common case, with the existing `0..1 ImagingStudy` slice on `RotatorCuffFollowUpBundle` already structurally available for the rare research-driven exception.

## Decision

1. **Q6: build a minimal `ShoulderImagingStudy`** — `status = "available"`, `subject`, `modality` (one `Coding`, MR or CT) — in both frontends. No series, no DICOM UID, no endpoint: `ImagingStudy.series` is itself `0..*` and entirely optional, so a study-level `modality` roll-up carries no further required companions.
2. **Tighten `ShoulderImagingStudy.modality`'s binding** from the unbound base-R4 extensible binding (the full DICOM CID-29 catalogue) to a new small `ImagingModality` ValueSet (`MR`/`CT`/`US`, still `extensible` — other DICOM codes remain valid, just not enumerated).
3. **Q5 gets no new field.** Its mapping realisation repoints to the already-existing imaging-classification Observations, linked via `Condition.evidence.detail` (ADR-0064 et al.) — zero new resources, zero new frontend work, unchanged from the original draft of this ADR.
4. **`RotatorCuffServiceRequest`/`ShoulderDiagnosticReport` are not deleted** and not required for Q5/Q6 `Full` status — legitimate optional profiles a real deployment (or the hand-authored example data) can still use for genuine order/report tracking.
5. **Q13 is left untouched** — out of scope per the Context section above.

Frontend cost of building `ImagingStudy`, in practice: the unified frontend needed one new `ImagingStudy`-typed resource builder in `StepImaging.tsx` (same size as the Observation builder it replaced). The SDC frontend needed more: `ImagingStudy` is a *new resource type* to its generic extraction pipeline, not just a new Questionnaire item — `extractor.ts`'s per-leaf extraction path is hardcoded to only produce `Observation`s, so a new top-level `itemExtractionContext` group (mirroring how `Condition`/`Encounter` are extracted) was needed instead, plus one `case 'ImagingStudy'` added to `submissionDefaults()` and `extractResources()`'s resource-bucket dispatcher, and one new field on `ExtractedResources`. This is *routing* logic (which output bucket a fully-built resource lands in, and the handful of fields no Questionnaire item answers) — ADR-0122's genericity claim is about per-field type/cardinality resolution, which needed zero changes here; the small, explicit resource-bucket list is a different, unavoidable layer that this correctly extends by one case.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| New `ImagingModalityObservation` profile (Observation-based) — this ADR's own first draft | Rejected on reflection: FHIR already has a purpose-built element for this exact fact (`ImagingStudy.modality`); using a generic Observation instead is a workaround, not the spec-intended home, and matters for the stated goal of handing this IG to another hospital/company — a real RIS/PACS-integrated system produces `ImagingStudy` resources, not generic findings, for modality metadata. The original justification ("ImagingStudy is heavier") does not hold up: verified against the base R4 `StructureDefinition-ImagingStudy.json`, a minimal `ImagingStudy` (`status` + `subject` + `modality`) requires no more than the Observation would have. |
| Build the full `ServiceRequest`→`ImagingStudy`→`DiagnosticReport` chain for Q6 too | Q6 never needed the order (`ServiceRequest`) or report (`DiagnosticReport`) — only the modality fact, which `ImagingStudy.modality` alone carries. Building the other two for Q6 specifically would reintroduce the over-build this ADR is correcting for Q5. |
| Downgrade Q5/Q6 to `Partial`, add nothing | Rejected — throws away the fact that both fixes (a zero-field fix for Q5, a genuinely-minimal-resource fix for Q6) are cheap and available. |
| Delete `RotatorCuffServiceRequest`/`ShoulderDiagnosticReport` from the IG entirely | Rejected — unlike the four convenience PROMs retired by ADR-0054 (which failed the 80% Delphi threshold outright), these two profiles are legitimate, standards-correct FHIR resources a real-world deployment integrating with a RIS/PACS might still want, and the hand-authored example data already uses them well. The defect was requiring them for Q5/Q6 `Full` status, not their existence. |

## Classification (Clinical Feedback Integration Workflow)

**(a) Refinement.** Hurley names the elements (Q5 "when to image," Q6 "MRI vs CT") but is silent on the FHIR mechanism — the IG has design freedom here, same bucket as ADR-0047's tear-size dual-encoding or ADR-0088's ROM redesign. Not a new clinical data-collection burden (bucket (d)): Q6's one field is a fact the clinician already knows immediately (which scan was used), not a new measurement.

## Consequences

✅ Q6 is now genuinely demonstrated by both frontends' write paths, via the FHIR-spec-correct resource — a real, queryable `ImagingStudy.modality`, not a workaround and not a claim resting on an unused profile.
✅ Q5 needs no new resource at all — its substance was already true of every registration in the system.
✅ `RotatorCuffServiceRequest`/`ShoulderDiagnosticReport` remain in the IG as legitimate optional capability, already well-demonstrated in the hand-authored example data, just decoupled from the Q5/Q6 `Full` claim.
✅ No headline coverage regression: Q5/Q6 stay `Full`, now on firmer footing than before.
✅ Interoperability: a third party integrating a real PACS/RIS with this IG will find modality metadata exactly where FHIR convention puts it.
⚠️ Q3 (radiographs) has the identical defect — realised via the same never-instantiated `ImagingStudy`+`DiagnosticReport` pattern — and was deliberately left untouched here (out of scope of the finding that prompted this ADR). Logged to `docs/limitations_items/`.
⚠️ The SDC frontend's extraction pipeline gained its first non-`{Patient,Condition,Procedure,Observation,Encounter}` resource-bucket case (`ImagingStudy`) — a small, contained addition, but worth naming since every prior ADR touching `extractor.ts` operated within that fixed set.

## Sources

- the consensus paper — verbatim Q5/A5, Q6/A6 wording quoted above.
- `seed/.fhir-r4-core-cache/extracted/package/StructureDefinition-ImagingStudy.json` — verified R4 cardinalities (`status` 1..1, `modality` 0..*, `subject` 1..1, `series` 0..* with `series.uid`/`series.modality` only required *if* `series` is populated at all).
- `ig/input/fsh/profiles/ShoulderImagingStudy.fsh` — tightened `modality` binding.
- `ig/input/fsh/valuesets/ImagingModality.fsh` — new ValueSet (MR/CT/US, DICOM CID-29), reused directly from this ADR's first draft.
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — new `item[6]` "imaging" extraction group.
- `frontend/src/components/wizard/StepImaging.tsx`, `frontend/src/types/fhir.ts` (`ImagingStudy` interface) — unified frontend.
- `sdc-frontend/src/lib/extractor.ts` (`ImagingStudy` resource-bucket case), `sdc-frontend/src/lib/bundleAssembler.ts` (subject wiring), `sdc-frontend/src/types/fhir.ts` — SDC frontend.
- `seed/bundles/{anna-mueller,kemal-demir}/*_01_registration.json` — existing hand-authored `ServiceRequest`/`ImagingStudy`/`DiagnosticReport` examples, unchanged by this ADR (already correct).
- `mapping/SECEC_FHIR_Mapping.csv` rows `Q5` (unchanged realisation), `Q6` (realisation confirmed as `ImagingStudy.modality`, now genuinely built), `L3.G.1` (fixed a leftover reference to the ADR-0129 move, unrelated oversight caught while editing this row), `L3.G.5` (ServiceRequest — decoupled from Q5/Q6 dependency).
- ADR-0008 (derived-Observation-profile pattern — considered, not used, for Q6), ADR-0027 (standard-terminology-first rule), ADR-0064 (`Condition.evidence.detail` wiring pattern reused for Q5), ADR-0054 (precedent for retiring elements that don't earn their keep, distinguished in Alternatives Considered above), ADR-0103/ADR-0122 (the generic extraction mechanism `ImagingStudy`'s new resource-bucket case extends), ADR-0129 (companion fix, same review, same session).
