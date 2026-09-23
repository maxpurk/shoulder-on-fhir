# SDC's quantity Observations omit the human-readable `valueQuantity.unit`; unified's populate it

> **Status:** Limitation — open, SDC/unified parity gap. Logged 2026-08-12, found via a live
> `Patient/$everything` comparison of two patients created 2026-08-12, one per frontend (unified
> Friedrich Wagner vs SDC Ingrid Fischer).

## Gap

Every `valueQuantity` Observation emitted by the **SDC** frontend carries `value`, `system`
(UCUM), and `code` (the UCUM code, e.g. `deg`, `{score}`, `cm`, `kg`) but **no `unit`** — the
human-readable display string. The **unified** frontend populates all three plus `unit`
(`"degrees"`, `"MMT grade"`, `"points"`, …). Measured across the two live patients: unified
**47/47** quantity Observations had `unit`; SDC **0/46** did.

Root cause is precise: SDC's generic `buildValue()` for the `Quantity` type
(`sdc-frontend/src/lib/extractor.ts:226–233`) sets `q.value`, and — only when a `ucumCode` is
resolved from the profile — `q.system` + `q.code`, but never `q.unit`. The unified builder
(`frontend/src/lib/observationBuilder.ts:96`, `:132` for components) sets
`unit: input.unitDisplay ?? input.unit` alongside the code.

## Why it matters

`Quantity.unit` is the human-readable label FHIR intends for display; omitting it means the SDC
output is less self-describing (a consumer must resolve the UCUM code to know `{score}` means
"points" or "MMT grade"). It is also the exact element the FHIR Validator flags at submit time
(`the Quantity.unit '…' SHOULD contain the annotation` best-practice warning). Semantically the two
frontends are equivalent — same UCUM `code` — but they are not byte-equivalent for the same data
point, which is the parity target for the two demonstrator paradigms.

## Note

Fix is in `extractor.ts`'s `buildValue()` Quantity branch: also set `q.unit`. The resolution path
first suggested here — read it from the target profile's fixed `valueQuantity.unit` — does not work:
no profile in this IG fixes `unit`, only the UCUM `code` (verified 2026-09-12), and ADR-0188 decided
to keep it that way, since fixing a display string by pattern turns a rendering detail into a
conformance surface.

Nor can the label be derived from the UCUM code alone: `{score}` legitimately renders as `points`
(Constant-Murley), `MMT grade` (ordinal strength), and `pain score` (the four pain axes). The label
belongs to the measurement, not to the unit.

So the fix is one table keyed by `Observation.code`, read by both frontends — `shared/` plus
`tools/sync-shared-code.sh` (ADR-0157) is the right home, since it already solves exactly this
cross-frontend duplication problem. The unified frontend's existing `unitDisplay` entries in
`config/observationMetadata.ts` and `config/followupObservationMetadata.ts` are the content; moving
them into `shared/` and repointing every consumer is the work, which is why ADR-0188 aligned the
unified frontend, the seed bundles, and the IG examples and left this entry open rather than
half-doing the refactor.

## Decision, 2026-09-18: left to the client on purpose

`Quantity.unit` is the human-readable form of the unit. `system` and `code` carry the meaning, and
both frontends emit those identically, so the two submissions are semantically equal and differ
only in a display string.

Pinning the display in the profile would close this for every client at once, because the generic
filler writes whatever fixed parts a profile declares. It was not done. The string is English, the
guide targets European reuse, and a deployment in another language would inherit a label it cannot
use. One UCUM code also carries several displays here: `{score}` reads "points", "pain score" and
"MMT grade" depending on the profile, so the display belongs to the observation and not to the
unit.

The cost is a display string in one frontend's output. The measured cost in the conformance gate is
nothing: the run of 2026-09-18 reports no warning mentioning `Quantity.unit`, because the resources
the gate validates carry the element.

If a future deployment wants the label pinned, the mechanism is a per-profile display argument on
`BoundedQuantity` across its twenty-six call sites, and the generic filler needs no change.
