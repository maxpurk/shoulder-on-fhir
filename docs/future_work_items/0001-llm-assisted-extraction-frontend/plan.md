# LLM-assisted extraction frontend — pre-fill wizards from free clinical text

> **Status:** Future work item — not yet implemented, not yet approved for implementation.
> Captured 2026-07-25. This file is the whole plan: the codebase-verified file paths, the reuse
> points, the architecture, and the open risks are all below.

## Context

Idea: add an LLM-based "autofill from free text" capability to the Shoulder on FHIR registry —
a clinician pastes a clinic note or op report, picks which record type it belongs to
(Registration / Surgery / Follow-up), and the model extracts structured values into the
matching wizard's fields, for the clinician to review and correct before the normal, unchanged
submit path runs. This is exploratory/demonstrative (an HPI master's thesis artifact), not a
production clinical feature, so the design favors a clean, reviewable MVP over enterprise
robustness — consistent with how the rest of this codebase is built.

Decisions already locked when this was scoped:
- **Model hosting — revisited, self-hosted is now the preferred approach.** The design below was
  originally written around the Anthropic API (`claude-sonnet-5` default, `claude-opus-4-8`
  escalation, never `claude-haiku-4-5` — see the Anthropic-API subsection for why). That design
  is kept in full as the documented **fallback / fast-path option** (fastest to a working demo,
  zero new infrastructure). But the **preferred** approach, and the one to build toward, is
  **self-hosted inference** — see "## Model hosting strategy" below for the full reasoning
  (data-privacy: clinical text never leaves infrastructure the researcher controls, which matters
  for any real deployment beyond the synthetic thesis demo, plus no third-party cost/ToS/model-
  deprecation dependency) and the concrete design (inference server, model choice, hardware
  implications).
- **deployment server:** current server is a small instance (CX22/CX32-class, ~2 vCPU / 4–8GB
  RAM) already running HAPI (JVM), Postgres, the `validator-service` JVM sidecar
  (`mem_limit: 2g`), two nginx frontends, and Caddy. **This assumption differs by hosting choice:**
  the Anthropic-API fallback path does no local inference (just outbound HTTPS calls) so it needs
  no hardware change; the preferred self-hosted path needs either a GPU-backed instance or an
  accepted CPU-only latency tradeoff — see "## Model hosting strategy" below. Verify actual
  headroom (`free -h`, `docker stats`) on the box before deploying either way.
- **Delivery shape:** a genuinely **standalone third frontend** (not a route bolted onto the
  existing unified frontend) — paste text, pick a record type, get a prefilled review, then hand
  off into the existing wizard for final clinician review + submit.

## Verified facts (do not re-derive when picking this up)

- **Surgery wizard form-state is inline, not a `stepFormData.ts` sibling** — `EncounterFormState`
  lives in `frontend/src/components/surgery/SurgicalEventStep.tsx`,
  `ProcedureFormState`/`SurgicalProcedureFormItem` in
  `frontend/src/components/surgery/SurgicalEventStep.tsx`.
- **Registration** form-state: `frontend/src/components/wizard/stepFormData.ts`
  (`PatientFormData`, `ConditionFormData`, `ImagingFormData`, `ClinicalAssessmentFormData`,
  `OutcomeScoresFormData`, each with a `createInitial*` factory).
- **Follow-up** form-state: inline in `frontend/src/components/followup/FollowUpWizard.tsx`
  (`Q9FormState`/`Q12FormState`), field catalog driven by
  `frontend/src/config/followupObservationMetadata.ts`.
- **Terminology reuse points:** `frontend/src/lib/terminologyService.ts` (`expandValueSet()` for
  closed VSs, `searchValueSet()` with `excludeValueSetUrl` for the SNOMED comorbidity typeahead),
  `frontend/src/lib/fhirClient.ts` `expand()` (empty-result→`GET /ValueSet?url=` fallback,
  ADR-0063), `frontend/src/types/fhir.ts` (`VALUESET_URLS`, ~24 entries; `COMORBIDITY_TYPEAHEAD`
  is the *only* large/hierarchical one), `frontend/src/config/observationMetadata.ts` +
  `followupObservationMetadata.ts` (`valueType`/`unit`/`min`/`max`/`valueSetUrl` per field),
  `frontend/src/lib/profileBounds.ts` (numeric bounds).
- **Sidecar precedent:** `validator-service/src/ValidatorServer.java` (266 lines, plain
  `com.sun.net.httpserver`) — `/health` + one action endpoint, loopback-only wide-open CORS,
  bounded worker pool separate from HTTP dispatch, per-call timeout, SHA-256 single-flight
  dedup, `mem_limit`/`JAVA_OPTS` capped in compose. Client wrapper pattern:
  `frontend/src/lib/preflightValidate.ts` (typed result union, one cold-start retry).
- **Ports** (all `127.0.0.1`-only today): HAPI `8080`, validator-service `3500`, unified frontend
  `3000`, SDC frontend `3001`. `3002`/`3003` are free (former LHC-forms / follow-up-frontend,
  both retired). → new frontend on **3002**, new sidecar on **3600**. (Re-verify these are still
  free before implementing — the repo evolves.)
- **Anthropic API** (verified against the Anthropic API documentation as of 2026-07-25, not from
  memory — re-verify at implementation time since models/pricing change): `claude-sonnet-5` /
  `claude-opus-4-8` are the exact model IDs. Structured outputs via
  `output_config: {format: {type: 'json_schema', schema}}` on `@anthropic-ai/sdk`'s
  `messages.create()`/`messages.parse()` — JSON-schema `enum` is honored and hard-constrains
  output; **numeric `minimum`/`maximum` are NOT supported in the schema**, which is fine because
  the existing client-side bounds (`profileBounds.ts`) already do that clamping on the wizard
  side. `thinking: {type:'adaptive'}` (Sonnet 5 runs adaptive by default when omitted, but set it
  explicitly), `output_config.effort`. Prompt caching: render order is
  `tools → system → messages`; put `cache_control: {type:'ephemeral'}` on the last stable block.

## Model hosting strategy: self-hosted (preferred) vs. Anthropic API (fallback)

**Self-hosting is the preferred approach.** The reasoning: the whole point of this feature is
running free clinical text through a model. Even though the current demo only ever uses
synthetic seed data, the design should not casually depend on shipping real clinic notes/op
reports to a third-party API as its default posture — for any deployment beyond the thesis demo,
that's a real data-residency/GDPR-adjacent concern for a clinical registry, and self-hosting
removes it entirely (the text never leaves infrastructure the researcher/deployer controls). It
also removes the recurring per-call API cost and any dependency on a third party's uptime, terms
of service, or model deprecation schedule. The Anthropic API design already fully specified below
remains valuable and is kept as the **documented fallback** — the fastest path to a working
proof-of-concept, with zero new infrastructure, useful for validating the extraction UX before
investing in self-hosted infra, or as a fallback if self-hosting proves impractical for this
project's timeline.

### Self-hosted design

**Inference server.** Two realistic options:
- **vLLM** — an OpenAI-compatible inference server with native "guided decoding" (via `outlines`,
  `lm-format-enforcer`, or `xgrammar` backends): pass a JSON schema and it constrains generation
  token-by-token to match it, including `enum` fields. This is the direct self-hosted equivalent
  of the Anthropic API's `output_config.format` — **the closed-ValueSet-as-hard-enum-constraint
  safety design in this plan carries over unchanged**, just pointed at a local server instead of
  `api.anthropic.com`. Better throughput/latency, GPU-oriented.
- **Ollama / llama.cpp** — simpler to operate (single binary, `ollama pull <model>`), supports
  GBNF grammar-constrained decoding (also capable of enforcing a JSON schema/enum), and has a
  much better CPU-only story than vLLM. The pragmatic pick if avoiding a GPU entirely.

Either way, the *rest* of the sidecar design in "## Architecture" below is unchanged — resilience
pattern, ValueSet fetching, two-stage comorbidity resolution, `/extract` + `/extract/draft/:id`
contract, docker wiring, and the frontend hand-off are all backend-agnostic. Only `anthropic.ts`
changes shape: it becomes e.g. `llm.ts`, calling the local inference server's HTTP API instead of
the Anthropic SDK.

**Model choice.** Do not treat any specific model name below as a final pick — open-weight model
quality shifts constantly, and this plan was written mid-2026. At implementation time, benchmark
2–3 current open-weight instruction-tuned models on the actual extraction task (structured JSON
output + negation handling on realistic synthetic notes) before committing. Reasonable starting
candidates to evaluate, as families rather than fixed versions: **Meta Llama** (3.x/4.x line),
**Mistral/Mixtral**, **Qwen** (2.5/3.x line — historically strong at structured/JSON tasks per
public benchmarks). A medical-domain fine-tune may or may not outperform a strong general model
with good prompting for this specific task (closed-enum-constrained field extraction, not free-
form clinical reasoning) — evaluate rather than assume a medical fine-tune is automatically
better.

**Hardware implications (the real cost of "preferred").** This is a materially bigger
infrastructure decision than the Anthropic-API fallback, and should be made with eyes open:
- **GPU path:** a quantized 7–8B parameter model (4-bit GGUF/AWQ) is the realistic smallest-viable
  tier for decent latency, needing roughly a 12–16GB-VRAM-class GPU; a 70B-class model needs
  materially more (24GB+ VRAM at 4-bit, or multi-GPU). This means provisioning a new GPU-backed
  server — a bigger cost and setup step than the current CX22/CX32 box, and something to size and
  price at implementation time (GPU offerings and pricing change; verify current remote GPU
  options, or consider another provider, rather than assuming availability).
- **CPU-only path:** given this feature's workflow — the clinician pastes text, waits, then
  reviews a prefilled form — is inherently async/reviewed rather than a real-time chat, a CPU-only
  deployment of a small quantized model (e.g. via llama.cpp on the existing box or a modest RAM
  upgrade) is a genuinely plausible fit, accepting materially higher latency (potentially tens of
  seconds to a couple of minutes per extraction) in exchange for staying within the project's
  existing "small box, no GPU" hardware philosophy. This is the path most consistent with not
  needing a hardware upgrade, at the cost of a slower — but still workable — user experience.
- Either sub-path is a new infra decision distinct from the Anthropic-API fallback's "no hardware
  upgrade needed" assumption in the Context section above — confirm the tradeoff (latency vs.
  hardware spend) explicitly before implementation.

