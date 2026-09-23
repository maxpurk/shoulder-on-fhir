# Backfill `RotatorCuffResearchCarePlan` for pre-ADR-0129 surgeries

> **Status:** Future work item — accepted migration boundary, not yet closed. A sibling issue,
> duplicated Q11 offset constants across frontends, is resolved by ADR-0157 and out of scope here.

## Gap

ADR-0129 auto-generates the Q11 follow-up schedule from the index procedure date on every new
Surgery submission, going forward. No backfill exists for a surgery recorded before that change —
such a patient has no `CarePlan` unless added by hand (as was done manually for the two
longitudinal example patients).

## Why it matters

The mapping's `Full` claim for Q11.a–e is genuinely demonstrated by both frontends' write paths,
but not retroactively true for any pre-existing registry data recorded under the old model.

## Note

Needs either a one-off backfill script or accepting this as a known migration boundary.

## Related limitations

- Resolved, and worth knowing before this item is picked up: `RotatorCuffSurgeryBundle` now declares
  a `carePlan` entry slice bound to `RotatorCuffResearchCarePlan`, so a backfill lands into a
  profile that constrains the slot it fills.
