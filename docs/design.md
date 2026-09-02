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

Rhaiteous is **station-flow only**: author `stations[]` in JSON; the compiler emits a skinny **forum-runner** Rhai script. At run time:

1. **Init** creates a durable **workflow context** via the Rhaiteous toolbox (`thread-create`) and loads Operational Guidance + station prompt texts into the orchestrator.
2. Each station `agent()` receives **Operational Guidance + Input + Station Instructions** (concatenated by the orchestrator — stations do not `read_file` those prompts themselves).
3. Station agents **persist** with the toolbox (`thread-get-posts` / `thread-add-post`) under **`out_dir/threads/`** and return **exactly one post**; the Rhai driver **routes** on `metadata.to`.

Linear `steps[]` / `scriptType: "step"` and **`payloadSchema` / `flow.payload`** were removed. Multi-agent pipelines are stations with agent-owned persistence and routing.

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
| `schema-inline.js` | Compile-time JSON Schema `$ref` resolution (validate/fail-closed) |
| `compile-workflow.js` | Workflow validation + skinny IR emit (forum-runner template) |
| `emit-thread-workflow.js` | Fills `templates/forum-runner.rhai.template` splices |
| `templates/forum-runner.rhai.template` | Shared Rhai body (Init context + prompt load; station loop) |
| `tools/toolbox/` | Workflow-context CLI (`thread-create` / `thread-get-posts` / `thread-add-post`) |
| `cli.js` | `parseArgs`, exit codes, stdout/stderr policy |
| `init-project.js` | Copy example workflows into a host project |
| `rhai-keywords.js` | Load/check shipped Rhai keyword list; format multi-violation reports |
| `data/rhai-keywords.txt` | Active + reserved Rhai keywords (identifier ban-list) |

### Schema / prompt pipeline (current)

1. Workflow lists `schemas` / `prompts` as bindings → bare filenames under `stations/`  
2. Compiler loads schemas and **inlines `$ref`s** for fail-closed validation (not grafted into Rhai as large literals)  
3. Skinny emit stamps `meta`, default `workflow.json` path, and `tools/toolbox/rhaiteous-toolbox.mjs` into the forum-runner template  
4. At run time **Init** (an agent) reads `workflow.json`, creates the workflow context via toolbox, and returns prompt texts; the orchestrator concatenates Guidance + Input + Station Instructions per station  

Authors never maintain the Rhai form. CLI `-b` / `--base` is the workflow directory (contains `stations/`).

### Routing pipeline

- Init returns the ordered `stations` roster (and caps)  
- Each visit: station agent returns **one post**; driver follows single `metadata.to` until terminal (`[]` / empty)  
- Caps / `benched` / append vs replace are enforced by **Operational Guidance** + toolbox (`station_run`, `--no-count`, `mode: capped`), not by silent orchestrator rewrites of already-persisted posts  
- Optional helpers (`tools/write-thread.mjs`, pack `finalize.mjs`) are **not** invoked by the skinny runner; use them only for manual export / pack post-process  

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
