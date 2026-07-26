# Examples

Sample **workflow JSON**, **JSON Schema**, and **prompt** files for **Rhaiteous** (`rhaiteous`).

## Layout

```text
examples/
  minimal.workflow.json       # single agent + one schema
  client-issues.workflow.json # multi-schema, parallel, zip_filter
  rhaiteous/                  # asset base (-b ./examples/rhaiteous)
    schemas/                  # real JSON Schema (authoring surface)
    prompts/                  # prompt source files referenced by name
  out/                        # sample generated Rhai IR (optional)
```

## minimal

- Args: required `target`, optional `label` (default `"run"`)
- One schema: `summary`
- Prompt: `minimal-summarize.txt`
- Ops: `phase`, `agent`, `if_failed`, `complete_from`

```bash
node ./bin/rhaiteous.js ./examples/minimal.workflow.json -b ./examples/rhaiteous -o ./examples/out/minimal-summary.rhai
```

## client-issues

- Args: required `docs_dir`, optional `client_name`
- Schemas: `inventory`, `candidates`, `verdict` (three external files)
- Prompts: `client-intake.txt`, `client-analyze.txt`, `client-verify.txt`
- Ops: intake agent → bind files → parallel analysts → collect → parallel skeptics → zip_filter → complete with `$ref`s
- Candidate/verdict `evidence` is an array of `{ "source", "quote" }` objects (no separate `source_path`)

```bash
node ./bin/rhaiteous.js ./examples/client-issues.workflow.json -b ./examples/rhaiteous -o ./examples/out/client-issues.rhai
```

## Note on generated `out/`

Files under `out/` are **compiler output**. Prefer editing `*.workflow.json`, `rhaiteous/schemas/*`, and `rhaiteous/prompts/*`, then recompile. They are committed so GitHub visitors can inspect IR without running Node.
