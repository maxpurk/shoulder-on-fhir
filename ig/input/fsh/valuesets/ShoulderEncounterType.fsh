// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderEncounterType                                                   │
// │  SNOMED CT codes for shoulder encounter types across all three bundles    │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: ShoulderEncounterType
Id: shoulder-encounter-type
Title: "Shoulder Encounter Type ValueSet"
Description: """
ValueSet of SNOMED CT codes for ShoulderEncounter.type, covering all three
bundle contexts of the three-bundle architecture:

* **Pre-operative registration (T0):** 185349003 "Encounter for check up"
* **Surgical admission (T1):** 308335008 "Patient encounter procedure" —
  semantically accurate because the encounter frames a surgical procedure.
  No dedicated surgical-admission code is included: the enclosing
  RotatorCuffSurgeryBundle profile and its RotatorCuffProcedure entries
  (category=Surgical) already identify the surgical context unambiguously;
  Encounter.type is a secondary queryability label, not the primary
  discriminator. SNOMED 305408004 "Admission to surgical ward" was
  considered and rejected, it incorrectly implies inpatient admission
  for procedures commonly performed as day surgery.
* **Routine post-operative follow-up (Tn):** 390906007 "Follow-up encounter"
  (expert consensus Q10).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-encounter-type"
* ^version = "0.2.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-05-18"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#185349003 "Encounter for check up"
* http://snomed.info/sct#390906007 "Follow-up encounter"
* http://snomed.info/sct#308335008 "Patient encounter procedure"
