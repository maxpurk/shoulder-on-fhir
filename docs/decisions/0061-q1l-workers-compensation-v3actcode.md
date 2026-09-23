# ADR-0061: Q1.l "workmen's compensation" via FHIR core v3-ActCode `WCBPOL` (no local payer VS, no HL7 DE Basisprofil parenting)

**Date:** 2026-05-22
**Status:** Accepted (amended 2026-05-23 twice)

## 2026-05-23 amendment (b) — scope narrowed to the WC flag

After the PRIVA correction (amendment (a) below) we re-read Hurley's verbatim text. Q1.l is one of 13 patient-history factors in the Q1 unanimous-consensus list; Hurley names it as a single phrase ("Workmen's compensation") with **no further decomposition** into payer categories. There is no Hurley basis for offering GKV/PKV/Selbstzahler in the form — those were over-engineered scope creep dressed up as "German payer mapping". The honest reading of Q1.l is the binary/categorical clinical flag *"is this patient's care being delivered under a workers'-compensation regime?"* — captured because WC status is a well-known outcome confounder.

**Scope change:**
- `StepPatient.tsx`: the dropdown collapses from 4 payer-type options to a Yes/No/Unknown WC question. The form field renames `payerType` → `workersCompensation`. A ShoulderCoverage with `Coverage.type = v3-ActCode#WCBPOL` is emitted **only** when the answer is "yes"; "no" and "unknown" emit nothing.
- `ShoulderCoverage.fsh`: Description rewritten to scope the profile to the WC flag (the only Hurley-named element); `Coverage.type` tightened to `1..1` and the `^short` text repurposed. Binding remains extensible — a deploying registry may still encode other coverage types if it wants to, but that is out of scope for this IG.
- The PKV gap dissolves: there is nothing to encode at the v3-ActCode layer for non-WC payers in this IG.

**Unchanged:**
- The mapping CSV status (Q1.l = `Full`) — WCBPOL is verified and is the only code Hurley actually asks for.
- The seed Patient-1 (Schmidt, carpenter, BG BAU) — still the canonical WC example and exercises the narrowed profile cleanly.
- The deferral of HL7 DE Basisprofil — sites needing GKV/PKV/Selbstzahler structure should pull DE Basisprofil at deployment time.

This amendment supersedes the §"Why `Coverage.type` and not `Coverage.class`" framing in places where it spoke of "the high-level category (workers' comp vs statutory vs private vs self-pay)" — only the workers'-comp half of that distinction is in scope now.

## 2026-05-23 amendment (a) — PRIVA removed

The original draft of this ADR claimed `PRIVA` ("private") existed in `http://terminology.hl7.org/CodeSystem/v3-ActCode`. **It does not.** A `tx.fhir.org` lookup against v3-ActCode v2018-08-12 returns `not-found` for `PRIVA`. The mistaken claim was carried into `ShoulderCoverage.fsh`, `StepPatient.tsx`, `stepFormData.ts`, and `types/fhir.ts`; the validator surfaced the error the first time a user selected "Privat (PKV)" in the registration form.

**Fix:** PKV is removed from the form, the FSH profile, the type comments, and the mapping table below. The Q1.l mapping is reduced to the three codes that demonstrably exist in v3-ActCode / coverage-selfpay: `PUBLICPOL` (GKV), `WCBPOL` (BG — the actual Hurley element), `pay` (Selbstzahler). Sites needing PKV encoding must pull in HL7 DE Basisprofil (`http://fhir.de/CodeSystem/versicherungsart-de-basis#PKV`), which this IG defers per §"Why not parent from HL7 DE Basisprofil" below. The decision's substance — close Q1.l with v3-ActCode WCBPOL, no local VS, no DE Basisprofil parenting — stands; only the PKV row was wrong.

Subsequent inline mentions of `PRIVA` in this document have been corrected; the amendment note is preserved here so the correction history stays visible. Q1.l status in the mapping CSV remains `Full` — the workmen's-compensation element (the only Hurley-named one in this row) is still fully closed by `WCBPOL`.

## Context

The SECEC mapping CSV walkthrough resumed after the 2026-05-22 cross-cutting realm-alignment work (ADRs 0057–0060). Q1.l "Workmen's compensation" was marked `Partial` in the CSV with a To Do entry "Add German payer-type ValueSet" — but on closer inspection the gap turned out to be smaller than the To Do implied.

**What Hurley actually asks.** Q1.l is one of the unanimous-consensus items in the patient-history list; Hurley names it as a single line ("workmen's compensation") with no sub-decomposition. The semantic intent is the insurance / payer question: "is this patient's care covered under workers' compensation?" — which both implies the injury is work-related and triggers a different care pathway in most jurisdictions. In the German healthcare system, the equivalent is **Berufsgenossenschaft (BG)**: a statutory workers'-comp insurance carrier that triggers a different documentation regime (Durchgangsarzt-Verfahren, BG-specific reports) and reliably shows different outcome trajectories vs GKV/PKV in shoulder literature.

