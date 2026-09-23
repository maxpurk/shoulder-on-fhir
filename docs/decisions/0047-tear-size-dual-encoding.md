# ADR-0047: Dual encoding of Hurley Q4.a "Size" — continuous linear cm + categorical Cofield bucket

**Date:** 2026-05-19
**Status:** Accepted
**Builds on:** ADR-0008 (one profile per Observation type), ADR-0010 (custom CodeSystems for orthopedic terminology), ADR-0027 (complete SECEC coverage via standard terminologies), ADR-0039 (three-layer SECEC accounting)

## Context

Hurley et al. (2024) Q4 enumerates five tear-classification axes, of which Q4.a is the single word **"Size"**. The Hurley paper does not specify a representation; it neither names units nor a categorical scale.

The IG initially implemented Q4.a as `TearSizeObservation` with `value[x] only Quantity`, UCUM `cm`, capturing the maximum tear diameter as a continuous linear measurement. The element was marked **Partial** in the SECEC mapping (no LOINC code exists for rotator-cuff tear-size measurement — verified May 2026 against the LOINC FHIR TX server; closest matches `LA25586-1` and `LA22224-2` are not measurement concepts).

In parallel, the dominant convention in the shoulder surgery literature is the **Cofield categorical scale** (Cofield, 1982; Cofield et al., 2001): *small* (<1 cm), *medium* (1–3 cm), *large* (3–5 cm), *massive* (>5 cm). Every major outcomes paper (Bikkanuri 2024 included), every operative note, every shoulder registry abstract reports Cofield, not raw centimetres. A registry that captures only cm forces every downstream consumer to re-bucket — introducing rebucketing variance and complicating aggregate comparisons against the published literature.

Information-theoretically, the linear cm measurement is **richer**: Cofield can always be computed from cm, but cm cannot be recovered from a Cofield bucket. FHIR best practice favours capturing the richer form. But pragmatically, the categorical bucket should also be captured at the source so the IG (a) aligns with the clinical vocabulary, (b) supports downstream aggregation without re-bucketing, and (c) matches the existing pattern used by Goutallier (Q4.e) and Patte (Q4.d) — both categorical observations that coexist with quantitative imaging metadata.

SNOMED CT International Edition (verified May 2026) contains no precoordinated concepts for the Cofield buckets (`snomed_lookup` for "small tear of rotator cuff", "massive tear of rotator cuff", "Cofield classification" — all returned thickness / etiology / laterality codes only). A custom CodeSystem is therefore required, mirroring `GoutallierClassificationCodes` and `PatteClassificationCodes`.

## Decision

1. **Decompose Hurley Q4.a "Size" into two sibling Observations** — both encode Q4.a; both are anchored to the same Encounter and (when imaging-derived) referenced from `Condition.evidence.detail`:
   - `TearSizeObservation` (existing, unchanged): `value[x] only Quantity`, UCUM `cm`. Coded `ShoulderObservationCodes#tear-size`.
   - `TearSizeClassificationObservation` (new): `value[x] only CodeableConcept`, `required`-bound to `CofieldTearSizeClassification`. Coded `ShoulderObservationCodes#tear-size-classification`.

2. **Add a dedicated CodeSystem `CofieldTearSizeClassificationCodes`** with four concepts (`small`, `medium`, `large`, `massive`), each with description text giving the cm boundaries. This follows the per-classification CodeSystem pattern already established by `GoutallierClassificationCodes` and `PatteClassificationCodes` (one CS per clinical scale; thin VS wrapper).

3. **Add `CofieldTearSizeClassification`** as the binding ValueSet (FHIR profile bindings must reference a ValueSet, never a CodeSystem directly).

4. **Add `#tear-size-classification` to `ShoulderObservationCodes`** so the new profile fixes `Observation.code` to a local concept consistent with the rest of the IG.

5. **Register the decomposition as an interpretation note** in `mapping/SECEC_FHIR_Mapping.md` (Interpretation notes section, alongside Q1.h "Pain" and Q1.j "Sports") so the thesis Methods chapter can reference it as a worked example of consensus-element decomposition.

6. **Keep Q4.a marked Partial.** Although the categorical encoding is now captured by a standard-pattern local CodeSystem, the continuous-measurement axis still lacks a precoordinated LOINC code. Per ADR-0036 / ADR-0039 we report coverage honestly and do not upgrade Partial → Full on a structural addition that does not eliminate the LOINC gap. The denominator stays 58 (one Hurley sub-element with a dual implementation, not two sub-elements).

