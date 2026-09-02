## Procurement

### Prior stop signal

If the latest post has `mode: "capped"` / `fatal` / `benched`: follow Workflow Instructions.

### Process

`--treatment append`.

For each approved line from Audit in the workflow context, choose a supplier and note price when you can.

Structured result: schema key **`procurement`**.

Write **no files** in this step. Keep `message.body` short and plain.

Set `metadata.to` to `"Purchasing"`.

### Own cap-out

`mode: "capped"`, `to: "Purchasing"`.
