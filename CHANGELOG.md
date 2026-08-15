# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Example station schemas**: one schema per station, station-named files (`intake.schema.json`, …). Removed `shopping-*` filename prefixes. Issues pack now includes schemas for Intake, Formulation, Validation, Presentation, and QA.

## [0.4.1] — 2026-08-15

### Added

- **`rhaiteous init`**: creates host `./workflows/`, copies product seed packs (`example-*`) from the installed package, and adds a sandbox `workflows/` line to `.gitignore`
- **`rhaiteous compile <pack-name>`**: compiles `./workflows/<name>/` to in-pack `workflow.rhai` + `workflow.md` and publishes `.grok/workflows/<name>.rhai`
- Host flow after `npm install rhaiteous`: `npx rhaiteous init` then `npx rhaiteous compile example-office-shopping`

## [0.4.0] — 2026-08-15

### Added

- **Seed packs under `examples/example-*`**: versioned pack layout (`workflow.json`, `schema.json`, `stations/`, `input/`, `output/`); product ids use the **`example-`** prefix
- **Option B npm map**: `prepack` copies `examples/example-*` → `workflows/example-*` for the tarball (`files` includes `workflows/`); `postpack` cleans the map; root `workflows/` is gitignored
- **example-office-shopping** and **example-birthday-issues** seed packs
- **Generated `.rhai` BUILD ARTIFACT banner**: every compile opens with a clear header that the file is for analysis only, not editing; authoring surface remains JSON + schemas + prompts
- **Generated `workflow.md`**: every compile emits a human guide **always named `workflow.md`** in the same cycle as the Rhai IR (purpose, Grok invocation + args, stations). Written beside the authoring JSON and beside the IR when `-o …/workflow.rhai`. Build artifact — do not hand-edit.
- **Pack-aware asset base**: if `{base}/schemas` or `{base}/prompts` is missing, resolve schemas under `{base}` and prompts under `{base}/stations/` (workflow pack layout)
- **Flow authoring**: `stations[]` of station objects; compiler derives `meta.phases`, emits one `fn` per station, `flow` envelope, and `Fn(flow.next).call(flow)` driver
- **Flow station `schemas`**: optional array of top-level schema bindings; embedded in the station prompt under **Additional Schemas** as best-effort guidance (not host-enforced beyond the flow envelope)
- **Schema `$ref` inlining**: compile-time resolution of external file and in-document `$ref` / JSON pointers under `{base}/schemas/` (`src/schema-inline.js`)
- **Flow `payloadSchema`**: optional payload file path; inlined into flow envelope as `flow.payload` (host-checked via `make_flow_schema()`)
- **Top-level `prompts`**: binding → path under `{base}/prompts/`; station `prompt` arrays list binding names merged in order (e.g. `flow_common` + station file)
- **Flow args injection**: declared workflow `args` are appended to each station prompt as **Workflow args (JSON)** so station prompts can stay source-agnostic

### Changed

- Author field **`uiDescription`** (stations) replaces phase `detail`; still emitted as Grok `meta.phases[].detail`
- Top-level `schemas` bindings are loaded with `$ref` inlining (not raw file parse only)
- Flow envelope always includes `payload` (nullable object default when `payloadSchema` omitted)
- Stations without `workflow.prompts` still accept legacy prompt **file paths**
- **`args` defaults are flat**: the value after the key is the default (e.g. `"out_dir": "…"`). Nested `{ "default": … }` is rejected. Required remains `true` or `{ "required": true }`; optional-without-default remains `{}`
- **Prompt sources use Markdown (`.md`)** under pack `stations/` or legacy `{base}/prompts/`

### Removed

- **`scriptType: "step"`** and **`workflow.steps[]`** (linear step ops: `agent`/`parallel`/`if`/`set`/…). Rhaiteous is **flow-only** (`stations[]`). `"step"` and `steps` fail closed at compile time.
- Hand-authored **`workflow.phases`** (phases are always derived from stations)
- Legacy **`examples/rhaiteous/`** shared-base tree and **`examples/out/`** sample IR dump (replaced by `examples/example-*` packs)

