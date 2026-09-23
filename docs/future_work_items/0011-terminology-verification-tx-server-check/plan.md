# Add a live tx.fhir.org check to the terminology-verification process

> **Status:** Future work item — process improvement, not implemented.

## Gap

This project's "verify every code against its authoritative server" policy (see
`0010-atrophy-snomed-code-tx-fhir-org-gap/`) used the SNOMED MCP tool, which is evidently ahead of
what `tx.fhir.org` — the server the actual validator/HAPI/IG-Publisher toolchain depends on —
currently serves. The gap surfaced only at deploy/validate time, not at authoring time.

## Why it matters

Any future terminology-code addition verified only via a general SNOMED lookup carries the same
latent risk of being real-but-not-yet-servable by `tx.fhir.org`.

## Note

Add a direct `curl .../CodeSystem/$lookup` against `tx.fhir.org` as a standard step whenever a new
terminology code is added, alongside the existing verification policy.
