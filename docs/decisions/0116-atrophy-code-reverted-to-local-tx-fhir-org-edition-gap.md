# ADR-0116: Revert Atrophy `Observation.code` to a local code — tx.fhir.org's served SNOMED edition doesn't have 1119438000

**Date:** 2026-07-30
**Status:** Accepted

## Context

ADR-0115 migrated `AtrophyObservation.code` from a local `ShoulderObservationCodes`
concept to SNOMED CT `1119438000` "Atrophy of muscle of shoulder", verified at the
time via the project's SNOMED MCP terminology tool. A live `--full` server deploy
(full clean rebuild + reseed + `tools/validate.sh`) surfaced a validator failure on
both longitudinal seed patients' registration bundles:

```
[error] Unknown code '1119438000' in the CodeSystem 'http://snomed.info/sct'
version 'http://snomed.info/sct/900000000000207008/version/20250201'
(International Edition)
```

Confirmed independently via a direct `$lookup` against this IG's pinned terminology
server:

```bash
curl -s "https://tx.fhir.org/r4/CodeSystem/\$lookup?system=http://snomed.info/sct&code=1119438000"
# → OperationOutcome: "Unable to find code '1119438000' in http://snomed.info/sct
#   version http://snomed.info/sct/900000000000207008/version/20250201"
```

Cross-checked against the SNOMED MCP tool's own data (`snomed_get_by_code`), which
still returns the concept correctly (`"Atrophy of muscle of shoulder"`, active,
disorder hierarchy) — so the concept is real and current in SNOMED CT itself. The
discrepancy is that `tx.fhir.org` — the terminology server this IG pins for
`tools/validate.sh` (ADR-0049), HAPI's remote SNOMED delegation (ADR-0050), the
`validator-service` client pre-flight sidecar (ADR-0051), and the IG Publisher build
(ADR-0052) — currently serves the SNOMED CT International Edition dated 2025-02-01,
and `1119438000` was evidently introduced in a later release than that snapshot.

The other four concepts ADR-0115 migrated in the same pass were independently
re-verified live against `tx.fhir.org` and all resolve correctly: `111263009`
(deformity), `57427004` (handedness), `1231437004` (Jobe/empty-can test), `1231510004`
(lift-off test). This is an isolated, single-concept gap, not a systemic problem with
the migration or with `tx.fhir.org` generally.

This is not a cosmetic issue: because `AtrophyObservation.code` is a *fixed* pattern
on the profile, every submission containing an Atrophy finding — via either frontend,
through the `validator-service` client pre-flight (ADR-0051, which blocks on
errors) — would fail the same "Unknown code" check in production, not just in CI.
Left unfixed, this would have silently blocked real clinician submissions of the
Atrophy inspection finding on the live demo.

## Decision

1. **`AtrophyObservation.code` reverted** from `http://snomed.info/sct#1119438000`
   back to `ShoulderObservationCodes#atrophy` (local code, restored — not
   newly invented).
2. **`ShoulderObservationCodes` CodeSystem**: `#atrophy` concept restored (`^count`
   43 → 44); its definition text explains the revert reason inline for future
   readers, distinguishing it from the two visual-inspection axes that never had a
   standard-terminology match at all (`#normal-shoulder-contour`).
3. **`ShoulderObservationCode`**: the `http://snomed.info/sct#1119438000` external-
   code enumeration line removed (already covered by the restored local `#atrophy`
   include).
4. **`frontend/src/types/fhir.ts`** (`OBSERVATION_CODINGS['atrophy']`) reverted to
   the local coding to match.
5. **Both longitudinal seed bundles' registration files** (`anna_mueller_01_registration.json`,
   `kemal_demir_01_registration.json`) reverted their Atrophy `Observation.code.coding`
   back to the local code.
6. **Mapping** (`SECEC_FHIR_Mapping.csv`/`.md`, rows `Q2.a`/`Q9.a`): updated to
   reflect atrophy-local/deformity-SNOMED asymmetry and the revert rationale.
   `Q2.a`/`Q9.a` stay `Full` throughout — Hurley names only "Inspection" with no
   coding-system mechanism specified, so this is a pure terminology-binding detail,
   not a coverage change.
