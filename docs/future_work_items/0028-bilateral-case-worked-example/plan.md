# No worked bilateral example exercises `Observation.focus`

> **Status:** Future work — deliberately deferred. Logged 2026-09-12; the structural capability was
> added by ADR-0156, and the seed bundles were brought in line with it on the same date.

## Gap

ADR-0077 made `RotatorCuffRegistrationBundle.condition` `1..*`, so a bilateral tear is
representable: two `RotatorCuffCondition` instances for one patient. ADR-0156 added
`focus 0..1 MS → RotatorCuffCondition` to the five aggregate PROM profiles so a Constant-Murley,
SSV, SANE, satisfaction, or return-to-activity score says which of those Conditions it scores —
necessary because ADR-0074 deliberately excludes `bodySite` from those five, leaving nothing else to
disambiguate a side.

Both longitudinal example patients are unilateral. `focus` is populated for both (each score points
at the patient's single Condition), so the element is exercised, but the *ambiguity it exists to
resolve* is not: no example has two Conditions for one patient, and therefore nothing demonstrates
`focus` actually separating two scores that would otherwise be indistinguishable.

## Why it matters

The mechanism is the kind that looks correct until real bilateral data arrives. Without an example
carrying two Conditions and PROM scores attached to each, neither the frontends' Condition-selection
behaviour nor a consumer's ability to group scores by side has ever been exercised end to end. It is
also the one place where the guide asserts a capability it does not demonstrate.

## Note

A third example patient with a bilateral tear would cover it: two `RotatorCuffCondition` instances
in one registration bundle, per-side laterality on every physical measurement via `bodySite`, and
per-side PROM scores distinguished only by `focus`. Both frontends would need checking first —
whether either lets the user attach a score to a chosen Condition when a patient has two, or
whether both silently assume one. That check is the real work; the example data is the easy part.
