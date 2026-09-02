# Workflow JSON reference

This document defines the **authoring format** consumed by **Rhaiteous** (`rhaiteous`).  
The compiler emits a single Grok Build Rhai script using the **workflow-context + toolbox** model (skinny forum-runner).

You author **`stations[]`**. Linear `steps[]` / `scriptType: "step"` are not supported.

## Runtime model (emitted IR)

| Piece | Role |
|--------|------|
| **workflow context** | Durable JSON on disk under `threads/<id>/thread.json`: `stations`, `caps`, `station_run`, `benched`, `schemas`, `posts` |
| **toolbox** | `tools/toolbox/rhaiteous-toolbox.mjs` — `thread-create`, `thread-get-posts`, `thread-add-post` (station agents shell these) |
| **Station prompt** | Orchestrator concatenates **Operational Guidance** (common) + **Input** + **Station Instructions** |
| **Station output** | Exactly **one post**: `metadata` + `message` (identical to what `thread-add-post` saved) |
| **Driver** | Init → `while next_name` → `phase` → `agent` → follow single `metadata.to` until terminal |

Default **`max_visits` = 1** per station unless `stations[].max_visits` is set. Multi-recipient `to` is unsupported (first recipient only).

### Post shape

```json
{
  "metadata": {
    "from": "Intake",
    "to": "Inventory",
    "visit": 1,
    "routing_rationale": "…"
  },
  "message": {
    "mime": "text/markdown",
    "body": "…",
    "attachments": [
      { "name": "result", "mime": "application/json", "schema": "intake", "content": { } }
    ]
  }
}
```

- **`metadata.from` / `metadata.to`** — sender and next addressee (peers). Terminal: `"to": []`.
- **`message`** — body block (`mime`, `body`, `attachments`). Use property name **`mime`** on both the message and each attachment.
- **`metadata.routing_rationale`** — human reason when caps or non-default routing apply.
- Cap-out / forced end may set `metadata.mode` to `capped`, `fatal`, or `benched` and use a non-counted toolbox save (`--no-count`).

## Asset base

Schemas and prompts resolve under an **asset base** directory (CLI: `-b` / `--base`, library: `options.base`).

### Pack layout (preferred)

Point `-b` at the pack directory (the folder that contains `workflow.json`):

```text
workflows/example-office-shopping/   # or examples/example-office-shopping/ in this repo
  workflow.json
  stations/                # Operational Guidance + station prompts (.md) + schemas
  input/
  output/
  workflow.rhai            # compile product
  workflow.md              # compile product (always this name)
```

| Resolution | Behavior |
|------------|----------|
| Schemas | If `{base}/schemas/` exists, use it; else **pack root** / `stations/*.schema.json` |
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
  "args": {
    "requests_dir": true,
    "company_name": "Acme Office"
  },
  "schemas": {
    "intake": "intake.schema.json"
  },
  "prompts": {
    "thread_common": "common.prompt.md",
    "intake": "intake.prompt.md"
  },
  "stations": [
    {
      "name": "Intake",
      "uiDescription": "collect requests",
      "prompt": ["thread_common", "intake"],
      "schemas": ["intake"],
      "capability_mode": "all",
      "max_visits": 1
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
| `payloadSchema` | — | no | **Rejected** (removed with the old flow envelope) |
| `stations` | array | yes | Non-empty ordered station objects |
| `finalizer` | string | no | Optional pack script name (not invoked by the skinny runner) |
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
| `capability_mode` | string | no | Authoring hint; skinny runner uses `all` so stations can shell the toolbox |
| `agent_type` | string | no | Optional Grok agent type |
| `max_visits` | integer | no | Counted performances allowed (≥ 1; default **1**) |

Compiler emits a skinny forum-runner: `meta` (Init + station phases), stamped `workflow.json` path + toolbox script path, Init agent (create context + load prompts), then a `while next_name` station loop. Station agents return one post; the driver follows `metadata.to`.

```rhai
// Init: thread-create + load prompts.common / prompts[<Station>]
let next_name = stations[0];
while next_name != () {
    // agent(Operational Guidance + Input + Station Instructions) → post
    next_name = normalize_to(last_post.metadata["to"]);
}
```

Routing (`metadata.to`) is **agent-owned** via Operational Guidance + station instructions. Agents persist with the toolbox before returning the post.

### Top-level `prompts`

```json
"prompts": {
  "thread_common": "common.prompt.md",
  "intake": "intake.prompt.md"
},
"stations": [
  { "name": "Intake", "prompt": ["thread_common", "intake"] }
]
```

The common / `thread_common` binding is **Operational Guidance**. Station-specific bindings are **Station Instructions**. The orchestrator also injects an **Input** block (station name, workflow-context id, toolbox prefix, workflow.json path). Stations read run settings from `workflow.json` / args when instructed — Input is not a dump of arg values.

### Schema `$ref` inlining

Applied when loading top-level `schemas` at compile time (fail-closed validation). External file, file+pointer, and in-document `$ref` are supported. Network URLs, circular `$ref`, and `$ref` with siblings fail closed. Schemas are also loaded into the workflow context at Init for station use.

### `payloadSchema`

**Rejected.** The old `flow.payload` envelope is gone; structured work lives in post attachments keyed by schema binding.

### `name` rules

- Lowercase start; letters, digits, hyphens; becomes `meta.name` and default output stem `<name>.rhai`.

### Identifiers and Rhai keywords

Args, schema bindings, station names, etc. must not be Rhai reserved keywords. Violations are collected and reported (see `src/data/rhai-keywords.txt`).

---

## `args`

Flat defaults in `workflow.json`. Nested `{ "default": … }` is rejected.

| Form | Meaning |
|------|---------|
| `"out_dir": "path/to/out"` | Default value |
| `"requests_dir": true` or `{ "required": true }` | Required |
| `"hint": {}` | Optional |

At runtime: `/workflow example-office-shopping {"requests_dir":"..."}`. Stations discover args via the workflow definition path in Input when station instructions say to.

---

## Prompt files

Under `{base}/stations/` (pack layout) or `{base}/prompts/` (legacy). Markdown `.md`. Common = Operational Guidance; per-station files = Station Instructions only (no duplicated shared rules).

---

## Emitted IR (conceptual)

```rhai
let meta = #{ name: "...", description: "...", phases: [ Init, ...stations ] };
let default_workflow_json = "…/workflow.json";
let toolbox_script = "tools/toolbox/rhaiteous-toolbox.mjs";
// Init agent → context_id + prompts{}
// while next_name: build_station_prompt → agent → follow metadata.to
complete(#{ ok: true, context_id: context_id, last_post: last_post, … });
```

See [design.md](./design.md).
