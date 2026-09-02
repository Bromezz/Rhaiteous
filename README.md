# Rhaiteous

[![npm](https://img.shields.io/npm/v/rhaiteous.svg?logoColor=CB3837&style=plastic&logo=npm&labelColor=silver&color=3269a0)](https://www.npmjs.com/package/rhaiteous)
[![license](https://img.shields.io/npm/l/rhaiteous.svg?style=plastic&labelColor=silver)](./LICENSE)

**JSON in → Rhai out** for [Grok Build](https://x.ai/) workflows.  
*A righteous way to author Rhai.*

Grok Build runs multi-agent pipelines as **Rhai** scripts (`.rhai`) under `.grok/workflows/`. That works well as a runtime IR, but authoring orchestration and **JSON Schema** as Rhai maps is awkward.

**Rhaiteous** lets you:

- Author **workflow packs** (`workflow.json`, `schema.json`, `stations/`, `input/`, `output/`)
- Version **product seeds** under git `examples/example-*` (prefix reserved for demos)
- Ship seeds on npm as **`workflows/example-*`** (Option B map at `prepack`)
- Compile packs to **`workflow.rhai`** + **`workflow.md`** (build artifacts) and Grok IR under **`.grok/workflows/`**

```text
examples/example-*/          (git)
        │  prepack
        ▼
workflows/example-*/         (npm package)
        │  init (host)
        ▼
./workflows/example-*/       (your project; gitignored by default)
        │  rhaiteous compile
        ▼
workflow.rhai + workflow.md  +  optional .grok/workflows/<name>.rhai
        │
        ▼
/workflow example-… { …args }
```

## Why

| Concern | Without Rhaiteous | With Rhaiteous |
|--------|-------------------|----------------|
| Orchestration | Hand-written Rhai | Declarative JSON `stations[]` + skinny forum-runner |
| Shared state | Ad-hoc prompts / dumps | Durable **workflow context** + toolbox (`thread-get-posts` / `thread-add-post`) |
| Output contracts | `#{ "type": "object", ... }` in Rhai | Standard `.schema.json` on post attachments |
| Diffs / review | Generated-looking IR | Review JSON + schemas + Markdown prompts; recompile |

Rhai remains what Grok executes. You maintain the authoring surface.

## Requirements

- **Node.js 18+** (developed on 24 LTS)
- No runtime npm dependencies (Node standard library only)

## Install (recommended: npm)

Published package: **[rhaiteous](https://www.npmjs.com/package/rhaiteous)** on the public npm registry.

### One-shot with `npx` (no install)

```bash
npx rhaiteous --help
```

### Project dependency (recommended for Grok projects)

From your **Grok project root**:

```bash
npm install --save-dev rhaiteous
npx rhaiteous init
npx rhaiteous compile example-office-shopping
npx rhaiteous --help
```

`init` creates `./workflows/`, seeds `example-*` packs from the package, and adds a `workflows/` gitignore line. `compile` writes pack IR + `workflow.md` and `.grok/workflows/<name>.rhai`.

Pin a version in CI/scripts when you want reproducible compiles:

```bash
npx rhaiteous@0.3.1 ./rhaiteous/workflows/my.workflow.json
```

### Global CLI (optional)

```bash
npm install -g rhaiteous
rhaiteous --help
```

### As a library

```js
import compileMod from "rhaiteous";

const result = compileMod.compileWorkflowFile(
  "./rhaiteous/workflows/office-shopping.workflow.json",
  {
    base: "./rhaiteous",
    // omit outPath → writes ./.grok/workflows/<name>.rhai
    write: true,
  }
);

console.log(result.outputPath);
```

### Developing this repo (contributors)

Clone and run from source — not required for normal use:

```bash
git clone https://github.com/Bromezz/Rhaiteous.git
cd Rhaiteous
npm test
npm link          # optional: rhaiteous on PATH from this clone
# or:
node ./bin/rhaiteous.js --help
```

## Quick start

In a **Grok project** (cwd = project root; assets under `./rhaiteous/`):

```bash
# install once
npm install --save-dev rhaiteous

# compile → ./.grok/workflows/<name>.rhai
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json

# compile only (CI check)
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json --dry-run

# print Rhai to stdout (status on stderr)
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json --stdout
```

Then in Grok Build:

```text
/workflow office-shopping {"requests_dir":"./inbox/requests","company_name":"Acme Office"}
```

**Full project guide (layout, gitignore, day-to-day loop):**  
→ **[docs/using-in-a-grok-project.md](./docs/using-in-a-grok-project.md)**

**Complete example walkthrough (every file):**  
→ **[docs/office-shopping-example.md](./docs/office-shopping-example.md)**

### Package demos (this repository only)

```bash
# sample IR under examples/out/ (not the Grok project path)
npx rhaiteous ./examples/rhaiteous/workflows/office-shopping.workflow.json \
  -b ./examples/rhaiteous -o ./examples/out/office-shopping.rhai
# or from a clone without install:
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/office-shopping.workflow.json \
  -b ./examples/rhaiteous -o ./examples/out/office-shopping.rhai
```

## Asset base (`workflows/` + `schemas/` + `prompts/`)

By convention, project assets live under **`./rhaiteous`** (override with **`-b` / `--base`**):

```text
rhaiteous/
  workflows/   # *.workflow.json (authoring — keep under VC)
  schemas/     # *.schema.json referenced from workflow "schemas"
  prompts/     # Markdown prompts referenced from stations
.grok/
  workflows/   # *.rhai — default compile output (Grok project discovery)
```

### Multiple external JSON Schemas

In a **pack**, declare schemas by **binding → path under the pack** (one schema per station is the convention):

```json
{
  "schemas": {
    "intake": "intake.schema.json",
    "inventory": "inventory.schema.json"
  },
  "prompts": {
    "thread_common": "common.prompt.md",
    "intake": "intake.prompt.md"
  },
  "stations": [
    {
      "name": "Intake",
      "prompt": ["thread_common", "intake"],
      "schemas": ["intake"],
      "capability_mode": "all"
    }
  ]
}
```

Each station should list its own schema binding (even a permissive `additionalProperties: true` object). At run time, schemas are loaded into the **workflow context**; structured work lives in post attachments keyed by those bindings.

### Prompt files

Station `prompt` arrays list **binding names** (via top-level `prompts`) under pack `stations/` (Markdown `.md`). The common / `thread_common` file is **Operational Guidance**; station files are **Station Instructions**. The orchestrator concatenates Guidance + Input + Station Instructions before each `agent()` call. Missing files fail closed at Init.

See the [office-shopping example](./docs/office-shopping-example.md) for a five-station pack.

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

## Seed packs (`examples/example-*`)

Product demos are **workflow packs** under [`examples/`](./examples/). Names always start with **`example-`**.

| Pack | Grok id | What it shows |
|------|---------|----------------|
| [`example-knock-knock/`](./examples/example-knock-knock/) | `example-knock-knock` | Joker ⇄ Audience knock-knock (toolbox get/add, caps 3/3) |
| [`example-office-shopping/`](./examples/example-office-shopping/) | `example-office-shopping` | Intake → Inventory → Audit → Procurement → Purchasing |
| [`example-birthday-issues/`](./examples/example-birthday-issues/) | `example-birthday-issues` | Curated corpus + Formulation ⇄ Validation → Presentation → QA |

```text
examples/example-office-shopping/
  workflow.json      # authoring (name = example-office-shopping)
  stations/          # Operational Guidance + station prompts + schemas
  input/             # sample sources
  output/            # runtime (empty in git)
```

### Compile and run (from this repo)

```bash
npx rhaiteous ./examples/example-office-shopping/workflow.json \
  -b ./examples/example-office-shopping \
  -o ./examples/example-office-shopping/workflow.rhai
# also writes examples/example-office-shopping/workflow.md
```

```text
/workflow example-office-shopping {"requests_dir":"workflows/example-office-shopping/input"}
```

In a **host project**, packs live under `./workflows/` (copied from the package on init). Catalog and packaging: **[examples/README.md](./examples/README.md)**. Older narrative: **[docs/office-shopping-example.md](./docs/office-shopping-example.md)** (paths may lag the pack layout).

## Workflow JSON (summary)

Top-level document:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Grok workflow name: lowercase, digits, hyphens |
| `description` | yes | Short summary |
| `stations` | yes | Ordered station objects (phases derived from them) |
| `args` | no | Launch args; value after key is the default; `true` for required |
| `schemas` | no | Binding → path under pack base (`schemas/` or pack root / `stations/`) |
| `prompts` | no | Binding → path under `prompts/` or pack `stations/` |

**Station fields:** `name`, `prompt`, optional `schemas`, `uiDescription`, `capability_mode`, `agent_type`, `label`, `max_visits`.

Full field reference: **[docs/workflow-json.md](./docs/workflow-json.md)**.

## CLI

```text
rhaiteous <workflow.json> [options]

  -o, --out <path>   Output .rhai path (default: .grok/workflows/<name>.rhai)
  -b, --base <path>  Asset base (pack dir, or legacy schemas/+prompts/) (default: rhaiteous)
  --stdout           Print Rhai to stdout (no file write)
  --dry-run          Compile only; do not write
  -h, --help         Help
```

Details: **[docs/cli-and-api.md](./docs/cli-and-api.md)**.

## Project layout

```text
bin/rhaiteous.js            CLI entry
src/                        compiler + library
packaging/
  map-examples-to-workflows.mjs   # prepack: examples/ → workflows/
  clean-workflows-map.mjs         # postpack cleanup
examples/
  example-office-shopping/  # example workflows (git; example- prefix)
  example-birthday-issues/
workflows/                  # generated at prepack only (gitignored; npm ships this)
test/                       node:test suite
docs/                       Extended documentation
```

## Design notes

- **JSON = authoring surface; Rhai + `workflow.md` = build artifacts.** Each compile writes Grok IR (`.rhai`, **BUILD ARTIFACT** banner) and a human guide always named **`workflow.md`** (purpose, `/workflow` invocation + args, stations). Do not edit either; recompile after changing JSON, schemas, or prompts.
- **Fail closed.** Unknown fields / removed step authoring throw at compile time.
- **Rhai keyword guard.** Author identifiers cannot be Rhai reserved words; compile lists every violation (see `src/data/rhai-keywords.txt`).
- **No npm runtime deps.** Easier to audit and embed.
- **Standalone verifiability.** CLI and library share `compile-workflow.js`.
- **Not affiliated with xAI.** Grok Build is a product of xAI; Rhaiteous is an independent helper for its workflow format.

More context: **[docs/design.md](./docs/design.md)**.

## Examples

See **[examples/README.md](./examples/README.md)** and [Seed packs](#seed-packs-examplesexample-).

```bash
npm run example:compile
# or map seeds as npm will:
npm run map:workflows
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
