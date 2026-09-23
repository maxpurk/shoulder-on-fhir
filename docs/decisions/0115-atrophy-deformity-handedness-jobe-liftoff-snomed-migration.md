# ADR-0115: Migrate atrophy, deformity, hand-dominance, Jobe, and lift-off test codes from local codes to SNOMED CT

**Date:** 2026-07-29
**Status:** Accepted, except the **atrophy** migration, reverted the next day by ADR-0116 — tx.fhir.org's served SNOMED edition does not carry `1119438000`, so `AtrophyObservation.code` remains `ShoulderObservationCodes#atrophy`. The deformity, hand-dominance, Jobe, and lift-off migrations landed as described and are still in force.

## Context

Several `ShoulderObservation` child profiles fix `Observation.code` to a local
`ShoulderObservationCodes` concept because earlier verification passes only checked
whether a laterality-neutral SNOMED CT **observable-entity** concept existed for the
axis. ADR-0086, in particular, states for the three visual-inspection findings
(atrophy, deformity, normal shoulder contour): "No laterality-neutral SNOMED CT
observable-entity concept exists for this axis (verified July 2026)".

A live SNOMED CT terminology-server sweep (via the project's SNOMED MCP tool, July 2026)
of the broader **disorder/clinical-finding** and **procedure** hierarchies — not just
observable entity — found real, laterality-neutral, active concepts for five of these
local axes:

| Local code (retired) | SNOMED CT concept | Hierarchy |
|---|---|---|
| `ShoulderObservationCodes#atrophy` | `1119438000` "Atrophy of muscle of shoulder" | disorder |
| `ShoulderObservationCodes#deformity` | `111263009` "Acquired deformity of shoulder" | disorder |
| `ShoulderObservationCodes#hand-dominance` | `57427004` "Handedness" | observable entity |
| `ShoulderObservationCodes#jobe-test` | `1231437004` "Empty can test" (synonym "Jobe test") | procedure |
| `ShoulderObservationCodes#lift-off-test` | `1231510004` "Lift-off test" (synonym "Gerber test") | procedure |

`1119438000` and `111263009` were confirmed laterality-neutral by walking the SNOMED
hierarchy: each is the direct parent of laterality-specific left/right/bilateral
sibling concepts (e.g. `1119438000` parents `313821000119103` "Atrophy of muscle of
left shoulder", `313911000119104` "...right shoulder", and `15704441000119108`
"...bilateral shoulder regions").

Two axes in the same neighbourhood were re-checked and confirmed to have **no**
equivalent standard concept, so they stay local:
- `#normal-shoulder-contour` — no laterality-neutral finding concept exists; the only
  candidate, `116308004` "Finding of shoulder region", is too generic to be a
  meaningful `Observation.code` (it would fire for any shoulder finding whatsoever).
- `#belly-press-test`, `#bear-hug-test`, `#hornblower-test` — no SNOMED procedure or
  finding concept exists for any of the three (verified). Splitting the five
  provocation tests into 2 SNOMED-coded + 3 locally-coded was considered and accepted
  deliberately (see Alternatives) rather than waiting for full coverage.

Per this project's standard-terminology-first principle (ADR-0010, ADR-0027), local
codes are a fallback of last resort, not a default — where a verified standard
concept exists, the profile should use it.

## Decision

Fix `Observation.code` on the five affected profiles directly to their SNOMED CT
concept, replacing the local code:

- `AtrophyObservation.code = http://snomed.info/sct#1119438000`
- `DeformityObservation.code = http://snomed.info/sct#111263009`
- `HandDominanceObservation.code = http://snomed.info/sct#57427004`
- `JobeTestObservation.code = http://snomed.info/sct#1231437004`
- `LiftOffTestObservation.code = http://snomed.info/sct#1231510004`

`value[x]` cardinality and ValueSet bindings are **unchanged** on every profile —
`PresentAbsent` (atrophy/deformity), `HandDominance`, and `PositiveNegative`
(Jobe/lift-off) all stay exactly as they were. Only the fixed `code` element moves.

This adopts the FHIR pattern of using a SNOMED CT **finding/disorder concept as
`Observation.code`**, paired with a present/absent (or positive/negative) qualifier
as `Observation.value` — a recognized, common pattern (see
`hl7.org/fhir/snomedct.html`) for axes where no SNOMED **observable-entity** concept
exists. `HandDominanceObservation` gets the cleaner textbook code=question /
value=answer pairing since `57427004` genuinely is an observable entity.

**Laterality is not folded into the code.** SNOMED CT post-coordination
(`1119438000 : 272741003 = 7771000`) was considered and rejected — post-coordinated
expressions are poorly supported by `tx.fhir.org` and most terminology tooling for
validation/expansion (this IG has hit exactly this class of limitation before, e.g.
ADR-0084's `compose.exclude` + text-filter combination failure), and would encode
structured data as an opaque string. `Observation.bodySite` (bound to
`ShoulderLaterality`, already populated on these exam-category observations per
ADR-0074) remains the sole carrier of laterality — two separate FHIR elements, not
one post-coordinated code, matching how every other Observation in this IG already
handles laterality.

`ShoulderObservationCodes` CodeSystem: the five retired local concepts are removed
(not deprecated-in-place — no external consumer references them yet, this IG being
pre-1.0/draft), `^count` 48 → 43. `ShoulderObservationCode` ValueSet (the enumerated
hybrid per ADR-0065): the five SNOMED codes added to the external-code enumeration.

### SDC frontend — no code change required

The SDC frontend (port 3001) was checked for parity. Two things were confirmed live:

1. **The runtime Questionnaire already has full coverage.** `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` — the actual Questionnaire fetched from HAPI at runtime (`FlowPage.tsx` → `fhirClient.search('Questionnaire', ...)`) — already declares `obs.atrophy`, `obs.deformity`, `obs.normal-shoulder-contour`, `obs.jobe-test`, `obs.lift-off-test`, and `obs.hand-dominance` items, each `item.definition` pointing at `...#Observation.valueCodeableConcept` on the respective profile. `value[x]` is untouched by this migration, so no instance edit was needed.
2. **`Observation.code` is resolved dynamically, not hardcoded.** ADR-0103 replaced the SDC extractor's old hand-typed `PROFILE_METADATA` code table with `profileMetadataResolver.ts`, which reads the fixed `Observation.code` straight off the compiled StructureDefinition HAPI serves. Once the five profiles above are reloaded into HAPI, the SDC frontend picks up the new SNOMED codes automatically, with zero `sdc-frontend/` code changes.

One pre-existing, unrelated issue surfaced during this check: `sdc-frontend/src/questionnaire/ShoulderRegistration.ts` is a hand-written duplicate Questionnaire definition that is not imported or reachable from any runtime code path (superseded by the HAPI-served instance once ADR-0103 landed) and had already drifted stale (missing the three inspection items). Left untouched — out of scope for this change — and logged in `docs/limitations_items/` for a future cleanup pass.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Keep all five local | Contradicts the standard-terminology-first principle now that verified standard concepts are known to exist; local codes are harder for external systems to recognize without importing this IG's CodeSystem. |
| Post-coordinate laterality into the SNOMED expression (`1119438000 : 272741003 = left`) | Poor tooling/validation support (`tx.fhir.org` and most terminology servers don't reliably expand/validate post-coordinated expressions); `Observation.bodySite` already solves this cleanly and is the pattern used everywhere else in the IG. |
| Migrate all 5 provocation tests, backfilling belly-press/bear-hug/hornblower with a broader "shoulder provocation test" procedure parent | Would either mis-code three genuinely distinct clinical tests under an over-generic concept, or require inventing non-existent precoordinated concepts — rejected; the 2 tests with real matches migrate, the 3 without stay local, consistent with how this IG treats other unmatched axes (documented per-item in the CodeSystem). |
| Also migrate `#normal-shoulder-contour` to `116308004` "Finding of shoulder region" | Too generic — that concept would be equally valid for any shoulder finding whatsoever, defeating the purpose of a distinct `Observation.code` per finding type. |

## Consequences

✅ Five `Observation.code` axes move from IG-local codes to standard, externally-recognizable SNOMED CT concepts, with zero change to cardinality, value bindings, or category.
✅ Laterality stays cleanly represented via the existing `Observation.bodySite` mechanism — no post-coordination introduced.
✅ SDC frontend picks up the new codes automatically via ADR-0103's dynamic resolution — no `sdc-frontend/` source changes needed.
⚠️ `ShoulderObservationCodes` CodeSystem `^count` and content shrink (48 → 43); any external reference to the five retired concepts (none known) would break. Acceptable — pre-1.0 draft IG.
❌ Three provocation tests (belly-press, bear-hug, hornblower) remain locally coded alongside two now-SNOMED-coded siblings (Jobe, lift-off) in the same clinical group — an intentional, documented asymmetry rather than a defect.

## Sources

- SNOMED CT MCP terminology server lookups (July 2026): `1119438000`, `111263009`, `57427004`, `1231437004`, `1231510004`, plus hierarchy walk confirming laterality-neutral parent status for the two disorder concepts.
- `ig/input/fsh/profiles/observations/{Atrophy,Deformity,HandDominance,JobeTest,LiftOffTest}Observation.fsh`
- `ig/input/fsh/codesystems/ShoulderObservation.fsh`, `ig/input/fsh/valuesets/ShoulderObservationCode.fsh`
- ADR-0086 (original visual-inspection decomposition, observable-entity-only verification), ADR-0074 (bodySite laterality scoping), ADR-0065 (enumerated-hybrid ValueSet pattern), ADR-0010/ADR-0027 (standard-terminology-first), ADR-0103 (dynamic SDC profile-metadata resolution), ADR-0084 (prior encounter with `tx.fhir.org` post-coordination/compose limitations)
- `sdc-frontend/src/components/FlowPage.tsx`, `sdc-frontend/src/lib/profileMetadataResolver.ts`, `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh`
- `docs/limitations_items/` — dead `sdc-frontend/src/questionnaire/ShoulderRegistration.ts` entry logged during this work
