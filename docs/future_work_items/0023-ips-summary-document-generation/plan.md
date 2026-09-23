# Generate an IPS summary document to exercise the instance-level IPS conformance claims

> **Status:** Future work item — above-consensus enrichment that exercises existing conformance, not
> a limitation of consensus coverage. Logged 2026-08-17 during a reader review of the EU Core / IPS
> alignment (ADR-0169). Classification: category (d), above-consensus infrastructure.

## Gap

The IG asserts IPS conformance via `meta.profile[]` on the Patient, the comorbidity Condition,
every Procedure, and the smoking Observation, and these claims are validated as such by
`tools/validate.sh` (IPS 1.1.0 pinned). But **nothing generates an actual IPS summary** — no
`Composition` and no IPS document `Bundle` that would reference and consume those IPS-profiled
resources. The conformance is therefore *asserted and validated*, but never *exercised* by a real
export end to end.

## Why this is future work, not a limitation

No SECEC consensus element requires an IPS document, and the claims already deliver their intended
value: they demonstrate that the registry's resources are IPS-summary-eligible and validate against
the IPS profiles. Producing a live IPS `Composition` is a demonstration enrichment that would prove
the claims end to end, not a gap in what the consensus asks the IG to represent.

## Note

Would build a `Composition` (IPS structure: Problems, Procedures, Social History sections)
referencing the IPS-profiled Patient / Condition / Procedure / Observation resources, wrapped in an
IPS document `Bundle`. Pairs naturally with the attestation/document work already logged in
[[0005-composition-document-attestation]] and the provenance work in
[[0006-provenance-consent-research-subject]]. The related question of which procedures belong in an
IPS Procedures section was already settled for this artifact by ADR-0170 (IPS Procedure claim scoped
to surgical; prior PT/injection excluded), so an IPS document would render only surgical procedures
in that section.
