# Using Rhaiteous in a Grok Build project

Step-by-step: install the compiler from **npm**, lay out authoring files under version control, compile into Grok’s project workflow directory, and keep the generated `.rhai` trackable in git.

## Recommended usage

| Audience | How to run Rhaiteous |
|----------|----------------------|
| **Grok project authors (default)** | `npm install --save-dev rhaiteous` then `npx rhaiteous …` |
| One-off / no package.json | `npx rhaiteous …` (downloads/runs the published CLI) |
| Contributors to Rhaiteous itself | Clone this repo; `node ./bin/rhaiteous.js` or `npm link` |

You do **not** need to clone or vendor the Rhaiteous source tree just to compile workflows. The published package has **zero runtime dependencies**.

Package: [https://www.npmjs.com/package/rhaiteous](https://www.npmjs.com/package/rhaiteous)

## Mental model

| You maintain | Compiler writes (same cycle) | Grok executes |
|--------------|------------------------------|---------------|
| Host **`workflows/<name>/`** packs (`workflow.json`, `schema.json`, `stations/`, …) | In-pack **`workflow.rhai`** + **`workflow.md`** | `/workflow <name> {…args}` |
| Product seeds from npm: **`node_modules/rhaiteous/workflows/example-*`** | Optional publish to **`.grok/workflows/<name>.rhai`** | |

Host `workflows/` is typically **gitignored** (sandbox). Product seeds use the **`example-`** prefix. Both `.rhai` and `workflow.md` are **build artifacts** — do not hand-edit.

See [examples/README.md](../examples/README.md) for Option B (`examples/` in git → `workflows/` on npm).

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

1. **Node.js 18+** (`node -v`) with **npm** (includes `npx`).
2. A Grok Build project (repo / workspace root).

---

## 1. Install the CLI (recommended: npm)

From your **Grok project root**:

### Project dependency (preferred)

```bash
npm install --save-dev rhaiteous
npx rhaiteous --help
```

Using a **devDependency** keeps the compiler version pinned in `package.json` for teammates and CI, without putting it on production dependency lists.

Optional script:

```json
{
  "scripts": {
    "workflows:compile": "rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json"
  }
}
```

```bash
npm run workflows:compile
```

### One-shot with `npx` (no package.json entry)

```bash
npx rhaiteous --help
npx rhaiteous@0.3.1 ./rhaiteous/workflows/office-shopping.workflow.json --dry-run
```

### Global install (optional)

```bash
npm install -g rhaiteous
rhaiteous --help
```

### Alternatives (only if you need them)

| Approach | When |
|----------|------|
| Clone + `npm link` | Hacking on the compiler itself |
| `node path/to/Rhaiteous/bin/rhaiteous.js` | Offline / unreleased commits |
| Git submodule under `tools/rhaiteous` | Pin to a git SHA instead of npm |

For normal Grok project authoring, prefer **npm / `npx`**.

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
  package.json           # lists rhaiteous as a devDependency
  rhaiteous/
    workflows/           # *.workflow.json  (authoring — commit these)
    schemas/             # *.schema.json
    prompts/             # prompt source files
  .grok/
    workflows/           # *.rhai           (generated IR — Grok discovery)
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

Copy or adapt the shipped **office-shopping** example (five stations: Intake → Inventory → Audit → Procurement → Purchasing). Full file text and step-by-step explanation: [office-shopping-example.md](./office-shopping-example.md).

Minimal shape of a step that uses a schema + prompt file:

```json
{
  "op": "agent",
  "as": "intake",
  "output_schema": "requests",
  "prompt": ["shopping-intake.md"]
}
```

| Asset | Example path under `{base}` |
|-------|-----------------------------|
| Workflow | `workflows/office-shopping.workflow.json` |
| Schemas | `schemas/shopping-requests.schema.json`, … |
| Prompts | `prompts/shopping-intake.md`, … |

Use `$comment` freely in schema files. Dialect reference: [workflow-json.md](./workflow-json.md).

---

## 4. Compile into the project `.grok/workflows/` location

Always run the compiler from the **Grok project root** so defaults resolve correctly.

```bash
# default out: ./.grok/workflows/office-shopping.rhai
# default base: ./rhaiteous
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json
```

Equivalent explicit form:

```bash
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json \
  -b ./rhaiteous \
  -o ./.grok/workflows/office-shopping.rhai
```

Other useful flags:

```bash
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json --dry-run
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json --stdout
```

If you installed globally or use an npm script that invokes the local bin, bare `rhaiteous …` works the same way.

| Flag | Default |
|------|---------|
| `-b` / `--base` | `./rhaiteous` |
| `-o` / `--out` | `./.grok/workflows/<workflow.name>.rhai` |

Parent directories (including `.grok/workflows/`) are created as needed.

**Do not hand-edit** the generated `.rhai` for day-to-day work. Change JSON / schemas / prompts and recompile.

Optional user-global IR location (not the default):

```bash
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json \
  -o ~/.grok/workflows/office-shopping.rhai
```

---

## 5. Run in Grok Build

1. Open the project in Grok Build (workspace = project root).
2. Confirm `.grok/workflows/<name>.rhai` exists.
3. Launch:

```text
/workflow office-shopping {"requests_dir":"./inbox/requests","company_name":"Acme Office"}
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
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json

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
2. Recompile from project root: `npx rhaiteous ./rhaiteous/workflows/….json` (or `npm run workflows:compile`).
3. Re-run `/workflow <name> {…}` in Grok.
4. Commit sources (+ `.rhai` if you track IR).

---

## 8. Optional: seed from the office-shopping example

Browse assets on GitHub: [examples/rhaiteous](https://github.com/Bromezz/Rhaiteous/tree/main/examples/rhaiteous), or clone once to copy:

```bash
git clone --depth 1 https://github.com/Bromezz/Rhaiteous.git /tmp/Rhaiteous
cp /tmp/Rhaiteous/examples/rhaiteous/workflows/*.workflow.json ./rhaiteous/workflows/
cp /tmp/Rhaiteous/examples/rhaiteous/schemas/* ./rhaiteous/schemas/
cp /tmp/Rhaiteous/examples/rhaiteous/prompts/* ./rhaiteous/prompts/
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json
```

When compiling **inside the Rhaiteous repo itself**, demos use `-b ./examples/rhaiteous` and often `-o ./examples/out/…`. In a real Grok project, omit `-o` so output lands in `.grok/workflows/`.

Full walkthrough: [office-shopping-example.md](./office-shopping-example.md).

---

## 9. Verify your install (smoke test)

After `npm install --save-dev rhaiteous` (and with authoring files under `./rhaiteous/`):

```bash
npx rhaiteous --help
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json --dry-run
```

Expect exit code `0` and a line like `ok: compiled … (dry-run)`.

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
