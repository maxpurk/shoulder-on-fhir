# Anna Müller — Longitudinal Example Case

> **Synthetic data.** This is a fabricated reference case. It is not a real patient, and no real
> patient data was used to produce it. The name, date of birth, address, insurance, and every
> clinical value were authored for demonstration.

A reference patient story split across **seven named submissions** that demonstrate the full Shoulder on FHIR pathway from initial presentation through 24-month follow-up. Each submission is a separate FHIR transaction bundle conforming to the bundle profile for its phase, per ADR-0034 (three-bundle architecture).

## Submission inventory

| # | File | Bundle profile | Date | Entries |
|---|---|---|---|---|
| 1 | `anna_mueller_01_registration.json` | `RotatorCuffRegistrationBundle` | 2024-01-08 → 2024-02-20 (pre-op window) | 47 |
| 2 | `anna_mueller_02_surgery.json` | `RotatorCuffSurgeryBundle` | 2024-04-15 | 9 |
| 3 | `anna_mueller_03_followup_6wk.json` | `RotatorCuffFollowUpBundle` | 2024-05-27 | 10 |
| 4 | `anna_mueller_04_followup_3mo.json` | `RotatorCuffFollowUpBundle` | 2024-07-15 | 18 |
| 5 | `anna_mueller_05_followup_6mo.json` | `RotatorCuffFollowUpBundle` | 2024-10-15 | 16 |
| 6 | `anna_mueller_06_followup_12mo.json` | `RotatorCuffFollowUpBundle` | 2025-04-15 | 30 |
| 7 | `anna_mueller_07_followup_24mo.json` | `RotatorCuffFollowUpBundle` | 2026-04-15 | 9 |

Submissions 2–7 reference the Patient + Condition created by submission 1 via persistent logical IDs (`Patient/pat-long-001`, `Condition/anna-mueller-rc-tear`).

Load order matters: submit in order 1 → 7. Each bundle is independently `Bundle/$validate`able against its declared profile.

## Patient

- **Name**: Anna Müller (identifier `PAT-LONG-001`, logical ID `Patient/pat-long-001`)
- **Date of birth**: 1971-04-12 (age 52 at first visit, 54 at 24-month follow-up)
- **Sex**: female
- **Address**: Bertha-von-Suttner-Allee 7, 14471 Potsdam, Germany
- **Insurance**: AOK Brandenburg (statutory) — narrative only; the registry models insurance solely via the workers'-compensation flag (ADR-0061), so a statutory (non-workers'-comp) case emits **no `Coverage` resource**
- **Occupation**: schoolteacher — employment status: employed full time; occupational physical demand: light manual work; occupational overhead exposure: yes (frequent overhead blackboard writing) — the two axes are independent since ADR-0105
- **Hand dominance**: right
- **Tobacco**: former smoker, 8 pack-years
- **Sports**: recreational alpine skiing (twice yearly), weekly swimming — sports participation level: recreational / leisure sport
- **Comorbidities (expert consensus Q1.c)**: essential hypertension (well-controlled) and type 2 diabetes mellitus (oral antidiabetic therapy) — captured as `ShoulderComorbidityCondition` resources on the Registration bundle per ADR-0055 (the registry captures the coded problem, not a per-comorbidity onset/recorded date)

## Clinical storyline

### December 2023 — Onset

Insidious right shoulder pain begins **2023-12-22**. Anna notices nocturnal pain and increasing difficulty writing on the blackboard above shoulder height. No acute trauma. Sleep is impaired.

### 2024-01-08 — Initial orthopaedic consultation (Registration bundle #1)