**What the IG had before this ADR.**
- `ShoulderCoverage` profile (Parent: `Coverage`, `type` extensible-bound to FHIR core `http://hl7.org/fhir/ValueSet/coverage-type`, `subscriber → ShoulderPatient`, `payor 1..*`).
- Anna's example bundle had a Coverage with `type.coding = v3-ActCode#PUBLICPOL` (GKV).
- Seed bundle had **no** Coverage instances at all.
- Frontend had **no** payer-type collection — Coverage was structurally declared in the bundle profile but the wizard never produced one. The "Partial" status was honest about the terminology gap but understated the more serious end-to-end gap (no UI → no data flow → fictional profile).
- Hurley's "Workmen's compensation" was not represented in any example.

**What the audit found (2026-05-22).**
- The FHIR core `coverage-type` ValueSet already includes `v3-ActCode#WCBPOL` (Worker's compensation policy) — alongside `PUBLICPOL` (public statutory) and others. **No new ValueSet is needed.** (Original draft also listed `PRIVA` here; that code does not exist in v3-ActCode — see the 2026-05-23 amendment at the top.)
- HL7 v3-ActCode is the universal payer-classification code system across HL7 IGs; it is the natural choice for the German GKV/PKV/BG categories.
- HL7 DE Basisprofil (`de.basisprofil.r4`) **does** ship a Coverage profile (`KrankenversicherungsverhältnisCoverage`) with German-specific identifier slicing (Versicherungsnummer, KVNR). Pulling it in would add a separate seed loader, a sushi-config dependency bump, and a parent-chain change — substantial scope for one element.
- EU Core 2.0.0 ships no Coverage profile; no realm-alignment is available at the EU layer.
- IPS 1.1.0 ships no Coverage profile either.

The thesis-defense sentence after this ADR: *"`ShoulderCoverage` extensible-binds to the FHIR core `coverage-type` ValueSet (which already enumerates German payer categories via HL7 v3-ActCode: GKV → `PUBLICPOL`, BG → `WCBPOL`, Selbstzahler → `coverage-selfpay#pay`). Hurley's single-item Q1.l 'workmen's compensation' is captured by `Coverage.type.coding = v3-ActCode#WCBPOL`, with one example (Patient-1, carpenter) in the seed bundle demonstrating Berufsgenossenschaft coverage. PKV is intentionally not represented at the v3-ActCode layer — v3-ActCode has no exact code for German substitutive private health insurance, and HL7 DE Basisprofil is deferred."*

## Decision

1. **Update `ShoulderCoverage.fsh`** at `ig/input/fsh/profiles/ShoulderCoverage.fsh`:
   - Rewrite `Description` to enumerate the v3-ActCode payer-type mapping table (GKV → `PUBLICPOL`, BG → `WCBPOL`, Selbstzahler → `coverage-selfpay#pay`; PKV not represented — see the 2026-05-23 amendment at the top) and document the explicit deferral of HL7 DE Basisprofil parenting.
   - Add `^short` text to `Coverage.type` reinforcing the workers'-comp encoding so the IG Publisher's structure-definition rendering surfaces the mapping prominently.
   - No structural changes: parent stays `Coverage` (base FHIR R4), binding stays extensible, no new extensions, no class slicing, no new ValueSet.
   - Bump `^date` to 2026-05-22.

2. **Add a Coverage entry to the seed bundle** at `seed/bundles/example-patients.json`:
   - Patient-1 (Schmidt, carpenter) is the natural fit for a Berufsgenossenschaft case (rotator-cuff injury sustained during overhead work).
   - New `urn:uuid:11111111-0000-0000-0001-000000000040` Coverage entry with `Coverage.type.coding = v3-ActCode#WCBPOL`, `payor[].display = "Berufsgenossenschaft der Bauwirtschaft (BG BAU)"`, narrative text describing the work-related context.
   - Patient-2 and Patient-3 continue with no Coverage (representative of a sparser real-registry mix).

3. **Frontend integration** in `frontend/src/components/wizard/StepPatient.tsx`:
   - Add a new "Payer Type / Versicherung" select field to the Patient History section. German-labelled options: Gesetzlich (GKV), Berufsgenossenschaft (BG, Hurley Q1.l), Selbstzahler, Unbekannt. (Privat (PKV) was offered in the original draft but removed per the 2026-05-23 amendment — no v3-ActCode match.)
   - Add `payerType: string` to `PatientFormData` (empty default per the user-memory "no fallback defaults" rule).
   - In `handleSubmit`, push a `Coverage` resource into the entries array when `payerType` is set and not `unknown`. The Coverage carries the v3-ActCode mapping and a German `Coverage.type.text` label.
   - Add a minimal `Coverage` interface to `frontend/src/types/fhir.ts` (status, type, subscriber, beneficiary, payor — enough for the IG's Coverage shape). Extend `AnyFhirResource` to include `Coverage`.
   - Reuse the existing `PROFILE_URLS.COVERAGE` canonical and the existing `ShoulderRegistrationBundle.entry[coverage] 0..1` slice — no bundle-builder changes needed beyond `entries.push`.
   - SDC frontend deferred (the IG pattern for newly-added clinical fields per ADR-0055 §5).

4. **CSV row Q1.l update** at `mapping/SECEC_FHIR_Mapping.csv`:
   - Coverage status `Partial` → `Full`.
   - Notes rewritten to enumerate the v3-ActCode mapping and document the deferred DE Basisprofil dependency.
   - IG Implementation rewritten with the StepPatient field + ShoulderCoverage profile + seed example references.
   - To Do: `Add German payer-type ValueSet` cleared (no new VS needed); replaced with the two remaining deferrals (SDC Questionnaire Coverage item, HL7 DE Basisprofil).

## Why not introduce a local `GermanPayerType`

Initial instinct in the CSV's original To Do entry. Rejected on four grounds:

| Concern | Detail |
|---|---|
| **No terminology gap to close** | The FHIR core `coverage-type` ValueSet already enumerates `PUBLICPOL`, `WCBPOL`, and others via `compose.include` from v3-ActCode. A local German-specific VS would be a strict subset of an existing standard VS — pure documentation, no terminology contribution. (For PKV the situation differs — v3-ActCode has no exact code; that gap is closed by deferring to HL7 DE Basisprofil, not by adding a local VS. See the 2026-05-23 amendment.) |
| **Worse interoperability** | A local `GermanPayerType` canonical would force every downstream consumer of an IG-produced Coverage to know about an IG-specific VS for a code lookup they could equally do against the universal HL7 v3-ActCode. Local VSs add maintenance burden; universal ones don't. |
| **Documentation belongs in the profile description, not in a new VS** | The mapping table (GKV/BG → PUBLICPOL/WCBPOL, plus Selbstzahler → coverage-selfpay#pay) is small enough to live in the profile Description and the `Coverage.type ^short` text. The IG Publisher renders both prominently in the structure-definition HTML. |
| **Precedent from ADR-0027** | ADR-0027 closed the SECEC Missing column primarily by using standard terminologies (LOINC + SNOMED + universal HL7 CSs) without introducing IG-specific VSs. Adding a local VS for Q1.l would contradict that precedent. |

## Why not parent ShoulderCoverage from HL7 DE Basisprofil

Briefly considered after the realm-alignment work in ADRs 0057–0060 — if we re-parent from EU Core where available, why not also re-parent from HL7 DE Basisprofil where it offers a German Coverage profile?

| Concern | Detail |
|---|---|
| **Scope cost-benefit** | Pulling `de.basisprofil.r4` in for one element would add: (1) a new seed loader (mirroring `load-ips-package.sh`); (2) a sushi-config dependency entry; (3) a parent-chain change on `ShoulderCoverage`; (4) Versicherungsnummer/KVNR identifier slicing that the IG doesn't currently use; (5) potential constraint conflicts to audit. The realm-alignment ADRs (0057–0059) each parent-rebased a profile that touches **most resources in the bundle** (Patient referenced by everything; Condition + Procedure are core clinical resources). Coverage is a single optional resource in the registration bundle. The blast radius is much smaller. |
| **Versicherungsnummer identifier is not in scope** | HL7 DE Basisprofil's main contribution beyond v3-ActCode is the `Identifier` slicing for German insurance numbers (eGK Versicherungsnummer). The IG's current registry use case does NOT capture insurance numbers (privacy + scope decision). Adopting the parent without using the slices would be cargo-culting. |
| **EU Core direction takes priority** | The realm narrative committed to in ADRs 0038/0057/0058/0059 is EU Core (cross-border EHDS scope), not national-realm German profiles. Adding DE Basisprofil for one element would muddy that narrative — "we align with EU Core where possible, but DROP to national-realm for Coverage" needs a stronger justification than this element provides. |
| **Revisit trigger documented** | If multiple German-realm encodings start accumulating (e.g., Q1.l + future Versicherungsnummer capture + payer-organization references), the cost-benefit shifts. This ADR documents the deferral with an explicit revisit trigger; future ADRs can adopt DE Basisprofil at that point. |

## Why `Coverage.type` and not `Coverage.class`

Both `Coverage.type` and `Coverage.class` can carry payer categorization. The FHIR R4 specification distinguishes them: `type` is "the type of coverage (medical, dental, social) and contractual relationship", while `class` is "more specific organizational sub-divisions (plan, subplan, group, sub-group, etc.)".

The Hurley Q1.l question is the high-level category (workers' comp vs statutory vs private vs self-pay) — that's `Coverage.type`, not `Coverage.class`. The class-level distinction would matter for capturing the specific BG sub-organisation (BG BAU vs BG Verkehr vs BGW etc.), or the specific GKV insurer (AOK vs TK vs Barmer). The IG defers that level of detail to deployment-time customization; out of scope for v1.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep Q1.l as `Partial` and add a local `GermanPayerType` | See §"Why not introduce a local GermanPayerType" above. The work is documentation, not terminology — local VS adds an artifact for no contribution. |
| Parent `ShoulderCoverage` from HL7 DE Basisprofil's KrankenversicherungsverhältnisCoverage | See §"Why not parent from HL7 DE Basisprofil" above. Scope mismatch for one element + Versicherungsnummer slicing is not in scope. |
| Use `Coverage.class` with sliced payer categories | The semantic level mismatches Hurley's question (which is the type level, not the sub-organisation level). Defer to deployment customization. |
| Capture workers'-comp as a separate Observation (not Coverage) | Considered in the AskUserQuestion clarification before this ADR. Rejected — fundamentally an insurance question, and the German conflation of "BG-insured" and "work-related-injury" exactly matches v3-ActCode `WCBPOL` semantics. Adding a separate Condition extension would duplicate the same information across two resources with risk of inconsistency. |
| Defer Q1.l entirely (leave as Partial) | After ADR-0057's PatientUvIps multi-profile work and ADRs 0058–0060's IPS conformance pattern, the IG's interop credibility now warrants closing the "Partial" rows that don't actually have terminology gaps. Q1.l's terminology gap was illusory; the close-out is mostly documentation + one example + frontend wiring. |

## Consequences

✅ **Q1.l moves from `Partial` to `Full`** with end-to-end data flow: profile documentation → frontend collection → bundle assembly → seed example → validator-confirmed conformance.

✅ **Standard FHIR terminology (HL7 v3-ActCode)** carries the German payer mapping with zero IG-specific terminology. Maximally interoperable; matches universal HL7 patterns; no maintenance burden for a local VS.

✅ **Seed bundle demonstrates Berufsgenossenschaft** for the first time — Patient-1 (Schmidt, carpenter) is a clinically credible BG case (work-related rotator-cuff injury). Helpful for examiners and IG consumers who want to see the WCBPOL pattern in practice.

✅ **Frontend now collects Coverage** — closes the gap where the bundle profile declared a `coverage 0..1` slice but the wizard never produced one. End-to-end testability for Q1.l.

✅ **No new dependencies, no new ValueSet, no new ADR-required loader.** The IG's seed pipeline, sushi-config, and validator-script all unchanged.

⚠️ **SDC frontend deferred** for the Coverage Questionnaire item — same pattern as ADR-0055 §5 (deferred SDC for comorbidity typeahead). A future SDC ADR may extend the registration Questionnaire with a Coverage item.

⚠️ **HL7 DE Basisprofil deferred** — documented in §"Why not parent from HL7 DE Basisprofil". Revisit trigger: when multiple German-realm encodings (Versicherungsnummer, payer-organization references, etc.) accumulate.

⚠️ **`Coverage.class` not exercised** — the IG captures the type-level payer category but not the sub-organisation. Deployment-time registries that need finer-grained insurer identification (specific BG or GKV insurer) can extend at the class layer without re-authoring the profile.

⚠️ **Anna stays on PUBLICPOL** (GKV) — clinically consistent (graphic designer, no occupational injury) but means the Anna longitudinal example doesn't demonstrate WCBPOL. The seed bundle (Patient-1) does.

## Sources

- HL7 v3-ActCode CodeSystem at `http://terminology.hl7.org/CodeSystem/v3-ActCode` — `WCBPOL` and `PUBLICPOL` definitions verified against `tx.fhir.org` v2018-08-12 (universal HL7 codes; no local CodeSystem needed). `PRIVA` was claimed in the original draft but is not in v3-ActCode — see the 2026-05-23 amendment at the top.
- FHIR R4 `coverage-type` ValueSet at `http://hl7.org/fhir/ValueSet/coverage-type` (composes v3-ActCode and coverage-selfpay) — extensible binding already in place on `ShoulderCoverage.type` before this ADR
- ADR-0027 (precedent for standard-terminology-first), ADR-0055 (precedent for SDC deferral), ADRs 0057–0060 (realm-alignment narrative this ADR continues by way of an explicit national-realm deferral)
- Hurley et al. (2024) SECEC consensus paper, Q1 patient-history unanimous-consensus list — "workmen's compensation" as a single-item element
