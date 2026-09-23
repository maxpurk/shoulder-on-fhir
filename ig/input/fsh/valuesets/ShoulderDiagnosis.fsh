// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ShoulderDiagnosis                                                         │
// │  Enumerated SNOMED CT codes for coexisting NON-rotator-cuff shoulder       │
// │  pathology, bound on ShoulderDiagnosisCondition.code.                      │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: ShoulderDiagnosis
Id: shoulder-diagnosis
Title: "Shoulder Diagnosis (Non-Rotator-Cuff) ValueSet"
Description: """
Enumerated SNOMED CT codes for shoulder pathology commonly coexisting with a
rotator cuff tear but distinct from it, long head of biceps pathology, AC
joint osteoarthritis, glenoid labrum tear, adhesive capsulitis, glenohumeral
osteoarthritis, shoulder instability. The expert consensus does not name this
element. The list is an editorial baseline covering the pathologies most often
recorded as a secondary diagnosis alongside a rotator cuff tear. Binding is
extensible, a site may add further codes without a profile change.

Every code in this list is laterality-neutral, the same convention as
`TendonsInvolved`. The affected side is carried on `Condition.bodySite`, so a
deployer extending this list should also choose laterality-neutral concepts.
"""
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/shoulder-diagnosis"
* ^version = "0.1.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-07-13"
* ^publisher = "Hasso Plattner Institute"

* http://snomed.info/sct#202856007 "Biceps tendinitis"
* http://snomed.info/sct#86128003 "Rupture of tendon of biceps, long head"
* http://snomed.info/sct#239865003 "Osteoarthritis of acromioclavicular joint"
* http://snomed.info/sct#202332000 "Glenoid labrum tear"
* http://snomed.info/sct#399114005 "Adhesive capsulitis of shoulder"
* http://snomed.info/sct#373623009 "Osteoarthritis of glenohumeral joint"
* http://snomed.info/sct#298854003 "Shoulder joint unstable"