7. **Update both Questionnaires** (`ShoulderRegistrationQuestionnaire`, `ShoulderSurgeryQuestionnaire`) to include the paired classification item next to the existing cm item, pointing `definition` to the new profile. The Follow-Up Questionnaire is unchanged (tear size is captured at T0 pre-op imaging and T1 intra-op confirmation only).

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Keep cm only (status quo) | Loses the clinical lingua franca; forces downstream re-bucketing variance; misaligns with Bikkanuri (2024) and the rest of the shoulder literature. |
| Switch to Cofield only (replace cm) | Loses information — Cofield is derivable from cm but cm cannot be recovered from Cofield. Violates the FHIR best practice of capturing the richer queryable form. |
| Single Observation with `component[]` (cm component + Cofield component) | Inconsistent with ADR-0008 ("one profile per code × `value[x]`"). Goutallier and Patte are separate Observations, not components of an imaging-classification multi-component Observation. Mixing categorical and quantitative `value[x]` across components of one Observation is awkward to validate and to query. |
| Use `Observation.interpretation` to carry Cofield | `interpretation` is reserved for normal/abnormal/high/low flags relative to a reference range, not for derived categorical classification of a quantity. Misuse would block real reference-range interpretations later. |
| Bind Cofield to a SNOMED ECL filter | No precoordinated SNOMED concepts exist for the buckets; an ECL filter would expand to an empty set. SNOMED extension proposal is appropriate future work but not a present-day binding. |

## Consequences

✅ Q4.a now matches the shoulder-literature vocabulary while preserving the richer linear measurement.
✅ Pattern parity with Q4.d (Patte) and Q4.e (Goutallier) — three classification axes, three dedicated CodeSystems, three derived Observation profiles.
✅ Anna Müller longitudinal example (T0 imaging) and the synthetic surgery example (T1 intra-op) carry both forms, giving thesis Results §5.6 a concrete worked instance of the decomposition.
✅ Methods §4.2.2 (decomposition rules) gains its cleanest worked example — bare "Size" → continuous × categorical with explicit FHIR-best-practice rationale.
⚠️ Q4.a remains **Partial** in the SECEC mapping; this ADR does not close the LOINC gap on the continuous-measurement axis. A long-term path is a LOINC submission for "Maximum rotator-cuff tear diameter [Length] in Shoulder by MRI / Imaging".
⚠️ Adds a 12th local CodeSystem to the IG; the standard-terminology-first rule (ADR-0010 / ADR-0027) is honoured because no SNOMED CT or LOINC precoordination exists at the bucket granularity.
⚠️ Surveys / data submissions completed against the old single-observation form remain valid (the cm profile is unchanged); only the optional sibling is new.
❌ None — the change is purely additive at the profile / VS / CS level.

## Sources

- `ig/input/fsh/profiles/observations/TearSizeObservation.fsh` — existing cm profile (description updated to reference Q4.a letter notation and this ADR)
- `ig/input/fsh/profiles/observations/TearSizeClassificationObservation.fsh` — new categorical profile
- `ig/input/fsh/codesystems/CofieldTearSizeClassification.fsh` — new CodeSystem (small / medium / large / massive)
- `ig/input/fsh/valuesets/CofieldTearSizeClassification.fsh` — new ValueSet
- `ig/input/fsh/codesystems/ShoulderObservation.fsh` — new `#tear-size-classification` concept; `#tear-size` description updated to flag the sibling
- `ig/input/fsh/instances/ShoulderRegistrationQuestionnaire.fsh` line 322 — paired Cofield item added
- `ig/input/fsh/instances/ShoulderSurgeryQuestionnaire.fsh` line 169 — paired Cofield item added
- `ig/input/fsh/examples/ShoulderSurgeryBundle.fsh` — `ExampleIntraOpTearSizeClassification` instance
- `example_data/anna_mueller_01_registration.json` — `anna-mueller-tear-size-classification` Observation referenced from `Condition.evidence.detail`
- `mapping/SECEC_FHIR_Mapping.csv` Q4.a row — dual-encoding documented
- `mapping/SECEC_FHIR_Mapping.md` Interpretation notes — Q4.a entry
- Cofield RH. *Surg Gynecol Obstet.* 1982;154(5):667–72. Cofield RH, et al. *J Bone Joint Surg Am.* 2001;83(1):71–7.
- Hurley ET, et al. *JSES International.* 2024;8(3):478–482.
