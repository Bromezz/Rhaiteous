# Workflow JSON reference

This document defines the **authoring format** consumed by **Rhaiteous** (`rhaiteous`).  
The compiler emits a single Grok Build Rhai script.

Paths in `schemas` are resolved **relative to the workflow JSON file’s directory**.

---

## Top-level object

```json
{
  "name": "my-workflow",
  "description": "What this pipeline does",
  "phases": [
    { "title": "Scan", "detail": "optional UI detail" }
  ],
  "args": {
    "target": { "required": true },
    "label": { "default": "run" }
  },
  "schemas": {
    "summary": "./schemas/summary.schema.json"
  },
  "steps": []
}
```

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `name` | string | yes | Grok `meta.name`: lowercase letters, digits, hyphens; must match discovery conventions |
| `description` | string | yes | Non-empty human summary |
| `phases` | array | no | Optional; should align with `phase` steps for the `/workflows` UI rail |
| `args` | object | no | Declares invocation args (see below) |
| `schemas` | object | no | Map of **binding name** → **relative path** to a JSON Schema file |
| `steps` | array | yes | Non-empty ordered list of step objects |

### `name` rules

- Pattern (approximately): lowercase start; letters, digits, hyphens; hyphenated multi-char names must end with letter or digit.
- Examples: `minimal-summary`, `client-issues`
- Becomes both `meta.name` and the default output file stem: `<name>.rhai`

### `phases[]`

| Field | Type | Required |
|-------|------|----------|
| `title` | string | yes |
| `detail` | string | no |

---

## `args`

Each key is an **argument name** and becomes a **Rhai local** of the same name (must be a Rhai-friendly identifier: `[A-Za-z_][A-Za-z0-9_]*`).

### Forms

**Required, no default** (pause if missing):

```json
"docs_dir": { "required": true }
```

Shorthand (same meaning):

```json
"docs_dir": true
```

**Optional with default:**

```json
"client_name": { "default": "client" }
```

**Optional without default** (local may be unit `()`):

```json
"hint": {}
```

### Generated Rhai (conceptual)

```rhai
let docs_dir = if args == () { () } else { args.docs_dir };
if docs_dir == () { pause("verification", "Pass args.docs_dir."); }

let client_name = if args == () || args.client_name == () { "client" } else { args.client_name };
```

At runtime Grok still passes `args` into the script (e.g. `/workflow name {"docs_dir":"..."}`).

---

## `schemas` (multiple external JSON Schemas)

```json
"schemas": {
  "inventory": "./schemas/inventory.schema.json",
  "candidates": "./schemas/candidates.schema.json",
  "verdict": "./schemas/verdict.schema.json"
}
```

| Rule | Detail |
|------|--------|
| Binding name | Rhai identifier; becomes `let <name>_schema = #{...};` |
| Path | Relative to the workflow JSON file; must be a JSON **object** root |
| Count | Any number of entries (including zero) |
| Authoring | Keep **standard JSON Schema** syntax in those files |

### Referencing on a step

Use the **binding name**, not the path:

```json
"output_schema": "candidates"
```

### Inline schema (discouraged)

`output_schema` may also be a raw JSON object embedded in the workflow file. Prefer external files so schemas stay shareable and toolable.

---

## Prompt templates

`prompt` and `log.message` accept a **string** or **array of strings** (arrays are joined with newlines).

Interpolation:

| Token | Meaning |
|-------|---------|
| `{{args.field}}` | Arg local declared under `args` |
| `{{item}}` or `{{item_as}}` | Current element in a `parallel` loop |
| `{{index}}` or `{{index_as}}` | Loop index (number → `.to_string()` in Rhai) |
| `{{binding}}` | Prior step binding (`as` names, `collect` targets, etc.) |
| `{{binding.field}}` | Property chain on a known binding |

Unknown roots fail at **compile** time.

Example:

```json
"prompt": [
  "Client: {{args.client_name}}",
  "File: {{f}}",
  "Index: {{i}}"
]
```

---

## Steps

Every step is an object with string **`op`**. Unknown `op` values fail closed.

### `phase`

```json
{ "op": "phase", "title": "Analysis" }
```

| Field | Required |
|-------|----------|
| `title` | yes |

Emits: `phase("Analysis");`

---

### `log`

```json
{ "op": "log", "message": "Intake complete for {{args.client_name}}" }
```

| Field | Required |
|-------|----------|
| `message` | yes (string or string[]) |

---

### `agent`

Single subagent invocation.

