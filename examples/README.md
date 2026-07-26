# Examples

Sample **workflow JSON**, **JSON Schema**, and **prompt** files for **Rhaiteous** (`rhaiteous`).

## Layout

```text
examples/
  rhaiteous/                    # asset base (-b ./examples/rhaiteous)
    workflows/                  # *.workflow.json (authoring surface)
    schemas/                    # real JSON Schema
    prompts/                    # prompt source files
  out/                          # sample generated Rhai (package demos only)
```

In a real Grok Build project, the same shape lives at the repo root as `./rhaiteous/…`, and the compiler’s **default** output is **`.grok/workflows/<name>.rhai`** (Grok’s project discovery path). These package examples intentionally write sample IR under `examples/out/` so the Rhaiteous repo does not depend on a local `.grok/` tree for demos.

See [docs/using-in-a-grok-project.md](../docs/using-in-a-grok-project.md) for project integration and gitignore notes.

## minimal

- Path: `rhaiteous/workflows/minimal.workflow.json`
- Args: required `target`, optional `label` (default `"run"`)
- Schema: `summary`
- Prompt: `minimal-summarize.txt`
- Ops: `phase`, `agent`, `if_failed`, `complete_from`

```bash
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/minimal.workflow.json \
  -b ./examples/rhaiteous \
  -o ./examples/out/minimal-summary.rhai
```

## client-issues

- Path: `rhaiteous/workflows/client-issues.workflow.json`
- Args: required `docs_dir`, optional `client_name`
- Schemas: `inventory`, `candidates`, `verdict`
- Prompts: `client-intake.txt`, `client-analyze.txt`, `client-verify.txt`
- Ops: intake → parallel analyze → collect → parallel verify → zip_filter → complete
- `evidence` is an array of `{ "source", "quote" }`

```bash
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/client-issues.workflow.json \
  -b ./examples/rhaiteous \
  -o ./examples/out/client-issues.rhai
```

## Note on generated `out/`

Files under `out/` are **compiler output**. Prefer editing `rhaiteous/workflows/*`, `schemas/*`, and `prompts/*`, then recompile. They are committed so visitors can inspect IR without running Node.
