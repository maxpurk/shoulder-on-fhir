# Add Provenance / Consent / ResearchSubject enrollment tracking

> **Status:** Future work item — not implemented, not approved.

## Gap

Zero `Provenance` or `Consent` resources anywhere in the IG. ADR-0068 already documents the
deliberate rejection of `ResearchStudy`/`ResearchSubject` (citing mCODE's identical choice) and
flags `RotatorCuffResearchCarePlan`'s schedule-only semantics as "a known pragmatic shortcut" — but
there is no data-lineage (who/when captured each Observation) or informed-consent trail at all.

## Why it matters

If the registry ever needs an IRB-auditable consent trail or cross-site provenance — typical for
multi-site registry data collection — this is currently a hard gap. SenologieOnFHIR (the closest
sibling IG) models trial enrollment as a first-class `ResearchSubject` profile referencing
`Consent`/`ResearchStudy`.

## Note

Already partially tracked via ADR-0068; this item consolidates it as a harvestable, scoped future
addition rather than a live TODO.

## Related limitations

Both are narrower instances of the missing lineage layer described above, and a single `Provenance`
per submission would close them alongside this item:

- `limitations_items/0004-observation-performer-not-captured/` — no performer on any Observation,
  and "surgeon" survives only as a free-text display string on the Procedure. This item's
  "who/when captured each Observation" gap is the general form of it.
- `limitations_items/0019-extracted-resources-no-provenance-link-to-questionnaireresponse/` — no
  back-reference from an extracted resource to the QuestionnaireResponse it came from. Its own Note
  names "a single `Provenance` per submission" as one of the two candidate fixes.
