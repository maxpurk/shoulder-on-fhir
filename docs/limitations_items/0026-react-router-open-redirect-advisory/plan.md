# The two React frontends ship a React Router version carrying an open-redirect advisory, and the fix is a major-version migration

> **Status:** Limitation — open, dependency currency, in the demonstration frontends.
> Classified against the expert consensus: **none** — this concerns the demonstration
> application's dependency set, not any `Q#.#` consensus element or `L3.#` structural row.

## Gap

`frontend/` and `sdc-frontend/` both resolve `react-router-dom` 6.30.3, the last release on
the version 6 line. That line is covered by a moderate advisory: a same-origin redirect to a
path beginning `//` is reinterpreted as a protocol-relative URL, so a crafted link can redirect
a user off-site while appearing same-origin.

The advisory range runs to 7.17.0, so no release on the 6 line fixes it. Closing it means
migrating both applications from React Router 6 to 7 — a major-version change touching every
route in the three capture flows and the patient browser.

`sdc-generic-frontend/` and `sdc-lforms-frontend/` are unaffected: neither uses React Router.

The remaining advisories reported by `npm audit` across these packages sit in build-time
tooling — Vite, Rollup, esbuild, PostCSS, Babel, Browserslist and similar. Those run during
`docker build` and contribute nothing to the static assets nginx serves, so they do not reach
a browser.

## Why it matters

It is a real defect in shipped code rather than in the build, which is what separates it from
the rest of the audit output. The practical exposure is small: both frontends sit behind the
reverse proxy's Basic Auth, the demonstration holds only synthetic data, and the redirect has
to be delivered to someone already holding the shared credential. That is why it is recorded
rather than fixed under time pressure — a major router migration carries more regression risk
across the capture flows than the advisory carries exposure.

## Note

Deliberately not bundled into the toolchain pinning work (ADR-0194). That decision fixes the
versions of the tools that *build* the artifact so a rebuild reproduces it; this is an
application dependency whose fix changes how the applications route, which is a different kind
of change and wants its own verification pass over all four capture flows.
