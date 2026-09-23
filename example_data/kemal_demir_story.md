# Kemal Demir — Longitudinal Example Case

> **Synthetic data.** This is a fabricated reference case. It is not a real patient, and no real
> patient data was used to produce it. The name, date of birth, address, insurance, and every
> clinical value were authored for demonstration.

A second reference patient story, told in the same seven-submission structure as [Anna Müller](anna_mueller_story.md), that demonstrates the Shoulder on FHIR pathway for a contrasting clinical scenario: an **acute traumatic, two-tendon, workers'-compensation** case rather than Anna's degenerative, single-tendon, statutory-insurance case. Each submission is a separate FHIR transaction bundle conforming to the bundle profile for its phase, per ADR-0034 (three-bundle architecture).

## Submission inventory

| # | File | Bundle profile | Date | Entries |
|---|---|---|---|---|
| 1 | `kemal_demir_01_registration.json` | `RotatorCuffRegistrationBundle` | 2024-02-26 → 2024-03-01 (pre-op window) | 42 |
| 2 | `kemal_demir_02_surgery.json` | `RotatorCuffSurgeryBundle` | 2024-03-18 | 8 |
| 3 | `kemal_demir_03_followup_6wk.json` | `RotatorCuffFollowUpBundle` | 2024-04-29 | 10 |
| 4 | `kemal_demir_04_followup_3mo.json` | `RotatorCuffFollowUpBundle` | 2024-06-18 | 18 |
| 5 | `kemal_demir_05_followup_6mo.json` | `RotatorCuffFollowUpBundle` | 2024-09-18 | 16 |
| 6 | `kemal_demir_06_followup_12mo.json` | `RotatorCuffFollowUpBundle` | 2025-03-18 | 30 |
| 7 | `kemal_demir_07_followup_24mo.json` | `RotatorCuffFollowUpBundle` | 2026-03-18 | 9 |

Submissions 2–7 reference the Patient + Condition created by submission 1 via persistent logical IDs (`Patient/pat-long-002`, `Condition/kemal-demir-rc-tear`).

Load order matters: submit in order 1 → 7. Each bundle is independently `Bundle/$validate`able against its declared profile.

## Patient

- **Name**: Kemal Demir (identifier `PAT-LONG-002`, logical ID `Patient/pat-long-002`)
- **Date of birth**: 1975-09-10 (age 48 at injury and first visit, 50 at 24-month follow-up)
- **Sex**: male
- **Address**: Rudower Straße 15, 12351 Berlin, Germany
- **Insurance**: workers' compensation — Berufsgenossenschaft der Bauwirtschaft (BG BAU), `Coverage.type = v3-ActCode#WCBPOL` (ADR-0061)
- **Occupation**: roofer (ISCO-08 7121) — employment status: employed full time; occupational physical demand: heavy manual work; occupational overhead exposure: yes (climbing, lifting tiles, frequent overhead work) — a worked example of ADR-0105's own motivating case: a roofer is simultaneously heavy-manual AND overhead-exposed, which the prior single combined axis could not represent
- **Hand dominance**: right (same side as the injury)
- **Tobacco**: current every day smoker, 15 pack-years
- **Sports**: none — no regular recreational sport; physically active through daily construction work
- **Comorbidities**: none recorded — demonstrates that `ShoulderComorbidityCondition` is optional (0..\*), unlike Anna's two comorbidities

## Clinical storyline

### 2024-02-19 — Onset

Kemal falls from a ladder while working on a roof. Immediate severe right shoulder pain and weakness; unable to continue work. No prior shoulder symptoms.

### 2024-02-26 — Initial orthopaedic consultation (Registration bundle #1)

