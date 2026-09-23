# Bundle `entry.fullUrl` is a random `urn:uuid` that no reference in the bundle uses

> **Status:** Limitation — open, needs a decision on which of two coherent patterns to adopt before
> any fix. Logged 2026-09-08, surfaced by a review of validator output volume: this single mismatch
> accounts for the large majority of the residual warnings on every submitted bundle.

## Gap

Every entry in every transaction bundle this project produces carries
`fullUrl: urn:uuid:<random>`, while every cross-reference inside the same bundle uses the literal
`Type/id` form (`Condition/anna-mueller-rc-tear`, `Patient/pat-long-001`) that the entry's own
`request.url` already pins via `PUT`. The two never agree, so the validator resolves each reference
by its type-and-id fallback and emits, per reference:

> Entry X matches the reference … by type and id but its fullUrl … does not match … by Bundle
> resolution rules.

This is FHIR-legal — the fallback resolution is specified — but it is not the canonical form, and at
roughly 150–190 near-identical warnings per bundle it is the dominant term in the residual warning
count, which makes the remaining warnings harder to read.

The FSH comment on `RotatorCuffRegistrationBundle.fsh` (`* entry.fullUrl 1..`) states the element is
"needed for urn:uuid cross-references". No bundle in the project actually uses urn:uuid
cross-references, so the stated rationale does not describe the data.

## Why it matters

It is cosmetic for correctness and real for legibility: a reviewer reading validator output has to
filter ~150 lines of one benign warning to find anything else. It also means the guide ships example
data in a form that is not the pattern the specification treats as canonical, which is a poor model
for a second implementer copying the examples.

## Note — why this was not fixed as a quick pass

The obvious framing ("realign the 14 seed files") is wrong, because the seed data is not the source
of the pattern. Both frontends assemble bundles the same way —
`frontend/src/lib/fhirClient.ts` (two sites), `frontend/src/components/followup/ReviewSubmit.tsx`,
and `sdc-frontend/src/lib/fhirClient.ts` (two sites) all emit `fullUrl: urn:uuid:${uuid}`. Patching
only the seed bundles would make the shipped example data diverge from what the live system actually
submits, which is worse than the current consistent-but-noisy state.

Two coherent fixes exist, and choosing between them is a submission-semantics decision, not a
find-and-replace:

1. **Keep `urn:uuid` fullUrls and switch internal references to `urn:uuid:`.** This is the canonical
   POST-transaction pattern and is fully spec-conformant. It changes how the server resolves
   references at submission time and touches both frontends' assemblers plus every seed bundle.
2. **Make `fullUrl` an absolute URL whose tail is the `Type/id` the references already use.** Removes
   the warning with a smaller semantic change, but requires choosing a base URL to bake into
   authored example data, which no base currently fits (the canonical namespace identifies
   StructureDefinitions, not instances, and the server base varies by deployment).

Deferred rather than rushed: this is a change to how every bundle in the system is assembled, and the
current behaviour is correct, merely non-canonical.
