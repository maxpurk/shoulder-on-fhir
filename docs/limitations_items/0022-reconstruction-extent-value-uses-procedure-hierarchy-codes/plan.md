# `ReconstructionExtentObservation` carries a SNOMED *procedure*-hierarchy concept in `Observation.value`, where FHIR expects a finding/measurement

> **Status:** Limitation — open, needs a modeling decision before any fix. Logged 2026-08-24,
> surfaced while reviewing the Anna Müller surgery bundle's reconstruction-extent Observation.

## Gap

`ReconstructionExtentObservation` (`ig/input/fsh/profiles/observations/ReconstructionExtentObservation.fsh`)
binds `valueCodeableConcept` `required` to `ReconstructionExtent`, whose four members are all SNOMED
**procedure**-hierarchy concepts — `304385007 "Partial repair of rotator cuff"`, `304384006 "Complete
repair of rotator cuff"` (FSN ends in `(procedure)`, verified on the SNOMED server), `308681004`,
`785850002`. FHIR's own Observation scope defines the resource as *"measurements and simple assertions
made about a patient"* and its boundary section steers the act-that-was-done to `Procedure`; a procedure
concept in `Observation.value` is a code-system-semantics mismatch. FHIR provides a native slot for this
exact datum — `Procedure.outcome` (0..1 CodeableConcept, "did the procedure achieve its goal") on the
index `RotatorCuffProcedure`. The `ReconstructionExtent.fsh` Description already states the reuse is
intentional ("precoordinated SNOMED … procedure-level codes, reused here as Observation values"), so this
is a known trade-off, not an accident. The same procedure-code-as-value pattern applies to the sibling
`TearThickness` (and, to check, `ProcedureApproach`) Observations, which cite `TearThickness` as their
precedent — so a fix here should be decided for the family, not this one profile.

## Why it matters

A downstream consumer querying `Observation.value` for these profiles receives a SNOMED *procedure*
concept where it would reasonably expect a finding/qualifier — degrading interoperability and making the
data harder to align with peer registries or IPS-style tooling that assume finding-hierarchy Observation
values. It is also the one part of an otherwise clean per-data-point Observation model that a FHIR
reviewer would flag as off-spec.

## Note

Not scoped yet. Two clean directions, to be decided (per the Clinical Feedback Integration Workflow's
(a)/(b)/(c)/(d) classification, and applied consistently to `TearThickness`/`ProcedureApproach` if it
holds): (1) **keep the Observation** (preserves the uniform, queryable one-data-point-per-Observation
registry pattern) but move the value to *finding/qualifier*-hierarchy concepts — e.g. a small ValueSet
expressing "complete repair achieved / partial repair / arthroplasty" as findings rather than the names
of procedures; or (2) **move the datum to `Procedure.outcome`** on the index procedure, which is the
spec-native home but breaks the aggregation-friendly Observation-per-data-point uniformity and would need
both frontends' surgery flows rewired. The reconstruction-extent axis is itself a deliberate,
surgeon-requested modeling choice (postcoordination-style decoupling from `Procedure.code`); only the
*value hierarchy* is in question here, not whether to capture the axis. Verify whether an existing ADR in
the second surgeon-feedback round (ADR-0105–0115 range) already covers the axis before writing a new one.
