// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderObservation Profile                                               │
// │  Observation profile for shoulder-related clinical findings                │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: ShoulderObservation
Parent: Observation
Id: shoulder-observation
Title: "Shoulder Observation (Base)"
Description: """
Abstract base profile for all shoulder-related clinical observations.
Shared constraints (status, category, code, subject, encounter, effective[x], value[x],
bodySite, method, interpretation) are defined here.

Observation subtypes are captured in derived child profiles under profiles/observations/,
each fixing the code and tightening value[x] to the appropriate type and ValueSet binding.
Child profiles follow the same base + derived pattern FHIR core itself uses for Vital
Signs (the Vital Signs profile as base, Body Height/Body Weight/Blood Pressure etc. as
derived children) and that HL7 US Core uses for its own Vital Signs family.
"""
// Precedent correction: an earlier version of this text also cited IPS; IPS's own
// Observation profiles derive directly from core Observation with no shared abstract
// intermediate, so it is not a precedent for this specific mechanism (see ADR-0177).
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-04-09"
* ^abstract = true

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Status                                                                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// Fixed #final on the abstract base, cascading to every derived profile: every
// Observation this registry submits documents a completed, confirmed clinical
// finding at the time of submission -- never a preliminary/amended/cancelled
// reading. Same pattern already used for Observation.category (ADR-0103) and
// Condition.category (encounter-diagnosis, this profile's own precedent).
* status 1..1 MS
* status = #final

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Category                                                                  │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* category 1..* MS
* category from http://hl7.org/fhir/ValueSet/observation-category (preferred)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Code                                                                      │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* code 1..1 MS
* code from ShoulderObservationCode (extensible)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Subject (Patient Reference)                                               │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* subject 1..1 MS
* subject only Reference(ShoulderPatient)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Encounter (Visit Anchor)                                                  │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// The three bundle profiles all state that every Observation anchors to the
// bundle's Encounter, which is what ties a measurement to the visit it was
// taken at and makes the longitudinal series reconstructable. That contract
// was previously prose in the bundle Descriptions only, so a profile-conformant
// submission could omit the link entirely and still validate; constrained here
// so the anchor is machine-checked rather than assumed.
* encounter 1..1 MS
* encounter only Reference(ShoulderEncounter)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Effective Date/Time                                                       │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* effective[x] MS
* effective[x] only dateTime or Period

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Value (constrained per subtype in child profiles)                         │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* value[x] MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Body Site                                                                 │
// ╰─────────────────────────────────────────────────────────────────────────────╯
// Extensible (not required) so that derived profiles can use more specific SNOMED
// anatomy codes (e.g. individual tendons) while still recommending laterality codes.
* bodySite MS
* bodySite from ShoulderLaterality (extensible)

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Method                                                                    │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* method MS

// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Interpretation                                                            │
// ╰─────────────────────────────────────────────────────────────────────────────╯
* interpretation MS