- Pain 8/10 (verbal numeric rating)
- Forward flexion 75° (active), abduction 65° (active) — pain-limited and guarded
- External rotation (at side) 22°, internal rotation to **Sacrum** (hand-behind-back, `InternalRotationVertebralLevel` ordinal, ADR-0088) — not markedly restricted, consistent with a posterosuperior (not subscapularis) tear
- Supraspinatus strength MRC 1/5 (ordinal) + 0.8 kg (dynamometry, `SupraspinatusStrengthDynamometryObservation`, ADR-0089); external rotation strength 2/5 (reduced more than Anna's isolated-supraspinatus case, reflecting the infraspinatus component); internal rotation (composite) strength 4/5; subscapularis strength 5/5 (uninvolved)
- Provocation battery (Hurley A2): Jobe (empty can) **positive**, lift-off negative, belly-press negative, bear-hug negative (subscapularis spared), Hornblower negative
- No atrophy yet (one week post-injury — too early for disuse atrophy to develop); mild residual swelling/bruising from the fall
- Constant–Murley **28** (component-derived entry, ADR-0090: Pain 2/15, ADL 6/20, ROM 16/40, Strength 4/25), Subjective Shoulder Value **28**
- Functional limitation severity: **below-shoulder-level activity limited** (cannot work at heights or overhead, cannot lift tools above shoulder height, difficulty dressing) — a 5-tier coded ordinal (ADR-0105), not free text

Working diagnosis: **full-thickness two-tendon (supraspinatus + infraspinatus) tear, right shoulder, traumatic**. `Condition.code` is fixed by the profile to the single tear inclusion diagnosis (`926335004` Rupture of rotator cuff of shoulder, thickness-neutral), not a clinician choice — Hurley's 13 consensus questions define no disease-entity selection at all (ADR-0111); which tendons (supraspinatus + infraspinatus, via two `TendonsInvolvedObservation` instances — one per tendon, per the ADR-0064 pattern) and etiology (traumatic, via the `condition-dueTo` extension) are captured on separate elements. Unlike Anna, there is no secondary (incidental) diagnosis — the Registration bundle's `otherDiagnosis` slice (ADR-0077) is legitimately empty here, and `Encounter.diagnosis[]` carries a single rank-1 entry.

Both tendons are recorded as full-thickness, so `Observation/kemal-demir-tear-thickness` (ADR-0106, one value per `Condition`, not per tendon) records a single, fully accurate finding here — no per-tendon nuance is lost in this case. (A genuinely mixed-severity two-tendon tear would still expose that `TearThicknessObservation` can't represent two independent per-tendon values; tracked as an open modeling question in `docs/future_work_items/0009-tear-thickness-per-tendon/`, pending a decision between a `bodySite`- or `focus`-based per-tendon design.)

No prior conservative trial is recorded (the Registration bundle's `priorTreatment` slice, 0..\*, is empty). This is clinically appropriate, not a data gap: for an acute traumatic two-tendon tear in a physically demanding occupation, primary surgical referral without a physiotherapy/injection trial is standard of care — conservative treatment is the pathway for degenerative, atraumatic presentations like Anna's, not acute trauma with a defined mechanism and significant weakness.

### 2024-03-01 — MRI right shoulder (3T, non-contrast) — still bundle #1

A lean `ImagingStudy` records the modality obtained (MR), the study date, and the registration visit it belongs to (`encounter`, ADR-0187); the reading itself is captured as discrete, queryable `Observation`s linked to the diagnosis (Patte, Goutallier, tear size, tear location, tear thickness) rather than as free-text narrative:

> Complete full-thickness tear of the supraspinatus tendon at the musculotendinous junction, ~3.8 cm AP, retracted to the humeral head (**Patte II**), with an associated full-thickness tear of the infraspinatus. No fatty infiltration (**Goutallier 0**), consistent with an acute/subacute traumatic tear. Subscapularis and biceps tendon intact. Mild soft-tissue edema and subcutaneous bruising c/w recent trauma. No glenohumeral arthropathy.

Goutallier 0 (normal muscle, no fatty streaks) is deliberately lower than Anna's Goutallier 1 — fatty infiltration is a chronicity marker that takes months to years to develop, and modelling it any higher on a one-week-old traumatic tear would be internally inconsistent with the acute mechanism. For the same reason, the Cofield tear-size bucket is **large** (3–5 cm), not massive (&gt;5 cm) — this IG's massive-bucket definition is written with chronic-pathology framing (fatty infiltration, long-standing retraction) that does not fit an acute two-tendon injury.

### 2024-03-18 — Surgery (bundle #2)

**Arthroscopic double-row suture-anchor repair of the right supraspinatus and infraspinatus**, performed within a month of the injury (guideline-consistent timing for an acute traumatic tear — tendon quality and retraction worsen with delay). The Surgery bundle contains eight entries:

1. A `ShoulderEncounter` for the inpatient surgical admission (class = IMP); `period` (08:30 → 10:20) is *derived* from the operative window below, not separately captured (ADR-0110)
2. The `RotatorCuffProcedure` (`code = 699120002 Arthroscopic repair of rotator cuff`, `category = 387713003 Surgical procedure`), timed via `performedPeriod` (incision **08:30** → suture closure **10:20**, ADR-0108); `performer.actor.display` = **Dr. med. Sabine Hoffmann** (not Hurley-named, L3.H.1 — free-text via `Reference.display` only, no Practitioner directory in this IG)
3. `ProcedureApproachObservation` — **arthroscopic** (postcoordinated procedure-technique axis, ADR-0108, now capturing what `text` alone described before)
4. `ReconstructionExtentObservation` — **complete repair** (SNOMED `304384006`)
5. `FixationTechniqueObservation` — **double-row** fixation — the axis this case was specifically designed to exercise, contrasting with Anna's single-row repair; previously only distinguishable via free-text `Procedure.code.text`, now a coded, queryable field (no separate SNOMED CT concept exists for row count, verified July 2026)
6. `IntraopTearSizeObservation` — tear size confirmed intra-operatively at **3.5 cm**, modestly smaller than the 2024-03-01 MRI estimate of 3.8 cm
7. `IntraopTearSizeClassificationObservation` — Cofield **large** (3–5 cm), the same bucket as the MRI reading despite the numeric difference
8. The `RotatorCuffResearchCarePlan` — the five-timepoint Q11 follow-up schedule (6 weeks / 3 months / 6 months / 1 year / 2 years), anchored to the surgery date (ADR-0129)

The first seven reference the already-persisted Patient + Condition by their logical IDs; the three technique Observations (3–5) additionally reference the specific `RotatorCuffProcedure` (entry 2) via `Observation.partOf`. Unlike Anna Müller's case (where the intra-operative measurement exceeded the imaging estimate and crossed a Cofield bucket boundary), Kemal's discrepancy runs the other way and stays within the same bucket — a deliberate contrast (ADR-0104) illustrating that pre-op imaging vs. intra-operative direct measurement can diverge in either direction: acute peri-traumatic oedema on an MRI obtained only a week after a traumatic injury can inflate the apparent tear margin relative to the debrided intra-operative view.

### Post-operative follow-up trajectory

Each row below is a single `RotatorCuffFollowUpBundle` transaction. The trajectory starts lower and trails Anna's throughout, converging toward a good-but-not-quite-matching plateau by 24 months — clinically expected given the two-tendon involvement and the heavier occupational demand of return-to-work.

| Visit | Bundle | Date | Pain, on average (0–10) | Forward flex. | Abd. | Ext. rot. | Int. rot. (hand-behind-back) | Supra. MRC (dynamometry) | Constant | SSV |
|---|---|---|---|---|---|---|---|---|---|---|
| Pre-op | #1 (Registration) | 2024-02-26 | 8 | 75° | 65° | 22° | Sacrum | 1 (0.8 kg) | 28 | 28 |
| 6 weeks | #3 | 2024-04-29 | 6 | 65° (passive 100°) | — | — | Greater trochanter | — | 35 | 38 |
| 3 months | #4 | 2024-06-18 | 4 | 105° | 95° | 35° | Sacrum | 3 (3.5 kg) | 50 | 55 |
| 6 months | #5 | 2024-09-18 | 2 | 140° | 130° | 55° | L5 | 4 (6.0 kg) | 65 | 68 |
| 12 months | #6 | 2025-03-18 | 1 | 160° | 150° | 65° | L3 | 4 (7.5 kg) | 78 | 80 |
| 24 months | #7 | 2026-03-18 | 1 | 165° | — | 70° | L3 | 5 | 82 | 84 |

- Jobe converts from positive (pre-op through 6 wk) to **negative** by 6 months; lift-off and belly-press are negative at every timepoint tested (subscapularis intact throughout). The full 3-test post-op battery (Hurley A9: Jobe, lift-off, belly-press) is captured at 6 weeks, 6 months, and 12 months, mirroring Anna's pattern.
- At-side internal rotation transiently **regresses** further than Anna's — from Sacrum (pre-op) to Greater trochanter at 6 weeks, reflecting the more protected post-op sling protocol for a two-tendon double-row repair — before recovering past baseline to L3 by 12 months and holding at 24 months.
- Supraspinatus strength still sits at MRC 4/5 at 12 months, where Anna had already reached 5/5, and only reaches 5/5 by 24 months — a two-tendon repair in a manual laborer returning to heavy overhead loading takes longer to reach the ordinal ceiling than an isolated single-tendon repair.
- 12-month visit is the fullest post-op exam: full strength battery, rotation at 90° abduction (external 65°, internal 40°), a fully negative 3-test provocation battery, and a **component-derived** Constant-Murley entry (Pain 12/15, ADL 17/20, ROM 33/40, Strength 16/25, ADR-0090).
- 12-month visit also records **Patient Satisfaction = Somewhat satisfied** (LOINC 77218-6 / `LA27752-7`) and **Return to Sport/Work = Returned to Modified Activities** — Kemal is back at work but not yet cleared for unrestricted overhead roofing load.
- 24-month visit shows continued improvement: satisfaction upgrades to **Mostly satisfied** (`LA24974-0`) as strength and function reach their durable plateau.

## Bundle composition (aggregated across all seven submissions)

| Resource | Count | Where it lives |
|---|---|---|
| Patient | 1 | bundle #1 |
| Coverage | 1 | bundle #1 (workers' compensation, WCBPOL) |
| Condition | 1 | bundle #1: rotator cuff tear (principal) only — no secondary diagnosis, no comorbidities |
| ImagingStudy | 1 | bundle #1 (MR; modality, date, and the registration `encounter` it belongs to) |
| CarePlan | 1 | bundle #2 (2-year post-operative plan, anchored to the surgery date — ADR-0129); each of its 5 `activity` entries carries a `detail.code` (`6-weeks`/`3-months`/`6-months`/`1-year`/`2-years`, the local `Q11TimepointCodes` CodeSystem) discriminating which Q11.a–e timepoint it represents |
| Procedure | 1 | bundle #2: surgical repair only — no prior conservative treatment (acute presentation) |
| Encounter | 7 | bundle #1: registration consultation · bundle #2: surgical encounter · bundles #3–#7: one follow-up encounter each |
| Observation | 120 | spread across all bundles: pre-op exam + imaging classification + tear thickness + pack-years + occupational overhead exposure (bundle #1, ADR-0105/ADR-0106), intra-operative tear-size confirmation + procedure-technique axes (bundle #2, ADR-0104/ADR-0108), post-op exam + PROMs (bundles #3–#7) |

## How to load

The 7 JSON bundles live under `seed/bundles/kemal-demir/` (one level up from this directory); this walkthrough ships alongside them in the published artifact. Load them with:

```bash
./load-kemal-demir.sh
```

Equivalently, in load order (each is an independent FHIR transaction):

```bash
for f in ../seed/bundles/kemal-demir/kemal_demir_0{1,2,3,4,5,6,7}_*.json; do
  curl -X POST -H "Content-Type: application/fhir+json" \
    --data @"$f" \
    http://localhost:8080/fhir/DEFAULT/
done
```

`build-and-deploy.sh` also auto-discovers and loads this case (alongside Anna Müller) via its generalized longitudinal-seed loop — no manual step is needed for a fresh stack or a `--clean` rebuild.

## What the case demonstrates

- **Aggregate PROM scores carrying `focus`** (ADR-0156): every Constant-Murley, SSV, SANE, patient-satisfaction, and return-to-activity Observation references the `RotatorCuffCondition` it scores. These five profiles deliberately carry no `bodySite` (a patient-reported composite has no measurement site, ADR-0074), so `focus` is the only element that says which shoulder the score is about — load-bearing the moment a bilateral patient enters scope.
- A **contrasting clinical arc** to Anna Müller: acute traumatic (vs. degenerative), two-tendon (vs. single-tendon), male/workers'-compensation (vs. female/statutory insurance), heavy manual occupation (vs. sedentary/light overhead), slower and slightly lower-plateauing recovery (vs. Anna's steady near-full recovery).
- **`Coverage.type = WCBPOL`** (ADR-0061) exercised end-to-end in a full longitudinal case, not just a cross-sectional example.
- **Two `TendonsInvolvedObservation` instances on one Condition** (ADR-0064) — the multi-tendon case the single-tendon Anna example cannot demonstrate.
- **`FixationTechniqueObservation` = double-row**, contrasting with Anna's single-row repair (ADR-0108) — exercises both members of the postcoordinated fixation-technique axis across the two example cases.
- **An empty `priorTreatment` slice and an empty `otherDiagnosis` slice** — both legitimately 0..\* — showing the Registration bundle correctly supports a "nothing to report" case without any structural workaround.
- **Goutallier and Cofield staged consistently with an acute mechanism** (Grade 0, large-not-massive) — a concrete worked example of the chronicity-marker distinction documented in the classification profiles.
- A second, independent **PROM and ROM trajectory** for outcome analytics — together with Anna, two longitudinal cases with materially different recovery curves, useful for testing any downstream cohort-level analysis.
