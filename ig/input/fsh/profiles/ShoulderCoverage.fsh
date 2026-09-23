// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderCoverage Profile                                                  │
// │  Workers'-compensation flag (expert consensus Q1.l)                        │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: ShoulderCoverage
Parent: Coverage
Id: shoulder-coverage
Title: "Shoulder Coverage"
Description: """
Profile for documenting the expert consensus Q1.l "workmen's compensation" flag, one of 13 patient-history factors in the unanimous-consensus list (Q1).
The expert consensus names this as a single yes/no element with no further decomposition;
this IG realises a "yes" answer as a Coverage resource with `Coverage.type =
v3-ActCode#WCBPOL`. When the patient is not under a workers'-compensation
regime (or the status is unknown), no ShoulderCoverage instance is emitted.

The clinical/medicolegal rationale for capturing this flag is well-established:
workers'-compensation status (German Berufsgenossenschaft) both implies a
work-related injury (Arbeitsunfall) and triggers a different documentation
pathway (Durchgangsarzt-Verfahren), with consistently different recovery
trajectories in shoulder outcomes literature.

`Coverage.type` is extensible-bound to the FHIR core
`http://hl7.org/fhir/ValueSet/coverage-type` ValueSet. The expert consensus Q1.l element
is realised by `v3-ActCode#WCBPOL` (worker's compensation):

| Coding | v3-ActCode | Display | Notes |
|---|---|---|---|
| Berufsgenossenschaft (BG) | `WCBPOL` | worker's compensation | **Expert consensus Q1.l, the only code this profile exercises** |

Broader payer categorisation (GKV, PKV, Selbstzahler, etc.) is intentionally
out of scope. The expert consensus does not name these categories; the v3-ActCode coverage
of German payer types is partial (no exact code for PKV); and a registry that
wants to capture them belongs in deployment-time extension or HL7 DE
Basisprofil parenting. The narrower scope keeps this profile honest to
the actual consensus element.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-coverage"
* ^version = "0.1.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-23"

// ── Status ────────────────────────────────────────────────────────────────────
* status 1..1 MS

// ── Coverage type ─────────────────────────────────────────────────────────────
// Extensible binding to FHIR core coverage-type. The expert consensus Q1.l element is
// realised by v3-ActCode#WCBPOL (worker's compensation, German
// Berufsgenossenschaft). Broader payer categorisation is out of scope, see
// ADR-0061 for the rationale (narrowed scope per the 2026-05-23 amendment).
* type 1..1 MS
* type ^short = "Workers'-compensation flag (expert consensus Q1.l): v3-ActCode#WCBPOL = Berufsgenossenschaft"
* type from http://hl7.org/fhir/ValueSet/coverage-type (extensible)

// ── Subscriber (Patient Reference) ───────────────────────────────────────────
* subscriber 1..1 MS
* subscriber only Reference(ShoulderPatient)

// ── Payor ─────────────────────────────────────────────────────────────────────
* payor 1..* MS
