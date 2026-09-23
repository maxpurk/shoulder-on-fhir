# ADR-0062: Comorbidity typeahead routes to `tx.fhir.org` (SNOMED implicit subset); IPS Problems VS retained as resource-level binding

**Date:** 2026-05-23
**Status:** Accepted (amended 2026-05-23; verified 2026-05-24 — the dual-VS shape is the only architecturally available choice)

## 2026-05-24 verification — IPS canonical also unresolvable via GET

A follow-up review questioned whether the typeahead/binding asymmetry (typeahead returns SNOMED Clinical-finding descendants only; binding additionally includes IPS Absent/Unknown convenience codes like `no-known-problems`) could be closed by pointing the typeahead at the IPS Problems VS canonical and letting `tx.fhir.org` expand it. The §Context note above documented that `POST` of the IPS VS to `tx.fhir.org/r4/ValueSet/$expand` returns 422; it left open whether `GET /ValueSet/$expand?url=<IPS canonical>` would succeed against a server that already hosts IPS.

Tested on 2026-05-24 against `https://tx.fhir.org/r4`:

```
GET /ValueSet?url=http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips
  → 200, Bundle total=0          (tx does not host this VS by canonical)
GET /ValueSet/$expand?url=http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips&filter=diabetes
  → 422 "ValueSet not found"
GET /ValueSet/$expand?url=http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-uv-ips&filter=diabetes
  → 422 "ValueSet not found"
GET /ValueSet/$expand?url=http://hl7.org/fhir/uv/ips/ValueSet/absent-or-unknown-problems-uv-ips
  → 422 "ValueSet not found"
```

`tx.fhir.org` serves SNOMED / LOINC / HL7 terminology but does **not** host IPS VS resources by canonical URL. The premise that "tx hosts IPS" was wrong; the existing SNOMED-implicit-subset workaround is the only architecturally available choice given the deployed terminology servers. Any future move would require either (a) loading the IPS VSs into a TX server we control (Snowstorm/Ontoserver) or (b) a frontend two-source merge (SNOMED implicit + IPS absent/unknown CS lookup) — neither is justified by current UX needs.

**Follow-up (2026-05-24):** a tri-state radio in `StepPatient.tsx` ("Add specific comorbidities" / "No known comorbidities" / "No information available") closes the *UX* gap by giving the clinician explicit access to the two problem-relevant IPS absent/unknown codes (`no-known-problems`, `no-problem-info`). The routing-level asymmetry — typeahead VS is a strict SNOMED subset of the binding VS — remains, but the codes the typeahead cannot reach are now selectable through a dedicated control. New constants in `frontend/src/types/fhir.ts` (`IPS_ABSENT_UNKNOWN`) and a `comorbidityStatus` field on `PatientFormData` carry the state; the registration bundle builder emits exactly one Condition per non-default status.

## 2026-05-23 amendment — same-origin proxy

Manual verification immediately after this ADR landed exposed a follow-up bug. Typing "hyper" in the Comorbidities field returned `TypeError: Failed to fetch` in the UI even though the browser's network panel showed the request to `https://tx.fhir.org/r4/ValueSet/$expand?…` returning **HTTP 200** with a valid JSON body.

**Root cause.** `tx.fhir.org` returns **duplicate** CORS headers:

```
access-control-allow-origin: *
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS
access-control-allow-headers: Origin, X-Requested-With, Content-Type, Accept
access-control-allow-headers: DNT, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Content-Type, Range, Authorization
```

