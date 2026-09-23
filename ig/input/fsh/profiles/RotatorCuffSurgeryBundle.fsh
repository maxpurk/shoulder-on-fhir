// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  RotatorCuffSurgeryBundle Profile                                          │
// │  Transaction bundle wrapping the surgical event (T1) for an already-       │
// │  registered patient. Sibling to RotatorCuffRegistrationBundle (pre-op, T0) │
// │  and RotatorCuffFollowUpBundle (post-op, Q11 timepoints). See ADR-0034.    │
// ╰─────────────────────────────────────────────────────────────────────────────╯

Profile: RotatorCuffSurgeryBundle
Parent: Bundle
Id: rotator-cuff-surgery-bundle
Title: "Rotator Cuff Surgery Bundle"
Description: """
Transaction bundle wrapping the surgical event for an already-registered
rotator-cuff-surgery patient. This is the second of three named submissions
per patient (Registration → Surgery → Follow-Up×N) and corresponds to the
implicit surgical phase in Hurley et al. (2024).

Per submission the bundle contains:
- exactly one ShoulderEncounter, the surgical admission/encounter
- one or more RotatorCuffProcedure entries (category = surgical), the index
  procedure and any concomitant surgical procedures (biceps tenodesis, distal
  clavicle resection, etc.). A concomitant procedure carries `partOf` pointing
  at the index procedure it accompanies; the index procedure is the one with no
  `partOf`. The link is carried on the resources themselves rather than implied
  by entry order, so it still holds once the bundle is persisted and each entry
  has its own identity.
- zero or more ShoulderObservation entries, intra-operative findings
  (confirmed tear size, intra-articular findings, etc.)
- an optional RotatorCuffResearchCarePlan, the Q11 research follow-up
  schedule (6 weeks / 3 months / 6 months / 1 year / 2 years), anchored to
  this submission's index procedure date. Carried here, not on
  RotatorCuffRegistrationBundle, because the schedule cannot be computed
  before the surgery date is known.

The bundle does NOT contain Patient, Condition, or prior non-surgical
treatments: these were established by the prior RotatorCuffRegistrationBundle
and are referenced via their already-persisted IDs
(Encounter.subject → Patient/{id}; Encounter.reasonReference → Condition/{id};
Procedure.subject → Patient/{id}; Procedure.encounter →
urn-uuid-of-this-bundle-entry).

Slicing follows the IPS two-discriminator pattern (resource type + profile).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/rotator-cuff-surgery-bundle"
* ^version = "0.4.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-09-12"

// ── Bundle type ───────────────────────────────────────────────────────────────
* type = #transaction (exactly)

// ── Entry fullUrl required (urn:uuid cross-refs between Encounter and the
//     intra-op Observations / Procedures)
* entry.fullUrl 1..

// ── Entry slicing ─────────────────────────────────────────────────────────────
// Same IPS pattern as the other two bundle profiles: discriminate by resource
// type and by profile so the validator can route each entry to the right slice
// when multiple entries share the same resource type (e.g. index + concomitant
// procedures, both RotatorCuffProcedure).
* entry ^slicing.discriminator[0].type = #type
* entry ^slicing.discriminator[=].path = "resource"
* entry ^slicing.discriminator[+].type = #profile
* entry ^slicing.discriminator[=].path = "resource"
* entry ^slicing.rules = #open
* entry ^short = "Entry resources in a single rotator cuff surgery submission"
* entry contains
    encounter   1..1 and
    procedure   1..* and
    observation 0..* and
    carePlan    0..1

// ── Slice constraints ─────────────────────────────────────────────────────────
* entry[encounter].resource 1..
* entry[encounter].resource only ShoulderEncounter

* entry[procedure].resource 1..
* entry[procedure].resource only RotatorCuffProcedure
// Note: per ADR-0034 we do not slice index vs. concomitant. The distinction is
// carried by Procedure.partOf instead (0..1 MS on RotatorCuffProcedure,
// ADR-0186): a concomitant procedure references the index procedure, the index
// procedure carries none. Entry order is an assembly-time convenience only --
// it does not survive the transaction POST, so a consumer reading the registry
// back cannot recover it, which is why the relationship is stated on the
// resources. The RotatorCuffProcedure profile's category binding (extensible to
// RotatorCuffProcedureCategory, ADR-0033) is what keeps non-surgical procedures
// out of this slice in practice.

* entry[observation].resource 1..
* entry[observation].resource only ShoulderObservation

// The research follow-up schedule is created with the surgery, because the five
// expert consensus Q11 timepoints are counted from the index procedure date.
* entry[carePlan].resource 1..
* entry[carePlan].resource only RotatorCuffResearchCarePlan
