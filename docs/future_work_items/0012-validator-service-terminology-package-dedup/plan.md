# Deduplicate `hl7.terminology` package versions in validator-service

> **Status:** Future work item — real fix, not yet implemented (ADR-0119 only worked around the
> symptom).

## Gap

`validator-service`'s boot log loads five different `hl7.terminology(.r4)` versions simultaneously
(~20,000 redundant CodeSystem/ValueSet resources sitting in idle heap) because
`hl7.fhir.eu.base`, `hl7.fhir.uv.xver-r5.r4`, and this IG each pin a different version, and none
get reconciled. ADR-0119 fixed the resulting OOM crash by enlarging the container/heap, not by
shrinking this footprint.

## Why it matters

The same OOM risk returns at a larger scale if the IG's dependency graph grows further or
concurrent validation load increases.

## Note

Needs understanding why each dependency currently pins a different version (possible genuine
compatibility constraint, not just an oversight) before reconciling to one shared version.
