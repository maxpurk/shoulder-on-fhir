# The publisher cannot resolve its own `item.definition` element links

> **Status:** Limitation — open, external. Not fixable from this repository: the defect is in the IG
> Publisher, and no value of `item.definition` avoids it. Root-caused 2026-09-15 (ADR-0191), which
> also corrected the guide's own part of the problem. Classified against the expert consensus:
> **none** — no `Q#.#` or `L3.#` element is touched; this is a publishing-tool defect, not a
> data-model gap. Supersedes the separate entry `0017-ig-publisher-residual-doc-link-errors`,
> which double-counted the same defect and proposed a mitigation that does not exist.

## Gap

The published guide's quality report does not come back clean. Every remaining entry is one broken
hyperlink from a questionnaire item to the profile element it populates, and all of them have a
single cause: the publisher escapes the choice-element suffix in the anchor it renders but not in
the cross-reference it generates.

| | |
|---|---|
| anchor rendered on the profile page | `name="Observation.value_x_"` |
| href generated from `item.definition` | `href="…#Observation.value[x]"` |

`HTMLInspector` compares fragments literally; neither `[x]` nor `_x_` appears anywhere in the class.
So the link cannot find the anchor the same tool rendered.

The report states the same defect twice, which is worth knowing before quoting either figure: the
resource-level errors are counted once per questionnaire item, and the build errors are the same
links re-reported once per rendering of that narrative on its generated page, three renderings per
page. The two figures are not independent and must not be added.

## Why it cannot be worked around

FHIR R4 requires the fragment to name an ElementDefinition by its id, and for a choice element that
id carries the bracketed suffix; the specification's own example is
`http://hl7.org/fhir/StructureDefinition/Observation#Observation.value[x]`. The only string the link
checker would accept, `Observation.value_x_`, is not an element id. The two requirements are
mutually exclusive.

Three further routes were checked and closed:

- **Suppression.** `ignoreWarnings.txt` suppresses warnings and hints only. `ValidationPresenter`
  carries `suppressedInfo` and `suppressedWarnings` counters and no error counter, and `qa.json`
  reports the same two and nothing for errors. These entries are all errors.
- **A newer publisher.** No entry in the 2.3.1 through 2.3.4 release notes touches link checking,
  anchors, or choice elements.
- **A patched template.** `ig/template` is the unpacked `fhir2.base.template#current` and is
  refetched on every build, so a local patch would not survive.

Injecting an `<a name="Observation.value[x]">` anchor into every profile page's introduction would
work, and was rejected: it adds invisible markup across the whole Observation family of the
published guide purely to satisfy a defective checker.

## Why it matters

Presentational only. Instance conformance is unaffected, every profile compiles, both frontends and
HAPI are unaffected, and the package is usable. The cost is that a reader opening the published
quality page sees an error count that suggests the guide is broken when the defect is in the tool
that produced the page, and that a reader following one of those links does not land on the element.

## Note

What the guide could fix has been fixed (ADR-0191): every fragment now names a real
ElementDefinition, and the three address links resolve because those ids now exist.
`tools/check-questionnaire-definitions.sh` guards it. What remains is external. Worth reporting
upstream against HL7/fhir-ig-publisher; revisit if a release changes the anchor scheme or applies
the same escaping to both halves of the link.
