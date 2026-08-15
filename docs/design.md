# Design

## Problem

[Grok Build](https://x.ai/) workflows are **deterministic Rhai scripts** that orchestrate subagents (`agent`, `parallel`, `phase`, `complete`, …). That is a reasonable **execution** model:

- Dynamic fan-out from prior results  
- Barriers, budgets, pause/resume journals  
- Structured `output_schema` on child agents  

Exposing raw Rhai as the **only** authoring surface has sharp edges:

1. **JSON Schema is a foreign format.** Host `output_schema` expects a Rhai map, so `"type"` must be quoted and maps use `#{...}`. Authors lose standard schema tooling and readability.
2. **No modular schema include** in the documented workflow host API for loading `.schema.json` from disk into `output_schema`.
3. **Orchestration is easier to review as data** for many pipelines (stations, re-entry, shared payload) than as a general-purpose script.

## Approach

Treat Rhai as **intermediate representation (IR)**:

```text
Author:  JSON workflow + JSON Schema files + Markdown prompts
Compile: Rhaiteous (this project; CLI: rhaiteous)
Run:     Grok Build workflow host
```

Rhaiteous is **flow-only**: `stations[]` → `meta.phases` + one station `fn` per entry + shared `flow` envelope + `while flow.next` driver. Stations may list `schemas` for best-effort **Additional Schemas** guidance. Optional **`payloadSchema`** is compile-time `$ref`-inlined into the host-checked **`flow.payload`**.

Linear `steps[]` / `scriptType: "step"` were removed; multi-agent pipelines are expressed as stations with agent-owned routing and payload.

## Goals

- Keep **real JSON Schema** files as the contract source of truth  
- Support **many named external schemas** per workflow  
- Emit **valid Grok workflow Rhai** (pure-literal `meta`, host calls, string-built prompts)  
- Fail **closed** on unknown constructs  
- Zero runtime npm dependencies  
- Library and CLI share one implementation  

## Non-goals (v1)

- Replace Rhai for power users who want full host API access  
- Full general-purpose programming language in JSON  
- Round-trip decompile Rhai → JSON  
- Host-level `parallel` fan-out as a first-class JSON op (stations handle lists in-agent, or use custom IR later)  
- Official affiliation with or endorsement by xAI  

## Architecture

| Module | Responsibility |
|--------|----------------|
| `json-to-rhai.js` | Faithful emission of JSON values as Rhai literals |
| `template.js` | `{{refs}}` → Rhai string concatenation statements |
| `schema-inline.js` | Compile-time JSON Schema `$ref` resolution |
| `compile-workflow.js` | Flow validation, schema load, station emit, file I/O |
| `cli.js` | `parseArgs`, exit codes, stdout/stderr policy |
| `rhai-keywords.js` | Load/check shipped Rhai keyword list; format multi-violation reports |
| `data/rhai-keywords.txt` | Active + reserved Rhai keywords (identifier ban-list) |

### Schema pipeline

1. Workflow lists `schemas: { binding: "file.schema.json" }` (paths under `{base}/schemas/`)  
2. Compiler loads and **inlines `$ref`s**  
3. Emitter writes `let <binding>_schema = #{ ... };` for bindings  
4. Station `schemas[]` embeds selected documents under **Additional Schemas**  
5. Optional `payloadSchema` is inlined into `make_flow_schema()` as `properties.payload`  
6. Station prompts list Markdown under `{base}/prompts/`; bodies are concatenated with banners; `{{templates}}` expand into Rhai string builds  

Authors never maintain the Rhai form. Default `base` is `./rhaiteous` (CLI `-b` / `--base`).

### Flow / routing pipeline

- `flow.stations` is the ordered station name list  
- Each visit: agent returns the **full flow** object under the envelope schema  
- Default successor: next name after `flow.current` in `flow.stations`  
- Conditional re-entry / early stop: station prompts set `flow.next` / `flow.msg`  

## Dialect philosophy

v1 is tuned to **multi-station agent pipelines** (intake → formulate → validate → present → qa), not a reimplementation of all Rhai or a linear step DSL.

**Rhai keyword guard:** Author-controlled identifiers are checked against a shipped list (`src/data/rhai-keywords.txt`). Violations are collected and reported with origin labels; a post-emit scan is a safety net.

## Compatibility

- **Grok Build** evolves; emitted scripts target the documented host API (`agent`, `phase`, `complete`, `pause`, `await_user`, `output_schema`, `capability_mode`, …).  
- Recompile when upgrading expectations around meta shape or host functions.  
- This project’s **semver** applies to the JSON dialect and Node API, not to Grok itself.

## Security notes

- Compiler reads only paths you pass (workflow file + schema paths you declare).  
- Generated prompts embed template data as Rhai strings; treat untrusted document content carefully when you pass it through templates or args.  
- Do not compile untrusted workflow JSON in privileged environments without review (same as running any code generator).
