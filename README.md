# Rhaiteous

**JSON in → Rhai out** for [Grok Build](https://x.ai/) workflows.  
*A righteous way to author Rhai.*

Grok Build runs multi-agent pipelines as **Rhai** scripts (`.rhai`) under `.grok/workflows/`. That works well as a runtime IR, but authoring orchestration and **JSON Schema** as Rhai maps is awkward.

**Rhaiteous** lets you:

- Author workflows as **plain JSON**
- Keep **real JSON Schema** files on disk (one or many, referenced by name)
- Compile them into a **Grok-compatible `.rhai`** script

```text
*.workflow.json  +  schemas/*.schema.json
              │
              ▼
          rhaiteous
              │
              ▼
   .grok/workflows/<name>.rhai
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

const result = compileMod.compileWorkflowFile("./examples/minimal.workflow.json", {
  outPath: "./.grok/workflows/minimal-summary.rhai",
  write: true,
});

console.log(result.outputPath);
```

## Quick start

```bash
# compile the minimal example (writes examples/out/...)
node ./bin/rhaiteous.js ./examples/minimal.workflow.json -o ./examples/out/minimal-summary.rhai

# default output path: ./.grok/workflows/<name>.rhai
node ./bin/rhaiteous.js ./examples/minimal.workflow.json

# print Rhai to stdout (status on stderr)
node ./bin/rhaiteous.js ./examples/minimal.workflow.json --stdout

# compile only, no write
node ./bin/rhaiteous.js ./examples/minimal.workflow.json --dry-run
```

Then in Grok Build (with the `.rhai` under `.grok/workflows/` or `~/.grok/workflows/`):

```text
/workflow minimal-summary {"target":"quarterly planning notes"}
```

## Multiple external JSON Schemas

Yes — that is a primary feature.

Declare schemas by **name → file path** (paths are relative to the workflow JSON file):

```json
{
  "schemas": {
    "inventory": "./schemas/inventory.schema.json",
    "candidates": "./schemas/candidates.schema.json",
    "verdict": "./schemas/verdict.schema.json"
  }
}
```

Reference them on steps by **name** (not path):

```json
{
  "op": "agent",
  "as": "intake",
  "output_schema": "inventory",
  "prompt": ["Inventory docs under {{args.docs_dir}}"]
}
```

The compiler loads each file as normal JSON Schema and emits:

```rhai
let inventory_schema = #{ /* ... generated map ... */ };
// ...
output_schema: inventory_schema,
```

You never hand-author the Rhai form of those schemas.

See `examples/client-issues.workflow.json` for three schemas used in one pipeline.

## Workflow JSON (summary)

Top-level document:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Grok workflow name: lowercase, digits, hyphens |
| `description` | yes | Short summary |
| `phases` | no | Dashboard phase rail: `{ "title", "detail?" }[]` |
| `args` | no | Input args → Rhai locals + required-arg pauses |
| `schemas` | no | Map of binding name → path to `.schema.json` |
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
  *.workflow.json           Authoring examples
  schemas/*.schema.json     Real JSON Schema files
  out/*.rhai                Sample generated IR (optional to commit)
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
| [`examples/minimal.workflow.json`](./examples/minimal.workflow.json) | One agent, one schema, args, `if_failed`, `complete_from` |
| [`examples/client-issues.workflow.json`](./examples/client-issues.workflow.json) | Intake → parallel analysis → parallel challenge → `zip_filter` → complete with `$ref`s |

Regenerate sample IR:

```bash
node ./bin/rhaiteous.js ./examples/minimal.workflow.json -o ./examples/out/minimal-summary.rhai
node ./bin/rhaiteous.js ./examples/client-issues.workflow.json -o ./examples/out/client-issues.rhai
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
