# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
