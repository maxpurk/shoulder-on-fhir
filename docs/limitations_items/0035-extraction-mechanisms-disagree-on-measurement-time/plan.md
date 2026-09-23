# The registration form stamps a measurement with entry time, not visit time

> **Status:** Limitation, open, and narrowed. Affects `Observation.effective[x]` on the
> observations `ShoulderRegistrationQuestionnaire` creates. The Surgery and Follow-Up forms now
> take the visit date the form asks for.

## Gap

`rulesets/SdcExtractionRuleSet.fsh` reads the effective time from the visit-date answer a form
carries, and falls back to entry time when a form carries none. `ShoulderFollowUpQuestionnaire`
answers it with `encounter.date` and `ShoulderSurgeryQuestionnaire` with `encounter.startDate`,
so both now file a measurement under the time of the visit it was taken at.

`ShoulderRegistrationQuestionnaire` asks no visit date. Its observations take the fallback, and
`Encounter.period.start` is fixed to the same value at the form root, so there is nothing to read
even if the rule set were changed.

Its template counterpart, `ShoulderRegistrationFullTemplateQuestionnaire`, does ask
`encounter.date` and uses it for `Encounter.period.start`, `Condition.onsetDateTime` and
`Condition.recordedDate`, falling back to a computed value only when the question is left blank.

So for registration, and only for registration, the two mechanisms still return different
`effective[x]` values from one set of answers.

## Why it matters

For a registration filled at the visit, entry time is the visit time and nothing is wrong. The
exposure is the retrospective case: a site that registers a patient some days after the
consultation files the baseline measurements under the entry date. A registry filtering by date
then draws the wrong cohort for that patient, and a before-and-after comparison measures from the
wrong point.

Nothing catches it. The fallback always yields a valid `dateTime`, so the resource conforms and
the validator stays silent.

`$extract` over the registration form is also not reproducible in this one element. The same
`QuestionnaireResponse` submitted twice yields two different effective times. The Surgery and
Follow-Up forms no longer have this property.

## Note

Closing it means asking a registration visit date. That is an out-of-consensus addition: the
expert consensus names no such element, no bundle profile requires one, and a new question adds
data-collection burden at the point of capture. The decision to leave it unasked, and the
reasoning, are recorded in the decision record that introduced the visit-date expression.

If it is ever added, the rule set needs no change. The expression already reads
`encounter.date` first, so a registration question under that link id would be picked up with no
edit to any of the 157 declaration sites.

`limitations_items/0013` covers a separate question about the same element: the precision the
value is written at, rather than where the value comes from.
