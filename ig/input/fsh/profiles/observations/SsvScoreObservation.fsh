Profile: SsvScoreObservation
Parent: ShoulderObservation
Id: ssv-score-observation
Title: "Subjective Shoulder Value (SSV) Observation"
Description: "Observation documenting the Subjective Shoulder Value (SSV): the patient's self-rated overall shoulder function expressed as a percentage of a normal, uninjured shoulder (0–100%). Covers the expert consensus Q12 preferred score, element `Q12-SSV-SANE` in the mapping, which the consensus names together with the Single Assessment Numeric Evaluation and counts once. The two are separately published instruments, each carried by its own profile here. No equivalent code exists in SNOMED CT International Edition or LOINC at time of authoring; local code used."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/ssv-score-observation"
* ^version = "0.3.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-12"
* code = ShoulderObservationCodes#ssv-score
* category = http://terminology.hl7.org/CodeSystem/observation-category#survey "Survey"
// ADR-0156: disambiguates which of a patient's (possibly multiple, in a
// bilateral case) RotatorCuffCondition instances this composite score is
// about, ADR-0074 deliberately excludes bodySite from aggregate/survey
// PROMs (no physical measurement site), leaving nothing to disambiguate a
// bilateral case; focus (distinct from subject) is FHIR's own element for
// exactly this, precedented by mCODE's identical use for its own composite
// scores against a patient's possibly-multiple cancer conditions.
* focus 0..1 MS
* focus only Reference(RotatorCuffCondition)
// SSV is by definition a percentage of a normal shoulder, so the value carries
// UCUM % rather than the arbitrary-unit annotation {score}; bounds added so an
// out-of-range entry is a hard validator error like every sibling PROM profile.
* insert BoundedQuantity(#%, 0, 100)
