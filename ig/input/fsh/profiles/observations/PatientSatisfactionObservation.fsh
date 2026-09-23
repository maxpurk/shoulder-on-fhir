Profile: PatientSatisfactionObservation
Parent: ShoulderObservation
Id: patient-satisfaction-observation
Title: "Patient Satisfaction Observation"
Description: "Observation documenting overall patient satisfaction with treatment outcome using the 5-point LOINC satisfaction scale (LL4543-6). Covers expert consensus Q8.e (patient satisfaction with treatment) and Q12.g (PROM, patient satisfaction). Observation code: LOINC 77218-6."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/patient-satisfaction-observation"
* ^version = "0.2.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-12"
* code = http://loinc.org#77218-6 "Patient satisfaction with healthcare delivery"
* category = http://terminology.hl7.org/CodeSystem/observation-category#survey "Survey"
// ADR-0156: disambiguates which RotatorCuffCondition (bilateral case) this
// Observation is about, see SsvScoreObservation.fsh's fuller comment.
* focus 0..1 MS
* focus only Reference(RotatorCuffCondition)
* value[x] only CodeableConcept
* valueCodeableConcept from SatisfactionScale (required)
