# Examples (seed packs)

Product demo workflows, **versioned in git** under this directory.

| Pack directory | Workflow `name` / Grok id | Role |
|----------------|---------------------------|------|
| [`example-office-shopping/`](./example-office-shopping/) | `example-office-shopping` | **List development** — requests → challenged shopping list → buy |
| [`example-birthday-issues/`](./example-birthday-issues/) | `example-birthday-issues` | **Issue surfacing** — curated corpus → issues ↔ challenge → report |

Each pack has a conceptual **`README.md`** (what the workflow is *for*). Generated **`workflow.md`** is the technical compile guide—not a substitute for the README.

## Conventions

- Directory name = `workflow.json` `"name"` = Grok `/workflow` id.
- Product seeds always use the **`example-`** prefix (distinguish from user packs; easy to ignore under RCS).
- Pack layout:

```text
examples/example-<name>/
  workflow.json      # authoring
  schema.json        # payload schema
  stations/          # one .md + one .schema.json per station (station-named)
  input/             # sample sources
  output/            # runtime (empty in git)
```

- **Every station has its own schema** under `stations/` (e.g. `intake.schema.json`). If there is little structure to enforce, use an open object (`additionalProperties: true`). Do not prefix schema files with the product name (`shopping-…`).

## npm packaging (Option B)

| Layer | Path |
|-------|------|
| **Git (this folder)** | `examples/example-*` |
| **npm tarball** | `workflows/example-*` (via `npm prepack` → `scripts/map-examples-to-workflows.mjs`) |
| **Host after init** | `./workflows/example-*` (copy from the package) |

The published package does **not** ship a top-level `examples/` tree; consumers only see `node_modules/rhaiteous/workflows/example-*/`.

## Compile a pack (local)

```bash
npx rhaiteous ./examples/example-office-shopping/workflow.json \
  -b ./examples/example-office-shopping \
  -o ./examples/example-office-shopping/workflow.rhai
```

Writes **`workflow.rhai`** and **`workflow.md`** in the same directory (build artifacts; gitignored).

## Run (Grok)

After compiling and publishing IR to `.grok/workflows/<name>.rhai`:

```text
/workflow example-office-shopping {"requests_dir":"workflows/example-office-shopping/input"}

/workflow example-birthday-issues {}
```

In a real host project, packs live under **`workflows/`** (not `examples/`). Paths in default args assume that host layout after init.