### Migrated

- **office-shopping** example rewritten as pack **`example-office-shopping`** (five-station flow)

## [0.3.1] — 2026-07-27

### Added

- Compile-time **Rhai reserved-keyword guard**: rejects author identifiers that collide with Rhai keywords
- Keyword list shipped at `src/data/rhai-keywords.txt` (active + reserved from the Rhai book)
- Detailed multi-violation report with origin labels; post-emit scan safety net
- Docs for the keyword check; tests in `test/rhai-keywords.test.js`

## [0.3.0] — 2026-07-27

### Added

- Step op **`set`**: assign JSON / `{ "$ref" }` values to bindings; omit `value` for unit `()`
- Hoist `let name = ()` when `set` targets appear inside branch arms (visible after `if` / `if_empty` / `if_failed`)
- office-shopping uses `set` for `cycle_status` / `final_report` across branches

## [0.2.1] — 2026-07-27

### Changed

- **office-shopping** example uses branching: `else` on `if_failed` / `if_empty`, multi-way `if` / `else_if` / `else` after audit, and final `if` / `else` on transactions
- Regenerated `examples/out/office-shopping.rhai`; docs/README embed and step tables updated

## [0.2.0] — 2026-07-27

### Added

- Structured branching: step op **`if`** with closed `when.kind` values (`empty`, `nonempty`, `failed`, `succeeded`), plus optional **`else_if`** / **`else`**
- Optional **`else`** on **`if_empty`** and **`if_failed`** (backward compatible)
- Docs and tests for multi-way branch emission

### Notes

- Backward compatible dialect extension (existing workflows without `else` / `if` unchanged)
- Compiler package surface still JSON → Rhai; new ops only

## [0.1.2] — 2026-07-27

### Added

- README badges for **npm version** and **license** (shields.io)
- Expanded npm **keywords** for discovery (`grok-build`, `xai`, `rhai`, `workflow`, `json-schema`, `cli`, `multi-agent`, …)

### Notes

- Packaging / docs polish only; compiler behavior unchanged from 0.1.1

## [0.1.1] — 2026-07-27

### Added

- **office-shopping** as the package’s full example: five-station twice-weekly office supply cycle (workflow, schemas, prompts, sample IR)
- [docs/office-shopping-example.md](./docs/office-shopping-example.md) — end-to-end user guide for that example
- Docs recommend **`npm install --save-dev rhaiteous`** + **`npx rhaiteous`** as the primary way to use the published package

### Changed

- Removed **minimal** and **client-issues** example assets, sample IR, and documentation references
- README, project guide, CLI/API, and workflow-json reference updated for npm-first install and office-shopping-only examples
- Tests and `example:compile` script target office-shopping

### Notes

- Compiler behavior is unchanged from 0.1.0 (patch release: docs + examples + packaging polish)

## [0.1.0] — 2026-07-26

### Added

- Initial JSON → Rhai workflow compiler for Grok Build under the name **Rhaiteous**
- CLI entry point: `rhaiteous` (`-o` / `--out`, `-b` / `--base`, `--stdout`, `--dry-run`, `--help`)
- Library package name: `rhaiteous` (`compileWorkflow`, `compileWorkflowFile`, `readJsonFile`, `jsonToRhai`)
- Multi-schema loading via `schemas` map (external `.schema.json` under `{base}/schemas/`)
- File-based prompts under `{base}/prompts/` with section banners; `{{templates}}` expanded at compile time
- Default Rhai output: `.grok/workflows/<name>.rhai` (Grok project discovery path)
- Step ops: `phase`, `log`, `agent`, `parallel`, `collect`, `zip_filter`, `bind`, `if_empty`, `if_failed`, `complete` (with `$ref`), `complete_from`, `pause`, `await_user`
- Evidence as `{ source, quote }[]` in example schemas; zip_filter uses non-empty array check
- Documentation: README, workflow JSON reference, CLI/API, design, using-in-a-grok-project, contributing
- First publish to npm as [`rhaiteous@0.1.0`](https://www.npmjs.com/package/rhaiteous)
- MIT license