The edge nginx and the Express backend both inject CORS headers. The CORS spec (Fetch §3.5) requires exactly **one** `Access-Control-Allow-Origin` per response; Chromium and Firefox enforce this strictly and drop the response before user code sees it. `fetch()` rejects with the opaque `TypeError: Failed to fetch`. The earlier `curl` verification (this ADR's §Verification step 1) did not surface the issue because `curl` does not enforce CORS.

**Fix.** Route the call through a same-origin proxy. Same-origin responses are not subject to CORS at all, so the duplicate-header issue evaporates.

- `frontend/vite.config.ts` — new `/tx-fhir` proxy entry (target `https://tx.fhir.org`, `rewrite` strips `/tx-fhir` and prepends `/r4`).
- `frontend/nginx.conf` — new `location /tx-fhir/` block (target `https://tx.fhir.org/r4/`, with `resolver`, `proxy_ssl_server_name on`, and a `Host: tx.fhir.org` override for SNI/vhost routing).
- `frontend/src/lib/terminologyService.ts` — default `TX_FHIR_URL` flipped from `'https://tx.fhir.org/r4'` to `'/tx-fhir'`. The `VITE_TX_FHIR_URL` env-var escape hatch remains for direct debugging and for production Snowstorm / Ontoserver targets.

Reporting the duplicate-headers issue upstream to the `tx.fhir.org` maintainers is recommended but out of scope here; the proxy is the durable client-side workaround. The future Snowstorm/Ontoserver migration path is unaffected — the proxy target simply moves to the deployed TX server.

The §Verification step that previously said "request URL goes to `https://tx.fhir.org/...`" is replaced by: **request URL is `http://localhost:3000/tx-fhir/...` (same origin); response has at most one `Access-Control-Allow-Origin` header**.

## Context

ADR-0055 bound `ShoulderComorbidityCondition.code` to the IPS Problems VS (`http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips`) and noted the picker would "expand server-side via tx.fhir.org delegation (ADR-0050)". ADR-0056 closed the runtime gap for the smoking VS by loading the IPS package into HAPI. The implicit claim was that the same fix closed the gap for the Problems VS. Empirical testing on 2026-05-23 disproved that.

**Reproduction.** Open the registration wizard, focus the "Comorbidities (SECEC Q1.c)" typeahead, type `diabetes`. The frontend calls:

```
GET /fhir/DEFAULT/ValueSet/$expand
    ?url=http://hl7.org/fhir/uv/ips/ValueSet/problems-snomed-absent-unknown-uv-ips
    &filter=diabetes&_count=200
```

HAPI returns **HTTP 500** with `HAPI-0888 / HAPI-0702`:

> Unable to expand ValueSet because CodeSystem could not be found: http://snomed.info/sct|http://snomed.info/sct/900000000000207008

**Diagnosis.**

1. The IPS VS composes through `problems-snomed-uv-ips`, which has three `compose.include` blocks of shape `system = http://snomed.info/sct`, `version = …/900000000000207008` (SNOMED International edition), `filter = concept descendent-of <code>`.
2. Expanding a `descendent-of` filter requires walking the SNOMED hierarchy.
3. HAPI has no local SNOMED CodeSystem and falls back to `InMemoryTerminologyServerValidationSupport`, which fails immediately when the CodeSystem is unresolved.
4. HAPI's `remote_terminology_service.snomed` delegation (ADR-0050) only covers code-level operations — `$validate-code`, `$lookup`. It does **not** cover ValueSet expansion with hierarchy traversal. This is the boundary ADR-0055's "zero plumbing" claim and ADR-0056's IPS-package load both elided: smoking is a LOINC LA enumeration (no hierarchy walk needed); the problem-list case requires SNOMED hierarchy traversal.

**What tx.fhir.org does and does not serve.**
- POST `Parameters.valueSet=<IPS VS>` to `tx.fhir.org/r4/ValueSet/$expand` → **422** "ValueSet not found" because tx.fhir.org cannot resolve the chained `include.valueSet` canonicals at expansion time.
- GET `tx.fhir.org/r4/ValueSet/$expand?url=http://snomed.info/sct?fhir_vs=isa/404684003&filter=diabetes&count=5` → **200**, 5 SNOMED concepts returned within ~600 ms. CORS open (`Access-Control-Allow-Origin: *`).

## Decision

1. **Typeahead UX is decoupled from resource-level binding.** The comorbidity picker uses the SNOMED implicit subset URL `http://snomed.info/sct?fhir_vs=isa/404684003` (Clinical-finding descendants), served directly by `tx.fhir.org`. The `Condition.code` element of the bound `ShoulderComorbidityCondition` continues to validate against IPS `problems-snomed-absent-unknown-uv-ips` — every SCT code under `404684003` is by construction inside that VS, so codes picked through the typeahead pass validation.

2. **Frontend dispatcher by URL pattern.** `frontend/src/lib/terminologyService.ts::searchValueSet` keeps a single entrypoint and dispatches by URL pattern: URLs starting with `http://snomed.info/sct?fhir_vs=` go to `tx.fhir.org/r4/ValueSet/$expand`; everything else (local IG VSs, IPS LOINC VSs, etc.) continues to expand against HAPI via `fhirClient.expand`. The tx.fhir.org base is overridable through `VITE_TX_FHIR_URL` for offline / test environments.

3. **Constant rename, not just value swap.** `VALUESET_URLS.IPS_PROBLEMS` → `VALUESET_URLS.COMORBIDITY_TYPEAHEAD`. The old name lied about what the URL pointed to (IPS canonical); the new name describes the role (UX-layer typeahead source). The IPS Problems VS canonical lives where it belongs — in the FSH binding at `ShoulderComorbidityCondition.fsh`, enforced by `tools/validate.sh` + the validator sidecar.

4. **No HAPI config change, no SNOMED fragment.** Reviving `seed/load-snomed-fragment.sh` (retired by ADR-0050) was considered and rejected — the fragment will lag SNOMED releases and the maintenance burden was the original justification for retiring it. Configuring HAPI to delegate VS expansion (not just code-level ops) to a remote TX server is HAPI-Starter undocumented territory and would still fail on the IPS canonical (tx.fhir.org cannot resolve the chained `include.valueSet`).

## Trade-offs

- **Lost from the picker UX:** the small set of SNOMED-CT "absent / unknown problems" modifier codes shipped in the IPS sub-VS `absent-or-unknown-problems-uv-ips` (e.g. "Problem absent", "Problem unknown"). These are rarely needed in a comorbidity list and can still be entered manually if a clinician knows the SCT code; the resource-level binding remains extensible (codes outside `404684003` still validate as long as they are inside `problems-snomed-absent-unknown-uv-ips`).
- **Frontend now talks to two terminology endpoints.** HAPI for local IG VSs (Goutallier, Cofield, payer types, etc.) and IPS LOINC VSs (smoking); tx.fhir.org for SNOMED implicit subsets. This matches the pattern already established by ADRs 0049 / 0050 / 0052 ("tx.fhir.org is our SNOMED authority").
- **Runtime dependency on tx.fhir.org availability for the comorbidity picker.** When tx.fhir.org is down the typeahead returns an error message; the wizard remains usable for non-comorbidity fields. Acceptable for a thesis demonstrator. Production deployments would swap tx.fhir.org for Snowstorm / Ontoserver via the same URL knob.

## Why this does not violate the IPS-binding intent

ADR-0055's intent was that comorbidity Conditions claim IPS conformance and validate against the IPS Problems VS. That intent is preserved:

- `ShoulderComorbidityCondition.code` is still bound extensible to `problems-snomed-absent-unknown-uv-ips` in FSH.
- `meta.profile[]` on each comorbidity instance still claims `Condition-uv-ips` (ADR-0058).
- The validator CLI's `-ig hl7.fhir.uv.ips#1.1.0` pin (ADR-0057) lets validation resolve the IPS VS locally from the package; SNOMED concept presence is then checked against `tx.fhir.org`.

What changes is purely the candidate-list source for the UX layer. The bound resource is unchanged in shape, code, or profile claim.

## Implementation

- `frontend/src/lib/terminologyService.ts` — `searchValueSet` dispatcher; `expandViaTx` helper; `TX_FHIR_URL = import.meta.env.VITE_TX_FHIR_URL || 'https://tx.fhir.org/r4'`.
- `frontend/src/types/fhir.ts` — `VALUESET_URLS.IPS_PROBLEMS` renamed to `COMORBIDITY_TYPEAHEAD`; value swapped to the SNOMED implicit subset URL; comment block rewritten.
- `frontend/src/components/wizard/StepPatient.tsx` — callsite updated; `helpText` rewritten to mention both ADRs (0062 for the typeahead UX, 0055 for the resource binding).
- `frontend/src/hooks/useSnomedTypeahead.ts`, `frontend/src/components/shared/SnomedTypeahead.tsx` — docstrings refreshed.
- `docs/decisions/0062-…md` — this file.
- the project guide — ADR count bumped 62 → 63; notable-ADR line for 0062.

No backend, IG, seed, or validator-CLI changes. No HAPI config change. The IPS VS continues to live in HAPI (loaded by `seed/load-ips-package.sh`, ADR-0056) for any other consumer that wants to fetch it by canonical URL.

## Consequences

- The 500 in the wizard is resolved; the comorbidity picker returns SNOMED matches within ~250 ms (debounce) + ~600 ms (tx.fhir.org).
- The frontend grows a second HTTP endpoint (tx.fhir.org). One TX endpoint added, no HAPI changes, no seed changes — the smallest-blast-radius fix that demonstrably works.
- The HAPI VS-expansion-with-hierarchy-walk limit is now documented (extends the ADR-0050 boundary statement). Future SNOMED-ECL-backed VSs added to the IG should use the same dispatcher pattern.
- ADR-0055's "zero plumbing" framing is retroactively corrected here — the actual plumbing is ADR-0056's IPS-package load (for the smoking VS) plus this ADR's TX dispatcher (for SNOMED-hierarchy VSs).

## Verification

1. `cd frontend && npm run lint && npm run build` → 0 warnings, 0 errors.
2. Open `http://localhost:3000/register`, type "diabetes" in Comorbidities → ~5 SNOMED matches populate from tx.fhir.org (visible in Network panel).
3. `./tools/validate.sh --only=anna_mueller_01_registration` → existing comorbidity Conditions still validate against the IPS binding.
4. `curl 'http://localhost:8080/fhir/DEFAULT/Condition?_sort=-_lastUpdated&_count=1'` after submitting a wizard registration → confirm the new Condition carries a SNOMED `code.coding`.

## References

- ADR-0050 — HAPI remote-TX delegation for SNOMED (code-level ops only)
- ADR-0055 — IPS Problems VS binding on `ShoulderComorbidityCondition`
- ADR-0056 — IPS package load into HAPI (closed the smoking gap; this ADR closes the problem-list gap)
- ADR-0058 — `Condition-uv-ips` multi-profile claim on comorbidity instances
