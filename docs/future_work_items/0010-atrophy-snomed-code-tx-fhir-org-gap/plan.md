# Re-migrate Atrophy to SNOMED CT once tx.fhir.org's edition catches up

> **Status:** Future work item — blocked on an external server, not a design gap.

## Gap

ADR-0115 migrated `AtrophyObservation.code` to SNOMED CT `1119438000` ("Atrophy of muscle of
shoulder") — a real, current, correctly-named concept — but `tx.fhir.org`'s pinned SNOMED edition
(2025-02-01 snapshot) doesn't yet serve it. ADR-0116 reverted to a local code pending
re-verification.

## Why it matters

Purely a wait on the external terminology server's data — the correct long-term target code is
already known and documented. Re-migrating later is a one-line profile change plus the same
seed/frontend propagation already done once.

## Note

Periodically re-check via `curl .../CodeSystem/$lookup?system=http://snomed.info/sct&code=1119438000`
against `tx.fhir.org`, and re-apply the ADR-0115 migration once it resolves.
