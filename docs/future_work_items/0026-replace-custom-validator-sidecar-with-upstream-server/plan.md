# Replace the custom validator sidecar with the validator's own `server` subcommand

> **Status:** Future work item — scoped, not implemented, not approved. Captured 2026-09-07 while
> auditing the validation story end to end (FAQ 07).

## Gap

`validator-service/src/ValidatorServer.java` is a hand-written HTTP wrapper around
`tools/validator_cli.jar`. It was written because, at the time (ADR-0051, May 2026, validator
6.9.7), the jar had no server mode — verified then by reading `java -jar validator_cli.jar -help`,
which listed only `-watch-mode` (folder-based, not request/response).

The pinned jar is now **6.10.0** and ships one:

```
Commands:
  server          Run the validator as a lightweight HTTP server.
                  The validator runs as an in-process HTTP validation service.
                  You can configure the FHIR version, connect to a terminology server,
                  and load relevant IGs for validation.
                  The server provides a /validateResource endpoint for POST …
```

So the project maintains ~266 lines of Java that upstream now provides.

## Why it matters

Maintenance surface with no remaining justification. ADR-0051's engine-parity argument is
unchanged either way (both run the same jar), and its footprint analysis — the HL7-maintained
`markiantorno/validator-wrapper` image OOM-ing at 4 GB on the target host — was about a *different*
artifact and does not apply to the in-jar server. The custom wrapper does carry three behaviours
the upstream mode would have to be checked against before a swap: the bounded validation thread
pool, the single-flight dedup of identical in-flight submissions, and the `VALIDATE_TIMEOUT_SECONDS`
bound that returns a clean `503` instead of hanging (ADR-0071, retained by ADR-0080).

Separately, ADR-0051's §Context sentence asserting that `-server` "does not exist" is now dated and
should not be read in the present tense.

## Note

Out of scope for the thesis — the current sidecar works and is engine-identical, so swapping it
buys maintenance, not correctness. If taken up: compare `/validateResource`'s request/response
shape against `preflightValidate.ts`'s expectations in both frontends, confirm the three
resilience behaviours above are either present or unnecessary, and keep the fail-open client
banner regardless. Note also that the validator documentation states that "neither the command
line validator nor the validator website are suitable for production system usage" — which our
advisory, fail-open pre-flight respects, and which any replacement must continue to respect.
