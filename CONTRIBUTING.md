# Contributing

Thanks for helping improve **Rhaiteous**.

## Development setup

1. Install **Node.js 18+** (24 LTS recommended).
2. Clone the repository and `cd` into it.
3. No `npm install` is required for core compile/test (zero runtime dependencies).
4. Run tests:

```bash
npm test
```

5. Compile a seed pack:

```bash
npm run example:compile
# or:
node ./bin/rhaiteous.js ./examples/example-office-shopping/workflow.json \
  -b ./examples/example-office-shopping \
  -o ./examples/example-office-shopping/workflow.rhai
```

6. Preview npm seed layout (Option B map):

```bash
npm run map:workflows    # → workflows/example-* (gitignored)
npm run clean:workflows
```

## Project conventions

### Seed packs

- Live under **`examples/example-*`** only (versioned).
- Directory name = `workflow.json` `"name"` = Grok id; always **`example-`** prefix.
- Pack shape: `workflow.json`, `schema.json`, `stations/`, `input/`, `output/`.
- Do **not** commit `workflow.rhai` / `workflow.md` (gitignored build products).
- **`workflows/`** at repo root is **prepack output** for npm — gitignored; not an authoring tree.

### Code style

This codebase follows strict comment-and-layout rules. In short:

- **2-space** indent; no tabs  
- Every one-line statement is preceded by a same-indent `//` comment  
- Blank line before every comment after the first in a file  
- No space after `//` (`//correct`, not `// correct`)  
- Inline comments start with a **lowercase** letter  
- Functions use a short block doc comment (`@description`, `@param`, `@returns`)  
- Prefer **structured imports** and **whole-object** module surfaces  

Match surrounding files when editing.

### Design rules

- **Fail closed** on unknown dialect features  
- Keep the **CLI and library** on the same implementation (`compile-workflow.js`)  
- Prefer **deterministic** emit for readable diffs  
- Document dialect changes in `docs/workflow-json.md`  
- Update **example packs** when you change the dialect in a breaking way  
- Keep **`experiments/`** local only (gitignored)  

## Pull requests

1. Add or update **tests** for compiler behavior changes.  
2. Update **docs** (`README.md`, `examples/README.md`, `docs/*`) when user-visible behavior changes.  
3. Describe **motivation** and **dialect impact** (additive vs breaking).  

## Reporting issues

Include:

- Node version (`node --version`)  
- Command line or library call used  
- Minimal workflow JSON / pack layout when relevant  
