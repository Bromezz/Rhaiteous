# Rhaiteous

**JSON in → Rhai out** for [Grok Build](https://x.ai/) workflows.  
*A righteous way to author Rhai.*

Grok Build runs multi-agent pipelines as **Rhai** scripts (`.rhai`) under `.grok/workflows/`. That works well as a runtime IR, but authoring orchestration and **JSON Schema** as Rhai maps is awkward.

**Rhaiteous** lets you:

- Author workflows as **plain JSON** under `{base}/workflows/` (version-controlled)
- Keep **real JSON Schema** files under `{base}/schemas/` (default base: `./rhaiteous`)
- Keep **prompt source files** under `{base}/prompts/` (referenced by name from each step)
- Compile them into Grok’s **project** discovery path: **`.grok/workflows/<name>.rhai`**

```text
{base}/workflows/*.workflow.json
{base}/schemas/*.schema.json
{base}/prompts/*
              │
              ▼
          rhaiteous
              │
              ▼
   .grok/workflows/<name>.rhai     ← default output (Grok project location)
              │
              ▼
   /workflow <name> { ...args }
```

## Why

| Concern | Without Rhaiteous | With Rhaiteous |
|--------|-------------------|----------------|
| Orchestration | Hand-written Rhai | Declarative JSON steps |
| Output contracts | `#{ "type": "object", ... }` in Rhai | Standard `.schema.json` files |
| Multiple schemas | Copy/paste maps | Named refs: `"output_schema": "candidates"` |
| Diffs / review | Generated-looking IR | Review JSON + schemas; recompile |

Rhai remains what Grok executes. You maintain the authoring surface.

## Requirements

- **Node.js 18+** (developed on 24 LTS)
- No runtime npm dependencies (Node standard library only)

## Install

### From a clone (this repo)

```bash
git clone <your-fork-or-url>
cd rhaiteous
npm test
```

Link the CLI locally:

```bash
npm link
# then:
rhaiteous --help
```

Or run without linking:

```bash
node ./bin/rhaiteous.js --help
```

### As a library

```js
import compileMod from "./src/compile-workflow.js";
// after publish, e.g.: import compileMod from "rhaiteous";

const result = compileMod.compileWorkflowFile(
  "./examples/rhaiteous/workflows/minimal.workflow.json",
  {
    base: "./examples/rhaiteous",
    // omit outPath to write ./.grok/workflows/<name>.rhai
    outPath: "./.grok/workflows/minimal-summary.rhai",
    write: true,
  }
);

console.log(result.outputPath);
```

## Quick start

```bash
# package demos: sample IR under examples/out/ (not the Grok project path)
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/minimal.workflow.json \
  -b ./examples/rhaiteous -o ./examples/out/minimal-summary.rhai

# in a Grok project (cwd = project root): default out is ./.grok/workflows/<name>.rhai
rhaiteous ./rhaiteous/workflows/minimal-summary.workflow.json

# print Rhai to stdout (status on stderr)
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/minimal.workflow.json \
  -b ./examples/rhaiteous --stdout

# compile only, no write
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/minimal.workflow.json \
  -b ./examples/rhaiteous --dry-run
```

Then in Grok Build (project IR under `.grok/workflows/`, or user-global `~/.grok/workflows/`):

```text
/workflow minimal-summary {"target":"quarterly planning notes"}
```

**Using this in a Grok project (layout, compile, git):**  
→ **[docs/using-in-a-grok-project.md](./docs/using-in-a-grok-project.md)**

## Asset base (`workflows/` + `schemas/` + `prompts/`)

By convention, project assets live under **`./rhaiteous`** (override with **`-b` / `--base`**):

```text
rhaiteous/
  workflows/   # *.workflow.json (authoring — keep under VC)
  schemas/     # *.schema.json referenced from workflow "schemas"
  prompts/     # prompt source files listed in each step's "prompt"
.grok/
  workflows/   # *.rhai — default compile output (Grok project discovery)
```

### Multiple external JSON Schemas

Declare schemas by **name → path relative to `{base}/schemas`**:

```json
{
  "schemas": {
    "inventory": "inventory.schema.json",
    "candidates": "candidates.schema.json",
    "verdict": "verdict.schema.json"
  }
}
```

Reference them on steps by **name** (not path):

```json
{
  "op": "agent",
  "as": "intake",
  "output_schema": "inventory",
  "prompt": ["client-intake.txt"]
}
```

### Prompt files

Each step `prompt` is an **array of source file names** under `{base}/prompts/`. Files are loaded at compile time, concatenated (each prefaced with a banner), then `{{templates}}` are expanded into Rhai string builds. Missing files fail the compile.

```text
===== [client-intake.txt] =====
…file body…
```

You never hand-author the Rhai form of those schemas or prompt bodies.

See `examples/rhaiteous/workflows/client-issues.workflow.json` for three schemas and prompt files used in one pipeline.

### Default Rhai output (project location)

When `-o` / `--out` is omitted, Rhaiteous writes:

```text
./.grok/workflows/<workflow.name>.rhai
```

That is the **project** path Grok scans for named `/workflow` launches (user-global alternative: `~/.grok/workflows/`). Parent dirs are created automatically. Use `-o` only when you intentionally want another path (e.g. package demos under `examples/out/`).

### Keeping `.rhai` in git

If your project ignores `.grok/`, exempt the workflow IR so clones stay runnable:

```gitignore
# Ignore Grok local state, but keep compiled workflows under VC.
# Do not use a bare ".grok/" line — that blocks re-including children.
.grok/*
!.grok/workflows/
!.grok/workflows/**
```

Details: [docs/using-in-a-grok-project.md](./docs/using-in-a-grok-project.md#6-keep-compiled-workflows-in-git-gitignore-exception).

## Workflow JSON (summary)

Top-level document:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Grok workflow name: lowercase, digits, hyphens |
| `description` | yes | Short summary |
| `phases` | no | Dashboard phase rail: `{ "title", "detail?" }[]` |
| `args` | no | Input args → Rhai locals + required-arg pauses |
| `schemas` | no | Map of binding name → path under `{base}/schemas/` |
| `steps` | yes | Ordered orchestration steps |

**Step ops (v1):**

| `op` | Purpose |
|------|---------|
| `phase` | UI phase marker |
| `log` | Progress line (`{{templates}}` supported) |
| `agent` | Single subagent call |
| `parallel` | Fan-out over an array binding |
| `collect` | Merge `output.<field>` arrays from parallel results |
| `zip_filter` | Keep left items whose parallel verdict has `real: true` |
| `bind` | `let x = agent.output.field` |
| `if_empty` / `if_failed` | Conditional nested steps |
| `complete` | End run (supports `{ "$ref": "binding" }`) |
| `complete_from` | `complete(agent.output)` (+ optional static extras) |
| `pause` / `await_user` | Human gates |

Full field reference: **[docs/workflow-json.md](./docs/workflow-json.md)**.

## CLI

```text
rhaiteous <workflow.json> [options]

  -o, --out <path>   Output .rhai path (default: .grok/workflows/<name>.rhai)
  -b, --base <path>  Asset base with schemas/, prompts/, workflows/ (default: rhaiteous)
  --stdout           Print Rhai to stdout (no file write)
  --dry-run          Compile only; do not write
  -h, --help         Help
```

Details: **[docs/cli-and-api.md](./docs/cli-and-api.md)**.

## Project layout

```text
bin/rhaiteous.js            CLI entry
src/
  cli.js                    argv / exit codes
  compile-workflow.js       compileWorkflow / compileWorkflowFile
  json-to-rhai.js           JSON values → Rhai literals
  template.js               {{args.x}} / loop refs → string build
examples/
  rhaiteous/
    workflows/*.workflow.json
    schemas/*.schema.json
    prompts/*
  out/*.rhai                Sample IR for this package (demos)
test/                       node:test suite
docs/                       Extended documentation
```

## Design notes

- **JSON = authoring surface; Rhai = IR.** Recompile after editing JSON/schemas; do not hand-edit generated `.rhai` unless you are debugging the emitter.
- **Fail closed.** Unknown step `op` values throw at compile time.
- **No npm runtime deps.** Easier to audit and embed.
- **Standalone verifiability.** CLI and library share `compile-workflow.js`.
- **Not affiliated with xAI.** Grok Build is a product of xAI; Rhaiteous is an independent helper for its workflow format.

More context: **[docs/design.md](./docs/design.md)**.

## Examples

| Example | What it shows |
|---------|----------------|
| [`examples/rhaiteous/workflows/minimal.workflow.json`](./examples/rhaiteous/workflows/minimal.workflow.json) | One agent, one schema, args, `if_failed`, `complete_from` |
| [`examples/rhaiteous/workflows/client-issues.workflow.json`](./examples/rhaiteous/workflows/client-issues.workflow.json) | Intake → parallel analysis → parallel challenge → `zip_filter` → complete with `$ref`s |

Regenerate sample IR (package demos → `examples/out/`):

```bash
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/minimal.workflow.json -b ./examples/rhaiteous -o ./examples/out/minimal-summary.rhai
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/client-issues.workflow.json -b ./examples/rhaiteous -o ./examples/out/client-issues.rhai
```

## Tests

```bash
npm test
# or:
node --test ./test/json-to-rhai.test.js ./test/compile-workflow.test.js
```

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for setup, coding conventions, and PR expectations.

## License

[MIT](./LICENSE) — see file for full text.

## Related

- [Grok Build user guide](https://x.ai/) / local docs under `~/.grok/docs/user-guide/` when Grok is installed
- Grok workflows are Rhai scripts discovered from `.grok/workflows/*.rhai` and `~/.grok/workflows/*.rhai`
- Workflow host concepts: `agent`, `parallel`, `phase`, `complete`, `pause`, `await_user`, `output_schema`, `agent_budget`
