// Shared FSH template (RuleSet) for a bounded Quantity value[x] — the
// "value[x] only Quantity" + system/code + min/max bound pattern repeated
// by hand across every ROM/strength/pain/PROM Observation profile in this
// IG. Insert with a path context (e.g. `* component[Pain] insert
// BoundedQuantity(#{score}, 0, 15)`) or with no path for the top-level
// value[x] (`* insert BoundedQuantity(#deg, 0, 180)`).
RuleSet: BoundedQuantity(unitCode, minVal, maxVal)
* value[x] only Quantity
* valueQuantity.system = "http://unitsofmeasure.org"
* valueQuantity.code = {unitCode}
* valueQuantity ^minValueQuantity.value = {minVal}
* valueQuantity ^minValueQuantity.system = "http://unitsofmeasure.org"
* valueQuantity ^minValueQuantity.code = {unitCode}
* valueQuantity ^maxValueQuantity.value = {maxVal}
* valueQuantity ^maxValueQuantity.system = "http://unitsofmeasure.org"
* valueQuantity ^maxValueQuantity.code = {unitCode}
