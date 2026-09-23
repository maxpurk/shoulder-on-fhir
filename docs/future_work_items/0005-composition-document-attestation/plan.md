# Add a Composition/document-style "complete record" attestation

> **Status:** Future work item — not implemented, not approved.

## Gap

Unlike IPS (`CompositionUvIps` + document-type `BundleUvIps`, `Composition.attester`/`.author`),
this IG's three transaction-bundle profiles have no Composition entry — nothing plays the role of
an explicit "this record is complete and attested" marker. The "one patient, one shoulder per
registration" completeness rule is stated only in bundle `Description:` prose.

## Why it matters

For a clinical research registry where data completeness/attestation may matter for audit
purposes, there's no FHIR-native resource asserting who compiled a registration/follow-up
submission and that it's complete.

## Note

ADR-0034/0037 already made a considered choice against a document pattern for a transactional
registry use case; mCODE and SenologieOnFHIR also skip Composition, so this is not an outlier —
worth a deliberate go/no-go before adding, not a default.
