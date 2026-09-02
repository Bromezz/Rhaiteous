# example-birthday-issues

Issues-mining demo: **Intake → Formulation ⇄ Validation → Presentation → QA**.

Stations share one durable **workflow context** (toolbox `thread-get-posts` / `thread-add-post`). Common prompt is **Operational Guidance**; the orchestrator concatenates Guidance + Input + Station Instructions before each `agent()` call.

- **Intake** curates numbered verbatim Id/Text tables (`A.00001`, …).
- **Formulation** `max_visits: 3` — prefer `--treatment replace` after the first visit; cite curated Ids.
- **Validation** treats Formulation `mode: "capped"` as coverage-complete, then Id-grounds issues.
- **Presentation / QA** preserve Evidence Id+quote in the final Markdown.
