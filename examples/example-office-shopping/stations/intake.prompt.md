## Intake

### Prior capped / fatal

Unlikely as first station. If it happens: `to: []` with a short explanation.

### Process

`--treatment append`.

1. Read purchase requests from the folder in `args.requests_dir` (see workflow args).
2. Structured result: schema key **`intake`** (list of requests).
3. Write **no files** in this step.
4. Keep `message.body` short — briefly say what you found in everyday language.

Set `metadata.to` to `"Inventory"`.

### Own cap-out

`mode: "capped"`, `to: "Inventory"` (or `[]` if none).
