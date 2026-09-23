# The published guide links to element anchors its own pages do not carry

> **Status:** Open, upstream.

## Gap

Every error the published guide reports is the same one. A Questionnaire item
names the element its answer fills, as `<profile canonical>#Observation.value[x]`,
which is what definition-based extraction reads. The IG Publisher renders that
into the Questionnaire's narrative as a hyperlink to
`StructureDefinition-<profile>.html#Observation.value[x]`, and then reports that
the link cannot be resolved.

It cannot, and no element link could: the profile pages carry no element anchors
at all. Counted on one of them, `StructureDefinition-shoulder-abduction-observation.html`
holds zero `<a name=...>` anchors of any kind. The Publisher generates a link to
an anchor its own profile template never emits.

## Why it matters

It is the whole error count rather than part of it, so the guide cannot report
zero errors while it stands, and a reader has no way to tell from the number
that nothing about the profiles is wrong.

Nothing about conformance is affected. The element identifier in `item.definition`
is correct and has to stay exactly as it is: it is what the extraction mechanism
resolves, and it is the identifier the element actually has.

## Note

Not fixable here without making `item.definition` wrong, which would break
extraction to quiet a broken link. The same reasoning as the R4 to R5 round trip
in `0027`: the artifact is right and the tool is wrong, so the artifact stays.

Worth reporting upstream together with `0027`.
