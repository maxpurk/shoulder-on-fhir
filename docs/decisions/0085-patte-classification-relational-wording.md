# ADR-0085: Patte classification wording corrected to a relational "retracted tendon end" framing

**Date:** 2026-07-18
**Status:** Accepted

## Context

Next point in the surgeon-review notes, after Comorbidities (ADR-0084):

The Patte description should change: not "[the] proximal stump", but rather "[the] stump is proximal of/to [X]".

The note is terse enough to admit two readings — one about renaming the compound "proximal stump," the other about restructuring the sentence to be relational. This is a clinical-precision wording call, not something to guess: routed through the `shoulder-surgeon` subagent per this project's clinical-feedback workflow rather than picking a reading myself.

**Classification against Hurley**: Q4.d names "Patte" as a required tear-classification component; the consensus paper is silent on display-string wording. This is a **Refinement** — full design freedom, `Full` status on `Q4.d` unaffected.

## Clinical review (shoulder-surgeon subagent)

Confirmed the surgeon's reading is correct, and identified two distinct problems with the prior wording (`"Stage I - Proximal stump near insertion"` etc.):

1. **"Proximal stump" is the wrong construction.** Patte staging grades *where the retracted tendon end has migrated to* — the stump doesn't have a fixed "proximal" identity; the degree of medial/proximal retraction is the variable being staged.
2. **The "near/at [landmark]" phrasing is a vague appositive, not relational.** It should state the *position* of the retracted tendon end relative to a fixed landmark, matching Patte's own staging logic (footprint → humeral head → glenoid, in increasing retraction severity).

The three landmarks themselves were confirmed correct and standard for Patte 1990 (Patte D. *Classification of rotator cuff lesions.* Clin Orthop Relat Res. 1990;254:81-86) — not changed, only the framing.

## Decision

Rewrite all three `display`/definition pairs in `PatteClassificationCodes` (and the matching inlined strings in the `PatteClassification` ValueSet) to consistently frame the *position of the retracted tendon end* as the graded variable, replacing "proximal stump" with "retracted tendon end":

| Code | `display` | `definition` |
|---|---|---|
| `#I` | Stage I - Retracted tendon end at the bony insertion | Minimal retraction: the retracted (medial) end of the torn tendon lies at or near the level of the bony insertion (footprint), close to its anatomical attachment site. |
| `#II` | Stage II - Retracted tendon end at the humeral head | Moderate retraction: the retracted tendon end lies at the level of the humeral head — retracted medially away from the footprint but still lateral to the glenoid. |
| `#III` | Stage III - Retracted tendon end at the glenoid | Severe retraction: the retracted tendon end lies at the level of the glenoid, i.e. at or medial to the glenoid rim. |

No frontend change needed — the Patte dropdown is fully dynamic (`useValueSet` → `$expand`), confirmed via grep that no source file hardcodes "Proximal stump" text anywhere in either frontend. No mapping CSV/`.md` change — Q4.d's Notes column references the mechanism generically, not the specific wording.

## Consequences

✅ `Q4.d` remains `Full` — no denominator or percentage change.

✅ Non-breaking: `code` values (`#I`/`#II`/`#III`) are unchanged, only `display` and the CodeSystem's `definition` text — no frontend/backend logic depends on display text, only on the code.

✅ Example data (`seed/bundles/example-patients.json`, 3 occurrences; `example_data/anna_mueller_01_registration.json`, 1 occurrence) updated for consistency, though `Coding.display` is non-normative and stale display text would not have failed validation.

## Sources

- Clinical review by the reviewing shoulder surgeon
- `shoulder-surgeon` subagent clinical review (2026-07-18)
- Patte D. Classification of rotator cuff lesions. Clin Orthop Relat Res. 1990;254:81-86 (already cited in the CodeSystem's own Description)
- `ig/input/fsh/codesystems/PatteClassification.fsh`, `valuesets/PatteClassification.fsh`
