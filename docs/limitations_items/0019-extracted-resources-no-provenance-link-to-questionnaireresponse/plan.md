# Extracted clinical resources carry no provenance link back to the QuestionnaireResponse

> **Status:** Limitation — open, widened 2026-09-17, provenance and auditability, in the FHIR R4
> QuestionnaireResponse-vs-Observation boundary. Classified against the expert consensus: **none** — this touches the L3
> operational/provenance envelope, not any `Q#.#` consensus element.

## Gap

The SDC flow extracts a `QuestionnaireResponse` into discrete profiled resources (`Observation`,
`Condition`, `Procedure`) and assembles them into a transaction `Bundle`.
`RotatorCuffRegistrationBundle` and `RotatorCuffFollowUpBundle` both carry a `questionnaireResponse`
slice for the QR to travel in, and `RotatorCuffQuestionnaireResponse.questionnaire 1..1 MS` records
*which* form was answered.

**The generic form filler does not fill that slice.** It builds the QR in memory as the input to
extraction (`sdc-generic-frontend/src/App.tsx`) and never submits it: its only writes are the
pre-flight validation POST, the transaction bundle POST, and a terminology `$expand`. Neither
extraction mechanism produces a QR entry either, because no Questionnaire declares one. None of the
six forms carries a `QuestionnaireResponse` entry in its contained template, and none names
`rotator-cuff-questionnaire-response` in a `definitionExtract`. The QR is therefore discarded at the
moment the bundle is built. Since HAPI persists bundle entries and not the envelope, nothing durable
records what was submitted as a unit, or how it was captured. Closing this is an edit to the
Questionnaires, not to the filler: a template gains a `QuestionnaireResponse` entry, and a
definition-based form gains a root `definitionExtract` naming the QR profile.

What is missing on top of that is the link in the *other* direction: no extracted resource references
the QR it was derived from. `Observation.derivedFrom` (which R4 explicitly allows to reference a
`QuestionnaireResponse`) is not set, and no `Provenance` resource is emitted — `grep` for
`derivedFrom`/`Provenance` across both `frontend/src` and `sdc-frontend/src` returns nothing. So
given a stored `Observation`, there is no machine-traversable path back to the exact submitted form
instance (and the verbatim answer) that produced it. In the unified typed-builder flow the gap is
wider still: its registration/surgery submissions build resources directly with no QR at all, so
there is no capture-provenance object to link to in the first place.

## Why it matters

The FHIR R4 boundary text is the reason extraction is the right modelling choice
(`QuestionnaireResponse` preserves "*the specific phrasing and organization of the questions*",
whereas `Observation` keeps "*only … the meaning of the answer, not what question was asked*") — but
that same boundary is why the two should stay *linked*: the discrete resource is queryable, the QR is
the audit record of how the value was captured. Without `derivedFrom`/`Provenance`, the registry can
answer "what is the value" but not "which filled form, answered when and by which flow, is this value
sourced from" — a weaker audit trail than a research registry would ideally want, and a break in the
capture→record traceability even when both artifacts sit in the same bundle.

## Note

Low-cost, additive refinement, no modelling change to any existing profile: set
`Observation.derivedFrom` (and `Condition`/`Procedure` equivalents, or a single `Provenance` per
submission) to the in-bundle QR `urn:uuid` during assembly, once a QR is carried in the bundle at
all. Bringing the same provenance to the unified flow would first require it to emit a QR (larger
scope — likely a `future_work_items/` entry if pursued). Inert under thesis-freeze; relevant to any
deployment that outlives the thesis. Related: FAQ #5 names this refinement in its "why extract at
all" section; the extract/store split itself is sound (ADR-0031/0034/0037) — this is purely the
missing back-reference.
