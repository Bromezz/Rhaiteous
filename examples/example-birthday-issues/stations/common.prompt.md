## Shared rules (forum / thread + posts)

You do **not** return a full flow/payload envelope.

Return **exactly one post**:

```json
{
  "metadata": {
    "from": "<your station name>",
    "to": "<NextStationName>",
    "visit": 1,
    "routing_rationale": "<one line when caps or non-default routing apply>"
  },
  "message": {
    "mime": "text/markdown",
    "body": "<optional markdown>",
    "attachments": [
      {
        "name": "result",
        "mime": "application/json",
        "schema": "<key from workflow schemas map>",
        "content": { }
      }
    ]
  }
}
```

### Routing
- Set **`metadata.to`** to a single station name (string). Multi-recipient is unsupported.
- Default: next station in the workflow station list after yours; last station uses `"to": []`.
- **`metadata.from`** must be your station name (the driver also stamps it).

### Caps / budget
A budget block may list remaining visits (and optional token/elapsed totals).
If your preferred `metadata.to` has remaining 0, do not route there. Follow station-specific fail vs accept-partial rules and set `metadata.routing_rationale`.

### MIME
Use property name **`mime`** everywhere (message body and attachments), e.g. `text/markdown`, `text/plain`, `application/json`.

### Args
Honor **Workflow args (JSON)**. Do not invent paths or titles.
