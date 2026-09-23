# Patient `name.use` / `address.use` / `address.country` / `identifier.use` differ between frontends

> **Status:** Limitation — open, SDC/unified parity gap (minor/cosmetic). Logged 2026-08-12, found
> via a live `Patient/$everything` comparison of two patients created 2026-08-12, one per frontend.

## Gap

The two frontends build the `Patient` resource with the same profile
(`shoulder-patient`), the same identifier system, and the identical
`individual-recordedSexOrGender` sex-at-birth extension (LOINC 76689-9) — but populate a handful of
optional scaffolding fields differently:

| Element | Unified (Friedrich Wagner) | SDC (Ingrid Fischer) |
|---|---|---|
| `name.use` | `"official"` | *omitted* |
| `address.use` | `"home"` | *omitted* |
| `address.country` | `"DE"` | *omitted* |
| `identifier.use` | *omitted* | `"official"` |

So each frontend sets a slightly different subset of the optional `use`/`country` metadata, in a
mirror-image pattern (unified marks the name/address, SDC marks the identifier).

## Why it matters

None of these are conformance failures — all are optional and both Patients validate — but the two
demonstrator paradigms are meant to be byte-comparable over the same IG, and a downstream consumer
filtering on `address.country = "DE"` or `name.use = official` would see one patient and not the
other. Lowest-severity of the parity gaps found in this comparison; recorded for completeness.

## Note

Fix is a few literal additions on whichever side is chosen as canonical: either add
`name.use`/`address.use`/`address.country` to SDC's `bundleAssembler.ts` Patient literal, or drop
them from unified's `frontend/src/lib/*` Patient builder — and align `identifier.use` the same way.
Agree one shape and mirror it. Not implemented here — flagged per this session's request rather than
fixed inline.
