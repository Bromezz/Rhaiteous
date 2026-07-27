# CLI and library API

## CLI: `rhaiteous`

**Recommended (published package):**

```bash
npm install --save-dev rhaiteous   # once, in your Grok project
npx rhaiteous <workflow.json> [options]
```

Also:

| Entry | When |
|-------|------|
| `npx rhaiteous …` | Project has `rhaiteous` installed, or one-shot from the registry |
| `rhaiteous …` | Global install (`npm i -g rhaiteous`) or npm script `bin` path |
| `node ./bin/rhaiteous.js …` | Developing this repository from a clone |
| `npm run rhaiteous -- …` | This package’s own `package.json` script |

Registry: [https://www.npmjs.com/package/rhaiteous](https://www.npmjs.com/package/rhaiteous)

### Synopsis

```text
rhaiteous <workflow.json> [options]
# or:
npx rhaiteous <workflow.json> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-o`, `--out <path>` | Write Rhai to this path (default: project Grok discovery path; see below) |
| `-b`, `--base <path>` | Asset base directory containing `schemas/` and `prompts/` (default: `rhaiteous` under cwd). Workflow JSON is usually under `{base}/workflows/`. |
| `--stdout` | Print Rhai to **stdout**; do not write a file |
| `--dry-run` | Compile only; do not write |
| `-h`, `--help` | Print help to stderr |

### Asset base

Schemas resolve as `{base}/schemas/<path-from-workflow>`.  
Prompt files resolve as `{base}/prompts/<name-from-step>`.  
Default base is `./rhaiteous` relative to the **current working directory**.  
Convention: author `*.workflow.json` under `{base}/workflows/` so the whole authoring tree is version-controlled together.

### Default output path (Grok project location)

If `--out` is omitted and neither `--stdout` nor `--dry-run` is set, the compiler writes **Grok’s project discovery path**:

```text
./.grok/workflows/<workflow.name>.rhai
```

relative to the **current working directory** (not the workflow file’s directory). Parent directories are created as needed.

Grok only auto-discovers named workflows from:

- `<repo-root>/.grok/workflows/*.rhai` (project) — **this is the default**
- `~/.grok/workflows/*.rhai` (user) — pass `-o` explicitly if you want this

To keep generated IR under git when `.grok` is otherwise ignored, see [using-in-a-grok-project.md](./using-in-a-grok-project.md#6-keep-compiled-workflows-in-git-gitignore-exception).

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Compile / I/O failure |
| `2` | Usage error (missing file, bad flags, missing input) |

### Stdout vs stderr

- **stdout:** pure Rhai source when `--stdout` is set (pipe-friendly)
- **stderr:** help text, errors, and one-line status (`ok: wrote ...`)

### Examples

```bash
# Grok project root: writes ./.grok/workflows/<name>.rhai
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json

# explicit out and asset base
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json -b ./rhaiteous -o ./.grok/workflows/office-shopping.rhai

# CI compile check
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json --dry-run

# package demos in this repo (from a clone)
npx rhaiteous ./examples/rhaiteous/workflows/office-shopping.workflow.json -b ./examples/rhaiteous --stdout
```

---

## Library API

Module: `src/compile-workflow.js`  
Package export (when published): `"."` → that module  
Also: `./json-to-rhai` → value emitter only

### ESM import

```js
import compileMod from "rhaiteous";
// developing this repo from a clone:
// import compileMod from "./src/compile-workflow.js";
```

Default export is a **single object** (structured surface; no cherry-picked named exports required by callers).

### `compileWorkflow(workflow, options?)`

Compile an in-memory workflow document.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `workflow` | object | Parsed workflow JSON |
| `options.base` | string | Asset base with `schemas/` and `prompts/` (default `./rhaiteous` under cwd) |
| `options.baseDir` | string | Legacy alias for `options.base` |

**Returns**

```js
{
  name: string,           // workflow.name
  rhai: string,           // full Rhai source
  loadedSchemas: object,  // binding → parsed schema object
  base: string            // resolved absolute asset base
}
```

**Throws** on validation / emit errors (including missing schema or prompt files).

### `compileWorkflowFile(workflowPath, options?)`

Read a workflow file from disk, compile, optionally write.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `workflowPath` | string | Path to `*.workflow.json` |
| `options.outPath` | string | Output `.rhai` path (optional) |
| `options.base` | string | Asset base with `schemas/` and `prompts/` (default `./rhaiteous` under cwd) |
| `options.write` | boolean | Write file (default `true`) |

Schema paths resolve under **`{base}/schemas/`**. Prompt files resolve under **`{base}/prompts/`**.

**Returns**

```js
{
  name: string,
  rhai: string,
  loadedSchemas: object,
  base: string,         // absolute asset base
  inputPath: string,    // absolute
  outputPath: string,   // absolute (even if not written)
  written: boolean
}
```

### `readJsonFile(filePath)`

Read and `JSON.parse` a UTF-8 file. Used internally; exported for tests and tools.

### `jsonToRhai(value, indent?)`

Also available via `import jsonToRhaiMod from "rhaiteous/json-to-rhai"` (or `./src/json-to-rhai.js`).

Converts JSON-compatible values to Rhai literals:

- `null` → `()`
- objects → `#{ ... }` (keys quoted when required, e.g. `"type"`)
- arrays, strings, numbers, booleans → Rhai equivalents

Object keys are sorted for **deterministic** output.

### Example: programmatic compile

```js
import compileMod from "rhaiteous";
import nodePath from "node:path";

const workflowPath = nodePath.resolve("rhaiteous/workflows/office-shopping.workflow.json");
const result = compileMod.compileWorkflowFile(workflowPath, {
  base: nodePath.resolve("rhaiteous"),
  // omit outPath → ./.grok/workflows/<name>.rhai under process.cwd()
  write: true,
});

if (!result.written) {
  throw new Error("expected write");
}

console.log("wrote", result.outputPath);
console.log("bytes", result.rhai.length);
```

### Example: in-memory workflow

```js
import compileMod from "./src/compile-workflow.js";

const workflow = {
  name: "hello",
  description: "smoke",
  steps: [
    { op: "phase", title: "Main" },
    {
      op: "complete",
      value: { summary: "ok" },
    },
  ],
};

const result = compileMod.compileWorkflow(workflow, { base: "./rhaiteous" });
console.log(result.rhai);
```

---

## Integration with Grok Build

1. Compile with `rhaiteous` → `.grok/workflows/<name>.rhai` (project) or copy to `~/.grok/workflows/`.
2. Ensure custom `agent_type` values exist as Grok agent definitions if you use them.
3. Run: `/workflow <name> { ...args }`
4. Watch: `/workflows`

Rhaiteous does **not** invoke Grok; it only produces the script Grok discovers.