7. **Not deprecating the SNOMED code as "wrong."** `1119438000` remains the correct
   long-term target — this is scoped as a *temporary* revert pending `tx.fhir.org`'s
   served edition catching up, not a rejection of the ADR-0115 finding. A future pass
   should re-run the same `$lookup` and re-migrate once it resolves.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep the SNOMED code, treat the validator failure as an accepted/known gap | Rejected — this isn't just a CI nuisance; the fixed pattern would block real submissions through the production `validator-service` pre-flight (ADR-0051), which runs the identical validator engine against the identical `tx.fhir.org`. A known-broken production data-entry path is not acceptable to ship. |
| Switch `tx.fhir.org` to an explicit newer SNOMED edition version parameter | Attempted (`version=.../20250801`) — `tx.fhir.org` returned "CodeSystem not found: undefined" for that version string; the server does not appear to expose multiple selectable SNOMED editions via this mechanism. Out of scope to investigate further given this IG's existing hard dependency on `tx.fhir.org` specifically (ADR-0049/ADR-0050/ADR-0052). |
| Revert all five ADR-0115 migrations, not just atrophy | Unnecessary — the other four were independently live-verified to resolve correctly against the same `tx.fhir.org` instance; reverting them would discard real interoperability improvements for no reason. |
| Post-coordinate or otherwise work around the missing code | Rejected for the same reasons ADR-0115 itself rejected post-coordination — poor tooling support, and orthogonal to the actual problem (the base concept itself isn't resolvable, coordinating it further doesn't help). |

## Consequences

✅ Closes the two validator `[error]`s found on a live `--full` server deploy
(`anna_mueller_01_registration`, `kemal_demir_01_registration`).
✅ Removes a live production-submission blocker: Atrophy findings can be submitted
through both frontends again without the client-side `validator-service` pre-flight
rejecting them.
✅ Deformity, hand dominance, Jobe test, and lift-off test SNOMED migrations
(ADR-0115) are unaffected and remain live-verified against `tx.fhir.org`.
✅ `sushi .` compiles 0 errors / 0 warnings; frontend `npm run build`/`lint` clean.
⚠️ Reintroduces one local code the project would prefer to retire eventually — tracked
as a revisit item, not closed permanently. `docs/limitations_items/` gets an entry.
⚠️ Surfaces a gap in this project's terminology-verification process: the SNOMED MCP
tool used for "verify before writing" (per this project's own stated policy) draws
from a data source that is evidently ahead of what `tx.fhir.org` actually serves for
validation. Verifying a code exists in SNOMED CT generally is necessary but not
sufficient — it also needs to be live-checked against the *specific* terminology
server this IG's toolchain depends on, ideally as part of the same verification pass
that adds the code, not discovered later during deployment.

## Sources

- Live `tools/validate.sh` output from a `--full` server deploy (2026-07-30):
  `[error] Unknown code '1119438000' in the CodeSystem 'http://snomed.info/sct'
  version '.../20250201'`
- Direct `curl` against `https://tx.fhir.org/r4/CodeSystem/$lookup?system=http://snomed.info/sct&code=1119438000`
  (2026-07-30), reproducing the same "Unable to find code" result
- SNOMED MCP tool (`snomed_get_by_code`), confirming `1119438000` is a real, active,
  correctly-named concept independent of `tx.fhir.org`'s edition gap
- Cross-check of the other four ADR-0115 codes (`111263009`, `57427004`,
  `1231437004`, `1231510004`) via the same `$lookup` mechanism — all resolve
- ADR-0115 (the migration this ADR partially reverts), ADR-0049/ADR-0050/ADR-0052
  (this IG's `tx.fhir.org` pinning), ADR-0051 (`validator-service` client pre-flight,
  the production path this would have blocked), ADR-0084 (prior precedent for a
  documented, real `tx.fhir.org` limitation discovered during live use)
- `ig/input/fsh/profiles/observations/AtrophyObservation.fsh`,
  `ig/input/fsh/codesystems/ShoulderObservation.fsh`,
  `ig/input/fsh/valuesets/ShoulderObservationCode.fsh`,
  `frontend/src/types/fhir.ts`,
  `seed/bundles/{anna-mueller,kemal-demir}/*_01_registration.json`
