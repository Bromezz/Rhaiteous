# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial JSON → Rhai workflow compiler for Grok Build under the name **Rhaiteous**
- CLI entry point: `rhaiteous` (`-o` / `--out`, `--stdout`, `--dry-run`, `--help`)
- Library package name: `rhaiteous` (`compileWorkflow`, `compileWorkflowFile`, `readJsonFile`, `jsonToRhai`)
- Multi-schema loading via `schemas` map (external `.schema.json` files by name)
- Step ops: `phase`, `log`, `agent`, `parallel`, `collect`, `zip_filter`, `bind`, `if_empty`, `if_failed`, `complete` (with `$ref`), `complete_from`, `pause`, `await_user`
- Prompt / log templates: `{{args.*}}`, loop item/index, known bindings
- Examples: `minimal`, `client-issues` (+ schemas and sample generated Rhai)
- Documentation: README, workflow JSON reference, CLI/API, design, contributing
- MIT license

## [0.1.0] — 2026-07-26

- First documented release line (standalone `rhaiteous` package)
