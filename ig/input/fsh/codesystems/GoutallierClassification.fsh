// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  Goutallier Classification CodeSystem                                      │
// │  Classification system for fatty infiltration of rotator cuff muscles      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

CodeSystem: GoutallierClassificationCodes
Id: goutallier-classification
Title: "Goutallier Classification"
Description: """
Ordinal classification of fatty infiltration of skeletal muscle (originally of the rotator
cuff musculature) as defined by Goutallier et al. (1994) based on CT imaging, and adapted
for MRI by Fuchs et al. (1999). Grades range from 0 (normal muscle) to 4 (more fat than
muscle). This CodeSystem is authored because no equivalent codes exist in SNOMED CT, LOINC,
RadLex, or NCI Thesaurus as of the authoring date of this IG (exhaustive search documented
in the IG source repository).
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/CodeSystem/goutallier-classification"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-04-03"
* ^publisher = "Hasso Plattner Institute"
* ^purpose = "To enable coded representation of the Goutallier fatty infiltration grade in FHIR Observation resources within the Shoulder on FHIR Implementation Guide."
* ^copyright = "This CodeSystem is authored by the Shoulder on FHIR IG project. Clinical classification originates from: Goutallier D, et al. Clin Orthop Relat Res. 1994;304:78–83 and Fuchs B, et al. J Shoulder Elbow Surg. 1999;8:599–605."
* ^caseSensitive = true
// No ^valueSet ("all codes" pointer): the companion ValueSet enumerates its
// concepts explicitly (deliberate HAPI $expand inlining), so it is not the
// canonical all-system value set the IG Publisher requires here. Profiles bind
// the enumerated ValueSet by URL directly — matches the other 18 local CodeSystems.
* ^hierarchyMeaning = #is-a
* ^compositional = false
* ^versionNeeded = false
* ^content = #complete
* ^count = 5

* #0 "Grade 0 – Normal muscle"
    """
    Normal muscle with no fatty deposits. The muscle appears homogeneous with no areas of
    decreased attenuation on CT or increased T1 signal on MRI. Corresponds to Grade 0 of the
    Goutallier (1994) and Fuchs (1999) systems.
    """
* #1 "Grade 1 – Some fatty streaks"
    """
    Normal muscle with some fatty streaks. A few foci of decreased radiodensity on CT or
    increased T1 signal on MRI are present within the muscle belly, but the muscle is still
    predominantly normal in appearance. Corresponds to Grade 1 of the Goutallier (1994) and
    Fuchs (1999) systems.
    """
* #2 "Grade 2 – More muscle than fat"
    """
    Definite fatty infiltration is present but the muscle cross-sectional area contains more
    muscle tissue than fat. Decreased radiodensity on CT or increased T1 signal on MRI occupies
    less than 50% of the muscle cross-section. Corresponds to Grade 2 of the Goutallier (1994)
    and Fuchs (1999) systems.
    """
* #3 "Grade 3 – Equal amounts of fat and muscle"
    """
    The muscle cross-section contains approximately equal proportions of fat and muscle tissue.
    Decreased radiodensity on CT or increased T1 signal on MRI occupies approximately 50% of
    the muscle cross-section. Corresponds to Grade 3 of the Goutallier (1994) and Fuchs (1999)
    systems.
    """
* #4 "Grade 4 – More fat than muscle"
    """
    Severe fatty infiltration in which fat predominates. The muscle cross-section contains more
    fat than muscle tissue; decreased radiodensity on CT or increased T1 signal on MRI occupies
    more than 50% of the muscle cross-section. Generally associated with irreversible muscle
    degeneration and poor surgical prognosis. Corresponds to Grade 4 of the Goutallier (1994)
    and Fuchs (1999) systems.
    """


