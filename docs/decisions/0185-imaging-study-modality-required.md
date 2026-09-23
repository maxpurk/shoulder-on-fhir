# ADR-0185: `ShoulderImagingStudy.modality` is `1..1`, and the DICOM footprint is stated exactly

**Date:** 2026-09-12
**Status:** Accepted

## Context

`ShoulderImagingStudy` exists to record one fact: which imaging modality was
obtained, and when. ADR-0130 derived that element by re-reading the consensus
statements A5 and A6 and concluding that the registry-capturable residue of a
when-to-image guideline is the modality itself. ADR-0155 added `DX` so a plain
radiograph (A3) uses the same slot, and made the frontends emit one study per
selected modality. ADR-0153 built the follow-up re-imaging study for A13.
ADR-0172 then stripped everything a PACS would carry — series, instance UIDs,
endpoints, the imaging order and the radiology report — because a data-entry
registry does not produce them.

What was left unconstrained is the element the profile is named for. The
generated differential carried `modality` with `mustSupport` and no cardinality,
so it inherited base R4's `0..*`. A conformant `ShoulderImagingStudy` could
therefore carry no modality at all: an imaging record that does not say what
imaging was done. Every instance the system actually produces carries exactly
one — both frontends, the guide's own example, and both seed bundles — so the
gap was between the stated design and the checkable profile, not in the data.

Tracing this also surfaced two cells in `mapping/SECEC_FHIR_Mapping.csv` that
still described the retired structure. Rows `Q13` and `L3.I.3` gave the FHIR
path as `ImagingStudy.series.modality`, a path that has no counterpart in the
profile, in either frontend, or in the seed data; rows `Q3`, `Q5` and `Q6`
already said `ImagingStudy.modality`. The `Q13` note additionally described the
follow-up `entry[imagingStudy]` slice as `0..1`, where
`RotatorCuffFollowUpBundle` declares `0..*`.

Separately, the DICOM footprint is easy to overstate. It is one ValueSet
(`ImagingModality`), four codes, one binding. The thesis introduction excluded
from scope "deep imaging-archive integration (DICOM) beyond a simple reference
to an imaging study", but no resource in the guide holds a reference to an
`ImagingStudy`; the study is a standalone record of modality and date.

## Decision

1. Constrain the element the profile exists for:

```
* modality 1..1 MS
* modality from ImagingModality (extensible)
```

`1..1` also states the one-study-per-modality rule as a constraint instead of
leaving it to the profile Description and the bundle slice comments. The binding
stays `extensible`, so any other DICOM acquisition-modality code remains valid.

2. Correct the two mapping cells: `ImagingStudy.series.modality` becomes
`ImagingStudy.modality` on `Q13` and `L3.I.3`, and the `Q13` note states the
`0..*` follow-up slice as the end state.

3. Reword the thesis scope exclusion to describe what the artifact holds.

## Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Leave `modality` at `0..*` | Same defect class as ADR-0184's prose-only visit anchor: the profile, not a particular frontend, is supposed to be the guarantee. An imaging record with no modality is not a record of anything. |
| `1..*` instead of `1..1` | Would permit one study listing several modalities, which contradicts the one-study-per-modality rule ADR-0155 established and which the SDC extractor explicitly implements by splitting a repeating modality leaf into separate studies. `1..*` would make two inconsistent shapes both conformant. |
| Tighten the binding from `extensible` to `required` | The four codes cover shoulder practice, but a site imaging with a modality outside the set (for example `XA`) should be able to record it truthfully. `extensible` is the right strength for a facet the consensus never enumerated. |
| Require an `ImagingStudy` in the registration bundle, to enforce A3 | A registry records what happened; it does not gate a submission on guideline compliance. `entry[imagingStudy]` stays `0..*`, consistent with how the no-consensus A7 ultrasound finding is handled. |
| Add a follow-up `ImagingStudy` to an example patient so A13 is exercised in seed data | Both example patients are ordinary post-operative courses with no research protocol; adding one would fabricate a research enrolment neither story has. The path stays code-complete in both frontends and unexercised in the seed. |

## Consequences

✅ An `ImagingStudy` with no modality is now a validation error.
✅ The one-study-per-modality rule is machine-checked rather than asserted in prose.
✅ The mapping's FHIR paths match the profile, the frontends, and the seed data on every imaging row.
✅ The DICOM footprint is stated exactly where it is described: one ValueSet, four codes, one binding, no PACS objects.
⚠️ Breaking for an external submitter that posts an `ImagingStudy` with an empty or multi-valued `modality`. Intentional, and narrow: the guide's own producers have always emitted exactly one.
⚠️ The A13 research re-imaging path remains unexercised in the example data, as above.

## Sources

- `ig/input/fsh/profiles/ShoulderImagingStudy.fsh` — the Modality section
- `ig/fsh-generated/resources/StructureDefinition-shoulder-imaging-study.json` — where the missing cardinality was visible
- `seed/.fhir-r4-core-cache/extracted/package/StructureDefinition-ImagingStudy.json` — base R4: `modality 0..*`, `series 0..*`, `series.modality 1..1`
- `ig/input/fsh/valuesets/ImagingModality.fsh` — the four DCM codes, the guide's whole DICOM footprint
- `mapping/SECEC_FHIR_Mapping.csv` — rows `Q3`, `Q5`, `Q6`, `Q13`, `L3.I.3`
- `ig/input/fsh/profiles/RotatorCuffFollowUpBundle.fsh` — `imagingStudy 0..*`
- `frontend/src/components/wizard/StepImaging.tsx`, `frontend/src/components/followup/FollowUpWizard.tsx`, `sdc-frontend/src/lib/extractor.ts` — the producers, all single-modality per study
- ADR-0130, ADR-0153, ADR-0155, ADR-0172 — how the element was derived, extended, and stripped back
- ADR-0184 — the same defect class, prose contract left unconstrained