### Anthropic API (documented fallback)

Kept below in full in "## Architecture" — model IDs, structured-outputs mechanics, prompt
caching, resilience pattern, everything. Useful as a faster first proof-of-concept, or if
self-hosting turns out impractical given the thesis timeline.

## Architecture

### 1. Backend sidecar — `extraction-service/` (port 3600)

> This section is written against the **Anthropic API fallback path** (see "## Model hosting
> strategy" above) since that's the fully-specified design. Everything here except the
> `anthropic.ts` module (§1.4) — the endpoints, ValueSet fetching, comorbidity two-stage
> resolution, resilience pattern, and docker wiring — is backend-agnostic and applies unchanged
> to the preferred self-hosted path; only the model-calling module differs (a vLLM/Ollama HTTP
> client instead of `@anthropic-ai/sdk`, using guided/grammar-constrained decoding for the same
> enum-safety guarantee).

**Node.js 20 + TypeScript, plain `node:http` (no framework), `@anthropic-ai/sdk`.** The Java
precedent (`validator-service`) is Java because it wraps `validator_cli.jar` — the JVM is
load-bearing there. This service does no local computation at all (pure HTTP proxy to Anthropic
+ HAPI + tx.fhir.org), so a third JVM on an already memory-constrained box buys nothing; Node's
footprint for this is ~60–100MB baseline, capped at `mem_limit: 512m`.

**Endpoints:**
- `GET /health` → `{"status":"ok"}` (compose healthcheck).
- `POST /extract` — body `{recordType: 'registration'|'surgery'|'followup', text: string, model?: string}`.
  Returns a typed union mirroring `preflightValidate.ts`'s style:
  ```json
  { "kind": "ok", "draftId": "<short-lived id>", "draft": { /* matches target formData shape */ },
    "provenance": { "<field>": { "confidence": "high"|"medium"|"low" } },
    "warnings": ["<unmapped comorbidity phrases, out-of-range numbers, etc.>"] }
  ```
  or `{"kind":"unavailable", "message": "..."}` / `{"kind":"error", "message": "..."}`. Any
  non-`ok` result means "extraction unavailable — fill the form manually," never a blocker.
- `GET /extract/draft/:draftId` — **the cross-origin hand-off mechanism** (see below): returns
  the same draft once, then deletes it. In-memory `Map<id, {draft, expiresAt}>` with a short TTL
  (~10 min) and single-use semantics — no new storage layer, reuses the same process the
  single-flight dedup already needs.

**Cross-origin hand-off:** since this is a genuinely standalone frontend on its own port/origin,
`sessionStorage` can't carry the draft from `extraction-frontend` (3002) to the unified
`frontend` (3000) — different origins. Rather than cramming the draft into a URL fragment
(size-limited, awkward for a multi-field Registration draft) or standing up a second storage
layer, **the sidecar itself is the hand-off point**: `extraction-frontend` calls `POST /extract`,
gets back `draftId`, and redirects the browser to `frontend`'s existing route with just the id —
e.g. `http://localhost:3000/register?draftId=abc123&fromExtraction=1`. The unified frontend gets
one new small proxy (`/extract-sidecar` → `extraction-service:3600`, exactly mirroring its
existing `/validate-sidecar` block) and the wizard fetches
`GET /extract-sidecar/draft/abc123` once on mount to hydrate its initial state. Clean, no
fragment-size limits, no duplicate infrastructure — both frontends already need a proxy to this
sidecar anyway.

**ValueSet enum fetching (closed-set fields):** the sidecar re-implements the same two HTTP
shapes `fhirClient.expand()` uses — `$expand` against HAPI over the docker network
(`http://hapi-fhir:8080/fhir/DEFAULT/ValueSet/$expand?url=...`) with the empty-result→
`GET /ValueSet?url=` fallback (ADR-0063) — rather than importing the browser-oriented
`terminologyService.ts` directly. ~23 closed VSs (Patte, Goutallier, Cofield, satisfaction,
sports participation, employment status, workers' comp, hand dominance, laterality, etiology,
tear-location, procedure type, present-absent, IR-vertebral-level, smoking, etc.), fetched and
cached in-process at startup, each becoming a hard JSON-schema `enum` in the extraction request —
the model **cannot** emit a code outside the list.

**The one hierarchical VS (comorbidity SNOMED):** two-stage, never trusting the LLM with a raw
code. The LLM does named-entity extraction only — emits plain phrases (`"hypertension"`,
`"type 2 diabetes"`) into a `comorbidityPhrases: string[]` field. The sidecar then runs each
phrase through the same `tx.fhir.org $expand?url=<COMORBIDITY_TYPEAHEAD>&filter=<phrase>` call
the browser typeahead uses, with the same ADR-0084 `excludeValueSetUrl` shoulder-region
exclusion, and returns resolved `{code, display, system}` entries. Unmatched phrases go into
`warnings[]` for manual entry.

**Quantity fields** (ROM degrees, pain 0–10, Constant sub-scores): the LLM just extracts a plain
number; the existing `min`/`max` bounds clamp/validate once the draft lands in the wizard,
exactly like manual entry.

**Resilience** (lighter mirror of `validator-service`): small in-process concurrency semaphore
(2–4 concurrent Anthropic calls, protecting the Anthropic rate limit and outbound sockets, not
local heap), per-call timeout via `AbortController` (`EXTRACT_TIMEOUT_SECONDS`, default ~60s) →
clean 503 on timeout, SHA-256 single-flight dedup on `(recordType+text+model)`, wide-open
loopback-only CORS. The SDK's own retry (429/5xx) covers transient Anthropic errors.

**Prompt caching:** one stable "extraction schema block" per record type (frozen instructions +
the closed-enum tables) gets the `cache_control:{type:'ephemeral'}` breakpoint on its last block;
only the free-text note (varies every call) goes after it in `messages`. Repeat calls of the same
record type read the schema at ~0.1x cost — verify via `usage.cache_read_input_tokens > 0` across
two calls.

**`docker-compose.yml`:**
```yaml
extraction-service:
  build: { context: ., dockerfile: extraction-service/Dockerfile }
  container_name: shoulder-extraction
  restart: unless-stopped
  ports: [ "127.0.0.1:3600:3600" ]
  environment:
    - PORT=3600
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - EXTRACTION_MODEL=claude-sonnet-5
    - HAPI_BASE=http://hapi-fhir:8080/fhir/DEFAULT
    - TX_FHIR_BASE=https://tx.fhir.org/r4
    - EXTRACT_TIMEOUT_SECONDS=60
    - EXTRACT_CONCURRENCY=3
  mem_limit: 512m
  depends_on: { hapi-fhir: { condition: service_started } }
  healthcheck: { test: ["CMD","wget","-qO-","http://localhost:3600/health"], interval: 10s, timeout: 5s, retries: 6, start_period: 20s }
  networks: [ shoulder-network ]
```
Multi-stage Dockerfile mirroring the frontend Dockerfiles: `node:20-alpine` builder (`npm ci`,
`tsc`) → `node:20-alpine` runtime (`npm ci --omit=dev`, `CMD ["node","dist/server.js"]`). No JVM.

### 2. New frontend — `extraction-frontend/` (port 3002)

Standalone Vite/React/Tailwind app, HPI-branded identically to the other two (copy
`tailwind.config.js`, `index.css`, `/hpi-logo.png`, the `App.tsx` header shell verbatim — do not
diverge from the existing scientific styling).

- **Landing/paste page** — a large textarea for the free clinical note, a record-type selector
  (Registration/Surgery/Follow-up), an "Extract & Review" button, an optional advanced model
  toggle (Sonnet 5 default / Opus 4.8 escalation).
- **Extract action** — `extraction-frontend/src/lib/extractDraft.ts`, a thin client wrapper
  modeled on `preflightValidate.ts` (cold-start retry, typed result union), POSTs to
  `/extract-sidecar` (nginx-proxied to `extraction-service:3600`). On `kind:'ok'`, redirects to
  the unified frontend's real route with `?draftId=...&fromExtraction=1`. On any non-ok, shows a
  yellow banner ("Extraction unavailable — fill the form manually") — never blocks manual use —
  with a direct link to the plain wizard.
- **Draft shapes per record type** (generated from the field catalogs in the "Verified facts"
  section above, not hand-duplicated):
  - Registration → `{patient, condition, imaging, assessment, outcomeScores}` matching
    `stepFormData.ts`'s interfaces; comorbidities pre-resolved to `ComorbidityCoded[]`.
  - Surgery → `{encounter, procedure}` matching the inline `EncounterFormState`/
    `ProcedureFormState`. **Surgery starts with a `PatientLookup`** — the LLM cannot invent a
    Patient/Condition, so only encounter+procedure fields pre-fill; the clinician still looks up
    the patient manually.
  - Follow-up → `{q9, q12}` keyed by `followupObservationMetadata`'s field keys. Same caveat:
    patient lookup + timepoint pick stay manual.

### 3. Minimal, additive changes to the existing unified `frontend/`

- `frontend/nginx.conf` + `vite.config.ts` — add an `/extract-sidecar` proxy block to
  `extraction-service:3600`, mirroring the existing `/validate-sidecar` block.
- `frontend/src/lib/fetchExtractionDraft.ts` — new, tiny: `GET /extract-sidecar/draft/:id` once,
  typed per record type.
- `RegistrationWizard.tsx` / `SurgeryWizard.tsx` / `followup/FollowUpWizard.tsx` — each gains a
  small "if `?draftId=` present, fetch once and seed the existing `useState` initializers instead
  of the `createInitial*` defaults" branch. This is the natural injection point — the state
  already lives there, and every existing review/validate/submit step is completely untouched.

### 4. Infra wiring

- `docker-compose.yml` — add `extraction-service` (§1) and `extraction-frontend` (mirroring the
  existing `frontend`/`sdc-frontend` service blocks: multi-stage Dockerfile, `127.0.0.1:3002:80`,
  `depends_on` hapi + extraction-service).
- `docker-compose.prod.yml` / `deploy/Caddyfile` — add a new `{$EXTRACTION_DOMAIN}` block (copy
  the existing `{$DOMAIN}` block: Basic Auth + `reverse_proxy extraction-frontend:80`), add
  `EXTRACTION_DOMAIN` to Caddy's env and `deploy/.env.prod.example`.
- `deploy/.env.prod.example` — add `ANTHROPIC_API_KEY=` with a comment identifying it as the
  extraction sidecar's outbound key. Never committed; the `git subtree split` mirror-repo deploy
  flow (ADR-0072) must not carry a real key.
- `build-and-deploy.sh` — register `extraction-service` and `extraction-frontend` in the
  build/rebuild-frontends service lists.

## Alternative frontend-independence designs (considered, deferred)

The design in §2/§3 above — a thin `extraction-frontend/` that redirects into `frontend/`'s real
wizards via a `draftId` hand-off — was the one chosen for this plan. Two alternatives came up in
discussion and were explicitly deferred, not ruled out; worth revisiting if standalone
independence from `frontend/` turns out to matter more than avoiding duplication.

**Option B — fully standalone `extraction-frontend/`, zero dependency on `frontend/`.** Give the
extraction frontend its own complete wizard UI (all fields, review, submit), so paste-text →
prefilled-and-editable form happens entirely within `extraction-frontend/` with no changes to the
unified frontend at all — no redirect, no `draftId`, no proxy addition on the `frontend/` side.
This is technically straightforward, but it means duplicating the entire Registration/Surgery/
Follow-up UI — `StepPatient`, `StepCondition`, `StepImaging`, `StepClinicalAssessment`,
`StepOutcomeScores`, the Surgery/Follow-up equivalents, the `*BundleBuilder.ts` files, and the
validator-preflight wiring — into a second codebase. Given how frequently this project's forms
change (dozens of ADRs touching fields over its history), that is not a one-time cost: every
future field/ValueSet change would need to land in two places to stay in sync. This is exactly
the kind of duplication the project has otherwise avoided — even the SDC frontend, a genuinely
different extraction paradigm, does not copy-paste the unified frontend's step components.

**Option C — shared-package reuse (the "clean" version of Option B).** Turn `frontend/` and
`extraction-frontend/` into a small workspace (npm/pnpm workspaces) with the wizard step
components pulled into a shared package, so `extraction-frontend/` imports and renders the
*real* `StepPatient.tsx` etc. directly, fed by the extraction draft as initial props. This gets
full runtime independence (no redirect, no `draftId`, no cross-origin hand-off at all) *without*
duplicating any logic — the single source of truth for each field stays exactly one file. The
cost is a heavier one-time investment: workspace tooling setup, and refactoring the wizard steps
so they no longer assume they're only ever mounted inside `frontend/`'s own state layout.
Architecturally this is the "right" way to get both independence and zero duplication, but it is
more setup than warranted for a first-pass thesis demo.

**Option D — no separate frontend at all: an `/assist` route inside the unified `frontend/`.**
Mount the paste-text-and-extract UI as one more page in the existing app rather than as its own
build. The draft hand-off then needs no cross-origin plumbing: the extracted values go into
`sessionStorage` and a client-side `navigate('/register?fromExtraction=1')` opens the real wizard
with them, same origin, same React tree. Nothing new is deployed except the sidecar, so the third
Vite build, the third nginx image, port 3002 and the extra Caddy block all disappear. The cost is
that the extraction UI is no longer separable from `frontend/`, which is the one property a
standalone third frontend buys. This is the cheapest path to a working demonstration by a wide
margin, and it is the option to weigh first against the standalone shape in §2/§3.

**Recommendation if this item is picked up:** start with the current plan's thin hand-off
(§2/§3) — least implementation risk, zero duplication, fastest path to a working demo. Revisit
Option C only if true standalone independence (no runtime dependency on `frontend/` being
deployed/available) turns out to matter more than the workspace-refactor cost it requires, and
weigh Option D first if the standalone requirement can bend at all.

## Critical files

| File | Role |
|---|---|
| `extraction-service/src/server.ts` | `node:http` server: `/health`, `/extract`, `/extract/draft/:id`; CORS, semaphore, `AbortController` timeout, single-flight dedup |
| `extraction-service/src/anthropic.ts` | Builds the per-record-type request (cached schema block + enum tables + adaptive thinking), calls `@anthropic-ai/sdk`, returns typed draft+provenance |
| `extraction-service/src/terminology.ts` | Server-side `expandValueSet()` (HAPI, ADR-0063 fallback) + `searchComorbidity()` (tx.fhir.org, ADR-0084 exclusions) |
| `extraction-service/src/schema.ts` | Builds each record type's JSON schema from the field catalogs; enum *values* fetched live from HAPI so VS changes propagate automatically |
| `frontend/src/components/wizard/stepFormData.ts` | Registration draft shape source of truth |
| `frontend/src/components/surgery/SurgicalEventStep.tsx` | Surgery draft shape source of truth (inline, not a sibling file — verified) |
| `frontend/src/config/observationMetadata.ts` + `followupObservationMetadata.ts` | Field types/units/bounds/`valueSetUrl` — drives both the schema and numeric clamping |
| `frontend/src/lib/terminologyService.ts`, `fhirClient.ts` | The `$expand` mechanism the sidecar re-implements server-side |
| `validator-service/src/ValidatorServer.java` | Resilience precedent (mirrored at lighter weight, not literally reused) |
| `docker-compose.yml`, `docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/.env.prod.example`, `build-and-deploy.sh` | Infra wiring |

## Verification (once implemented)

1. `docker compose ps` shows `extraction-service` + `extraction-frontend` healthy;
   `curl 127.0.0.1:3600/health` → ok.
2. **Sidecar smoke test** (no browser): POST a synthetic Registration note ("62yo right-handed
   male, ex-smoker, carpenter, traumatic onset, full-thickness supraspinatus tear, Goutallier 2,
   Patte II, denies numbness, no night pain") to `/extract`. Assert every closed-enum value is a
   real member of that field's `$expand`ed set (script the check against HAPI), numeric fields
   are plain numbers, comorbidities resolve to real SNOMED codes or land in `warnings`, and the
   negations produce **no** false-positive findings.
3. **Enum-safety check:** feed a note with a plausible-but-invalid value ("Patte grade IV" —
   doesn't exist) and confirm the model returns a valid member or omits the field — never an
   out-of-enum code.
4. **Cache-hit check:** call `/extract` twice for the same record type; confirm the second
   response's `usage.cache_read_input_tokens > 0`.
5. **Browser end-to-end:** paste → Extract on `extraction-frontend` → redirected into
   `frontend`'s real wizard with fields visibly pre-filled and fully editable → walk to review →
   confirm the existing "Clinician judgment required" banner and the validator-service pre-flight
   gate (ADR-0051) still run unchanged → confirm nothing was POSTed to HAPI until the real submit
   click.
6. **Surgery/Follow-up:** repeat with an op-report / follow-up note; confirm patient lookup +
   timepoint stay manual, only encounter/procedure/observation fields pre-fill.
7. **Degraded path:** stop `extraction-service`; confirm `extraction-frontend` shows the
   "unavailable — fill manually" banner with a working link to the plain wizard.
8. **server footprint:** `free -h` + `docker stats extraction-service extraction-frontend` —
   confirm comfortably under 512MB combined, no hardware change needed.

## Known risks (not blockers, worth remembering)

- **Schema drift:** the extraction schemas derive from `stepFormData.ts` + the observation-
  metadata catalogs + `VALUESET_URLS`. This repo's ADRs change these constantly — enum *values*
  are fetched live from HAPI so VS changes auto-propagate, but field *shape* changes
  (new/renamed fields) require updating `schema.ts` by hand. Worth a startup sanity log listing
  the fields per record type.
- **Cost:** negligible for a demo — a warm-cache Sonnet 5 call is well under $0.05; Opus 4.8
  escalation ~1.7x that. Still, use a low-limit `ANTHROPIC_API_KEY`.
- **tx.fhir.org dependency:** the comorbidity two-stage resolution hits `tx.fhir.org`. Per this
  project's own ADR-0080, that call can stall over a local VPN — so comorbidity resolution
  should be tested on the deployment server, not the local dev machine, matching the project's existing
  TX-testing policy.
- **Self-hosting (the preferred path) is a bigger lift than the Anthropic-API fallback:** it needs
  new infrastructure (a GPU instance, or an accepted CPU-only latency tradeoff — see "## Model
  hosting strategy"), an inference-server ops burden this project doesn't currently carry (vLLM
  or Ollama/llama.cpp), and open-weight models generally need more validation before trusting
  their structured-output/negation-handling reliability compared to a frontier hosted model —
  budget real evaluation time (the enum-safety and comorbidity-two-stage architecture is
  preserved regardless of backend, but "the model picks the right enum value" still needs to be
  re-verified per model choice, same as the Anthropic-API path's own enum-safety verification
  step).

## Before starting implementation

This plan has NOT been approved for implementation — it was captured as a future work item.
Re-verify the "Verified facts" section (ports, file locations, Anthropic model IDs/pricing)
against the live codebase before writing any code, since this project's ADRs and file layout
change frequently.
