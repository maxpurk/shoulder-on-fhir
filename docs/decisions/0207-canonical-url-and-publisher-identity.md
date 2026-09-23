# ADR-0207: Canonical URL and publisher identity move off the institutional namespace

**Date:** 2026-09-23
**Status:** Accepted — changes the canonical namespace set by ADR-0025 and the package identifier used throughout the guide. No profile, binding, or terminology decision is changed.

## Context

The guide declared `https://hpi.de/fhir/shoulder-on-fhir` as its canonical namespace, `de.hpi.shoulder-on-fhir` as its package identifier, and Hasso Plattner Institute as its publisher. Three problems follow from that, and all three surface the moment the repository becomes public.

**1. The publisher assertion is not the author's to make.** `ImplementationGuide.publisher` names the organisation that stands behind the artifact. Declaring an institution there, and putting the artifact in that institution's domain, asserts institutional authorship of a master thesis artifact. That needs sign-off from the institution, not from a supervisor.

**2. The canonical does not resolve and never will.** Nothing is served at `hpi.de/fhir/`. HL7 guidance is that a canonical should be a URL the publisher controls and can serve the guide from, so that a consumer holding only a profile URL can find its definition.

**3. The identifier and the canonical disagreed with the rest of the repository.** The package identifier encoded one owner while `CITATION.cff` and the repository URL encoded another.

## Decision

Move the guide's identity to a namespace the author controls.

1. **Canonical:** `https://maxpurk.github.io/shoulder-on-fhir`. GitHub Pages under the author's account can serve the built guide, so the canonical resolves to the artifact it names.
2. **Package identifier:** `shoulder-on-fhir`.
3. **Publisher:** `Maximilian Purk`, with `https://github.com/maxpurk/shoulder-on-fhir` as the publisher and contact URL.
4. **The institutional affiliation stays as a statement of provenance,** in the guide's description, in `README.md`, and in `CITATION.cff`'s author affiliation. Where the work was done is a fact about the work. Who publishes it is a claim about authority, and only the second one moves.
5. **The patient identifier system follows the canonical**, as ADR-0025 required: `https://maxpurk.github.io/shoulder-on-fhir/identifier/patient`. ADR-0025's reasoning is unchanged; only the namespace it points at moves.

The change is mechanical and total. Every `canonical`, every profile and CodeSystem and ValueSet URL, every `meta.profile` in the seed bundles and the extracted example bundles, every profile URL the two frontends send, and the IG package filename carry the new namespace.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep the institutional canonical and seek sign-off | Blocks publication on an approval the thesis timeline cannot absorb, and still leaves a canonical that does not resolve |
| Change the publisher but keep the `hpi.de` canonical | Leaves the artifact sitting in a domain whose owner has not agreed to host it, and the canonical still does not resolve |
| `io.github.maxpurk.shoulder-on-fhir` as the package identifier | The reverse-domain form the HL7 package registry expects. Rejected because this guide is a thesis artifact that is not registered, and the short form matches the repository name a reader will actually look for |
| A purchased domain for the author | Adds a recurring cost and a second thing that can lapse, for a namespace GitHub Pages already provides |

## Consequences

✅ The canonical resolves to a site the author can publish, so a consumer holding a profile URL can reach its definition
✅ No institution is named as publishing authority for an artifact it has not reviewed
✅ The package identifier, the canonical, the repository URL and `CITATION.cff` now name one owner
⚠️ Every conformance resource URL changes. Any data captured against the old namespace carries `meta.profile` values that no longer resolve. This is a pre-production research artifact with no external consumers, so no migration path is provided
⚠️ The built package filename changes from `de.hpi.shoulder-on-fhir.en.tgz` to `shoulder-on-fhir.en.tgz`
⚠️ The package identifier is not in reverse-domain form, so the guide cannot be submitted to the HL7 package registry without changing it again
⚠️ Rejected-alternative tables in ADR-0066 still quote the old namespace. They record options considered at the time and are left as written

## Sources

- `ig/sushi-config.yaml` — `id`, `canonical`, `publisher`, `contact`
- `ig/package-list.json` — `package-id`, `canonical`, list entry `path`
- ADR-0025 — canonical patient identifier system, whose namespace this decision moves
- HL7 FHIR Implementation Guide Publishing Documentation — canonical URL requirements
