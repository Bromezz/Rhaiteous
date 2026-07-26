# Using Rhaiteous in a Grok Build project

Step-by-step: install the compiler, lay out authoring files under version control, compile into Grok’s project workflow directory, and keep the generated `.rhai` trackable in git.

## Mental model

| You maintain (VC) | Compiler writes | Grok executes |
|-------------------|-----------------|---------------|
| `rhaiteous/workflows/*.workflow.json` | | |
| `rhaiteous/schemas/*` | → **`.grok/workflows/<name>.rhai`** | `/workflow <name> {…args}` |
| `rhaiteous/prompts/*` | | |

Grok discovers **saved** workflows only from:

| Scope | Path |
|-------|------|
| **Project** | `<repo-root>/.grok/workflows/*.rhai` |
| **User** | `~/.grok/workflows/*.rhai` |

There is no alternate discovery path for arbitrary directories. Rhaiteous therefore **defaults** to writing project IR at:

```text
./.grok/workflows/<workflow.name>.rhai
```

relative to the **current working directory** when you compile (normally your Grok project root).

---

## Prerequisites

1. **Node.js 18+** (`node -v`).
2. A Grok Build project (repo / workspace root).
3. Access to [Rhaiteous](https://github.com/Bromezz/Rhaiteous) (clone once).

No `npm install` is required for the compiler (zero runtime dependencies).

---

## 1. Install the CLI

### Option A — `npm link` (PATH)

```bash
git clone https://github.com/Bromezz/Rhaiteous.git
cd Rhaiteous
npm test
npm link
rhaiteous --help
```

### Option B — call Node on the clone

```bash
git clone https://github.com/Bromezz/Rhaiteous.git ~/src/Rhaiteous
node ~/src/Rhaiteous/bin/rhaiteous.js --help
```

### Option C — vendor inside the Grok project

```bash
cd /path/to/your-grok-project
git clone https://github.com/Bromezz/Rhaiteous.git tools/rhaiteous
# or: git submodule add https://github.com/Bromezz/Rhaiteous.git tools/rhaiteous
node ./tools/rhaiteous/bin/rhaiteous.js --help
```

---

## 2. Create the project layout

From your **Grok project root**:

```bash
mkdir -p rhaiteous/workflows rhaiteous/schemas rhaiteous/prompts
mkdir -p .grok/workflows
```

Recommended tree:

```text
your-grok-project/
  rhaiteous/
    workflows/     # *.workflow.json  (authoring — commit these)
    schemas/       # *.schema.json
    prompts/       # prompt source files
  .grok/
    workflows/     # *.rhai           (generated IR — Grok discovery)
  tools/rhaiteous/ # optional vendored compiler
```

| Path | Role |
|------|------|
| `rhaiteous/workflows/` | Workflow JSON under version control |
| `rhaiteous/schemas/` | JSON Schema files (`schemas` map paths are relative here) |
| `rhaiteous/prompts/` | Prompt files listed in each step’s `prompt` array |
| `.grok/workflows/` | **Default compile output** — Grok project discovery |

Asset base defaults to `./rhaiteous` (`-b` / `--base` to override). The workflows folder is a **convention** for JSON; the compiler only requires the path you pass to the CLI.

---

## 3. Author schema, prompt, and workflow

**Schema** — `rhaiteous/schemas/summary.schema.json` (use `$comment` freely).

**Prompt** — `rhaiteous/prompts/summarize.txt` (may include `{{args…}}` templates).

**Workflow** — `rhaiteous/workflows/minimal-summary.workflow.json`:

```json
{
  "name": "minimal-summary",
  "description": "One agent returns a structured summary",
  "args": {
    "target": { "required": true }
  },
  "schemas": {
    "summary": "summary.schema.json"
  },
  "steps": [
    {
      "op": "agent",
      "as": "result",
      "output_schema": "summary",
      "prompt": ["summarize.txt"]
    },
    { "op": "complete_from", "from": "result" }
  ]
}
```

Dialect reference: [workflow-json.md](./workflow-json.md).

---

## 4. Compile into the project `.grok/workflows/` location

Always run the compiler from the **Grok project root** so defaults resolve correctly.

```bash
# default out: ./.grok/workflows/minimal-summary.rhai
# default base: ./rhaiteous
rhaiteous ./rhaiteous/workflows/minimal-summary.workflow.json
```

Equivalent explicit form:

```bash
rhaiteous ./rhaiteous/workflows/minimal-summary.workflow.json \
  -b ./rhaiteous \
  -o ./.grok/workflows/minimal-summary.rhai
```

Other useful flags:

```bash
rhaiteous ./rhaiteous/workflows/minimal-summary.workflow.json --dry-run
rhaiteous ./rhaiteous/workflows/minimal-summary.workflow.json --stdout
```

| Flag | Default |
|------|---------|
| `-b` / `--base` | `./rhaiteous` |
| `-o` / `--out` | `./.grok/workflows/<workflow.name>.rhai` |

Parent directories (including `.grok/workflows/`) are created as needed.

**Do not hand-edit** the generated `.rhai` for day-to-day work. Change JSON / schemas / prompts and recompile.

Optional user-global install (not the default):

```bash
rhaiteous ./rhaiteous/workflows/minimal-summary.workflow.json \
  -o ~/.grok/workflows/minimal-summary.rhai
```

---

## 5. Run in Grok Build

1. Open the project in Grok Build (workspace = project root).
2. Confirm `.grok/workflows/<name>.rhai` exists.
3. Launch:

```text
/workflow minimal-summary {"target":"quarterly planning notes"}
```

Use `/workflows` for the live run dashboard (runs, not the definition catalog).

---

## 6. Keep compiled workflows in git (gitignore exception)

Many projects ignore all of `.grok/` (local Grok state). That also hides **`.grok/workflows/*.rhai`**, so clones won’t have runnable IR without recompiling.

**Yes, you can exempt them** — but Git cannot re-include a file if a **parent directory** is fully ignored. Prefer ignoring **contents** of `.grok/`, then un-ignore `workflows/`.

### Recommended `.gitignore` fragment (Grok project)

```gitignore
# Grok local state, but keep compiled workflow IR under version control.
# Do NOT use a bare ".grok/" rule if you need these negations to work.
.grok/*
!.grok/workflows/
!.grok/workflows/**
```

Narrower variant (only `.rhai` files):

```gitignore
.grok/*
!.grok/workflows/
!.grok/workflows/
!.grok/workflows/*.rhai
```

(If you still have a line that is only `.grok/`, remove or replace it — that form blocks child re-includes.)

### After adding the exception

```bash
# compile so the files exist
rhaiteous ./rhaiteous/workflows/minimal-summary.workflow.json

# force-add if they were previously ignored
git add -f .grok/workflows/*.rhai
git add rhaiteous/
git status
```

### What to commit

| Commit | Skip / ignore |
|--------|----------------|
| `rhaiteous/workflows/`, `schemas/`, `prompts/` | Ephemeral `.grok/*` (sessions, caches, etc.) |
| `.grok/workflows/*.rhai` (recommended for “clone and run”) | Hand-edited Rhai forks (prefer recompile) |

If you **prefer not** to commit IR, keep `.grok/` fully ignored and recompile in setup/CI. Document that in your project README.

---

## 7. Day-to-day loop

1. Edit under `rhaiteous/` (workflow JSON, schemas, prompts).
2. Recompile from project root (`rhaiteous ./rhaiteous/workflows/….json`).
3. Re-run `/workflow <name> {…}` in Grok.
4. Commit sources (+ `.rhai` if you track IR).

Example npm script in the **Grok project**:

```json
{
  "scripts": {
    "workflows:compile": "rhaiteous ./rhaiteous/workflows/minimal-summary.workflow.json"
  }
}
```

---

## 8. Optional: seed from Rhaiteous examples

```bash
cp tools/rhaiteous/examples/rhaiteous/workflows/*.workflow.json ./rhaiteous/workflows/
cp tools/rhaiteous/examples/rhaiteous/schemas/* ./rhaiteous/schemas/
cp tools/rhaiteous/examples/rhaiteous/prompts/* ./rhaiteous/prompts/
rhaiteous ./rhaiteous/workflows/minimal.workflow.json
```

When compiling **inside the Rhaiteous repo itself**, examples use `-b ./examples/rhaiteous` and often `-o ./examples/out/…` so the package’s demo IR stays under `examples/out/`. In a real Grok project, omit `-o` so output lands in `.grok/workflows/`.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `failed to load schema` / `prompt file` | Wrong cwd, or missing `-b`; files not under `{base}/schemas` or `prompts` |
| Grok doesn’t list the workflow | `.rhai` not under `.grok/workflows/` (or `~/.grok/workflows/`); wrong `meta.name`; forgot recompile |
| `.rhai` missing from `git status` | Parent `.grok/` still fully ignored — use the negation pattern above |
| `unsupported op` | Step not in the v1 dialect — see [workflow-json.md](./workflow-json.md) |

---

## Related docs

- [CLI and library API](./cli-and-api.md)
- [Workflow JSON reference](./workflow-json.md)
- [Design](./design.md)

Rhaiteous is not affiliated with xAI; it targets Grok Build’s documented workflow host API.
