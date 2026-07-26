# Examples

Sample **workflow JSON** and **JSON Schema** files for **Rhaiteous** (`rhaiteous`).

## Layout

```text
examples/
  minimal.workflow.json       # single agent + one schema
  client-issues.workflow.json # multi-schema, parallel, zip_filter
  schemas/                    # real JSON Schema (authoring surface)
  out/                        # sample generated Rhai IR (optional)
```

## minimal

- Args: required `target`, optional `label` (default `"run"`)
- One schema: `summary`
- Ops: `phase`, `agent`, `if_failed`, `complete_from`

```bash
node ./bin/rhaiteous.js ./examples/minimal.workflow.json -o ./examples/out/minimal-summary.rhai
```

## client-issues

- Args: required `docs_dir`, optional `client_name`
- Schemas: `inventory`, `candidates`, `verdict` (three external files)
- Ops: intake agent → bind files → parallel analysts → collect → parallel skeptics → zip_filter → complete with `$ref`s

```bash
node ./bin/rhaiteous.js ./examples/client-issues.workflow.json -o ./examples/out/client-issues.rhai
```

## Note on generated `out/`

Files under `out/` are **compiler output**. Prefer editing `*.workflow.json` and `schemas/*`, then recompile. They are committed so GitHub visitors can inspect IR without running Node.
