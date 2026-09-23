# Migrate belly-press / bear-hug / Hornblower provocation tests to SNOMED CT when procedure concepts are published

> **Status:** Future work item — scoped, not implemented, not approved. Captured 2026-08-25
> after a full SNOMED CT re-check of the three still-local provocation-test codes.

## Gap

Three of the five rotator-cuff provocation tests keep local `ShoulderObservationCodes` codes on
`Observation.code` because SNOMED CT (as served by the FHIR terminology server, verified Aug 2026)
carries no suitable concept:

- **Belly-press test** (`#belly-press-test`, Q2.g / Q9.g) — no SNOMED concept of any kind
  (zero description matches across every domain; also searched *Napoleon test*,
  *abdominal compression test*).
- **Bear-hug test** (`#bear-hug-test`, Q2.h) — no SNOMED concept of any kind.
- **Hornblower test** (`#hornblower-test`, Q2.i) — SNOMED has only the **finding**
  `1231519003` "Hornblower sign", not a **procedure** "Hornblower test". Binding the finding as
  `Observation.code` and then valuing it positive/**negative** is self-contradictory
  (a "sign" already asserts presence), so the local *test* code is retained deliberately to keep
  all five provocation tests on one uniform positive/negative value pattern.

This is a limitation of the current SNOMED CT edition, not of the artifact — the local codes are the
correct, best-available choice. Contrast the sibling tests Jobe (`1231437004` "Empty can test") and
Lift-off (`1231510004` "Lift-off test"), which *do* have published SNOMED procedure concepts; ADR-0115
moved their `Observation.code` to those concepts, taking Q2.e/Q9.e and Q2.f/Q9.f from `Local` to
`Reused` on the code facet. O'Brien, Yocum, Hawkins-Kennedy, Drop-arm, Load-and-shift and other
eponymous shoulder tests are likewise published — belly-press / bear-hug / Hornblower-test are the
notable omissions.

## Why it matters

Standard-terminology bindings are the IG's interoperability value proposition. As long as these three
tests carry local codes, cross-system comparability of subscapularis (belly-press, bear-hug) and
teres-minor / infraspinatus (Hornblower) integrity findings depends on a downstream ConceptMap.

These four rows sit on the terminology frontier, and migrating them would move each of them off it:
Q2.g, Q2.h, Q2.i and Q9.g each carry `Code Provenance = Local` with `Value Provenance = Reused`, so a
migration would flip the code facet to `Reused` and leave them resting entirely on external
terminology. The frontier totals would move with them, from 38 of 58 consensus elements drawing on at
least one local code to 34, and from 17 to 21 elements carried entirely by reused external
terminology. The three elements with no code on either facet are unaffected. Whether that migration
is possible is contingent only on SNOMED CT publishing the concepts.

## Note

Nothing to build now — the trigger is external. When re-checking terminology (see
`0011-terminology-verification-tx-server-check/`), re-query SNOMED CT for a *belly-press test*,
*bear-hug test*, and *Hornblower test* **procedure** concept. If one is published **and** resolves
against `tx.fhir.org`'s served edition (the `0010-atrophy-snomed-code-tx-fhir-org-gap/` caveat):

1. Swap the local `Observation.code` in the affected profile under `ig/input/fsh/profiles/observations/`.
2. Add a new ADR mirroring ADR-0115.
3. In `mapping/SECEC_FHIR_Mapping.csv`, set that row's `Code Provenance` to `Reused` and update its
   `Terminology Binding` and `Notes`. Leave `Value Provenance` unchanged — the `PositiveNegative`
   value binding is a modeling choice, independent of the code axis.
4. Regenerate `mapping/SECEC_FHIR_Mapping.md` from the CSV.
5. Update both frontends' displayed codings, and re-derive the frontier totals wherever they are
   quoted.
