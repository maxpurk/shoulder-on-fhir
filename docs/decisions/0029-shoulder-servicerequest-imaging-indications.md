# ADR-0029: ShoulderServiceRequest profile for imaging order indications

**Date:** 2026-05-11
**Status:** Superseded by ADR-0172 (2026-08-21) — the profile this ADR created (renamed `RotatorCuffServiceRequest` by ADR-0066) was retired outright; no `ServiceRequest` profile remains under `ig/input/fsh/`. The Q5/Q6 imaging-indication analysis below is retained for the audit trail.

> **Update 2026-06-07 (ADR-0066):** Profile renamed `ShoulderServiceRequest` → `RotatorCuffServiceRequest` (kebab id `shoulder-service-request` → `rotator-cuff-service-request`). The imaging-order indication design and the Hurley Q5/Q6 mapping below are unchanged; only the profile name moved.

> **Correction 2026-07-11:** §Decision's claim below that the profile is "not added to `ShoulderRegistrationBundle.entry` slicing" is stale. `RotatorCuffRegistrationBundle.fsh` defines an optional `entry[serviceRequest] 0..1` slice typed `only RotatorCuffServiceRequest`. The change from "asynchronous, bundle-external" to "optional bundle member" was made without a dedicated ADR; this note is the record of that fact. Rationale for the current behaviour: registrations that already know the imaging order at submission time can include it inline instead of round-tripping a second transaction, while the `0..1` cardinality keeps it non-blocking for registrations where imaging hasn't been ordered yet — so the original "registry submissions need not include the order" intent is preserved, just via an optional slice rather than exclusion. The ⚠️ consequence in §Consequences ("Imaging orders are submitted as separate transactions") should be read as "may optionally be submitted inline or as a separate transaction."

## Context

SECEC Q5.1 (MRI indication) and Q6.1 (CT indication) require capture of _why_ an advanced-imaging study was ordered. In FHIR, the order itself is a `ServiceRequest`; the resulting study is the existing `ShoulderImagingStudy`; the report is `ShoulderDiagnosticReport`. Pre-May-2026 the IG profiled the study and the report but not the order — so the indication for the study (e.g. "suspected rotator cuff tear") had nowhere conformant to live, and Q5.1/Q6.1 sat at 0% coverage.

The Hurley et al. consensus (Q5/Q6) explicitly recommends MRI when surgery is being planned, and CT when planning shoulder arthroplasty. The indication is part of the registry's value proposition: linking _why_ an imaging study was ordered to the diagnostic question it answered enables outcomes research on imaging utilisation.

## Decision

Add **`ShoulderServiceRequest`** profile (`profiles/ShoulderServiceRequest.fsh`) for imaging orders.

| Element | Constraint | Purpose |
|---------|------------|---------|
| `status` | 1..1 MS | Order lifecycle |
| `intent` | 1..1 MS | `order` for a clinical order |
| `category` | 1..1 MS, fixed to SNOMED `363679005` (Imaging) | Distinguishes imaging orders from other ServiceRequests |
| `code` | 1..1 MS, extensible to `ShoulderImagingProcedure` | The ordered procedure (SNOMED `783543007` Plain X-ray of shoulder / `241633004` MRI of shoulder / `303686006` CT shoulder region structure / `241497006` Ultrasound scan of shoulder joint) |
| `subject` | 1..1, only `Reference(ShoulderPatient)` | Required patient link |
| `authoredOn` | MS | When the order was authored |
| `reasonCode` | MS, extensible to `RotatorCuffDiagnosis` | The clinical indication — reuses the same VS as `RotatorCuffCondition.code` so the order's reason matches diagnosis vocabulary |
| `reasonReference` | MS, only `Reference(RotatorCuffCondition)` | Alternatively links directly to the diagnosed condition |

The new `ShoulderImagingProcedure` lists SNOMED procedure codes for the four modalities discussed in Q3/Q5/Q6/Q7.

`ShoulderServiceRequest` is **not** added to `ShoulderRegistrationBundle.entry` slicing — registry submissions need not include the order; the bundle remains diagnosis + procedure + outcomes-centred. ServiceRequests are recorded asynchronously when imaging is ordered.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Capture imaging indication on `ShoulderImagingStudy.note` | `ImagingStudy` represents the study itself, not the order; `note` would be unstructured and unsearchable |
| Capture indication on `ShoulderDiagnosticReport` only | Report comes after the study; the order's _intent_ is lost. Also the report may carry a different interpretive conclusion than the original indication. |
| Use the generic `ServiceRequest` without profiling | No machine-readable enforcement that the order targets `ShoulderPatient` or that the reason is a rotator cuff diagnosis |
| Bind `reasonCode` to a new ImagingReason | Duplicates `RotatorCuffDiagnosis`; reuse keeps the IG's diagnosis vocabulary consistent across `Condition.code`, `ServiceRequest.reasonCode`, and `Procedure.reasonReference` |
| Profile `Appointment` for ordering | `Appointment` schedules a future visit; `ServiceRequest` requests a clinical service — distinct semantics |

## Consequences

✅ SECEC Q5.1 + Q6.1 now Full — closes two more Missing elements  
✅ `RotatorCuffDiagnosis` is reused across diagnosis, imaging order indication, and procedure reason — a single source of truth for what counts as a rotator cuff problem  
✅ Standard SNOMED procedure codes cover all four imaging modalities discussed in the SECEC consensus  
✅ Registry queries can now answer "what indication drove this MRI?" using structured FHIR search (`ServiceRequest.reason-code` / `reason-reference`)  
⚠️ Imaging orders are submitted as separate transactions (not part of the index-surgery bundle); registry tooling must support this lifecycle  
⚠️ DICOM imaging procedure SNOMED codes (`241633004`, `303686006`, `241497006`) verified against SNOMED International; extensible binding accommodates local substitutes

## Sources

- `ig/input/fsh/profiles/ShoulderServiceRequest.fsh`
- `ig/input/fsh/valuesets/ShoulderImagingProcedure.fsh`
- ADR-0027 — "Complete SECEC element coverage via standard terminologies" — context for closing the remaining Q5.1/Q6.1 gaps
- Hurley et al. (2024), SECEC consensus, Q5: "Advanced imaging should be performed when planning or considering surgery"; Q6: "MRI except when planning arthroplasty, in which case CT"
