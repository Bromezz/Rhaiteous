# Workflow JSON reference

This document defines the **authoring format** consumed by **Rhaiteous** (`rhaiteous`).  
The compiler emits a single Grok Build Rhai script.

Rhaiteous is **flow-only**: you author **`stations[]`**. Linear `steps[]` / `scriptType: "step"` are not supported.

## Flow state: usage and visit bookkeeping

After each station `agent()` call, the compiled wrapper (not the agent) updates **`flow.state`**:

| Field | Type | Meaning |
|-------|------|---------|
| `state.tokens` | array of maps | One entry per station run: `{ "<StationName>": <tokens_used> }` (0 if host omitted usage) |
| `state.elapsed` | array of maps | One entry per run: `{ "<StationName>": <duration_ms> }` (0 if omitted) |
| `state.token_total` | number | Running sum of token counts |
| `state.elapsed_total` | number | Running sum of durations (milliseconds) |
| `state.station_run` | map | Station name → how many times it has been dispatched |

Initialized on the starting `flow` object. On success, prior series/totals/visit counts are restored onto the agent’s returned flow so agents cannot wipe the ledger. Failed agents still record a visit and any usage the host returned.

These fields support later caps (max visits, token budgets); this version only **records**.

## Asset base

Schemas and prompts resolve under an **asset base** directory (CLI: `-b` / `--base`, library: `options.base`).

### Pack layout (preferred)

Point `-b` at the pack directory (the folder that contains `workflow.json`):

```text
workflows/example-office-shopping/   # or examples/example-office-shopping/ in this repo
  workflow.json
  schema.json              # payloadSchema
  stations/                # prompts (.md) + station schemas
  input/
  output/
  workflow.rhai            # compile product
  workflow.md              # compile product (always this name)
```

| Resolution | Behavior |
|------------|----------|
| Schemas | If `{base}/schemas/` exists, use it; else **pack root** (`schema.json`, `stations/*.schema.json`) |
| Prompts | If `{base}/prompts/` exists, use it; else **`{base}/stations/`** |
| `workflow.md` | Written beside authoring JSON and beside IR when `-o …/workflow.rhai` |

### Legacy multi-workflow base

| Path | Contents |
|------|----------|
| `{base}/schemas/` | JSON Schema files |
| `{base}/prompts/` | Prompt Markdown |

Default base is still **`./rhaiteous`** relative to cwd when `-b` is omitted.

### Seeds in this repository vs npm

| Layer | Path |
|-------|------|
| Git | `examples/example-*` (versioned; `example-` prefix required for product seeds) |
| npm package | `workflows/example-*` (`prepack` maps from `examples/`) |
| Host project | `./workflows/…` (init copies seeds; custom packs unprefixed) |

Compiled IR defaults to **`.grok/workflows/<name>.rhai`**. See [using-in-a-grok-project.md](./using-in-a-grok-project.md) and [examples/README.md](../examples/README.md).

---

## Top-level object

