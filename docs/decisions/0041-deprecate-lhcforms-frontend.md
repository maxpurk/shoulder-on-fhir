# ADR-0041: Deprecate LHC-Forms frontend; move to archive

**Date:** 2026-05-19
**Status:** Accepted for the paradigm it retired; a different LHC-Forms application has since been built and runs (see §Amendment).
**Supersedes:** ADR-0023 (LHC-Forms as third frontend — Questionnaire renderer without client-side extraction)

## Amendment (2026-09-18) — LHC-Forms runs again, as a different application

An LHC-Forms application is in `sdc-lforms-frontend/` and runs on port 3003 as a
fourth container. This does not reverse the decision below, and the decision below
no longer describes the stack, so both halves need stating.

**What this ADR retired still stands.** The application it removed rendered one
Questionnaire and posted a bare `QuestionnaireResponse`, with no extraction and no
bundle. That paradigm is gone and has not come back.

**What was built instead is a different claim.** `sdc-lforms-frontend/` runs the
three template-based Questionnaires through LHC-Forms and lets *LHC-Forms itself*
perform the extraction, reading the contained template the Questionnaire carries and
returning the transaction Bundle. The page holds no profile canonical, no `linkId`
and no element path. It is evidence that the published templates are portable to an
independently written SDC engine, which is a property of the guide and not a fourth
data-entry paradigm — so §Decision 2's port-3002 arithmetic, §Decision 4's "two
running frontend paradigms" and §Consequences' first two bullets describe a
three-container stack the repository has left behind. The stack is now four
frontends on 3000–3003; LHC-Forms sits behind a path prefix on the SDC host rather
than a subdomain of its own.

The engine's behaviour under the template mechanism is recorded in ADR-0193, its
limits in `docs/limitations_items/0025-lforms-template-extraction-defects/`, and the
outstanding parity question in `docs/future_work_items/0002-lhcforms-frontend-parity/`.
No ADR records the decision to build it; this note is the pointer until one does.
**Builds on:** ADR-0034 (three-bundle architecture), ADR-0035 (unified registry frontend), ADR-0040 (HL7 SDC IG v3.0.0 conformance)

## Context

ADR-0023 (May 2026) added the LHC-Forms frontend at port 3002 to demonstrate a third data-entry paradigm — the NLM LHC-Forms web component rendering the canonical `shoulder-registration` Questionnaire and POSTing a bare `QuestionnaireResponse` (no client-side extraction, no bundle). At the time, three frontends gave three distinct demonstrations: typed-builder wizard, SDC pattern with client-side `$extract`, and off-the-shelf renderer with no extraction.

Two subsequent decisions narrowed the LHC-Forms frontend's demonstrative weight:

1. **ADR-0034 (three-bundle architecture)** moved registration / surgery / follow-up into three distinct named bundle profiles. The LHC-Forms frontend continued to target only `QuestionnaireResponse` against the single pre-restructure shape; it did not exercise the three-bundle architecture. ADR-0034 §Consequences and ADR-0035 §Consequences explicitly flagged this as deferred work.

2. **ADR-0040 (HL7 SDC IG v3.0.0 conformance)** brought the SDC frontend to formal SDC conformance with three SDC Questionnaires aligned to ADR-0034. With definition-driven extraction, `calculatedExpression` for the Constant-Murley composite, and `launchContext` + `itemPopulationContext` for follow-up pre-fill, the SDC frontend now covers both Questionnaire-driven workflows the LHC-Forms variant existed to illustrate — at greater spec fidelity than the LHC-Forms frontend ever did (LHC-Forms posted raw `QuestionnaireResponse`; the SDC frontend produces conformant bundles).

What the LHC-Forms frontend still uniquely demonstrated: a third-party Questionnaire renderer with zero custom code reaching the IG's Questionnaire artifact. That claim is real but small, and easily reproduced — anyone with the published Questionnaire can stand up an LHC-Forms renderer in an afternoon. The container, the docker-compose entry, the build step, and the doc references kept costing maintenance; the demonstrative value did not justify it once ADR-0040 was in place.

The user's confirmed choice (2026-05-19) is to deprecate the LHC-Forms frontend by moving it to the archive directory following the project's archive convention (the project guide — "frozen historical reference"), rather than deleting it. The archive directory preserves the demo as a citable artifact in the same way the archived LHC-Forms frontend already preserves prior project state reports and proposal drafts.

## Decision

1. **Move `lhcforms-frontend/` into the archive.** The directory becomes frozen historical reference per the project guide's archive rules: no further edits, only referenced when the user explicitly asks about historical content.

2. **Remove the `lhcforms-frontend` service block** from `docker-compose.yml` (formerly lines 118–135). Port 3002 is no longer bound; the demo stack drops from four to three running frontend containers (was 3, was previously 4 before ADR-0035) — now: HAPI + Postgres + unified frontend (3000) + SDC frontend (3001).

3. **Remove the `lhcforms-frontend` entry from `build-and-deploy.sh`**: the `docker compose build` invocation now reads `frontend sdc-frontend`. The success summary echo line for port 3002 is removed; a one-liner notes the LHC-Forms frontend has been archived.

