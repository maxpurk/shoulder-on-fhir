# ADR-0182: Write artefact names exactly as declared, with no `VS` / `CS` suffix

**Date:** 2026-09-07
**Status:** Accepted
**Relates to:** ADR-0179 (published IG narrative audit, which corrected narrative claims but not this naming habit), ADR-0032 (editorial scope of the diagnosis and procedure-type ValueSets)

## Context

FSH declares a ValueSet or CodeSystem under a bare name: `ValueSet: ShoulderLaterality`, `CodeSystem: ShoulderObservationCodes`. That name, and the `Id` derived from it, is what SUSHI compiles, what the IG Publisher renders, what HAPI serves, and what a reader searches for.

Project prose had drifted into a house shorthand that appends the artefact type instead: `ShoulderLateralityVS`, `ShoulderObservationCS`, `PatteCS`. <!-- check-artifact-names:allow --> None of these names exists in any compiled artefact. The habit had spread across every surface at once:

- **97 occurrences in the published IG narrative** (`ig/input/pagecontent/profiles.md`, `terminology.md`), including section headings such as `### ShoulderLateralityVS` and `### RotatorCuffEtiologyVS`. <!-- check-artifact-names:allow -->
- 39 in `mapping/SECEC_FHIR_Mapping.csv` and 14 in the generated `.md`.
- 15 in the thesis, which had inherited them from the mapping.
- 3 in FSH comments.

The cost falls on the reader. Someone who follows the published terminology page to look up `ShoulderLateralityVS` <!-- check-artifact-names:allow --> finds nothing under that name in the artefact list, nothing in the FSH, and nothing in the HAPI endpoint. The shorthand also silently invents distinctions that do not exist: `PatteCS` and `GoutallierCS` shortened the real `PatteClassificationCodes` and `GoutallierClassificationCodes`, and `ShoulderProcedureTypeVS` named an artefact that was never declared at all. A second implementer reading the guide cannot tell which names are real.

Two further phantoms surfaced during the sweep: `FollowUpEncounterTypeVS`, which is really `ShoulderEncounterType`, and `SmokingStatusVS`, which is a value set the IG deliberately does not define because it reuses the IPS one.  <!-- check-artifact-names:allow -->

## Decision

Artefact names are written exactly as the source declares them, on every surface: published IG narrative, FSH descriptions and comments, the mapping CSV and its generated Markdown, the thesis, and the ADRs.

No type suffix is appended. Write `ShoulderLaterality`, not `ShoulderLateralityVS`. Write `ShoulderObservationCodes`, not `ShoulderObservationCS`. <!-- check-artifact-names:allow --> Where the sentence needs to say what kind of artefact it is, say it in words ("the `ShoulderLaterality` ValueSet"), which reads better and keeps the name searchable.

A single historical exception is retired rather than kept: the note that "no local `SmokingStatusVS` is defined" now reads "no local smoking-status ValueSet is defined", because naming a value set that was never published helps no one.  <!-- check-artifact-names:allow -->

`tools/check-artifact-names.sh` enforces this. It derives the shorthand forms from the names actually declared under `ig/input/fsh/` and fails if any appears in the narrative, the mapping, or the thesis. Deriving the forms rather than pattern-matching on a `VS`/`CS` suffix means ordinary words that happen to end that way, such as PACS, are never flagged.

## Alternatives considered

**Declare the shorthand as a documented reading convention** (a legend in the appendix and a note on the terminology page). Rejected: a convention that has to be explained on every surface is worse than using the real name, and it does not help a reader who arrives at the guide through a search engine or the artefact index rather than through the legend.

**Rename the artefacts themselves to carry the suffix**, so the prose becomes correct. Rejected: the FHIR convention is a bare name, the `Id` and canonical URL are already published without a suffix, and renaming 54 artefacts to match a habit would break every existing reference for no gain.

## Consequences

- 96 shorthand names were replaced in the published narrative, plus the 3 in FSH comments and the phantom `SmokingStatusVS` sentence. The mapping and thesis were corrected in the same pass.  <!-- check-artifact-names:allow -->
- Section headings in `terminology.md` changed, so any external deep link to an old anchor such as `#shoulderlateralityvs` no longer resolves. No internal link used those anchors, and the guide is pre-ballot, so no stable external references are expected.
- The IG HTML must be rebuilt for the narrative change to reach the published site.
- Names in the guide are now searchable: what the page calls an artefact is what the artefact index, the FSH, and the HAPI endpoint call it.