```json
{
  "name": "office-shopping",
  "description": "What this pipeline does",
  "payloadSchema": "schema.json",
  "args": {
    "requests_dir": true,
    "company_name": "Acme Office"
  },
  "schemas": {
    "intake": "stations/intake.schema.json"
  },
  "prompts": {
    "flow_common": "stations/common.md",
    "intake": "stations/intake.md"
  },
  "stations": [
    {
      "name": "Intake",
      "uiDescription": "collect requests",
      "prompt": ["flow_common", "intake"],
      "schemas": ["requests"],
      "capability_mode": "read-only"
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `name` | string | yes | Grok `meta.name`: lowercase letters, digits, hyphens |
| `description` | string | yes | Non-empty human summary |
| `scriptType` | string | no | Omit or `"flow"` only. `"step"` is rejected |
| `args` | object | no | Launch args (see below) |
| `schemas` | object | no | Binding → path under `{base}/schemas/` (`$ref` inlined at compile time) |
| `prompts` | object | no | Binding → path under `{base}/prompts/`; station `prompt` lists binding names |
| `payloadSchema` | string | no | Path under `{base}/schemas/` for `flow.payload`; inlined into host `output_schema` |
| `stations` | array | yes | Non-empty ordered station objects |
| `steps` | — | no | **Rejected** (removed) |
| `phases` | — | no | **Rejected** — derived from `stations` |

### `stations[]`

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `name` | string | yes | Rhai function name and phase title (identifier; keyword-guarded) |
| `prompt` | string[] | yes | When top-level **`prompts`** is set: ordered **binding names**. When omitted: ordered **file paths** under `{base}/prompts/` |
| `schemas` | string[] | no | Top-level schema bindings; embedded under **Additional Schemas** (guidance only) |
| `uiDescription` | string | no | Phase rail subtitle → Grok `meta.phases[].detail` |
| `label` | string | no | Agent label (default: `name`) |
| `capability_mode` | string | no | Default `read-only` when omitted |
| `agent_type` | string | no | Optional Grok agent type |

Compiler emits: `meta.phases` from stations (`title` = `name`, `detail` = `uiDescription` when set), `let flow = #{ stations, log, current, next, msg, state, payload }`, one `fn <name>(flow[, workflow_args_json])` per station, then:

```rhai
flow.next = flow.stations[0];
while flow.next != () {
    flow = Fn(flow.next).call(flow /*, workflow_args_json */);
}
```

Domain routing (`flow.next`, `flow.msg`, `flow.state`, `flow.payload`) is **agent-owned** via prompts.

### Top-level `prompts`

```json
"prompts": {
  "flow_common": "stations/common.md",
  "intake": "stations/intake.md"
},
"stations": [
  { "name": "Intake", "prompt": ["flow_common", "intake"] }
]
```

When the workflow declares **`args`**, each station also receives a **Workflow args (JSON)** block.

### Schema `$ref` inlining

Applied when loading top-level `schemas` and **`payloadSchema`**. External file, file+pointer, and in-document `$ref` are supported. Network URLs, circular `$ref`, and `$ref` with siblings fail closed.

### `payloadSchema`

Optional path relative to `{base}/schemas/`. Becomes host-checked structure for **`flow.payload`** inside `make_flow_schema()`.

### `name` rules

- Lowercase start; letters, digits, hyphens; becomes `meta.name` and default output stem `<name>.rhai`.

### Identifiers and Rhai keywords

Args, schema bindings, station names, etc. must not be Rhai reserved keywords. Violations are collected and reported (see `src/data/rhai-keywords.txt`).

---

## `args`

Each key becomes a Rhai local. The value **immediately after the key** is the default when the launch arg is missing. Nested `{ "default": … }` is rejected.

| Form | Meaning |
|------|---------|
| `"out_dir": "path/to/out"` | Default value |
| `"requests_dir": true` or `{ "required": true }` | Required; pause if missing |
| `"hint": {}` | Optional; unit when missing |

At runtime: `/workflow office-shopping {"requests_dir":"..."}`.

---

## Prompt files

Under `{base}/prompts/` (convention: **Markdown** `.md`). Loaded, banner-prefixed, `{{templates}}` expanded (typically `{{args.field}}` for flow).

---

## Emitted IR (conceptual)

```rhai
let meta = #{ name: "...", description: "...", phases: [ ... ] };
// schema locals…
// args locals…
let flow = #{ stations: [...], log: [], current: (), next: (), msg: (), state: #{}, payload: () };
fn make_flow_schema() { /* envelope + payload */ }
fn Intake(flow, workflow_args_json) { /* agent → full flow */ }
// …
flow.next = flow.stations[0];
while flow.next != () {
    flow = Fn(flow.next).call(flow, workflow_args_json);
}
complete(#{ flow: flow, flow_json: json_encode(flow) });
```

See [office-shopping-example.md](./office-shopping-example.md) and [design.md](./design.md).