4. **Update the project guide, README.md, and the thesis 05_results chapter(s)** to reflect two running frontend paradigms instead of three. The thesis prose explicitly mentions the LHC-Forms archival so the audit trail is visible at the point of reading.

5. **Mark ADR-0023 as Superseded** by this ADR; its body is preserved unedited for audit trail (matches the project convention used for ADR-0014a, ADR-0016, ADR-0017, ADR-0027 §Coverage Statistics).

6. **Update wording in ADR-0030 and ADR-0035** where they enumerate the three pre-deprecation frontends, with parenthetical forward-pointers to this ADR.

## Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| **Keep LHC-Forms; update it to the three-bundle architecture** | Would require splitting the Questionnaire into three for the LHC-Forms case OR teaching `<wc-lhc-form>` to handle bundle routing — material work for a demo that no longer carries unique demonstrative weight after ADR-0040. |
| **Delete `lhcforms-frontend/` entirely** | Git history would preserve it, but loses the visible "this once existed" signal a thesis reader expects. Archive directory is the project's established pattern for retired demos. |
| **Keep LHC-Forms running but mark it deprecated in-place** | Doubles the docker-compose surface and the deploy script for no reader benefit. The thesis claim is cleaner with the artifact moved aside. |
| **Re-target LHC-Forms to one of the three bundles (e.g., Follow-Up only)** | LHC-Forms posts a `QuestionnaireResponse`, not a bundle. Re-targeting would mean adding client-side extraction — at which point the frontend is no longer demonstrating the bare-renderer paradigm and overlaps the SDC frontend entirely. |
| **Subsume LHC-Forms rendering into the unified frontend as a toggle** | Mixes two presentation paradigms into one app surface. Loses the didactic separation. |

## Consequences

✅ Two running frontend paradigms remain (typed-builder unified frontend, SDC-conformant definition-driven SDC frontend) — both current with ADR-0034. The thesis demonstrator claim narrows from "three paradigms" to "two paradigms with one historical reference under the archive directory" — sharper and easier to defend.

✅ Docker stack drops one container; `build-and-deploy.sh --rebuild-frontends` builds two images instead of three; the warm-restart path is marginally faster.

✅ The archive convention is followed cleanly: `lhcforms-frontend/` joins prior historical reference material (`20251125_proposal_master_thesis.docx`, retired demo videos, etc.). The project guide's archive rules apply (do not edit, only cite as historical).

✅ ADR-0023 remains in the audit trail with its body preserved; the Status line tells future readers the decision was reversed and points at this ADR.

⚠️ Anyone running `docker compose up -d` against the pre-deprecation `docker-compose.yml` and expecting a service on port 3002 will see "connection refused". Documented in the project guide and README.md.

⚠️ External consumers (test scripts, bookmarks, monitoring) referencing `http://localhost:3002` need to be updated. The IG is pre-1.0 so this rename is acceptable.

⚠️ The LHC-Forms demonstration's specific point — that a Questionnaire fetched from HAPI works under an off-the-shelf renderer with zero custom code — is no longer running as a live container. The archive directory preserves the source, but the user must rebuild and run it manually to verify the claim. This is the cost-benefit accepted in the user's 2026-05-19 decision.

❌ The thesis loses one of its three demonstrator paradigms. Mitigation: the SDC frontend at port 3001 now does formally what the LHC-Forms frontend did informally — fetch a Questionnaire from HAPI and render it via a generic renderer — plus extracts and submits conformant bundles. The narrowing is real but the loss is mostly aesthetic.

## Sources

- the archived LHC-Forms frontend — preserved working copy at the time of deprecation
- `docker-compose.yml` — `lhcforms-frontend` service block removed; trailing comment notes the archive move
- `build-and-deploy.sh` — `docker compose build` invocation reduced to `frontend sdc-frontend`; success echo updated
- the project guide — LHC-Forms section removed; component table reduced to two frontends; architecture paragraph rewritten; notable-ADR entries updated for ADR-0040 + ADR-0041
- `README.md` — Quick-Start, directory tree, dev section, service table, and ADR list updated
- the thesis 05_results chapter(s) line 47 — "three frontend variants" → "two frontend variants" with footnote pointing at this ADR
- `docs/decisions/0023-lhcforms-third-frontend.md` — Superseded banner added, body preserved
- `docs/decisions/0030-shoulder-followup-bundle.md` — historical-note parenthetical added at the "three existing frontends" sentence
- `docs/decisions/0035-unified-registry-frontend.md` — forward-pointers added to the lines that enumerated three frontends or two-still-old-shape paradigms
- `docs/decisions/README.md` — ADR-0023 status flipped to "Superseded by ADR-0041"; this ADR added to the index
- ADR-0023 (superseded by this ADR), ADR-0034 (three-bundle architecture), ADR-0035 (unified frontend — the SDC + LHC-Forms caveat is now closed), ADR-0040 (SDC conformance — the work that made LHC-Forms redundant)