- Pain 7/10 (verbal numeric rating)
- Forward flexion 110°, abduction 95°, external rotation 40°, internal rotation to **L5** (hand-behind-back, `InternalRotationVertebralLevel` ordinal, ADR-0088)
- Supraspinatus strength MRC 2/5 (ordinal) + 1.8 kg (dynamometry, `SupraspinatusStrengthDynamometryObservation`, ADR-0089); external rotation strength 4/5, internal rotation (composite) strength 4/5, subscapularis strength 5/5
- Full 5-test provocation battery (Hurley A2): Jobe (empty can) **positive**, lift-off negative, belly-press negative, bear-hug negative, Hornblower negative — consistent with an isolated supraspinatus tear and an intact infraspinatus/teres minor/subscapularis
- Visible mild atrophy over the supraspinatus fossa
- Constant–Murley **38** (component-derived entry, ADR-0090: Pain 4/15, ADL 4/20, ROM 20/40, Strength 10/25), Subjective Shoulder Value **35**
- Functional limitation severity: **below-shoulder-level activity limited** (cannot reach overhead at work, difficulty dressing) — a 5-tier coded ordinal (ADR-0105), not free text

Working diagnosis: **full-thickness supraspinatus tear, right shoulder**. `Condition.code` carries the disease entity only (rupture of rotator cuff, thickness-neutral); which tendon (supraspinatus, via `TendonsInvolvedObservation`), tear thickness (full-thickness, via `TearThicknessObservation`, ADR-0106), and etiology (degenerative, via the `condition-dueTo` extension) are all captured on separate elements rather than folded into the diagnosis code — see [Diagnosis modeling](#diagnosis-modeling-registration-bundle-1) below.

The Registration bundle also captures the expert consensus Q1 patient-history items (smoking, occupation, sleep, sports, functional limitations, hand dominance, comorbidities). The `RotatorCuffResearchCarePlan` that schedules the post-op follow-up timepoints is submitted later, in the Surgery bundle (ADR-0129) — the schedule anchors to the surgery date, which isn't known yet at registration.

### 2024-01-22 — MRI right shoulder (1.5T, non-contrast) — still bundle #1

A lean `ImagingStudy` records the modality obtained (MR), the study date, and the registration visit it belongs to (`encounter`, ADR-0187); the reading itself is captured as discrete, queryable `Observation`s linked to the diagnosis (Patte, Goutallier, tear size, tear location, tear thickness) rather than as free-text narrative:

> Complete full-thickness tear of the supraspinatus tendon, ~2.5 cm AP, mild retraction to humeral head (**Patte II**), mild fatty infiltration (**Goutallier 1**), tear located near the tendon insertion (footprint). Infraspinatus and subscapularis intact. No glenohumeral arthropathy. Incidental mild osteoarthritis of the acromioclavicular joint.

### Diagnosis modeling (Registration bundle #1)

Two `RotatorCuffCondition`/`ShoulderDiagnosisCondition` structures work together to
represent the full picture from the MRI:

- **`Condition/anna-mueller-rc-tear`** (`RotatorCuffCondition`, the principal
  diagnosis) — `code` fixed by the profile to the single tear inclusion
  diagnosis (`926335004` Rupture of rotator cuff of shoulder,
  thickness-neutral), not a clinician choice: Hurley's 13 consensus
  questions define no disease-entity selection at all (ADR-0111). Linked
  evidence:
  `Observation/anna-mueller-tendon-supraspinatus` (which tendon — expert consensus
  Q4.b), `Observation/anna-mueller-tear-location` (near the insertion — a
  Q4 refinement of tear classification, alongside Patte and Goutallier),
  and `Observation/anna-mueller-tear-thickness` (`202843000` Full thickness
  rotator cuff tear, reused as an Observation value — expert consensus Q4.c, decoupled
  from `Condition.code` per ADR-0106).
- **`Condition/anna-mueller-ac-oa`** (`ShoulderDiagnosisCondition`, secondary)
  — the incidental AC joint finding, same shoulder, not a rotator cuff
  diagnosis. Point tenderness over the AC joint on exam later supported
  treating it concomitantly at surgery (see [2024-04-15 —
  Surgery](#2024-04-15--surgery-bundle-2) below) rather than leaving it
  unaddressed.

`Encounter/anna-mueller-registration-encounter` ranks the two via
`Encounter.diagnosis[]`: rank 1 → the rotator cuff tear (`use = CC`, chief
complaint), rank 2 → the AC joint osteoarthritis (`use = CM`, comorbidity
diagnosis). `Encounter.reasonReference` continues to point at the rank-1
Condition.

### Pre-operative conservative trial (expert consensus Q1.f) — bundle #1

Both prior treatments are carried by the Registration bundle's `priorTreatment` slice. Required category binding (the `PriorTreatmentCategory` ValueSet) enforces that they are NOT surgical procedures:

- **2024-01-15** — 12 weeks of structured physiotherapy (Procedure, `category = 91251008 Physical therapy procedure`) — bucketed session count **more than 20 sessions** (`PriorPhysicalTherapySessionCountObservation`, ADR-0105; replaces the date-only capture the surgeon found clinically unhelpful)
- **2024-02-20** — single subacromial corticosteroid injection (Procedure, `category = 18629005 Administration of medication`) — bucketed count **1 to 3 injections** (`PriorInjectionCountObservation`, ADR-0105)

Symptoms persist. Shared decision for operative repair.

### 2024-04-15 — Surgery (bundle #2)

**Arthroscopic single-row suture-anchor repair of the right supraspinatus, plus a concomitant distal clavicle excision for the AC joint osteoarthritis noted on MRI.** The Surgery bundle contains nine entries:

1. A `ShoulderEncounter` for the inpatient surgical admission (class = IMP); `period` (09:00 → 10:35) is *derived* from the operative window below, not separately captured (ADR-0110)
2. The index `RotatorCuffProcedure` (`code = 699120002 Arthroscopic repair of rotator cuff`, `category = 387713003 Surgical procedure`), timed via `performedPeriod` (incision **09:00** → suture closure **10:35**, ADR-0108 — replaces the single `performedDateTime` the surgeon found redundant with `Encounter.period`; the wizard now captures this against one shared day-of-surgery date instead of a separate admission window, ADR-0110); `reasonReference` → `Condition/anna-mueller-rc-tear`; `performer.actor.display` = **Dr. med. Sabine Hoffmann** (not Hurley-named, L3.H.1 — free-text via `Reference.display` only, no Practitioner directory in this IG; shared with entry 3, same one-per-surgical-event pattern as `performedPeriod`)
3. A **concomitant** `RotatorCuffProcedure` — arthroscopic excision of the distal clavicle (`code = 734057006`, Mumford procedure) for the AC joint osteoarthritis — sharing the *identical* `performedPeriod` as entry 2, since it was performed through the same arthroscopic portals in the same operative session, not a separate skin incision (ADR-0121); linked to entry 2 via `Procedure.partOf`, and citing `Condition/anna-mueller-ac-oa` as the diagnosis it treats rather than the rotator cuff tear (ADR-0127 widened `RotatorCuffProcedure.reasonReference` to make this expressible)
4. `ProcedureApproachObservation` — **arthroscopic** (postcoordinated procedure-technique axis, ADR-0108)
5. `ReconstructionExtentObservation` — **complete repair** (SNOMED `304384006`, reused as an Observation value)
6. `FixationTechniqueObservation` — **single-row** fixation
7. `IntraopTearSizeObservation` — tear size confirmed intra-operatively at **3.2 cm**, exceeding the 2024-01-22 MRI estimate of 2.5 cm
8. `IntraopTearSizeClassificationObservation` — Cofield **large** (3–5 cm), crossing the bucket boundary from the MRI's **medium** (1–3 cm) reading
9. The `RotatorCuffResearchCarePlan` — the five-timepoint Q11 follow-up schedule (6 weeks / 3 months / 6 months / 1 year / 2 years), anchored to the surgery date (ADR-0129)

The first eight reference the already-persisted Patient + Condition by their logical IDs; the three RC-repair technique Observations (4–6) additionally reference the specific index `RotatorCuffProcedure` (entry 2, not entry 3) via `Observation.partOf`, since they describe the rotator cuff repair technique specifically and don't apply to the distal clavicle excision. The tear-size discrepancy (ADR-0104) is deliberate and illustrative: the pre-operative MRI reading (`Observation/anna-mueller-tear-size`, `category = imaging`) and this intra-operative direct measurement (`category = exam`) are modelled as two distinct, non-redundant Observations rather than one overwriting the other — imaging under-visualising the true extent of retraction relative to the debrided intra-operative view is a well-recognised, clinically expected pattern, not a data-entry error.

### Post-operative follow-up trajectory

Each row below is a single `RotatorCuffFollowUpBundle` transaction.

| Visit | Bundle | Date | Pain, on average (0–10) | Forward flex. | Abd. | Ext. rot. | Int. rot. (hand-behind-back) | Supra. MRC (dynamometry) | Constant | SSV |
|---|---|---|---|---|---|---|---|---|---|---|
| Pre-op | #1 (Registration) | 2024-01-08 | 7 | 110° | 95° | 40° | L5 | 2 (1.8 kg) | 38 | 35 |
| 6 weeks | #3 | 2024-05-27 | 5 | 80° (passive 120°) | — | — | Buttock | — | 44 | 45 |
| 3 months | #4 | 2024-07-15 | 3 | 125° | 110° | 50° | Sacrum | 3 (4.5 kg) | 61 | 62 |
| 6 months | #5 | 2024-10-15 | 2 | 155° | 145° | 65° | L5 | 4 (7.0 kg) | 74 | 76 |
| 12 months | #6 | 2025-04-15 | 1 | 170° | 165° | 75° | L3 | 5 (9.5 kg) | 86 | 88 |
| 24 months | #7 | 2026-04-15 | 1 | 170° | — | 75° | L3 | 5 | 89 | 92 |

- Jobe converts from positive (pre-op, 6 wk) to **negative** by 6 months; lift-off and belly-press are negative at every timepoint tested (subscapularis intact throughout). The full 3-test post-op battery (Hurley A9: Jobe, lift-off, belly-press) is captured at 6 weeks, 6 months, and 12 months; bear-hug/Hornblower are correctly **not** re-tested post-op (Hurley A9 names only 3 tests, unlike A2's 5 — see ADR-0093).
- At-side internal rotation transiently **regresses** from L5 (pre-op) to Buttock at 6 weeks — expected post-op stiffness under the sling protocol — before recovering past baseline to L3 by 12 months and holding at 24 months.
- External rotation ROM is deliberately not captured at 6 weeks (early sling protocol restricts formal ER testing to protect the repair), then tracked at every subsequent visit.
- 12-month visit is the fullest post-op exam: full strength battery (dynamometry + external/internal rotation strength 5/5 + subscapularis 5/5), rotation at 90° abduction (external 85°, internal 55° — no GIRD), a fully negative 3-test provocation battery, and a **component-derived** Constant-Murley entry (Pain 13/15, ADL 18/20, ROM 36/40, Strength 19/25, ADR-0090) — matching its role as the primary research endpoint (expert consensus Q11).
- 12-month visit also records **Patient Satisfaction = Completely satisfied** (LOINC 77218-6 / `LA27754-3`, ADR-0070) and **Return to Sport/Work = Returned to Full Activities**.
- 24-month visit confirms durable result; satisfaction unchanged.

## Bundle composition (aggregated across all seven submissions)

| Resource | Count | Where it lives |
|---|---|---|
| Patient | 1 | bundle #1 |
| Condition | 4 | bundle #1: rotator cuff tear (principal) + AC joint OA (secondary diagnosis, ADR-0077) + 2 comorbidities (hypertension, T2 diabetes, ADR-0055) |
| ImagingStudy | 1 | bundle #1 (MR; modality, date, and the registration `encounter` it belongs to) |
| CarePlan | 1 | bundle #2 (2-year post-operative plan, anchored to the surgery date — ADR-0129); each of its 5 `activity` entries carries a `detail.code` (`6-weeks`/`3-months`/`6-months`/`1-year`/`2-years`, the local `Q11TimepointCodes` CodeSystem) discriminating which Q11.a–e timepoint it represents, alongside the seed data's own `activity.detail.code` for a queryable schedule that doesn't rely on parsing the free-text `description` |
| Procedure | 4 | bundle #1: prior PT + prior injection · bundle #2: index surgical repair + concomitant distal clavicle excision |
| Encounter | 7 | bundle #1: registration consultation · bundle #2: surgical encounter · bundles #3–#7: one follow-up encounter each |
| Observation | 121 | spread across all bundles: pre-op exam + imaging classification + tear thickness + pack-years + occupational overhead exposure + prior-treatment counts (bundle #1, ADR-0105/ADR-0106), intra-operative tear-size confirmation + procedure-technique axes (bundle #2, ADR-0104/ADR-0108), post-op exam + PROMs (bundles #3–#7) |

## How to load

The 7 JSON bundles live under `seed/bundles/anna-mueller/` (one level up from this directory); this walkthrough ships alongside them in the published artifact. Load them with:

```bash
./load-anna-mueller.sh
```

Equivalently, in load order (each is an independent FHIR transaction):

```bash
for f in ../seed/bundles/anna-mueller/anna_mueller_0{1,2,3,4,5,6,7}_*.json; do
  curl -X POST -H "Content-Type: application/fhir+json" \
    --data @"$f" \
    http://localhost:8080/fhir/DEFAULT/
done
```

## What the case demonstrates

- Longitudinal **PROM and ROM trajectory** suitable for outcome analytics, captured as seven discrete atomic submissions over 24 months.
- **The three-bundle workflow** end-to-end: pre-op (Registration) → surgical event (Surgery) → recurring per-visit follow-ups (Follow-Up × 5).
- **Pre-operative expert consensus items** (Q1.f prior PT and prior injection) modelled as `Procedure` resources with the category codes required by the `PriorTreatmentCategory` ValueSet, demonstrating that the Registration bundle's slice binding correctly excludes surgical procedures.
- **Imaging classification** (Patte, Goutallier, tear size) modelled as discrete `Observation`s linked to the imaging encounter inside the Registration bundle.
- **Operative detail** (single-row, suture anchor, supraspinatus) captured in `Procedure.code` with right-shoulder body site inside the Surgery bundle, plus **postcoordinated procedure-technique axes** (approach / reconstruction extent / fixation technique, ADR-0108) as sibling Observations linked via `partOf` — decoupled from `Procedure.code` the same way diagnosis sub-axes were decoupled from `Condition.code`.
- **A concomitant procedure sharing one incision/closure with the index repair** (ADR-0121): the distal clavicle excision is a second `RotatorCuffProcedure` in the same Surgery bundle, `performedPeriod`-identical to the index repair and linked to it via `Procedure.partOf` — and, since it treats the AC joint diagnosis rather than the rotator cuff tear, cites `Condition/anna-mueller-ac-oa` via `reasonReference` (ADR-0127) rather than the index diagnosis. The `partOf` link is what makes the index repair identifiable once the bundle is persisted and entry order is gone (ADR-0186).
- A complete two-year follow-up window aligned with the `CarePlan` period from bundle #2 (ADR-0129 — the schedule is generated with the surgery, not at registration).
- **Full rotation ROM battery** (ADR-0088): at-side internal rotation on the 8-tier `InternalRotationVertebralLevel` ordinal (with a clinically expected transient post-op regression at 6 weeks), external rotation in degrees, and — at the 12-month primary endpoint only — both rotations re-measured at 90° abduction to screen for GIRD.
- **Dual-encoded supraspinatus strength plus the full rotation-strength battery** (ADR-0089): ordinal MMT alongside continuous dynamometry (kg) for supraspinatus, and composite external/internal rotation strength plus subscapularis-specific strength at the 6-month and 12-month checkpoints.
- **Aggregate PROM scores carrying `focus`** (ADR-0156): every Constant-Murley, SSV, SANE, patient-satisfaction, and return-to-activity Observation references the `RotatorCuffCondition` it scores. These five profiles deliberately carry no `bodySite` (a patient-reported composite has no measurement site, ADR-0074), so `focus` is the only element that says which shoulder the score is about — load-bearing the moment a bilateral patient enters scope.
- **Constant-Murley component-derived entry** (ADR-0090) at two timepoints (pre-op baseline and the 12-month primary endpoint) — Pain/ADL/ROM/Strength sub-scores summing exactly to the published total — alongside direct-total-only entries at the other visits, demonstrating both of the profile's two legitimate entry modes side by side.
- **A complete Hurley-scoped provocation battery**: the 5-test pre-op set (Q2, including bear-hug and Hornblower) at Registration, and the 3-test post-op set (Q9: Jobe, lift-off, belly-press — deliberately narrower per Hurley A9, ADR-0093) at three follow-up visits.
