# Contributing

Thanks for helping improve **Rhaiteous**.

## Development setup

1. Install **Node.js 18+** (24 LTS recommended).
2. Clone the repository and `cd` into it.
3. No `npm install` is required for core compile/test (zero runtime dependencies).
4. Run tests:

```bash
npm test
# equivalent:
node --test ./test/json-to-rhai.test.js ./test/compile-workflow.test.js
```

5. Compile examples:

```bash
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/minimal.workflow.json -b ./examples/rhaiteous -o ./examples/out/minimal-summary.rhai
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/client-issues.workflow.json -b ./examples/rhaiteous -o ./examples/out/client-issues.rhai
```

## Project conventions

### Code style

This codebase follows strict comment-and-layout rules (see historical project rules if present). In short:

- **2-space** indent; no tabs  
- Every one-line statement is preceded by a same-indent `//` comment  
- Blank line before every comment after the first in a file  
- No space after `//` (`//correct`, not `// correct`)  
- Inline comments start with a **lowercase** letter  
- Functions use a short block doc comment (`@description`, `@param`, `@returns`) instead of a leading `//`  
- Prefer **structured imports** and **whole-object** module surfaces (`import nodeFs from "node:fs"`, `compileMod.compileWorkflow(...)`) over heavy destructuring  

Match surrounding files when editing.

### Design rules

- **Fail closed** on unknown dialect features  
- Keep the **CLI and library** on the same implementation (`compile-workflow.js`)  
- Prefer **deterministic** emit (stable key order, stable formatting) for readable diffs  
- Document dialect changes in `docs/workflow-json.md` and mention them in the PR  
- Update examples when you change the dialect in a breaking way  

## Pull requests

1. Add or update **tests** for compiler behavior changes.  
2. Update **docs** (`README.md`, `docs/*`) when user-visible behavior changes.  
3. Keep generated sample IR under `examples/out/` in sync if you change emission (or note why not).  
4. Describe **motivation** and **dialect impact** (additive vs breaking).  

## Reporting issues

Include:

- Node version (`node --version`)  
- Command line or library call used  
- Minimal workflow JSON (and schemas if relevant)  
- Full error output  

## Scope

Useful contributions:

- New step `op`s that map cleanly to Grok host calls  
- Better diagnostics  
- Optional JSON Schema **meta-schema** for workflow documents  
- Packaging / CI / editor helpers  

Please open an issue before large dialect redesigns so we can keep the authoring surface small and teachable.
