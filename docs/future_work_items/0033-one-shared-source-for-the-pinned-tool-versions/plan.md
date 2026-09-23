# The pinned tool versions live in three places, and only one of them is shared

> **Status:** Future work, scoped and not started. Deferred as toolchain work with no defect
> behind it: nothing is drifting today.

## Gap

Four build tools are pinned, and they are pinned in three different files.

`tools/validator-pin.sh` holds the FHIR Validator CLI version and is sourced by `tools/validate.sh`,
`build-and-deploy.sh` and `deploy/bootstrap-server.sh`. That is the shape the other three want.

The IG Publisher version and its image digest are literals in `build-and-deploy.sh`. `SUSHI_VERSION`
is a literal in `deploy/bootstrap-server.sh`, which enforces it by reading `sushi --version` and
installing the exact version on mismatch. `build-and-deploy.sh` then calls bare `sushi` off `PATH`
and asserts nothing, so a development machine can compile the guide with a version the server would
have corrected.

## Why it matters

SUSHI compiles the FSH that is the guide. A machine running a different version can produce a
different `fsh-generated/` from identical source, and nothing in the repository would show it.

Nothing is drifting at the moment. The pin is 3.20.0 and the development machine reports 3.20.0, so
this is an exposure and not a live defect. That is why it is future work and not a limitation.

Bumping a version today also means finding every place it is written, and the answer differs per
tool, which is the kind of asymmetry that gets one of them missed.

## Note

One shared source read by both scripts, holding the Validator CLI version, the IG Publisher version
and digest, and `SUSHI_VERSION`, with one bump point each. `tools/validator-pin.sh` already proves
the pattern, so the work is extending it rather than inventing it.

`build-and-deploy.sh` should then assert the local SUSHI matches, in the same shape as the publisher
jar's checksum gate: detection before execution, and a hard exit rather than a silent difference.
Do not auto-install on mismatch, for the same reason the jar gate does not refetch.
