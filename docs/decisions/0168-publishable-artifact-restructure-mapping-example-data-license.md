# ADR-0168: Make the published artifact complete — move the mapping and example-patient narratives into the subtree, relocate the subproject guide out of it, and add LICENSE + CITATION.cff

**Date:** 2026-08-16
**Status:** Accepted; the DOI half of §Decision 3 is cancelled (see §Amendment). The restructure, the relocated subproject guide, `LICENSE` and `CITATION.cff` all stand.

## Amendment (2026-09-18) — no DOI, and the release is the reference point

§Decision 3 left the released version, the release date and an archival DOI as
placeholders in `CITATION.cff`, and §Consequences said the DOI remained to be minted
and pinned. The external deposit that would have minted it is no longer planned. The
release is the repository and a tag on it, so:

1. **`CITATION.cff` carries no `doi` field.** The version and release date
   placeholders stay and are filled at the tagged release. Nothing else in the file
   changes. §Context point 3's reading of the situation in August is left as written.
2. **The fixed reference point is the tagged release**, not an archived snapshot.
   This is weaker than a DOI and the wording must not pretend otherwise: a tag is
   reachable only while the repository is reachable, and it can be moved or deleted
   by whoever holds the repository. Nothing about a tag is guaranteed to outlive it.
3. **It also depends on the repository being readable at all.** Both repositories
   are private today. Anything the guide's own documents say about where a reader
   obtains the built artifacts is unfulfillable until one of them is published, and
   the mirror is the only candidate, since the other carries unpublished writing.
   That decision is open and sits outside this record.

`shoulder_on_fhir/` is published as a citable open-source research artifact via a deploy-only
mirror repo, produced by `git subtree split --prefix=shoulder_on_fhir`
(ADR-0072). The subtree split publishes **only** the contents of `shoulder_on_fhir/`, flattened to
the mirror root; anything living in a sibling directory of the monorepo is excluded by construction.

Preparing the artifact for public release surfaced three gaps:

1. **Two core research artifacts lived outside the subtree.** The authoritative SECEC→FHIR
   element-coverage mapping (`mapping/SECEC_FHIR_Mapping.{csv,md}`) and the two longitudinal
   example-patient narrative walkthroughs (`example_data/{anna_mueller,kemal_demir}_story.md` plus
   their loader/validator scripts and the trajectory visualisation) were top-level siblings of
   `shoulder_on_fhir/`, so neither would appear in the published repo — even though the thesis
   reports on the mapping directly (Results, Appendix) and points readers to the example
   walkthroughs as the best end-to-end reference. The example-patient *bundles* already lived under
   `seed/bundles/` (published); only their human-readable narratives were excluded. That exclusion
   was a deliberate ADR-0072/ADR-0099-era choice to keep the narratives as monorepo-only
   "thesis-reference," publishing bundles but not stories.

2. **The subproject the project guide was inside the subtree** and therefore published. It documents
   internal deployment and operational-security detail — the mirror mechanism itself, the private
   repo names, the cloud-provider network firewall posture, and that the monorepo holds the unpublished
   thesis/defense/poster — none of which should reach the public repo.

3. **No `LICENSE` and no `CITATION.cff`.** The thesis Availability statement declares Apache-2.0,
   but no license file existed in the repo, and there was no machine-readable citation affordance to
   pair with the planned archival (Zenodo) DOI.

## Decision

1. **Move both research artifacts into the publishable subtree**, establishing a single source of
   truth and reversing the ADR-0072/ADR-0099-era narrative-exclusion (the artifact is now published
   as a complete research object, so the worked examples and the coverage mapping belong with it):
   - `mapping/` → `shoulder_on_fhir/mapping/` (publishes at `mapping/`).
   - `example_data/` → `shoulder_on_fhir/example_data/` (publishes at
     `example_data/`).

2. **Relocate the subproject guide out of the subtree**, from `shoulder_on_fhir/` up to the
   git-repo root one level above. It is thereby excluded from the subtree split, so its
   deployment and operational-security content never publishes, while remaining available to
   anyone working inside `shoulder_on_fhir/`. Its paths stay `shoulder_on_fhir/`-relative; a
   scope header documents this. The published repo's user-facing documentation is
   `shoulder_on_fhir/README.md`.

3. **Add publish essentials at the subtree root**: `LICENSE` (Apache-2.0, matching the thesis
   Availability statement) and `CITATION.cff` (author, repository, license, keywords), with the
   released version, release date, and archival Zenodo DOI left as clearly-marked placeholders to be
   pinned at the tagged submission release.

4. **Propagate the path changes** everywhere they are load-bearing or reader-facing: the
   `example_data/` loader and validator scripts (`../shoulder_on_fhir/seed/...` → `../seed/...`;
   the now-false "kept out of the mirror" comments rewritten), the two story files' load snippets,
   the `build-and-deploy.sh` comment block, both the project guides, both `README.md` files
   (including `shoulder_on_fhir/README.md`, which previously stated the mapping was "not part of
   this directory / the deploy mirror"), and the thesis (`appendix.tex` mapping path, and the
   Availability itemize in `07_conclusion.tex`, which now lists the mapping and the narratives).

## Consequences

- The published artifact now ships the SECEC→FHIR mapping and the two example-patient walkthroughs
  alongside the IG, both frontends, the seed bundles, and the ADR trail — a self-contained,
  end-to-end reference.
- Single source of truth: the mapping and example data each live in exactly one place; no dual-copy
  sync burden (the trap deliberately avoided, unlike the LaTeX-asset duplication policy).
- The subproject guide is now at the repo root with `shoulder_on_fhir/`-relative paths; the mapping
  references inside it (`mapping/SECEC_FHIR_Mapping.md`) became correct in that frame once the
  mapping moved into `shoulder_on_fhir/mapping/`.
- **Historical ADRs that cite the old `mapping/...` path are intentionally
  left unchanged** — they are point-in-time records, not build-critical, and were already
  path-stale in the mirror; rewriting ~40 of them would churn the historical record for no gain.
- **Parallel opsec observation, not addressed here:** ADR-0072 itself is published under
  `docs/decisions/` and still names the mirror mechanism, the private repo names, and the server
  security posture. If the published repo should carry zero operational detail, sanitising or
  excluding ADR-0072 (and any similarly detailed ADRs) is a separate follow-up.
- `LICENSE` gives the repo a machine-detected license badge; `CITATION.cff` gives GitHub a "Cite
  this repository" affordance. The Zenodo DOI remains to be minted and pinned (in both the thesis
  Availability statement and `CITATION.cff`) at the tagged submission release.

## Verification

- Disk layout confirmed: `shoulder_on_fhir/{mapping,example_data}/` present; the former top-level
  siblings removed; no project guide remains in the publishable subtree.
- `example_data/` scripts re-pointed to `../seed/bundles/...` and `SOF_ROOT="$SCRIPT_DIR/.."`.
- A dry-run `git subtree split --prefix=shoulder_on_fhir` (or a fresh-clone audit of the mirror)
  should confirm `mapping/`, `example_data/`, `LICENSE`, and `CITATION.cff` appear at the mirror
  root and no project guide does — run before the next publish per the ADR-0072 workflow.
