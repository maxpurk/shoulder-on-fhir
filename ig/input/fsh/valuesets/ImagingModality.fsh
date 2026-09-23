// ╭─────────────────────────────────────────────────────────────────────────────╮
// │  ImagingModality                                                          │
// │  DICOM acquisition-modality codes for advanced shoulder imaging            │
// ╰─────────────────────────────────────────────────────────────────────────────╯

ValueSet: ImagingModality
Id: imaging-modality
Title: "Imaging Modality ValueSet"
Description: "DICOM acquisition-modality codes for shoulder imaging: DX for a plain radiograph (Q3), and MR, CT, or US for the advanced-imaging choice (Q5, Q6, and the Q7 ultrasound recording pattern). A patient can have both a radiograph and an advanced study, so both frontends consume this ValueSet as a multi-select. The binding is extensible, so any other DICOM modality code is also valid."
* ^url = "https://maxpurk.github.io/shoulder-on-fhir/ValueSet/imaging-modality"
* ^version = "0.2.0"
* ^status = #draft
* ^experimental = true
* ^date = "2026-08-02"
* ^publisher = "Hasso Plattner Institute"

* http://dicom.nema.org/resources/ontology/DCM#DX "Digital Radiography"
* http://dicom.nema.org/resources/ontology/DCM#MR "Magnetic Resonance"
* http://dicom.nema.org/resources/ontology/DCM#CT "Computed Tomography"
* http://dicom.nema.org/resources/ontology/DCM#US "Ultrasound"
