## Inventory

### Prior stop signal

If the latest post has `mode: "capped"` / `fatal` / `benched`: follow Workflow Instructions (usually end or continue only as directed).

### Process

`--treatment append`.

Using Intake’s results in the **workflow context** `posts` (load with `thread-get-posts`), build clear line items (what to buy and how many).

Structured result: schema key **`inventory`**.

Write **no files** in this step. Keep `message.body` short and plain.

Set `metadata.to` to `"Audit"`.

### Own cap-out

`mode: "capped"`, `to: "Audit"`.
