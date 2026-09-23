// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffProcedure Profile                                              │
// │  Procedure profile for rotator cuff surgical interventions                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: RotatorCuffProcedure
Parent: http://hl7.eu/fhir/base/StructureDefinition/procedure-eu-core
Id: rotator-cuff-procedure
Title: "Rotator Cuff Procedure"
Description: """
Profile for documenting rotator cuff surgical interventions (rotator cuff
repairs and concomitant procedures) as well as prior non-surgical treatments
(physical therapy, injections, distinguished by `category` binding).

Derives from HL7 Europe Core `procedure-eu-core`, which preferred-
binds `code` to IPS `procedures-uv-ips` and pins `subject` to
`Reference(patient-eu-core)`. The patient-reference chain is satisfied because
`ShoulderPatient` parents from `patient-eu-core`. Our local
extensible binding to `RotatorCuffProcedureType` (SNOMED-first surgical and
prior-treatment codes) sits on top of the inherited preferred binding.

Surgical Procedure instances additionally claim IPS `Procedure-uv-ips`
conformance via `meta.profile[]` (both frontends stamp this at bundle assembly).
The claim is scoped to surgical procedures, prior non-surgical treatments
(physical therapy, injections) do not claim IPS, avoiding an over-broad
patient-summary assertion on conservative care. The IPS profile's
`subject only Reference(Patient-uv-ips)` is satisfied because ShoulderPatient
instances claim PatientUvIps in `meta.profile[]`.

The `RotatorCuff*` prefix marks a pathology-specific profile; anatomy-region
profiles that carry no rotator-cuff-specific constraint are named `Shoulder*`.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-procedure"
* ^version = "0.5.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-09-12"

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Status                                                                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// Fixed #completed: every Procedure this registry captures -- the index
// surgery and any prior treatment (PT/injection) -- is retrospective
// documentation of something that already happened, never an in-progress
// or planned procedure.
* status 1..1 MS
* status = #completed

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Category                                                                  │
// │  Index surgery and concomitant procedures use 387713003 "Surgical          │
// │  procedure"; expert consensus Q1.f prior PT and prior injections use the    │
// │  matching SNOMED parent concepts. See ADR-0033.                            │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* category 1..1 MS
* category from RotatorCuffProcedureCategory (extensible)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Code (Procedure Type)                                                     │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* code 1..1 MS
* code from RotatorCuffProcedureType (extensible)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Subject (Patient Reference)                                               │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* subject 1..1 MS
* subject only Reference(ShoulderPatient)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Encounter (Visit Anchor)                                                  │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// Same visit-anchor contract the bundle profiles assert in prose for every
// Procedure they carry; constrained here so it is machine-checked.
* encounter 1..1 MS
* encounter only Reference(ShoulderEncounter)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Performed Date/Time                                                       │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* performed[x] 1..1 MS
* performed[x] only dateTime or Period
* performedDateTime MS
* performedPeriod MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Body Site                                                                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* bodySite 1..1 MS
* bodySite from ShoulderLaterality (required)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Reason Reference (Condition being treated)                                │
// │  Widened (ADR-0127) to also allow ShoulderDiagnosisCondition so a          │
// │  concomitant procedure (e.g. distal clavicle excision for a coexisting AC  │
// │  joint diagnosis) can cite the specific non-RC diagnosis it treats,        │
// │  instead of only the index RotatorCuffCondition or no reference at all.    │
// │  Same relaxation pattern ADR-0066 applied to ShoulderEncounter.            │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* reasonReference MS
* reasonReference only Reference(RotatorCuffCondition or ShoulderDiagnosisCondition)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Part Of (Concomitant → Index Procedure Link)                              │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// A surgical event carries the index rotator cuff repair plus zero or more
// concomitant procedures performed through the same incision. The surgery
// bundle states the ordering convention -- first procedure entry is the index
// -- but bundle entry order is an artifact of the submission document and is
// gone once the transaction is persisted and each entry has its own server
// identity. A consumer reading the registry back (Patient/$everything, or any
// Procedure search) then sees several completed shoulder procedures sharing one
// encounter, performer, and period, with nothing marking which one the visit was
// for. partOf is the base element for exactly this containment relationship, so
// a concomitant procedure points at the index procedure it accompanies and the
// distinction survives persistence. Absent on the index procedure itself, which
// is what identifies it as the index.
* partOf 0..1 MS
* partOf only Reference(RotatorCuffProcedure)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Performer                                                                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* performer MS
* performer.actor MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Outcome                                                                   │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* outcome MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Notes                                                                     │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* note MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Extensions, Procedure.recorded INHERITED from procedure-eu-core          │
// │  (ADR-0059). No longer redeclared locally. The slice + binding chain holds │
// │  as before; only the source of the declaration changed.                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯


