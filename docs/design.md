# Design

## Problem

[Grok Build](https://x.ai/) workflows are **deterministic Rhai scripts** that orchestrate subagents (`agent`, `parallel`, `phase`, `complete`, …). That is a reasonable **execution** model:

- Dynamic fan-out from prior results  
- Barriers, budgets, pause/resume journals  
- Structured `output_schema` on child agents  

Exposing raw Rhai as the **only** authoring surface has sharp edges:

1. **JSON Schema is a foreign format.** Host `output_schema` expects a Rhai map, so `"type"` must be quoted and maps use `#{...}`. Authors lose standard schema tooling and readability.
2. **No modular schema include** in the documented workflow host API for loading `.schema.json` from disk into `output_schema`.
3. **Orchestration is easier to review as data** for many pipelines (stations, fan-out, gates) than as a general-purpose script.

## Approach

Treat Rhai as **intermediate representation (IR)**:

```text
Author:  JSON workflow + JSON Schema files
Compile: Rhaiteous (this project; CLI: rhaiteous)
Run:     Grok Build workflow host
```

This is the same split many systems use (YAML/JSON → engine IR), without waiting for a first-party JSON frontend in Grok.

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
- Official affiliation with or endorsement by xAI  

## Architecture

| Module | Responsibility |
|--------|----------------|
| `json-to-rhai.js` | Faithful emission of JSON values as Rhai literals |
| `template.js` | `{{refs}}` → Rhai string concatenation statements |
| `compile-workflow.js` | Dialect validation, schema load, step emit, file I/O |
| `cli.js` | `parseArgs`, exit codes, stdout/stderr policy |

### Schema pipeline

1. Workflow lists `schemas: { binding: "file.schema.json" }` (paths under `{base}/schemas/`)  
2. Compiler `JSON.parse`s each file  
3. Emitter writes `let <binding>_schema = #{ ... };`  
4. Steps set `output_schema: <binding>_schema`  
5. Step `prompt` lists files under `{base}/prompts/`; bodies are concatenated with section banners, then `{{templates}}` expand into Rhai string builds  

Authors never maintain the Rhai form. Default `base` is `./rhaiteous` (CLI `-b` / `--base`).

### Binding / scope pipeline

Steps introduce named bindings (`as`, `dropped_as`, `bind`, `collect`, …). Later steps and templates may only reference known bindings. This catches typos at compile time instead of at Grok runtime.

## Dialect philosophy

v1 is a **subset** tuned to multi-stage agent pipelines (intake → parallel analyze → parallel verify → filter → complete), not a reimplementation of all Rhai.

Prefer:

- Adding a clear new `op` with fail-closed validation  
- Over dumping raw Rhai escape hatches without structure  

If an escape hatch is added later, document it as IR leakage and keep it optional.

## Compatibility

- **Grok Build** evolves; emitted scripts target the documented host API (`agent`, `parallel`, `phase`, `complete`, `pause`, `await_user`, `output_schema`, `capability_mode`, `agent_type`, …).  
- Recompile when upgrading expectations around meta shape or host functions.  
- This project’s **semver** applies to the JSON dialect and Node API, not to Grok itself.

## Security notes

- Compiler reads only paths you pass (workflow file + schema paths you declare).  
- Generated prompts embed template data as Rhai strings; treat untrusted document content carefully when you pass it through templates or args.  
- Do not compile untrusted workflow JSON in privileged environments without review (same as running any code generator).

## Related reading

- Grok Build workflow skill / user guide (workflows, budgets, resume)  
- [Rhai language](https://rhai.rs/) (underlying script language)  
- [JSON Schema](https://json-schema.org/) (authoring contracts)
