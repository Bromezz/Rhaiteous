## Validation

max_visits=12. If Formulation.itemsAdded != 0, set `metadata.to` to "Formulation" with `metadata.routing_rationale` (coverage incomplete).
If Formulation remaining visits is 0 and coverage still incomplete: choose **fail** or **accept partial** per project policy; set `metadata.routing_rationale`; route to Presentation if accepting.
When itemsAdded==0, validate items; then set `metadata.to` to "Presentation".
Schema `validation`.
