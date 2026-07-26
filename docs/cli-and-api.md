# CLI and library API

## CLI: `rhaiteous`

Entry points:

- `bin/rhaiteous.js` (npm bin: `rhaiteous`)
- `node ./bin/rhaiteous.js ...`
- `npm run rhaiteous -- ...`

### Synopsis

```text
rhaiteous <workflow.json> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-o`, `--out <path>` | Write Rhai to this path |
| `--stdout` | Print Rhai to **stdout**; do not write a file |
| `--dry-run` | Compile only; do not write |
| `-h`, `--help` | Print help to stderr |

### Default output path

If `--out` is omitted and neither `--stdout` nor `--dry-run` is set:

```text
./.grok/workflows/<workflow.name>.rhai
```

relative to the **current working directory** (not the workflow file’s directory). Parent directories are created as needed.

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
# project-local Grok discovery path
rhaiteous ./workflows/client-issues.workflow.json

# explicit path
rhaiteous ./workflows/client-issues.workflow.json -o ./dist/client-issues.rhai

# CI compile check
rhaiteous ./workflows/client-issues.workflow.json --dry-run

# capture IR
rhaiteous ./examples/minimal.workflow.json --stdout > /tmp/out.rhai
```

---

## Library API

Module: `src/compile-workflow.js`  
Package export (when published): `"."` → that module  
Also: `./json-to-rhai` → value emitter only

### ESM import

```js
import compileMod from "rhaiteous";
// or from a clone:
import compileMod from "./src/compile-workflow.js";
```

Default export is a **single object** (structured surface; no cherry-picked named exports required by callers).

### `compileWorkflow(workflow, options?)`

Compile an in-memory workflow document.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `workflow` | object | Parsed workflow JSON |
| `options.baseDir` | string | Directory used to resolve `schemas` paths (default `"."`) |

**Returns**

```js
{
  name: string,           // workflow.name
  rhai: string,           // full Rhai source
  loadedSchemas: object   // binding → parsed schema object
}
```

**Throws** on validation / emit errors.

### `compileWorkflowFile(workflowPath, options?)`

Read a workflow file from disk, compile, optionally write.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `workflowPath` | string | Path to `*.workflow.json` |
| `options.outPath` | string | Output `.rhai` path (optional) |
| `options.write` | boolean | Write file (default `true`) |

Schema paths resolve relative to the **workflow file’s directory**.

**Returns**

```js
{
  name: string,
  rhai: string,
  loadedSchemas: object,
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
import compileMod from "./src/compile-workflow.js";
import nodePath from "node:path";

const workflowPath = nodePath.resolve("examples/minimal.workflow.json");
const result = compileMod.compileWorkflowFile(workflowPath, {
  outPath: nodePath.resolve(".grok/workflows/minimal-summary.rhai"),
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

const result = compileMod.compileWorkflow(workflow, { baseDir: process.cwd() });
console.log(result.rhai);
```

---

## Integration with Grok Build

1. Compile with `rhaiteous` → `.grok/workflows/<name>.rhai` (project) or copy to `~/.grok/workflows/`.
2. Ensure custom `agent_type` values exist as Grok agent definitions if you use them.
3. Run: `/workflow <name> { ...args }`
4. Watch: `/workflows`

Rhaiteous does **not** invoke Grok; it only produces the script Grok discovers.
