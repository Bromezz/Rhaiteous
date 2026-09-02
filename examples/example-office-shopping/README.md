# example-office-shopping

Office supply cycle demo: **Intake → Inventory → Audit → Procurement → Purchasing**.

Stations share one durable **workflow context** (toolbox `thread-get-posts` / `thread-add-post`). Common prompt is **Operational Guidance**; the orchestrator concatenates Guidance + Input + Station Instructions before each `agent()` call.

Default `max_visits` is **1** per station (linear). Purchasing may write `report.md` under `args.out_dir`.
