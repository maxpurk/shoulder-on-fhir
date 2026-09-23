# The implanted device and the operative materials are not modelled

> **Status:** Future work — out of scope. Logged 2026-09-13.

## Gap

The guide records the surgical event, its approach, and its reconstruction extent, but nothing
about what was implanted or used. Anchors, sutures, fixation devices, and graft or augmentation
material have no profile, no element, and no code in the IG. No `Device` or `DeviceUseStatement`
profile exists under `ig/input/fsh/`, and no such resource appears in any seed bundle.

The expert consensus does not ask for it either, so this is not a representability gap against the
requirement set. It is a scope boundary of the model.

## Why it matters

Device identification is the spine of the established arthroplasty registers: the German
implant registers bind a GTIN or UDI catalogue, and device-level analysis is what lets them
detect an underperforming implant. A rotator cuff registry that cannot say which anchor or
augmentation was used cannot answer the equivalent question, and cannot be joined to the device
recall and post-market surveillance chain that registers of that kind feed.

It is also the widest of the model's content gaps. Closing it adds a resource type rather than a
value set, so it is larger than the terminology items logged beside it.

## Note

The FHIR shape is `Device` for the product and `DeviceUseStatement` referencing the index
`Procedure` for its use in that event, with the catalogue identifier carried on `Device.udiCarrier`
or `Device.identifier`. The open question is the terminology, not the structure: a registry-grade
device catalogue has to come from somewhere, and binding one is a governance commitment this
project cannot make on its own.
