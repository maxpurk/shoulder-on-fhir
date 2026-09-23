// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Cofield Tear Size Classification CodeSystem                                │
// │  Categorical bucketing of rotator cuff tear size (Cofield)                  │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: CofieldTearSizeClassificationCodes
Id: cofield-tear-size-classification
Title: "Cofield Tear Size Classification"
Description: """
Categorical classification of rotator cuff tear size as defined by DeOrio and Cofield
(1984) and universally adopted in shoulder surgery literature: small (<1 cm), medium (1–3 cm),
large (3–5 cm), massive (>5 cm). The bucket boundaries are measured on the maximum
tear diameter, either on MRI or intra-operatively. This CodeSystem is authored because
no equivalent codes exist in SNOMED CT, LOINC, RadLex, or NCI Thesaurus as of the
authoring date of this IG (exhaustive search documented in the IG source repository).
Sibling concept to the linear-cm `TearSizeObservation`, both encode expert consensus Q4.a
("Size") and are intended to be captured together when known.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/cofield-tear-size-classification"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-05-19"
* ^publisher = "Hasso Plattner Institute"
* ^purpose = "To enable coded representation of the Cofield categorical tear-size bucket in FHIR Observation resources within the Shoulder on FHIR Implementation Guide, alongside the continuous linear measurement (cm) captured by TearSizeObservation."
* ^copyright = "This CodeSystem is authored by the Shoulder on FHIR IG project. Clinical classification originates from: DeOrio JK, Cofield RH. Results of a second attempt at surgical repair of a failed initial rotator-cuff repair. J Bone Joint Surg Am. 1984;66(4):563–7."
* ^caseSensitive = true
// No ^valueSet ("all codes" pointer): the companion ValueSet enumerates its
// concepts explicitly (deliberate HAPI $expand inlining), so it is not the
// canonical all-system value set the IG Publisher requires here. Profiles bind
// the enumerated ValueSet by URL directly — matches the other 18 local CodeSystems.
* ^hierarchyMeaning = #is-a
* ^compositional = false
* ^versionNeeded = false
* ^content = #complete
* ^count = 4

* #small "Small tear (<1 cm)"
    """
    Small rotator cuff tear with a maximum diameter less than 1 cm. Measured on the
    largest dimension of the tear, either on MRI or intra-operatively.
    """
* #medium "Medium tear (1–3 cm)"
    """
    Medium rotator cuff tear with a maximum diameter between 1 cm and 3 cm inclusive
    of the lower bound and exclusive of the upper bound. Measured on the largest
    dimension of the tear, either on MRI or intra-operatively.
    """
* #large "Large tear (3–5 cm)"
    """
    Large rotator cuff tear with a maximum diameter between 3 cm and 5 cm inclusive
    of the lower bound and exclusive of the upper bound. Measured on the largest
    dimension of the tear, either on MRI or intra-operatively.
    """
* #massive "Massive tear (>5 cm)"
    """
    Massive rotator cuff tear with a maximum diameter greater than 5 cm, frequently
    involving more than one tendon of the rotator cuff. Measured on the largest
    dimension of the tear, either on MRI or intra-operatively. Generally associated
    with chronicity, fatty infiltration (cf. Goutallier), and poorer surgical prognosis.
    """
