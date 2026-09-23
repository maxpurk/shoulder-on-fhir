# ADR-0049: FHIR Validator CLI default TX flips from `-tx n/a` to `https://tx.fhir.org/r4`

**Date:** 2026-05-20
**Status:** Accepted; §Decision §4 (fragment retention) amended by ADR-0050. §Consequences' "no SLA / if down" line lightly corrected by ADR-0080 (2026-07-17) — the load-bearing reason for this ADR's decision (SNOMED-in-QuestionnaireResponse hard errors offline) is unaffected and unrelated to that correction.
**Builds on:** ADR-0019 (terminology server strategy), ADR-0024 (FHIR Validator CLI as authoritative offline gate), ADR-0044 (HAPI as pure storage; Validator CLI is the conformance gate), ADR-0048 (`-tx n/a` workaround for the HAPI-as-TX validator-engine crash)
**Amends:** ADR-0048 §Decision §1 (the chosen default TX value); ADR-0019's offline-first stance **for the demonstrator's design-time validator gate only** (runtime / production guidance unchanged)
**Amended by:** ADR-0050 (HAPI now delegates SNOMED resolution to `tx.fhir.org` via `remote_terminology_service`; the local fragment scripts retained by §Decision §4 are retired)

## Context

ADR-0048 (accepted earlier on 2026-05-19) set `tools/validate.sh` to default `TX_SERVER=n/a`. Its §Decision premise was *"the validator does the same thing the validator-via-HAPI did: validate against the enumerated VS members. Nothing meaningful is lost."* That premise turns out to be incomplete.

**The gap.** ADRs 0046 and 0047 (also 2026-05-19) added two ValueSets that participate in `Questionnaire.item.answerValueSet` bindings: `RotatorCuffEtiology` (Q1.e etiology, on `condition.etiology` answer items in all three Questionnaires) and `TendonsInvolved` (Q4 tendon involvement, on `condition.tendons` answer items). The seed bundle's `QuestionnaireResponse` resources fill these with SNOMED-system `valueCoding` answers (`773760007`, `362975008`, `5580002`, `59713001`).

When `validate.sh` runs with `-tx n/a`, validator_cli 6.9.7 special-cases `http://snomed.info/sct` and **refuses** to use the `-ig snomed_fragment.json` workaround for `Questionnaire.answer.valueCoding` bind-checks. Each such answer becomes an error: *"Unable to validate code 'X' in system 'http://snomed.info/sct' because the validator is running without terminology services."* 12 errors total in the seed bundle. The same `-tx n/a` mode validates every other resource cleanly (22/23 pass) and validates SNOMED codes in `Observation.code`, `Condition.code`, `Condition.bodySite`, etc. against the enumerated VS members exactly as ADR-0048 expected. The QR-answer-binding case is the only place the workaround fails — and it's a non-trivial one because QRs are central to the SDC demonstrator (ADR-0040).

**The motivation reconsidered.** ADR-0048's chosen default (`n/a`) was justified almost entirely by ADR-0019's offline-first stance, which was itself motivated by reproducibility and CI hygiene. Neither is load-bearing for a thesis demonstrator: there is no production CI pipeline; examiner reproducibility is satisfied by `git clone && build`; the immediate concrete need is a clean per-resource validation pass without env-var setup.

**The actual ADR-0048 finding stays correct.** Validator 6.9.7 still rejects HAPI as TX server (`TerminologyClientContext.checkFeature` → `TerminologyServiceException: "not approved for use with this software (it does not pass the required tests)"`). That diagnosis is unchanged by this ADR. Only the chosen default is reversed. The HAPI-as-TX bug only fires when `-tx` points at HAPI; `tx.fhir.org` is unaffected.

**What `tx.fhir.org` is.** The official HL7-run terminology server (Grahame Grieve), serving every IG built on `build.fhir.org` and the bulk of FHIR-community development / validation / IG-authoring traffic. HL7's own documentation is explicit that `tx.fhir.org` is *not for production* — that flag fences against hospital deployments using it as their TX backbone, **not** against thesis demonstrators, IG authoring, or validation. It is the textbook fit for this use case.

