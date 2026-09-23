# Layer onto a German national base IG (ISiK / MII Kerndatensatz)

> **Status:** Future work item — deliberate scope boundary, not a defect.

## Gap

Peer German IGs (SenologieOnFHIR via MII Kerndatensatz + `de.gematik.isik`; ISiK itself) build
their Patient/Condition/Procedure profiles on top of a German national base layer
(`de.basisprofil.r4` → ISiK → MII → domain IG). This IG derives directly from `hl7.eu.base` (EU
Core) instead, with no German national base-IG dependency.

## Why it matters

A legitimate, deliberate scope choice for a thesis IG optimizing for international demonstrability
over deployability in a KHZG-regulated German hospital. If real-world adoption in German clinical
IT is ever pursued, ISiK/MII conformance would eventually be expected.

## Note

Not a defect — a documented scope boundary, relevant only if real-world German hospital deployment
is ever pursued.
