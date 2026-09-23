// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderImagingStudy Profile                                              │
// │  Imaging study metadata for shoulder imaging modalities                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: ShoulderImagingStudy
Parent: ImagingStudy
Id: shoulder-imaging-study
Title: "Shoulder Imaging Study"
Description: """
Records which shoulder imaging modality was obtained, radiograph, MRI, CT, or
ultrasound (expert consensus elements Q3, Q5, Q6, Q13, plus optional ultrasound).
One instance per modality obtained. The registry-capturable fact is the modality
(and when it was performed), not the DICOM pixel data, a radiology report, or an
imaging order, none of which the consensus names and none of which a data-entry
registry produces. The imaging-derived clinical findings (Goutallier, Patte, tear
size, tendons involved, tear location) are carried as separate ShoulderObservation
resources linked to the RotatorCuffCondition, not as content of this resource.

Constrains the subject to a ShoulderPatient and marks status, modality, the
performed date (`started`), and the visit anchor (`encounter`) as Must Support.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-imaging-study"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-09-12"

// ── Status ────────────────────────────────────────────────────────────────────
* status 1..1 MS

// ── Subject (Patient Reference) ───────────────────────────────────────────────
* subject 1..1 MS
* subject only Reference(ShoulderPatient)

// ── Modality ──────────────────────────────────────────────────────────────────
// Captures the imaging modality (DX = radiograph, MR = MRI, CT, US = ultrasound).
// Tightened from the base R4 extensible binding (dicom-cid29, the full DICOM
// modality catalogue) to a shoulder-registry-scoped ValueSet. 1..1 states the
// one-study-per-modality rule as a constraint: base R4 leaves modality 0..*,
// which would let a conformant instance carry none of the single fact this
// profile exists to record. See ADR-0185.
* modality 1..1 MS
* modality from ImagingModality (extensible)

// ── Started date/time ─────────────────────────────────────────────────────────
// When the imaging was performed. No DICOM series / instance / procedure
// metadata is constrained: this profile deliberately carries only the
// modality-was-obtained fact a data-entry registry can produce, not a
// PACS/DICOM record.
* started MS

// ── Encounter (Visit Anchor) ──────────────────────────────────────────────────
// Which visit the study belongs to. Every other resource this registry captures
// carries a visit anchor, and imaging is the one place the link was left to be
// inferred from `started` matching a visit date -- an inference that fails as
// soon as two visits share a date, and that has no answer at all for a patient
// whose pre-operative and follow-up imaging are both present. Optional rather
// than 1..1 because a study may legitimately predate registration (an outside
// radiograph carried into the record), which has no encounter in this registry.
* encounter 0..1 MS
* encounter only Reference(ShoulderEncounter)
