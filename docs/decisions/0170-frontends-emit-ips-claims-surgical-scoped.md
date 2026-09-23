# ADR-0170: Frontends emit instance-level IPS claims (parity with IG examples); IPS Procedure claim scoped to surgical

**Date:** 2026-08-17
**Status:** Accepted
**Relates to:** ADR-0057/0058/0059/0060 (the IPS instance-level multi-profile posture), ADR-0169 (risk register that logged the parity gap + limitation 0019), ADR-0157 (shared-code sync mechanism), ADR-0033 (`Procedure.category` surgical vs prior-treatment)

> **Numbering note:** the "limitation 0019" referenced throughout this ADR is the *original* `docs/limitations_items/0019-ips-procedure-claim-on-nonsurgical-procedures/`, which was deleted once this ADR resolved it, per the delete-on-resolution policy. The slot has since been reused: `limitations_items/0019-*` today is an unrelated, still-open item about provenance links from extracted resources back to the QuestionnaireResponse. Read every "limitation 0019" below as the resolved original, not the current occupant of that number.


## Context

ADR-0169's review of the EU Core / IPS alignment surfaced two facts about how the
instance-level IPS `meta.profile[]` claims are actually produced:

1. **Parity gap.** The IPS claims (Patient → `Patient-uv-ips`, comorbidity Condition →
   `Condition-uv-ips`, Procedure → `Procedure-uv-ips`, smoking Observation →
   `Observation-tobaccouse-uv-ips`) existed **only in the IG example FSH and the hand-authored
   seed bundles**. Neither demonstrator frontend stamped any IPS profile claim — both emitted only
   the local IG profile in `meta.profile`. So "instances claim IPS conformance" was true of the
   IG's canonical examples but not of what the running system produced. (Verified by grep: zero
   `uv/ips/StructureDefinition` occurrences in either `frontend/src` or `sdc-frontend/src`.)
2. **Over-broad Procedure claim.** In the one place a claim sat on a non-surgical procedure — Anna
   Müller's registration seed — `Procedure-uv-ips` was stamped on the prior physiotherapy and
   injection Procedures, not just surgical ones (logged as limitation 0019).

The user chose to close the parity gap by **propagating the IPS claims to the frontends** (rather
than the cosmetic alternative of narrowing the seed only), so the live demonstrator reproduces the
IG-example IPS conformance end to end, and to apply the surgical-only Procedure scoping while doing
so.

## Decision

- **Add a shared, self-contained helper** `shared/ipsProfiles.ts` (canonical source; synced into
  both frontends by `tools/sync-shared-code.sh` per ADR-0157) exporting `withIpsClaim(resource)`:
  a non-mutating, idempotent function that appends the correct IPS profile canonical to
  `meta.profile[]` when the resource is IPS-eligible, keyed structurally off the local IG profile
  canonical the resource already carries (or, for surgical procedures, the SNOMED CT category code
  `387713003`):
  - `Patient` → `Patient-uv-ips`
  - `Condition` whose local profile is `shoulder-comorbidity-condition` → `Condition-uv-ips`
    (the index `rotator-cuff-condition` and `shoulder-diagnosis-condition` do **not** claim IPS —
    an encounter diagnosis is not an IPS problem-list entry; the ADR-0058 asymmetry, now enforced
    in code)
  - `Procedure` with `category` = surgical (`387713003`) → `Procedure-uv-ips` (prior PT/injection
    Procedures do **not** claim IPS)
  - `Observation` whose local profile is `smoking-status-observation` → `Observation-tobaccouse-uv-ips`
- **Apply `withIpsClaim` at each bundle assembler's choke point** in both frontends — the unified
  `registration/surgery/followUpBundleBuilder.ts` assemblers and the SDC `bundleAssembler.ts`
  `assembleRegistrationBundle/assembleSurgeryBundle/assembleFollowUpBundle`. The follow-up
  assemblers carry no IPS-eligible resource today (no Patient/Condition/Procedure/smoking), so the
  call is a deliberate no-op there — applied uniformly for robustness, not because a follow-up
  visit claims IPS.
- **Scope the IPS Procedure claim to surgical procedures**, in code (via the category check above)
  and in the seed: removed `Procedure-uv-ips` from Anna Müller's registration PT + injection
  Procedures so the seed matches the new frontend behaviour. The IG example
  (`examples/RotatorCuffProcedure.fsh`, category = surgical) and the surgery-bundle seed keep it.
- **Tighten the `RotatorCuffProcedure` profile Description** to state the claim is surgical-scoped
  (was "both index surgical procedures and prior PT/injection").
- **Resolve limitation 0019** (IPS claim on non-surgical procedures) — the scoping is now enforced
  in both frontends and the seed.

## Consequences

- ✅ IPS conformance is now a live property of the running demonstrator, not example/seed-only: a
  registration submitted through either frontend carries `Patient-uv-ips` on the Patient,
  `Condition-uv-ips` on comorbidities, `Observation-tobaccouse-uv-ips` on smoking status; a surgery
  submission carries `Procedure-uv-ips` on the surgical Procedure(s).
- ✅ The ADR-0058 index-vs-comorbidity Condition asymmetry is enforced in code, not just asserted
  in the examples.
- ✅ Surgical-only Procedure scoping removes the semantic over-claim and the latent
  text-only-`code` fragility that limitation 0019 flagged.
- ✅ Both frontends `tsc` + ESLint clean; `sushi .` 0 errors / 0 warnings; seed JSON valid.
- ◽ The IPS claims remain conformance assertions validated by `tools/validate.sh` (IPS 1.1.0
  pinned) — generating an actual IPS summary document is still future work
  (`docs/future_work_items/0023-ips-summary-document-generation`).
- ◽ `withIpsClaim` recognises resources structurally by canonical suffix / category code rather
  than importing each frontend's typed profile constants, so it stays a single shared file with no
  per-frontend divergence; if a local profile id is ever renamed, update the suffix constants here.

## Sources

- `shared/ipsProfiles.ts` (canonical helper)
- `frontend/src/lib/{registration,surgery,followUp}BundleBuilder.ts`
- `sdc-frontend/src/lib/bundleAssembler.ts`
- `seed/bundles/anna-mueller/anna_mueller_01_registration.json` (surgical-only scoping)
- `ig/input/fsh/profiles/RotatorCuffProcedure.fsh` (Description)
- ADR-0169 — EU Core / IPS alignment risk register (logged this gap)
- ADR-0057/0058/0059/0060 — IPS instance-level multi-profile posture
