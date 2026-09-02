## Audit

### Prior stop signal

If the latest post has `mode: "capped"` / `fatal` / `benched`: follow Workflow Instructions.

### Process

`--treatment append`.

Review each inventory line from the workflow context. Decide what is reasonable to buy this cycle.

Structured result: schema key **`audit`** (one verdict per line, or an equivalent clear set of verdicts). Lines that pass should be marked as real/approved per the schema.

Write **no files** in this step. Keep `message.body` short and plain.

Set `metadata.to` to `"Procurement"`.

### Own cap-out

`mode: "capped"`, `to: "Procurement"`.
