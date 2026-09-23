# Populate `Condition.extension[assertedDate]`

> **Status:** Future work item — an explicit decision to defer rather than build a UI field.

## Gap

`RotatorCuffCondition` inherits `extension[assertedDate]` from `condition-eu-core` (ADR-0038), but
no frontend has a UI field for it and no seed patient's `Condition` resource sets it.

## Why it matters

Low — the element is a near-duplicate of the already-populated `Condition.recordedDate` (both
answer "when was this documented", not a clinically distinct fact like onset). Not Hurley-named.
