// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffFollowUpBundle Profile                                         │
// │  Transaction bundle wrapping ONE follow-up visit submission                │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Alias: $V3_ACT_CODE = http://terminology.hl7.org/CodeSystem/v3-ActCode

Profile: RotatorCuffFollowUpBundle
Parent: Bundle
Id: rotator-cuff-follow-up-bundle
Title: "Rotator Cuff Follow-Up Bundle"
Description: """
Transaction bundle defining a single post-operative follow-up visit submission
for an already-registered patient in a rotator cuff surgery registry. Third of
three named submission profiles in the registry workflow:
RotatorCuffRegistrationBundle (pre-op, T0) → RotatorCuffSurgeryBundle
(surgical event, T1) → RotatorCuffFollowUpBundle (per-visit increment, Q11
timepoints).

Per visit the bundle contains:
- exactly one ShoulderEncounter (expert consensus Q10), the realised follow-up visit
- one or more ShoulderObservation entries, Q9 post-op exam (ROM, MMT,
  provocation tests) and Q12 PROMs (Constant, SSV/SANE, VAS pain, satisfaction,
  return-to-activity)
- optionally one RotatorCuffQuestionnaireResponse, the answered PROM form
- optionally one ShoulderImagingStudy, only at the research re-imaging
  timepoint (Q13 exception)

The bundle does NOT contain Patient, Condition, or Procedure: Patient and
Condition were established by the prior RotatorCuffRegistrationBundle (T0),
the surgical Procedure(s) by the prior RotatorCuffSurgeryBundle (T1). All are
referenced via their already-persisted IDs (Encounter.subject -> Patient/{id};
Encounter.reasonReference -> Condition/{id}; Observation.subject -> Patient/{id};
Observation.encounter -> Encounter/{urn-uuid-of-this-bundle-entry}).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-follow-up-bundle"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-06-07"

// ── Bundle type ───────────────────────────────────────────────────────────────
* type = #transaction (exactly)

// ── Entry fullUrl required (urn:uuid cross-refs between Encounter and Obs) ────
* entry.fullUrl 1..

// ── Entry slicing ─────────────────────────────────────────────────────────────
// Same IPS pattern as RotatorCuffRegistrationBundle: discriminate by resource type
// and by profile so the validator can route each entry to the right slice when
// multiple Observation entries share the same resource type.
* entry ^slicing.discriminator[0].type = #type
* entry ^slicing.discriminator[=].path = "resource"
* entry ^slicing.discriminator[+].type = #profile
* entry ^slicing.discriminator[=].path = "resource"
* entry ^slicing.rules = #open
* entry ^short = "Entry resources in a single follow-up visit submission"
* entry contains
    encounter             1..1 and
    observation           1..* and
    questionnaireResponse 0..1 and
    imagingStudy          0..*

// ── Slice constraints ─────────────────────────────────────────────────────────
* entry[encounter].resource 1..
* entry[encounter].resource only ShoulderEncounter
// ShoulderEncounter.class is deliberately left open at the profile level
// (Surgery genuinely varies by case, ADR-0124) -- but a follow-up visit is
// always ambulatory, so it's fixed here, at the bundle level, instead.
// See ADR-0126.
* entry[encounter].resource.class = $V3_ACT_CODE#AMB "ambulatory"

* entry[observation].resource 1..
* entry[observation].resource only ShoulderObservation

* entry[questionnaireResponse].resource 1..
* entry[questionnaireResponse].resource only RotatorCuffQuestionnaireResponse

* entry[imagingStudy].resource 1..
* entry[imagingStudy].resource only ShoulderImagingStudy