```json
{
  "op": "agent",
  "as": "intake",
  "label": "intake",
  "agent_type": "stickler",
  "capability_mode": "read-only",
  "output_schema": "inventory",
  "prompt": ["Inventory {{args.docs_dir}}"]
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `as` | yes | Result binding name |
| `prompt` | yes | Template string or lines |
| `label` | no | Static job label |
| `agent_type` | no | Grok agent type (e.g. custom `analyst`) |
| `capability_mode` | no | `read-only` \| `read-write` \| `execute` \| `all` |
| `output_schema` | no | Schema binding name or inline object |

Emits roughly:

```rhai
let p = "";
p += "...";
let intake = agent(p, #{
  prompt: p,
  label: "intake",
  agent_type: "stickler",
  capability_mode: "read-only",
  output_schema: inventory_schema,
});
```

---

### `parallel`

Fan-out: one job per element of an array binding.

```json
{
  "op": "parallel",
  "as": "analysis_results",
  "over": "files",
  "item_as": "f",
  "index_as": "i",
  "label_prefix": "analyze",
  "agent_type": "analyst",
  "capability_mode": "read-only",
  "output_schema": "candidates",
  "prompt": ["Extract issues from {{f}} (shard {{i}})"]
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `as` | yes | Binding for `parallel(...)` results array |
| `over` | yes | Existing array binding to iterate |
| `prompt` | yes | Per-item template |
| `item_as` | no | Default `item` |
| `index_as` | no | Default `index` |
| `label_prefix` | no | Default = `as`; labels become `prefix:0`, `prefix:1`, … |
| `agent_type` | no | |
| `capability_mode` | no | |
| `output_schema` | no | |

`over` must already be a **known binding** (from `bind`, `collect`, etc.).

---

### `collect`

Merge nested arrays from parallel agent outputs.

```json
{
  "op": "collect",
  "as": "candidates",
  "from": "analysis_results",
  "field": "candidates"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `as` | yes | New array binding |
| `from` | yes | Parallel results binding |
| `field` | yes | Field under each `r.output` |

Skips failed / unit slots: requires `r != () && r.success && r.output.<field> != ()`.

---

### `zip_filter`

Pair `left[i]` with parallel verdict `right[i]`; keep left items when the verdict is successful and `output.real == true` with non-empty `output.evidence`.

```json
{
  "op": "zip_filter",
  "as": "survivors",
  "dropped_as": "dropped",
  "left": "candidates",
  "right": "verdict_results"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `as` | yes | Survivors array |
| `left` | yes | Candidate array (same length order as jobs) |
| `right` | yes | Parallel verdict results |
| `dropped_as` | no | If set, pushes `cand.id` for rejected items |

Assumes agents return objects with `id` when using `dropped_as`.

---

### `bind`

Copy one field from an agent result’s `output` into a new local.

```json
{
  "op": "bind",
  "as": "files",
  "from": "intake",
  "field": "files"
}
```

Emits: `let files = intake.output.files;`

---

### `if_empty`

If `path.len() == 0`, run nested `then` steps (usually `complete`).

```json
{
  "op": "if_empty",
  "path": "candidates",
  "then": [
    { "op": "complete", "value": { "summary": "No candidates.", "issues": [] } }
  ]
}
```

| Field | Required |
|-------|----------|
| `path` | yes (array binding) |
| `then` | yes (non-empty step array) |

---

### `if_failed`

If result is unit or `success` is false, run `then`.

```json
{
  "op": "if_failed",
  "path": "intake",
  "then": [
    { "op": "complete", "value": { "summary": "intake failed", "issues": [] } }
  ]
}
```

---

### `complete`

End the workflow successfully with a value.

```json
{
  "op": "complete",
  "value": {
    "summary": "challenge complete",
    "issues": { "$ref": "survivors" },
    "dropped": { "$ref": "dropped" }
  }
}
```

| Field | Required |
|-------|----------|
| `value` | yes |

#### `$ref` nodes

Anywhere in the `value` tree, an object of the form:

```json
{ "$ref": "bindingName" }
```

emits a bare Rhai identifier for that known binding (not a JSON string). Nested maps/arrays are supported.

Static scalars/objects/arrays are emitted as Rhai literals via the JSON→Rhai converter.

---

### `complete_from`

```json
{
  "op": "complete_from",
  "from": "result",
  "pass_output": true,
  "extra": { "tag": "v1" }
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `from` | yes | Agent result binding |
| `extra` | no | Static fields merged into the complete map |
| `pass_output` | no | If true, adds `output: <from>.output` |

If neither `extra` nor `pass_output` adds fields, emits `complete(<from>.output);`.

---

### `pause` / `await_user`

```json
{
  "op": "pause",
  "kind": "verification",
  "message": "Provide args.docs_dir and resume."
}
```

```json
{
  "op": "await_user",
  "kind": "verification",
  "message": "QA failed; inspect /workflows then resume."
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `message` | yes | Shown to the user |
| `kind` | no | Default `verification` |

**Semantics** (Grok host): `pause` re-checks conditions on resume; `await_user` continues past the gate on resume. Prefer `await_user` for human-in-the-loop after failed QA; prefer `pause` for missing args that a resume cannot fix without new invocation data.

---

## Binding model

Steps introduce **known bindings** used by later steps and templates:

| Introduced by | Binding |
|---------------|---------|
| `args` | Each arg name |
| `agent` / `parallel` / `collect` / `zip_filter` / `bind` | `as` (and `dropped_as`) |
| `schemas` | Not step bindings; schema names only for `output_schema` |

Using an unknown `over` / `from` / `$ref` fails at compile time.

---

## What is not in v1

- Arbitrary Rhai snippets / `import` of other Rhai modules  
- General expression language in conditions (only `if_empty` / `if_failed`)  
- Compiling *to* JSON Schema (schemas are inputs, not outputs)  
- Validating agent outputs at compile time against schemas  
- Nested workflows / calling other workflow files  

Contributions that extend the dialect should remain **fail-closed** and documented here.
