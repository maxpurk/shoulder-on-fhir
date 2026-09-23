# Shoulder on FHIR

A FHIR R4 Implementation Guide and supporting system for standardized documentation of rotator cuff injuries and surgical treatments in research registries. Developed as a master thesis artifact at Hasso Plattner Institute (HPI).

## Overview

- **FHIR Implementation Guide (IG)** — 14 base profiles (including the three transaction-bundle profiles for the registry workflow and the abstract `ShoulderObservation`) plus 57 derived observation child profiles, 20 CodeSystems, 35 ValueSets; hand dominance is captured as a derived `HandDominanceObservation` (ADR-0026), not a Patient extension. Built with FSH/SUSHI.
- **Three bundle profiles** (ADR-0034) following the SECEC consensus three-phase model (Hurley et al. 2024):
  - `RotatorCuffRegistrationBundle` — pre-operative submission (T0): Patient + Condition + baseline PROMs + imaging + prior PT/injection
  - `RotatorCuffSurgeryBundle` — surgical event (T1): Encounter + Procedure(s) + intra-op Observations
  - `RotatorCuffFollowUpBundle` — per-visit follow-up (5× Q11 timepoints): Encounter + Q9 exam + Q12 PROMs
- **HAPI FHIR Server** — R4, multitenancy enabled (`/fhir/DEFAULT`), runs as a storage server (request-time validation disabled per ADR-0031; conformance is gated by `tools/validate.sh`)
- **Unified Frontend** — Single React app at port 3000 with a landing page and three flows: `/register`, `/surgery`, `/follow-up`. Built with typed FHIR builders, each flow targets the corresponding bundle profile. Patient lookup is shared between the Surgery and Follow-Up flows. (`frontend/`, ADR-0035)
- **SDC Frontend** — The guide-aware SDC client, built against **HL7 SDC IG v4.0.0** (adopted as v3.0.0 by ADR-0040, bumped 2026-05-21, doc-drift fixed by ADR-0102). It renders the three definition-based Questionnaires (Registration / Surgery / Follow-Up) that match the three-bundle architecture; client-side `$extract` walks `item.definition` URLs plus the group-level extraction context to produce typed resources, and `bundleAssembler.ts` wires the cross-resource graph. It reads the retired `itemExtractionContext` extension rather than `definitionExtract`, which is the one reason those three forms still declare it ([future_work_items/0003](docs/future_work_items/0003-sdc-stu4-definitionextract-migration/plan.md)). Demonstrates `calculatedExpression` (Constant-Murley total) and `launchContext` + `itemPopulationContext` (Surgery / Follow-Up pre-fill). (`sdc-frontend/`, port 3001).
- **Generic SDC Filler** — A form filler holding no knowledge of this guide: it lists whatever Questionnaires the server offers, renders them, and extracts a transaction Bundle using only the declarations each Questionnaire carries. It reads both extraction mechanisms and chooses per form, so a template-extracted Bundle is labelled with the bundle profile it claims; either way the result is checked against a profile chosen at runtime before submission. It also honours what a form says about itself: which resources it wants handed to it at launch, the batch of queries it wants run before it is drawn, what to seed from either, which questions depend on earlier answers, which answers are required and where that is owed, which groups may occur more than once, what a value may range over, and what is computed rather than asked. It holds no address either — the FHIR, terminology and validator endpoints are set at runtime, so the same build can be pointed at any R4 server serving Questionnaires. Its engines are tested against the examples HL7 ships with the SDC specification, not only against this guide's forms. (`sdc-generic-frontend/`, port 3002, ADR-0192)
- **LHC-Forms Filler** — The same Questionnaires through the US National Library of Medicine's LHC-Forms, an independently written SDC implementation. A portability check against an engine nobody here controls. (`sdc-lforms-frontend/`, port 3003)
- **Seed Data** — Two longitudinal example patients (Anna Müller — degenerative, statutory insurance; Kemal Demir — traumatic, workers' compensation), each with a narrative walkthrough in `example_data/` and transaction bundles in `seed/bundles/` (auto-loaded by `build-and-deploy.sh`)
- **SECEC→FHIR mapping** — Authoritative element mapping in `mapping/` (all 58 expert consensus elements representable, 0 Missing; each classified by two-facet code/value terminology provenance — reused external code vs. local CodeSystem)

## Quick Start

### Prerequisites
- [Docker](https://www.docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) 20+ (for frontend development)
- [SUSHI](https://github.com/FHIR/sushi): `npm install -g fsh-sushi`
- Java (for IG Publisher / `_genonce.sh`)

### Full Build + Deploy

```bash
# From the repository root
./build-and-deploy.sh                       # warm restart (everything idempotent-skips, ~30 s)
./build-and-deploy.sh --clean               # full nuke: docker compose down -v + everything reloaded
./build-and-deploy.sh --reload-ig           # re-run sushi + reload IG profiles + HAPI restart
./build-and-deploy.sh --rebuild-frontends   # rebuild all frontend images (optionally name one)
./build-and-deploy.sh --rebuild-validator   # rebuild the validator-service sidecar image (port 3500; ADR-0051)
./build-and-deploy.sh --genonce             # also build the HTML IG (slow; off by default; uses tx.fhir.org for VS expansion per ADR-0052 — override with IG_TX_SERVER=n/a; always wipes ig/temp/ first)
./build-and-deploy.sh --validate            # run FHIR Validator CLI after sushi
./build-and-deploy.sh --skip-seed           # skip seed bundle loading
./build-and-deploy.sh --help                # full stage-by-stage description
```

The default invocation does the cheapest thing that gets the stack up. Postgres state is preserved across runs unless `--clean` is passed, and the seed loaders are idempotent (they short-circuit when their work is already done).

### Manual Start

```bash
# Start HAPI FHIR server and PostgreSQL
docker compose up -d

# Verify HAPI is ready (may take 1–2 min on first run)
curl http://localhost:8080/fhir/DEFAULT/metadata

# Load IG profiles (StructureDefinitions must be known to HAPI so it can resolve
# `meta.profile` references and so $validate calls succeed; see ADR-0031)
./seed/load-profiles.sh

# Load example data (auto-discovers every longitudinal case under seed/bundles/)
./build-and-deploy.sh
```


## Project Structure

```
shoulder_on_fhir/
├── build-and-deploy.sh         # Full build + deploy shortcut
├── docker-compose.yml          # Service orchestration
├── fhir-requests/              # Example FHIR REST calls (VS Code REST Client / IntelliJ)
│   ├── fhir-requests-general.http
│   ├── fhir-requests-clinical.http
│   ├── fhir-requests-profiles.http
│   ├── fhir-requests-validate.http
│   ├── fhir-request-test.http
│   └── fhir-request-test-patient-everything.http
│
├── ig/                         # FHIR Implementation Guide (FSH/SUSHI)
│   ├── sushi-config.yaml
│   ├── ig.ini
│   ├── _genonce.sh             # Build full HTML IG
│   └── input/
│       └── fsh/
│           ├── profiles/       # 14 base profiles (incl. RotatorCuffRegistrationBundle, RotatorCuffSurgeryBundle, RotatorCuffFollowUpBundle, ShoulderEncounter)
│           │   └── observations/  # 57 derived observation child profiles
│           ├── codesystems/    # 20 custom CodeSystems
│           ├── valuesets/      # 35 ValueSets
│           └── examples/       # Example resource instances
│
├── frontend/                   # Unified React app (port 3000) — three flows behind one landing page
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── components/
│       │   ├── Home.tsx           # Landing page (4 cards: Register / Surgery / Follow-Up / Patients)
│       │   ├── RegistrationWizard.tsx
│       │   ├── SurgeryWizard.tsx
│       │   ├── wizard/            # Registration steps (Patient, Condition, Imaging, Assessment, PROMs, Summary)
│       │   ├── surgery/           # Surgery steps (Surgical event, Intra-op observations, Review)
│       │   ├── followup/          # Follow-Up steps (Lookup, Timepoint, Q9 exam, Q12 PROMs, Review)
│       │   └── shared/            # PatientLookup (shared between Surgery + Follow-Up flows)
│       ├── lib/                # fhirClient.ts, terminologyService.ts, *BundleBuilder.ts
│       └── types/              # Local FHIR R4 type definitions
│
├── sdc-frontend/               # SDC Questionnaire-based data-entry app (port 3001)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── components/         # SDC form renderer
│       ├── hooks/              # useSnomedTypeahead.ts, useValueSet.ts
│       ├── lib/                # fhirClient.ts, terminologyService.ts, extractor.ts, bundleAssembler.ts
│       └── types/              # Local FHIR R4 type definitions
│                               # The Questionnaires themselves are IG instances fetched from HAPI at runtime,
│                               # not frontend source (ig/input/fsh/instances/Shoulder*Questionnaire.fsh)
│
├── sdc-generic-frontend/       # Guide-agnostic SDC filler, both extraction mechanisms (port 3002)
│   ├── src/lib/                # templateExtract.ts, sdcExtract.ts, profileTypes.ts, config.ts
│   └── test/                   # engines exercised against the HL7 SDC spec's own examples
│
├── sdc-lforms-frontend/        # The same Questionnaires through LHC-Forms (port 3003)
│   └── web/                    # index.html, app.js
│
├── shared/                     # Canonical source for code duplicated into both frontends
│   ├── constantScore.ts        # Copied into frontend/src/lib/shared/ and sdc-frontend/src/lib/shared/
│   ├── ipsProfiles.ts          # by tools/sync-shared-code.sh, which build-and-deploy.sh runs as its
│   └── q11Timepoints.ts        # SYNC stage — edit here, never the copies, or the next build overwrites you
│
├── tools/
│   ├── validate.sh             # FHIR Validator CLI wrapper (validator_cli.jar, ~250 MB, gitignored)
│   ├── sync-shared-code.sh     # Regenerate the shared/*.ts copies in both frontends
│   └── check-artifact-names.sh # Fail on VS/CS-suffixed artefact names in FSH, narrative, mapping, docs
│
├── hapi/
│   └── application.yaml        # HAPI FHIR server configuration
│
├── seed/
│   ├── load-profiles.sh        # Upload CodeSystems → ValueSets → Extensions → StructureDefs
│   ├── generate-expansions.sh  # Pre-compute ValueSet expansions
│   └── bundles/                # Longitudinal patient cases (one subdir each), auto-loaded by build-and-deploy.sh
│
├── mapping/                    # Authoritative SECEC→FHIR element mapping (CSV = source of truth; .md narrative)
├── example_data/               # Two longitudinal example patients (Anna Müller, Kemal Demir): narrative + loader + validator
├── docs/decisions/             # Architecture Decision Records (ADRs) — the "why" behind every design choice
├── LICENSE                     # Apache-2.0
└── CITATION.cff                # Machine-readable "Cite this repository" metadata
```

## FHIR Profiles

### Base Profiles

| Profile | Base Resource | Key Additions |
|---------|---------------|---------------|
| `ShoulderPatient` | Patient | Required demographics (identifier, name, gender, birthDate) |
| `RotatorCuffCondition` | Condition | `bodySite 1..1` = laterality only (`ShoulderLaterality`); the tear inclusion diagnosis (`RotatorCuffDiagnosis`); traumatic etiology via the `condition-dueTo` extension. Tendon involvement, tear location/thickness, and imaging classifications are separate Observations linked via `Condition.evidence.detail` ([ADR-0064](docs/decisions/0064-tendons-involved-observation-pattern.md)) |
| `ShoulderDiagnosisCondition` | Condition | A coexisting non-rotator-cuff shoulder diagnosis, carried on the Registration bundle's `otherDiagnosis` slice ([ADR-0077](docs/decisions/0077-multiple-diagnoses-secondary-shoulder-condition-encounter-rank.md)) |
| `ShoulderComorbidityCondition` | Condition | General (problem-list) comorbidity; `code` bound to the IPS problem-list ValueSet ([ADR-0055](docs/decisions/0055-comorbidity-capture-via-ips-problemsvs.md)) |
| `RotatorCuffProcedure` | Procedure | Shoulder procedure type ValueSet |
| `ShoulderObservation` | Observation | **Abstract base** — shared constraints; all concrete types are derived child profiles |
| `RotatorCuffQuestionnaireResponse` | QuestionnaireResponse | Multi-item PROM instruments |
| `ShoulderImagingStudy` | ImagingStudy | Which imaging modality was obtained (X-ray/MRI/CT/US) + date + the visit it belongs to (`encounter 0..1 MS`, optional so an outside pre-registration study stays recordable — see [ADR-0187](docs/decisions/0187-imaging-study-carries-the-visit-anchor.md)); one per modality. Imaging findings are modelled as Observations on the Condition |
| `ShoulderCoverage` | Coverage | Insurance / workers compensation |
| `RotatorCuffResearchCarePlan` | CarePlan | Research follow-up timepoints |
| `ShoulderEncounter` | Encounter | Routine post-operative follow-up visits (SECEC Q10 — see [ADR-0028](docs/decisions/0028-shoulder-encounter-for-followup.md)) |
| `RotatorCuffRegistrationBundle` | Bundle | **Transaction bundle (T0 pre-op)** — `ShoulderPatient 1..1`, `RotatorCuffCondition 1..*`, optional priorTreatment Procedures (category-bound to PT or Medication via `PriorTreatmentCategory`), observations, imaging (`ImagingStudy 0..*`), Coverage, QR. Surgical procedures are excluded — they belong in `RotatorCuffSurgeryBundle`. See [ADR-0017](docs/decisions/0017-shoulder-registration-bundle-profile.md) (scope narrowed by ADR-0034) |
| `RotatorCuffSurgeryBundle` | Bundle | **Transaction bundle (T1 surgical event)** — `ShoulderEncounter 1..1`, `RotatorCuffProcedure 1..*` (category=Surgical), optional intra-op `ShoulderObservation` entries. References Patient + Condition by persisted ID (see [ADR-0034](docs/decisions/0034-three-bundle-architecture.md)). Index vs. concomitant procedure is carried by `Procedure.partOf` on the resources, not by bundle entry order, which does not survive persistence (see [ADR-0186](docs/decisions/0186-procedure-partof-marks-concomitant-not-entry-order.md)) |
| `RotatorCuffFollowUpBundle` | Bundle | **Transaction bundle (per Q11 visit)** — single post-operative follow-up submission for an already-registered patient: `ShoulderEncounter 1..1`, `ShoulderObservation 1..*`, optional QR and imaging study (see [ADR-0030](docs/decisions/0030-shoulder-followup-bundle.md)) |

### Derived Observation Profiles (57)

`ShoulderObservation` is an abstract base. All 57 concrete observation types live in `profiles/observations/`, each fixing `code` and constraining `value[x]` to a single type (count last verified 2026-07-31 — verify with `ls ig/input/fsh/profiles/observations/*.fsh | wc -l` rather than trusting it blindly):

- **ROM angles (12)** — Flexion/Abduction/at-side-ER `value[x] only Quantity` (`deg`), LOINC-coded (active 41389-8/41381-5/41387-2, passive 41390-6/41382-3/41388-0; see [ADR-0045](docs/decisions/0045-rom-to-loinc-and-loinc-sweep.md)); at-side internal rotation redesigned to a local 8-tier vertebral-level ordinal (`value[x] only CodeableConcept`); four rotation-at-90°-abduction profiles added (local, degrees, 0–360° permissive bound)
- **Muscle strength (5)** — supraspinatus, external-rotation, internal-rotation, subscapularis (MMT `{score}` 0–5, Janda grading); plus `SupraspinatusStrengthDynamometryObservation` (kg, continuous)
- **Provocation tests (5)** — Jobe and Lift-off now fixed to verified SNOMED procedure concepts; Belly Press/Bear Hug/Hornblower stay local; all `value[x] only CodeableConcept` bound to `PositiveNegative (required)`
- **PROM scores (3)** — Constant-Murley (SNOMED 273383002, optional `component[]` sub-scores, UCUM `{score}` 0–100), SSV, SANE (UCUM `%` 0–100, see [ADR-0183](docs/decisions/0183-ssv-sane-ucum-percent-and-bounds.md)); `value[x] only Quantity`. All five aggregate PROM profiles carry `focus 0..1 MS → RotatorCuffCondition`
- **Imaging/anatomic classifications (9)** — Patte, Goutallier, tear size + Cofield bucket (both pre-op imaging and intra-op direct-measurement variants — see [ADR-0047](docs/decisions/0047-tear-size-dual-encoding.md)), tear location, tear thickness, tendons involved
- **Surgical procedure technique (3, Layer 2 — not a Hurley element)** — procedure approach, reconstruction extent, fixation technique; postcoordinated axes linked to their `RotatorCuffProcedure` via `Observation.partOf`
- **Patient history (SECEC Q1, 15)** — smoking status (LOINC 72166-2) + smoking pack-years (SNOMED 782516008); pain decomposed into 4 context-specific axes (average/active-movement/passive-movement/rest); occupation split into employment status (LOINC 67875-5 hybrid VS) + physical demand + overhead exposure; sleep disturbance and functional limitations redesigned to local ordinals; sports participation as a 4-tier ordinal; prior injection/PT session counts (bucketed); hand dominance (SNOMED 57427004)
- **Visual inspection (3)** — atrophy, deformity (SNOMED 111263009), normal-shoulder-contour, replacing a single free-text profile; `value[x] only CodeableConcept` bound to a shared present/absent ValueSet
- **Patient self-report (2)** — satisfaction (LOINC 77218-6 + LOINC answer list `LL4543-6`, migrated off a local CodeSystem), return-to-activity (local)

See [`mapping/SECEC_FHIR_Mapping.md`](mapping/SECEC_FHIR_Mapping.md) for the full element-by-element coverage and [ADR-0027](docs/decisions/0027-complete-secec-coverage-standard-terminologies.md) for the standard-terminology-first rule.

## CodeSystems

20 custom CodeSystems total (grown from an original 7 via later surgeon-feedback redesigns, each adding a local axis with no SNOMED/LOINC equivalent, plus `constant-calculator-input`, which is worksheet input rather than a clinical axis):

| CodeSystem | Purpose |
|------------|---------|
| `ShoulderObservationCodes` | 44 observation type codes (strength, provocation tests, PROM sub-components, tear morphology, imaging-classification anchors, patient-history axes, procedure technique) — ROM and several other concepts migrated to verified LOINC/SNOMED over time; see [ADR-0045](docs/decisions/0045-rom-to-loinc-and-loinc-sweep.md) |
| `GoutallierClassificationCodes` | Fatty infiltration grades 0–4 |
| `PatteClassificationCodes` | Tendon retraction stages I–III |
| `CofieldTearSizeClassificationCodes` | Tear-size buckets (small / medium / large / massive) per [ADR-0047](docs/decisions/0047-tear-size-dual-encoding.md) |
| `ShoulderEtiology` | One local code (`acute-on-chronic`) for mixed traumatic+degenerative etiology, per [ADR-0046](docs/decisions/0046-condition-dueto-for-etiology.md) — other etiology codes are SNOMED |
| `ReturnToActivityCodes` | returned-full / returned-modified / not-returned |
| `SleepDisturbanceSeverityCodes` | unaffected / occasional / nightly (3-tier) |
| `SportsParticipationLevelCodes` | none / recreational / competitive / professional |
| `EmploymentStatusSupplement` | One local addition (`self-employed`) to LOINC's own `LL1901-9` answer list |
| `OccupationalPhysicalDemandCodes` | sedentary / light-manual / heavy-manual |
| `OccupationalOverheadExposureCodes` | yes / no / unknown |
| `InternalRotationVertebralLevelCodes` | 8-tier "hand behind back" at-side IR ordinal |
| `PriorInjectionCountCodes` / `PriorPhysicalTherapySessionCountCodes` | Bucketed counts of prior treatment |
| `ProcedureApproachCodes` / `FixationTechniqueCodes` | Surgical procedure technique (Layer 2, not a Hurley element) |
| `TearLocationCodes` | near-insertion / musculotendinous / intratendinous |
| `FunctionalLimitationSeverityCodes` | 5-tier functional-ceiling ordinal |
| `Q11TimepointCodes` | Discriminator for the 5 Hurley Q11 research follow-up timepoints (6 wk / 3 mo / 6 mo / 1 y / 2 y), per [ADR-0129](docs/decisions/0129-careplan-moved-to-surgery-bundle-auto-generated.md) |

`SatisfactionScaleCodes` was retired — `PatientSatisfactionObservation` now uses LOINC `77218-6` with the LOINC answer list `LL4543-6` instead of a local CodeSystem.

Local codes are used only where no verified SNOMED CT / LOINC / ICD-10 code exists. Where a standard code does exist it is used directly in `Observation.code` — e.g. LOINC `72514-3`-family codes for pain, LOINC `72166-2` for smoking status, LOINC ROM codes per ADR-0045 — without enumerating it in `ShoulderObservationCodes` (see [ADR-0027](docs/decisions/0027-complete-secec-coverage-standard-terminologies.md) for the rule). Hand dominance is captured as a `HandDominanceObservation` now fixed to SNOMED `57427004` "Handedness"; the SNOMED CT value codes (`46669005`, `87683000`, `23088002`, plus `261665006` Unknown) live in `HandDominance` — see [ADR-0026](docs/decisions/0026-hand-dominance-observation.md).

## Building the Implementation Guide

```bash
cd ig

# Compile FSH → JSON only
sushi .

# Build full HTML IG (requires Java + IG Publisher)
./_genonce.sh

# View the IG
open output/index.html
```

After any FSH change, reload profiles into the running HAPI instance:

```bash
# From the repository root
./seed/load-profiles.sh
```

> **Note:** Nothing loads profiles automatically — `docker compose up` starts the services and no more. `build-and-deploy.sh` runs `load-profiles.sh` as a pipeline stage; if you start the stack any other way, or edit a `.fsh` file, run it yourself. HAPI returns 500 when a `meta.profile` URL cannot be resolved — missing/stale profiles are the most common cause.

## API Examples

All requests target the `DEFAULT` tenant.

```bash
# Server capability statement
curl http://localhost:8080/fhir/DEFAULT/metadata

# List all patients
curl http://localhost:8080/fhir/DEFAULT/Patient

# Create a patient
curl -X POST http://localhost:8080/fhir/DEFAULT/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{"resourceType":"Patient","meta":{"profile":["https://maxpurk.github.io/shoulder-on-fhir/StructureDefinition/shoulder-patient"]},"name":[{"family":"Beispiel","given":["Erika"]}],"gender":"female","birthDate":"1990-01-01"}'

# Search conditions by patient
curl "http://localhost:8080/fhir/DEFAULT/Condition?subject=Patient/123"
```

See `fhir-requests/` for a full collection of example requests (split by topic: general, clinical, profiles, validate).

## Development

### Frontend (wizard-based)

```bash
cd frontend
npm install
npm run dev     # Dev server at http://localhost:3000 (proxies /fhir/* → localhost:8080)
npm run build   # tsc + Vite production build
npm run lint    # ESLint — zero warnings enforced
```

### SDC Frontend

```bash
cd sdc-frontend
npm install
npm run dev     # Dev server at http://localhost:3001 (proxies /fhir/* → localhost:8080)
npm run build   # tsc + Vite production build
npm run lint    # ESLint — zero warnings enforced
```

### FHIR Validation

```bash
./tools/validate.sh                    # validate examples + SDC Questionnaires + seed bundle
./tools/validate.sh --seed-only        # seed bundle only (no Docker needed)
./tools/validate.sh --only=ROM         # filter to files whose basename contains "ROM"
./tools/validate.sh --deep             # also validate all StructureDefinitions
./tools/validate.sh --update-validator # re-download latest validator_cli.jar
```

Defaults to `https://tx.fhir.org/r4` for terminology lookups ([ADR-0049](docs/decisions/0049-validator-tx-default-flip-to-tx-fhir-org.md)); override with `TX_SERVER=n/a ./tools/validate.sh` for offline mode (the known limitation is that SNOMED-in-`QuestionnaireResponse.answer.valueCoding` bind-checks are skipped). Batch mode (always on) and `-txCache tools/.tx-cache/` (gitignored) keep the dev loop fast. Downloads `validator_cli.jar` (~250 MB) to `tools/` on first use. Requires Java 11+.

The same `validator_cli.jar` is used by the `validator-service` Docker sidecar (port 3500) for runtime client pre-flight from the three submitting frontends, per [ADR-0051](docs/decisions/0051-strict-client-preflight-via-validator-sidecar.md) — one validator engine, two invocation paths.

Environment variable: `VITE_FHIR_SERVER_URL` (default: `/fhir` via Vite proxy in dev).

### Docker Rebuild

Always pass `--build` after code changes:

```bash
docker compose up -d --build frontend
```

### Implementation Guide

```bash
cd ig
sushi .         # Compile FSH files
./_genonce.sh   # Build complete IG (takes several minutes)
```

## Services

| Service | Port | URL |
|---------|------|-----|
| HAPI FHIR Server | 8080 | http://localhost:8080/fhir/DEFAULT |
| Unified Frontend (Registration / Surgery / Follow-Up) | 3000 | http://localhost:3000 |
| SDC Frontend (guide-aware, the three definition-based Questionnaires) | 3001 | http://localhost:3001 |
| Generic SDC filler (both extraction mechanisms, no knowledge of this guide) | 3002 | http://localhost:3002 |
| LHC-Forms filler (the same Questionnaires, third-party engine) | 3003 | http://localhost:3003 |
| Validator sidecar (`validator_cli.jar` wrapper, strict client pre-flight per [ADR-0051](docs/decisions/0051-strict-client-preflight-via-validator-sidecar.md)) | 3500 | http://localhost:3500/health |
| PostgreSQL | 5432 | Internal only |

## Configuration

### HAPI FHIR Server

Base config: `hapi/application.yaml`. `docker-compose.yml` overrides key settings via environment variables:

- FHIR version: R4
- Multitenancy: enabled (`/fhir/DEFAULT`)
- Request-time validation: **disabled** (`hapi.fhir.validation.requests_enabled=false`). HAPI runs as a storage server only; conformance is gated by `tools/validate.sh` (FHIR Validator CLI) on design-time artefacts and by each frontend's typed bundle builders at construction time. The three-tier rationale (storage / terminology / validation) is documented in [ADR-0031](docs/decisions/0031-hapi-fhir-r4-core-ig-package.md).
- CORS: all origins allowed

### Frontend

- `VITE_FHIR_SERVER_URL` — FHIR server base URL

## Technology Stack

- **FHIR**: R4 (4.0.1), profiling directly against FHIR R4 base resources (European scope)
- **IG Tooling**: SUSHI, HL7 FHIR IG Publisher
- **Server**: HAPI FHIR JPA Server
- **Database**: PostgreSQL 15
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Container**: Docker, Docker Compose

## Architecture

Key architectural decisions are documented as Architecture Decision Records (ADRs) in [`docs/decisions/`](docs/decisions/README.md). These capture the *why* behind technology choices, FHIR design patterns, and decisions that were tried and later changed.

Highlights:
- [ADR-0001](docs/decisions/0001-fhir-r4-specification-version.md) — Why FHIR R4, not R5
- [ADR-0022](docs/decisions/0022-remove-de-basis-european-scope.md) — Why profiles inherit from FHIR R4 base (not German DE Basis) — European scope
- [ADR-0008](docs/decisions/0008-abstract-base-27-derived-observation-profiles.md) — Why one abstract base + N derived Observation profiles instead of one generic profile (the historical "27" in the filename reflects the original count at authoring; now 57 — verify with `ls ig/input/fsh/profiles/observations/*.fsh | wc -l`)
- [ADR-0012](docs/decisions/0012-atomic-transaction-bundle-wizard.md) — Why the wizard submits an atomic transaction bundle
- [ADR-0014a](docs/decisions/0014a-bodysite-slicing-abandoned.md) / [ADR-0014b](docs/decisions/0014b-precoordinated-snomed-bodysite.md) — bodySite slicing tried and abandoned in favour of pre-coordinated SNOMED CT
- [ADR-0017](docs/decisions/0017-shoulder-registration-bundle-profile.md) — `RotatorCuffRegistrationBundle`: machine-readable definition of a conformant registry submission
- [ADR-0018](docs/decisions/0018-sdc-questionnaire-frontend.md) — SDC Questionnaire-based frontend as a separate Docker service
- [ADR-0040](docs/decisions/0040-sdc-conformance-and-three-questionnaire-split.md) — HL7 SDC IG conformance (adopted as v3.0.0, bumped to v4.0.0 by commit `e425f1c` on 2026-05-19, retroactively documented by ADR-0102) + three SDC Questionnaires aligned to ADR-0034
- [ADR-0041](docs/decisions/0041-deprecate-lhcforms-frontend.md) — Deprecate LHC-Forms frontend (retired from the stack); supersedes ADR-0023
- [ADR-0024](docs/decisions/0024-fhir-validator-cli-integration.md) — FHIR Validator CLI for offline profile validation
- [ADR-0025](docs/decisions/0025-canonical-patient-identifier-system.md) — Canonical HPI-namespaced patient identifier system
- [ADR-0027](docs/decisions/0027-complete-secec-coverage-standard-terminologies.md) — Complete SECEC element coverage via standard terminologies (May 2026 push to 100% addressability)
- [ADR-0028](docs/decisions/0028-shoulder-encounter-for-followup.md) — `ShoulderEncounter` profile for routine follow-up (supersedes the Encounter-out-of-scope claim in ADR-0016)
- [ADR-0029](docs/decisions/0029-shoulder-servicerequest-imaging-indications.md) — `RotatorCuffServiceRequest` profile for imaging-order indications (profile removed by [ADR-0172](docs/decisions/0172-remove-seed-only-imaging-report-order-profiles.md) as a seed-only, non-consensus artifact)
- [ADR-0030](docs/decisions/0030-shoulder-followup-bundle.md) — `RotatorCuffFollowUpBundle` profile and Follow-Up frontend for per-visit longitudinal submissions
- [ADR-0031](docs/decisions/0031-hapi-fhir-r4-core-ig-package.md) — base profiles are loaded into HAPI by the seed scripts, not by HAPI's built-in IG installer, which crashes at boot on the R4 core package
- [ADR-0032](docs/decisions/0032-value-set-scope-and-provenance.md) — Editorial scope and provenance rule for `RotatorCuffDiagnosis` / `RotatorCuffProcedureType`
- [ADR-0033](docs/decisions/0033-shoulder-procedure-category-binding.md) — `RotatorCuffProcedureCategory` binding for distinguishing surgical from prior non-surgical procedures
- [ADR-0034](docs/decisions/0034-three-bundle-architecture.md) — Three-bundle architecture: separate `RotatorCuffSurgeryBundle` from `RotatorCuffRegistrationBundle`
- [ADR-0035](docs/decisions/0035-unified-registry-frontend.md) — Unified registry frontend: merge wizard + follow-up into one app at port 3000
- [ADR-0036](docs/decisions/0036-honest-secec-coverage-rebaseline.md) — Honest SECEC re-baseline (denominator corrected from 68 → 60 Hurley elements; baseline at authoring: 43 Full + 17 Partial + 0 Missing — subsequently re-baselined by ADR-0039 and ADR-0061)
- [ADR-0037](docs/decisions/0037-registration-bundle-encounter-and-linkage-closure.md) — Registration Bundle Encounter and cross-resource linkage closure (Encounter 1..1, Condition.evidence populated)
- [ADR-0038](docs/decisions/0038-soft-alignment-with-eu-base-core.md) — Soft alignment with HL7 Europe Base + Core v2.0.0 (declared dependency, EU Address datatype, condition-assertedDate, Procedure.recorded; Path A for bodySite per ADR-0014b)
- [ADR-0045](docs/decisions/0045-rom-to-loinc-and-loinc-sweep.md) — Migrate eight shoulder ROM observations from local CS to LOINC codes; profiles renamed `Shoulder…Observation`; documents the broader LOINC sweep over remaining `ShoulderObservationCodes` concepts
- [ADR-0046](docs/decisions/0046-condition-dueto-for-etiology.md) — `condition-dueTo` standard extension on `RotatorCuffCondition` (1..1) for SECEC Q1.e traumatic etiology; introduces `RotatorCuffEtiology` + `ShoulderEtiology`
- [ADR-0047](docs/decisions/0047-tear-size-dual-encoding.md) — Dual encoding of Hurley Q4.a "Size": existing `TearSizeObservation` (cm) + new `TearSizeClassificationObservation` (Cofield small/medium/large/massive) bound to `CofieldTearSizeClassification`
- [ADR-0049](docs/decisions/0049-validator-tx-default-flip-to-tx-fhir-org.md) — Validator CLI default flipped from `-tx n/a` to `https://tx.fhir.org/r4`; `TX_SERVER=n/a` retained as offline fallback
- [ADR-0050](docs/decisions/0050-hapi-delegates-snomed-to-tx-fhir-org.md) — HAPI delegates SNOMED resolution to `tx.fhir.org` via `remote_terminology_service`; local SNOMED fragment retired; seed pipeline reduced from 4 to 3 steps at the time (subsequently grown back to 5 by ADR-0053/ADR-0056 — see below)
- [ADR-0051](docs/decisions/0051-strict-client-preflight-via-validator-sidecar.md) — Strict client pre-flight via `validator-service` sidecar (port 3500); both frontends POST bundles before submit; blocks on errors, allows warnings, fail-open with `ValidatorBanner` on outage; frontends no longer call HAPI `Bundle/$validate`
- [ADR-0052](docs/decisions/0052-ig-publisher-tx-default-flip-to-tx-fhir-org.md) — IG Publisher build-time TX flipped to `https://tx.fhir.org/r4` (env `IG_TX_SERVER`); pre-genonce wipe of `ig/temp/` to drop stale Jekyll pages from removed resources
- [ADR-0053](docs/decisions/0053-gender-administrative-only-no-biological-sex.md) — HL7 Gender Harmony `individual-recordedSexOrGender` (RSG) extension on `ShoulderPatient` for SECEC L3.A.6 sex-at-birth; pinned LOINC `76689-9` as RSG `type`
- [ADR-0054](docs/decisions/0054-remove-supplementary-proms-relocate-s5.md) — Retire the Supplementary layer entirely: ASES/WORC/DASH/QuickDASH removed from the IG, lost-to-follow-up relocated to Layer 2 as `L3.H.4`; v4 two-layer accounting (all 58 expert consensus elements representable, 0 Missing). The per-element Full/Partial coverage status was later replaced by a two-facet code/value terminology-provenance classification (ADR-0178) — see [`mapping/SECEC_FHIR_Mapping.md`](mapping/SECEC_FHIR_Mapping.md) for the current breakdown
- [ADR-0055](docs/decisions/0055-comorbidity-capture-via-ips-problemsvs.md) / [ADR-0056](docs/decisions/0056-smoking-rebound-ips-loinc.md) — First IPS ValueSet bindings: `ShoulderComorbidityCondition` → IPS `ProblemsSnomedAbsentUnknownUvIps`; `SmokingStatusObservation` → IPS `CurrentSmokingStatusUvIps` (8 LOINC LA codes); added `seed/load-ips-package.sh` as 5th seed step
- [ADR-0057](docs/decisions/0057-shoulder-patient-eu-core-ips-multiprofile.md) / [ADR-0058](docs/decisions/0058-condition-family-eu-core-ips-multiprofile.md) / [ADR-0059](docs/decisions/0059-shoulder-procedure-eu-core-ips-multiprofile.md) / [ADR-0060](docs/decisions/0060-smoking-observation-ips-multiprofile.md) — EU Core profile-level parents (Patient/Condition/Procedure) + IPS instance-level multi-profile claims (Patient/Condition-comorbidity/Procedure/SmokingStatus)
- [ADR-0061](docs/decisions/0061-q1l-workers-compensation-v3actcode.md) — SECEC Q1.l workers' compensation closed Partial → Full via FHIR core v3-ActCode `WCBPOL` on a new `ShoulderCoverage` slice (`Coverage.type 1..1`); headline at the time 43 Full + 15 Partial of 58 (74.1% Full)
- [ADR-0062](docs/decisions/0062-comorbidity-typeahead-snomed-tx.md) — Comorbidity typeahead routes to `tx.fhir.org` via SNOMED implicit subset `?fhir_vs=isa/404684003`; same-origin `/tx-fhir` proxy to dodge duplicate CORS headers
- [ADR-0063](docs/decisions/0063-frontend-expand-empty-fallback.md) — `fhirClient.expand` falls back to direct `GET /ValueSet?url=…` on `expansion.contains=[]` (not just on throw); closes empty-dropdown after-restart failure mode for local-CS-backed VSs
- [ADR-0064](docs/decisions/0064-tendons-involved-observation-pattern.md) — SECEC Q4.b "Tendons involved" moves from `RotatorCuffCondition.bodySite` to a new `TendonsInvolvedObservation` linked via `Condition.evidence.detail`; `Condition.bodySite` tightens to 1..1 required `ShoulderLaterality`
- [ADR-0065](docs/decisions/0065-shoulderobservationcodevs-enumerate-derived-profile-codes.md) — Widen `ShoulderObservationCode` to enumerate the external (LOINC + SNOMED) codes that derived Observation profiles fix; closes the inverse half of ADR-0045
- [ADR-0053](docs/decisions/0053-gender-administrative-only-no-biological-sex.md) / [ADR-0056](docs/decisions/0056-smoking-rebound-ips-loinc.md) — Added `load-uv-extensions.sh` and `load-ips-package.sh`, growing the seed pipeline from 3 back to 5 steps
- [ADR-0070](docs/decisions/0070-patient-satisfaction-loinc-migration.md) — Q8.e/Q12.g patient satisfaction closed Partial → Full: migrated off a local CodeSystem to LOINC `77218-6` + answer list `LL4543-6`
- ADR-0081–ADR-0090 / ADR-0105–ADR-0115 — Two rounds of surgeon-feedback-driven redesign: pain decomposed into 4 axes, ROM's at-side internal rotation redesigned to a vertebral-level ordinal plus 4 new 90°-abduction profiles, strength gained dynamometry + internal-rotation axes, visual inspection split into 3 structured findings, occupation split into employment-status + physical-demand + overhead-exposure, Constant-Murley gained `component[]` sub-scores, diagnosis remodeled (tear location/thickness, non-rotator-cuff secondary diagnosis, procedure-technique postcoordination), and Jobe/Lift-off migrated to verified SNOMED CT procedure concepts (ADR-0115; the same round's atrophy migration was reverted by ADR-0116 after a live `tx.fhir.org` edition-resolution gap was found)
- [ADR-0102](docs/decisions/0102-sdc-version-label-accuracy-and-stu4-transparency.md) — Documents the SDC IG v3.0.0 → v4.0.0 bump (silently done in commit `e425f1c`, 2026-05-19) after the fact

## License

Two licences apply, split by what the file is.

- **Code** — the frontends, the scripts, the deployment configuration, the tooling: **Apache-2.0**, see [`LICENSE`](LICENSE).
- **Implementation Guide content** — the FSH source under `ig/input/fsh/`, the narrative pages, and the conformance resources built from them: **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**, as declared by `license: CC-BY-4.0` in [`ig/sushi-config.yaml`](ig/sushi-config.yaml) and carried in the published package. Reuse and adapt the profiles, value sets and code systems freely, with attribution.

Machine-readable citation metadata is in [`CITATION.cff`](CITATION.cff). Developed at Hasso Plattner Institute as part of a master thesis; see the thesis for full context and research methodology (Design Science Research Methodology).

## References

- [HL7 FHIR R4](https://hl7.org/fhir/R4/)
- [SUSHI / FSH School](https://fshschool.org/docs/sushi/)
- [HAPI FHIR](https://hapifhir.io/)
- [SECEC European Shoulder Registry](https://www.secec.org/)
