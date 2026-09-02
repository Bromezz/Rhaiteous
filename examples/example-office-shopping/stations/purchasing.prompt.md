## Purchasing

### Prior stop signal

If the latest post has `mode: "capped"` / `fatal` / `benched`: follow Workflow Instructions; prefer finishing a useful summary from what exists when Audit/Procurement left work, else `to: []`.

### Process

`--treatment append`.

Record the purchases for this cycle from the workflow context.

Structured result: schema key **`purchasing`**.

### Files you may write

Under `args.out_dir` only (create that folder if needed):

1. **`report.md`** — a short human summary for non-technical readers: company, cycle, what each step decided, what was purchased, and totals if known. Use clear everyday language.

### Files you must not write

- Do **not** write `thread.json`, `thread-*.json`, conversation dumps, or any full-run archive (the shared **workflow context** is persisted only via the Rhaiteous toolbox).
- Do **not** write any file other than **`report.md`**.

Set `metadata.to` to `[]` (this is the last step).
`metadata.routing_rationale`: one plain sentence that purchasing finished and the summary report was written.
Put a short narrative in `message.body` (`message.mime` = `text/markdown`).

### Own cap-out

`mode: "capped"`, `to: []`.
