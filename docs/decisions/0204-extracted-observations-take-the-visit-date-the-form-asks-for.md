# ADR-0204: Extracted observations take the visit date the form asks for, and fall back to entry time

**Date:** 2026-09-18
**Status:** Accepted
**Relates to:** ADR-0202 (extraction declarations name real element ids), ADR-0204 (the definition-based forms attribute the aggregate PROMs), ADR-0129 (Q11 follow-up timepoints computed from the index procedure date)

## Context

`DeclareObservation` and `DeclareObservationExistingSubject` declared
`Observation.effective[x]` from the FHIRPath literal `now()`. Every observation
the definition-based forms create therefore carried the moment of data entry and
never the time of the visit it belonged to.

Two of the three forms already hold the visit time and use it correctly
elsewhere in the same bundle. `ShoulderSurgeryQuestionnaire` asks for incision
and closure times, `encounter.startDate` and `encounter.endDate`, and writes them
to `Encounter.period` and to `Procedure.performed[x]`.
`ShoulderFollowUpQuestionnaire` asks for a visit date, `encounter.date`, and
writes it to `Encounter.period.start`. The observations captured at those same
visits were still stamped `now()`.

Given one set of answers that included a visit date in the past, the two
extraction mechanisms returned different `effective[x]` values for the same
measurement. A submission entered a week after the visit filed its measurements
under the entry date, so a query selecting a time range drew the wrong cohort,
and `now()` always yields a valid `dateTime`, so nothing in validation objected.

## Decision

The effective time is taken from the visit-date answer the form asks for, and
falls back to entry time when the form asks for none:

```
iif(<encounter.date answer>.exists(),    <encounter.date answer>,
iif(<encounter.startDate answer>.exists(), <encounter.startDate answer>,
    now()))
```

One expression serves all three forms. Follow-Up resolves the first branch,
Surgery the second, Registration neither. The alternative was to parameterise the
rule sets on a date link id, which would have meant editing all 157
`insert Declare…` call sites across the three forms for a value that two of them
answer the same way.

The fallback is not a convenience. `Observation.effective[x]` is mandatory on
these profiles, so an expression that can yield nothing would produce an
unextractable resource whenever the question is blank. The same shape is already
used by the template forms, which write
`iif(…encounter.date…exists(), …, now())` into `Encounter.period.start`.

## The registration visit date stays unasked

`ShoulderRegistrationQuestionnaire` asks no visit date, so its observations keep
entry time. Adding one was considered and rejected.

Classified against the expert consensus it is an out-of-consensus addition: the
consensus names no registration visit date, no bundle profile requires one, and
adding a question adds data-collection burden at the point of capture. The
standing rule for that class is to leave it out and record it.

The fallback is also defensible on its own terms here. Registration creates the
encounter it describes, so for a form filled at the visit, entry time is the
visit time. The gap is the retrospective case, where a site registers a patient
some days after the consultation. That case stays open and is recorded in
`limitations_items/0035`.

This is the one place where the two mechanisms still disagree on measurement
time, because the registration template form does ask a date and falls back the
same way.

## Consequences

Follow-Up and Surgery submissions now carry the visit time on every extracted
observation, so ordering a patient's record and selecting a time range work from
the clinical date.

`$extract` over those two forms becomes reproducible: the same
`QuestionnaireResponse` submitted twice yields the same `effective[x]`, which it
did not while the value was `now()`. Registration remains non-reproducible in
that one element.

Nothing stored changes. Existing observations keep the values they were written
with, and the element is mandatory and still populated in every case.
