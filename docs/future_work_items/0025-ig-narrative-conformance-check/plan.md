# Automated conformance check for the IG's authored narrative

> **Status:** Future work item — scoped, not implemented, not approved. Captured 2026-09-07
> during the published-narrative audit recorded in ADR-0179.

## Gap

Everything a reader sees on a published IG page comes from two hand-maintained sources: the four
narrative pages under `ig/input/pagecontent/` and the `Title:` / `Description:` / `^short` /
concept-definition strings in `ig/input/fsh/`. Neither SUSHI nor the IG Publisher checks that these
agree with the profiles they describe. The audit found nine claims that contradicted the compiled
artifacts — a binding stated as `required` that is `extensible`, a ValueSet given a binding strength
although nothing binds it, an `Encounter.status` lifecycle described where the profile pins a single
code, a code count off by two — plus a stale coverage metric that survived two ADRs retiring it.

Every one of those checks is mechanical against `fsh-generated/`, and was run by hand for this pass:

- each SNOMED CT / LOINC code cited in prose exists somewhere in the compiled output;
- each `Binding strength: **x**` claim matches an actual binding on that ValueSet;
- each documented CodeSystem table lists exactly the CodeSystem's concepts, with matching displays;
- each `](Artifact-id.html)` link resolves to a generated artifact;
- stated counts (derived profiles, ValueSets, CodeSystems, consensus elements) match reality;
- no published string contains project history, an ADR number, or an internal tool name.

## Why it matters

The narrative is the only part of the IG a first-time reader trusts before opening a
StructureDefinition, and it is the only part with no automated gate. Drift is silent and
accumulates: the corrected coverage paragraph had been wrong on the home page since ADR-0178
retired the metric, and four "Renamed from `Shoulder*`" notes survived the pass that was meant to
remove exactly that class of prose.

## Note

Natural home is a script under `tools/`, run alongside `sushi .` in `build-and-deploy.sh` and
failing the build on a mismatch. The checks above are the minimum set; the history/tooling scan is
a regex sweep over the generated JSON's string fields and is the cheapest of them. Out of scope for
this item: checking prose that is genuinely editorial (clinical rationale, terminology-gap
argument), which no static check can verify.
