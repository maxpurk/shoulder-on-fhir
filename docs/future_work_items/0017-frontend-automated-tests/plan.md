# Add automated tests to both frontends

> **Status:** Future work item — not implemented, not approved.

## Gap

`frontend/` lists no test framework at all (Vitest/Jest/RTL/Playwright/Cypress) and contains no
test files. `sdc-frontend/` has Vitest wired (`vitest.config.ts`, `npm test`) but carries a single
spec, `src/lib/calculatedExpression.test.ts`. Correctness currently rests entirely on `tools/validate.sh` +
manual browser QA — several real bugs (the Follow-Up `Observation.category` mistagging, the
`performedPeriod`/`performedDateTime` stale-read defect, three ADR-0090 UI bugs) were only caught
by manual passes, invisible to `tsc`/ESLint.

## Why it matters

`tsc`/ESLint and `tools/validate.sh` passing are both necessary but not sufficient for frontend
correctness — a regression of the same shape as the bugs above could silently ship again.

## Note

Two independently-useful increments if picked up: (1) Vitest unit tests on the FHIR-bundle-
construction/validation logic in `lib/` (pure functions, highest value per effort); (2) a handful
of Playwright E2E specs per frontend covering the golden-path flows plus the specific edge cases
already caught manually, reusing the existing browser-automation harness.

## Related limitations

Five open limitations are cross-frontend divergences found the same way: by hand-diffing
`Patient/$everything` between manually built patients, one per frontend. A single automated
bundle-diff over the same flows would have caught all five, and is what would catch the next one.

- `limitations_items/0009-sdc-follow-up-encounter-type-exposed-to-user/`
- `limitations_items/0010-sdc-registration-encounter-period-end-missing/`
- `limitations_items/0012-sdc-quantity-observations-omit-unit-display/`
- `limitations_items/0013-effectivedatetime-precision-inconsistent-across-frontends/`
- `limitations_items/0014-patient-field-parity-use-country-across-frontends/`