**The SNOMED fragment becomes redundant.** With the validator no longer using HAPI as TX, HAPI's loaded `CodeSystem/snomed-fragment-shoulder` (54 codes) is no longer needed for the design-time gate. HAPI keeps hosting the IG's ValueSets, but it does that by enumerating the codes already explicitly listed in the FSH ValueSet sources — no SNOMED CT release needs to be loaded. The fragment was specifically the validator-via-HAPI bridge. Removing it simplifies the stack by one seed step.

## Decision

1. **`tools/validate.sh` defaults to `TX_SERVER="${TX_SERVER:-https://tx.fhir.org/r4}"`.** Override via `TX_SERVER=n/a ./tools/validate.sh` to opt back into offline mode (the SNOMED-in-QR-answer limitation is then documented and expected).

2. **ADR-0048 §Decision §1 is amended (not deleted).** Its §Context — diagnosis of the validator-6.9.7-vs-HAPI CapabilityStatement feature-approval crash — remains Accepted. ADR-0048's status header gains an `Amended by ADR-0049` line. Readers follow the audit trail forward.

3. **ADR-0019 is amended for the demonstrator's design-time gate.** Its §Alternatives row that listed `tx.fhir.org` as rejected is qualified: rejected for production / runtime `$expand`; recommended for the demonstrator's design-time validator gate. Production guidance (Snowstorm, Ontoserver) is unchanged.

4. **`seed/load-snomed-fragment.sh` invocation stays in `build-and-deploy.sh`.** Initial intent was to drop it on the reasoning that HAPI's `$expand` would enumerate IG ValueSet members directly. Empirical check (2026-05-20, after `--clean` with the step removed): `rotator-cuff-etiology/$expand` collapsed from 4 → 1 concept (only the local `mixed` survived; 3 SNOMED concepts dropped) and `tendons-involved/$expand` returned an empty expansion. HAPI's `$expand` drops codes whose declared CodeSystem isn't resolvable at the server, even when those codes appear verbatim in `compose.include.concept[]`. Dropping the fragment therefore breaks the frontends' SNOMED-bound dropdowns (Etiology, Tendons Involved, Hand Dominance, Smoking Status, Rotator Cuff Diagnosis, Procedure Type). Step is retained; the four-script deploy pipeline stands.

5. **HAPI `Bundle/$validate` advisory pre-flight changes shape.** Without the SNOMED fragment loaded, HAPI no longer bind-checks SNOMED codes during the frontends' optional pre-flight call. The call is wrapped in `try/catch` and degrades silently per ADR-0044; the operative gate is `tools/validate.sh` against `tx.fhir.org`. This is a feedback-richness loss, not a correctness gap.

6. **Production guidance preserved.** A future deployment that needs a self-hosted TX server (national server, Snowstorm, Ontoserver) is a single configuration change away — HAPI's `custom-terminology-server-url` slot per ADR-0019 / ADR-0044 is the documented hook. ADR-0019's "no public TX as default" stance still applies in those contexts.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep `-tx n/a` default + downgrade offline-SNOMED-in-QR errors to warnings | Papers over the gap. Future real typos in offline mode would look identical to "skipped checks" — a silent-failure mode. ADR-0048's diagnosis stays correct; its conclusion didn't anticipate the QR-answer-binding case, and downgrading errors hides the discovery rather than naming it. |
| Rewrite seed-bundle QRs to use `valueString` instead of `valueCoding` | Weakens the demonstrator's authenticity — the QR resources stop demonstrating what HAPI actually receives from a real SDC form submission. Hides the gap rather than addressing it. |
| Stand up Snowstorm or Ontoserver locally | ~4–8 GB RAM, SNOMED CT RF2 import (~800 MB compressed, 30–60 min), SNOMED license. Already documented in ADR-0019 as the production path; over-engineered for a thesis prototype. |
| Configure HAPI to delegate SNOMED resolution to `tx.fhir.org` (via `hapi.fhir.implementationguides.custom-terminology-server-url` or equivalent) | Adds an HAPI-startup runtime dependency on `tx.fhir.org`; behavior of the pinned 8.8.0-1 image with a remote TX configured needs verification; out-of-scope for this round. Revisitable. The simpler path — drop the fragment, accept the advisory-`$validate` feedback loss — wins on stack simplicity. |
| Pin validator_cli.jar to a pre-6.9.7 version | Locks the project out of newer conformance rules; ADR-0048 already rejected this for the same reason. |

