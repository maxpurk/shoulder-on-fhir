Profile: ConstantScoreObservation
Parent: ShoulderObservation
Id: constant-score-observation
Title: "Constant-Murley Score Observation"
Description: """
Observation documenting the Constant-Murley composite shoulder outcome
score (0–100). Covers expert consensus Q12 preferred instrument (Constant, element `Q12-Constant` in the mapping). Bound to SNOMED CT 273383002
"Constant and Murley shoulder assessment score (assessment scale)".

Two entry modes, distinguished by whether `component[]` is populated:

1. **Direct total entry**, `valueQuantity` only, no `component[]`. Used
   when a site has only a previously published total on hand and did not
   re-collect the four sub-scores; a common, legitimate registry pattern.
2. **Component-derived entry**, all four `component[]` slices populated
   (Pain / ADL / ROM / Strength, matching the original Constant & Murley
   1987 15/20/40/25-point breakdown), with `valueQuantity` set to their
   sum. All four are required together when this mode is used, to avoid
   a partial sum silently masquerading as a real total.

The four component sub-scores are **directly captured clinical/patient
input, not derived from this IG's other clinical Observations**
(`Shoulder*RotationObservation`, strength MMT profiles, etc.). Such a
derivation would be clinically illegitimate: the Constant ROM sub-score (0–40) grades external rotation by functional
hand-position milestones and internal rotation by a 6-level vertebral
ladder distinct from this IG's own 8-tier `InternalRotationVertebralLevel`,
scored on *active, painless* motion specifically, not a
linear degrees-to-points conversion of the degree-valued ROM Observations
captured elsewhere. The Constant Strength sub-score (0–25) is a single
spring-balance/dynamometer-derived point value, clinically distinct from
`SupraspinatusStrengthDynamometryObservation`, which is a
different clinical test entirely. No LOINC or SNOMED CT code exists for
any of the four sub-components, so local codes are used.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/constant-score-observation"
* ^version = "0.4.0"
* ^status = #draft
* ^publisher = "Hasso Plattner Institute"
* ^date = "2026-07-19"

// Machine-checkable version of the "all four required together, total =
// their sum" rule this profile's own Description already states in prose
// and ADR-0113/ADR-0118 already enforce in both frontends' UI, previously
// only enforceable by an application, not by any validator run against
// this profile alone (e.g. a third-party submission bypassing both
// frontends' UI). direct-total mode (no components) is unaffected.
* obeys constant-score-component-sum
* code = http://snomed.info/sct#273383002
* category = http://terminology.hl7.org/CodeSystem/observation-category#survey "Survey"
// ADR-0156: disambiguates which RotatorCuffCondition (bilateral case) this
// composite score is about, see SsvScoreObservation.fsh's fuller comment.
* focus 0..1 MS
* focus only Reference(RotatorCuffCondition)
* insert BoundedQuantity(#{score}, 0, 100)

// Sub-component slices (ADR-0090), all optional; present together only
// in component-derived entry mode. Bounds mirror the original Constant &
// Murley 1987 15/20/40/25 breakdown, applied via the standard
// minValueQuantity/maxValueQuantity extensions, same as the ROM/strength/
// pain profiles. Correction (2026-08-05): despite this comment previously
// calling these "UI-hint... not validator-enforced hard constraints," a
// direct isolated test (component-sum invariant work below) confirmed the
// FHIR Validator CLI DOES reject an out-of-range value with a hard `error`
// (not a warning), e.g. a component value of 999 against maxValueQuantity
// 100 fails validation even fully offline (-tx n/a). These bounds are real,
// validator-enforced constraints, not merely advisory UI hints.
* component ^slicing.discriminator.type = #pattern
* component ^slicing.discriminator.path = "code"
* component ^slicing.rules = #open
* component ^slicing.description = "Sliced by component.code (pattern) to distinguish the four Constant-Murley sub-scores"
* component contains
    Pain 0..1 MS and
    ADL 0..1 MS and
    ROM 0..1 MS and
    Strength 0..1 MS

* component[Pain].code = ShoulderObservationCodes#constant-score-pain
* component[Pain] insert BoundedQuantity(#{score}, 0, 15)

* component[ADL].code = ShoulderObservationCodes#constant-score-adl
* component[ADL] insert BoundedQuantity(#{score}, 0, 20)

* component[ROM].code = ShoulderObservationCodes#constant-score-rom
* component[ROM] insert BoundedQuantity(#{score}, 0, 40)

* component[Strength].code = ShoulderObservationCodes#constant-score-strength
* component[Strength] insert BoundedQuantity(#{score}, 0, 25)

// FHIRPath has no built-in sum()/aggregate() reliably supported by the
// validator's engine (confirmed by trial: 'sum' rejected as an unknown
// function name), summed explicitly via .where(code=...) + per component
// instead, each of which resolves to a 0-or-1-item singleton since the
// four component codes are unique per slice.
Invariant: constant-score-component-sum
Description: "If any Constant-Murley sub-score component is present, all four (Pain, ADL, ROM, Strength) must be present, and the total must equal their sum."
Severity: #error
Expression: "component.empty() or (component.count() = 4 and value.ofType(Quantity).value = component.where(code.coding.where(code = 'constant-score-pain').exists()).value.ofType(Quantity).value + component.where(code.coding.where(code = 'constant-score-adl').exists()).value.ofType(Quantity).value + component.where(code.coding.where(code = 'constant-score-rom').exists()).value.ofType(Quantity).value + component.where(code.coding.where(code = 'constant-score-strength').exists()).value.ofType(Quantity).value)"
