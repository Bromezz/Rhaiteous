## Purchasing

Record transactions. Schema `purchasing`.

### Required file outputs (user-visible)

Using **read-write/execute** tools, write under `args.out_dir` (create the directory if needed):

1. **`thread.json`** — the full run result you can assemble from the conversation so far plus this post’s purchasing content: include `thread` (schemas + all posts including yours) and `control` if present in the prompt/budget context. Prefer writing the complete portable forum artifact.
2. **`report.md`** — short human summary: company, cycle, each station one-liner, items purchased, totals if known.

If you cannot reconstruct prior posts verbatim, still write `report.md` with purchasing results and note that `thread.json` is best-effort.

Set `metadata.to` to `[]` (terminal).
`metadata.routing_rationale`: "Terminal purchasing complete; wrote out_dir artifacts."
Put narrative in `message.body` with `message.mime` = `text/markdown`.