## Consequences

✅ **Clean default `./tools/validate.sh`**: 23 resources / 0 errors / 127 warnings. Examiner clones, runs, gets a green report — no environment variables to set.
✅ **HAPI-as-TX bug sidestepped**: `tx.fhir.org` is not affected by validator 6.9.7's CapabilityStatement feature-approval check.
✅ **Validator side simplifies**: HAPI is no longer load-bearing as the validator's TX. The seed pipeline is unchanged in step count because the SNOMED fragment is still needed for HAPI's `$expand` (see §Decision §4 above).
✅ **Aligned with how the broader FHIR community works**: every IG built on `build.fhir.org`, every reference IG (mCODE, US Core, IPS) uses `tx.fhir.org` for the same role.
✅ **Offline fallback retained**: `TX_SERVER=n/a` still works for plane / air-gapped / `tx.fhir.org`-down scenarios. Limitation (SNOMED-in-QR-answer skip) is documented.
⚠️ **Network dependency at validate-time.** Online dev is fine; offline needs `TX_SERVER=n/a` explicit.
⚠️ **~30–60 s slower** per validate run vs. the offline path (validator round-trips to `tx.fhir.org` for SNOMED concepts).
⚠️ **`tx.fhir.org` has no SLA** (a documented fact about the service, independent of this project's own experience with it) — if genuinely down, or if validating from a network path that can't reach it cleanly (ADR-0080: a VPN with a reduced-MTU tunnel silently stalled longer-lived connections on the developer's own machine, traced and confirmed 2026-07-17 — not a `tx.fhir.org` outage), fall back to `TX_SERVER=n/a` and accept the known SNOMED-in-QR limitation, or run validation on a network path without that constraint (this project's deployment server, per ADR-0080's policy). The fact that the system has a primary online path *and* a documented degraded offline path is a feature, not a bug; both are demonstrable.
⚠️ **HAPI `Bundle/$validate` advisory pre-flight no longer SNOMED-bind-checks.** Frontend feedback quality degrades slightly. The `try/catch` wrapping per ADR-0044 means the frontend continues to submit; the authoritative gate is `tools/validate.sh`.
❌ **Reverses ADR-0048's default decision after one day.** The honest framing is: ADR-0048 fixed the right problem (HAPI-as-TX crash) but chose a default that didn't survive contact with the SNOMED-in-QR-answer case that surfaced in the same session via ADRs 0046/0047. Recording both ADRs side-by-side (with the amendment trail visible) is more honest than retroactively editing ADR-0048.

## Sources

- `tools/validate.sh` — `TX_SERVER="${TX_SERVER:-https://tx.fhir.org/r4}"`; reachability check (already conditional on `!= "n/a"`) applies.
- `build-and-deploy.sh` — `seed/load-snomed-fragment.sh` invocation removed; idempotence-keys list updated.
- the project guide — FHIR Validation section + seed-scripts enumeration (four → three).
- the project guide — validation responsibilities table cell updated.
- Empirical: seed-bundle validation result, `TX_SERVER=https://tx.fhir.org/r4 ./tools/validate.sh --seed-only` → 0 errors / 127 warnings (2026-05-20).
- HL7 documentation on `tx.fhir.org`: "not a production grade system … operational use is not supported by tx.fhir.org."
- Validator version: `FHIR Validation tool Version 6.9.7 (Git# 1ab4fece6bbe). Built 2026-04-23T18:56:07.101Z`.
- ADR-0019 — original "no public TX as default" stance (amended by this ADR for the design-time gate).
- ADR-0024 — Validator CLI as authoritative gate.
- ADR-0044 — HAPI as pure storage; `Bundle/$validate` advisory and non-blocking.
- ADR-0048 — HAPI-as-TX bug diagnosis (retained); `-tx n/a` default (amended by this ADR).
