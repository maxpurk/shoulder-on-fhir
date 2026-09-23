Profile: SaneScoreObservation
Parent: ShoulderObservation
Id: sane-score-observation
Title: "SANE Score Observation"
Description: "Observation documenting the Single Assessment Numeric Evaluation (SANE): a single-item patient self-rating of current shoulder function as a percentage of a normal shoulder (0 = worst, 100 = normal). Covers the expert consensus Q12 preferred score, element `Q12-SSV-SANE` in the mapping, which the consensus names together with the Subjective Shoulder Value and counts once. The two are separately published instruments, each carried by its own profile here. No equivalent code exists in SNOMED CT International Edition or LOINC at time of authoring; local code used."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/sane-score-observation"
* ^version = "0.3.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-05-12"
* code = ShoulderObservationCodes#sane-score
* category = http://terminology.hl7.org/CodeSystem/observation-category#survey "Survey"
// ADR-0156: disambiguates which RotatorCuffCondition (bilateral case) this
// composite score is about, see SsvScoreObservation.fsh's fuller comment.
* focus 0..1 MS
* focus only Reference(RotatorCuffCondition)
// SANE is a single-item percentage-of-normal rating, not a drawn visual
// analogue scale, so it carries UCUM % on the same basis as the SSV; bounds
// added so an out-of-range entry is a hard validator error.
* insert BoundedQuantity(#%, 0, 100)
