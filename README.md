# Rhaiteous

[![npm](https://img.shields.io/npm/v/rhaiteous.svg?logoColor=CB3837&style=plastic&logo=npm&labelColor=silver&color=3269a0)](https://www.npmjs.com/package/rhaiteous)
[![license](https://img.shields.io/npm/l/rhaiteous.svg?style=plastic&labelColor=silver)](./LICENSE)

**JSON in → Rhai out** for [Grok Build](https://x.ai/) workflows.  
*A righteous way to author Rhai.*

Grok Build runs multi-agent pipelines as **Rhai** scripts (`.rhai`) under `.grok/workflows/`. That works well as a runtime IR, but authoring orchestration and **JSON Schema** as Rhai maps is awkward.

**Rhaiteous** lets you:

- Author workflows as **plain JSON** under `{base}/workflows/` (version-controlled)
- Keep **real JSON Schema** files under `{base}/schemas/` (default base: `./rhaiteous`)
- Keep **prompt source files** under `{base}/prompts/` (referenced by name from each step)
- Compile them into Grok’s **project** discovery path: **`.grok/workflows/<name>.rhai`**

```text
{base}/workflows/*.workflow.json
{base}/schemas/*.schema.json
{base}/prompts/*
              │
              ▼
          rhaiteous
              │
              ▼
   .grok/workflows/<name>.rhai     ← default output (Grok project location)
              │
              ▼
   /workflow <name> { ...args }
```

## Why

| Concern | Without Rhaiteous | With Rhaiteous |
|--------|-------------------|----------------|
| Orchestration | Hand-written Rhai | Declarative JSON steps |
| Output contracts | `#{ "type": "object", ... }` in Rhai | Standard `.schema.json` files |
| Multiple schemas | Copy/paste maps | Named refs: `"output_schema": "candidates"` |
| Diffs / review | Generated-looking IR | Review JSON + schemas; recompile |

Rhai remains what Grok executes. You maintain the authoring surface.

## Requirements

- **Node.js 18+** (developed on 24 LTS)
- No runtime npm dependencies (Node standard library only)

## Install (recommended: npm)

Published package: **[rhaiteous](https://www.npmjs.com/package/rhaiteous)** on the public npm registry.

### One-shot with `npx` (no install)

```bash
npx rhaiteous --help
```

### Project dependency (recommended for Grok projects)

From your **Grok project root**:

```bash
npm install --save-dev rhaiteous
npx rhaiteous --help
```

Pin a version in CI/scripts when you want reproducible compiles:

```bash
npx rhaiteous@0.1.2 ./rhaiteous/workflows/my.workflow.json
```

### Global CLI (optional)

```bash
npm install -g rhaiteous
rhaiteous --help
```

### As a library

```js
import compileMod from "rhaiteous";

const result = compileMod.compileWorkflowFile(
  "./rhaiteous/workflows/office-shopping.workflow.json",
  {
    base: "./rhaiteous",
    // omit outPath → writes ./.grok/workflows/<name>.rhai
    write: true,
  }
);

console.log(result.outputPath);
```

### Developing this repo (contributors)

Clone and run from source — not required for normal use:

```bash
git clone https://github.com/Bromezz/Rhaiteous.git
cd Rhaiteous
npm test
npm link          # optional: rhaiteous on PATH from this clone
# or:
node ./bin/rhaiteous.js --help
```

## Quick start

In a **Grok project** (cwd = project root; assets under `./rhaiteous/`):

```bash
# install once
npm install --save-dev rhaiteous

# compile → ./.grok/workflows/<name>.rhai
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json

# compile only (CI check)
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json --dry-run

# print Rhai to stdout (status on stderr)
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json --stdout
```

Then in Grok Build:

```text
/workflow office-shopping {"requests_dir":"./inbox/requests","company_name":"Acme Office"}
```

**Full project guide (layout, gitignore, day-to-day loop):**  
→ **[docs/using-in-a-grok-project.md](./docs/using-in-a-grok-project.md)**

**Complete example walkthrough (every file):**  
→ **[docs/office-shopping-example.md](./docs/office-shopping-example.md)**

### Package demos (this repository only)

```bash
# sample IR under examples/out/ (not the Grok project path)
npx rhaiteous ./examples/rhaiteous/workflows/office-shopping.workflow.json \
  -b ./examples/rhaiteous -o ./examples/out/office-shopping.rhai
# or from a clone without install:
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/office-shopping.workflow.json \
  -b ./examples/rhaiteous -o ./examples/out/office-shopping.rhai
```

## Asset base (`workflows/` + `schemas/` + `prompts/`)

By convention, project assets live under **`./rhaiteous`** (override with **`-b` / `--base`**):

```text
rhaiteous/
  workflows/   # *.workflow.json (authoring — keep under VC)
  schemas/     # *.schema.json referenced from workflow "schemas"
  prompts/     # prompt source files listed in each step's "prompt"
.grok/
  workflows/   # *.rhai — default compile output (Grok project discovery)
```

### Multiple external JSON Schemas

Declare schemas by **name → path relative to `{base}/schemas`**:

```json
{
  "schemas": {
    "requests": "shopping-requests.schema.json",
    "items": "shopping-items.schema.json",
    "audit": "shopping-audit.schema.json",
    "vendor_pick": "shopping-vendor-pick.schema.json",
    "purchase_one": "shopping-purchase-one.schema.json"
  }
}
```

Reference them on steps by **name** (not path):

```json
{
  "op": "agent",
  "as": "intake",
  "output_schema": "requests",
  "prompt": ["shopping-intake.txt"]
}
```

### Prompt files

Each step `prompt` is an **array of source file names** under `{base}/prompts/`. Files are loaded at compile time, concatenated (each prefaced with a banner), then `{{templates}}` are expanded into Rhai string builds. Missing files fail the compile.

```text
===== [shopping-intake.txt] =====
…file body…
```

You never hand-author the Rhai form of those schemas or prompt bodies.

See the [office-shopping example](./docs/office-shopping-example.md) for five schemas and five prompt files in one pipeline.

### Default Rhai output (project location)

When `-o` / `--out` is omitted, Rhaiteous writes:

```text
./.grok/workflows/<workflow.name>.rhai
```

That is the **project** path Grok scans for named `/workflow` launches (user-global alternative: `~/.grok/workflows/`). Parent dirs are created automatically. Use `-o` only when you intentionally want another path (e.g. package demos under `examples/out/`).

### Keeping `.rhai` in git

If your project ignores `.grok/`, exempt the workflow IR so clones stay runnable:

```gitignore
# Ignore Grok local state, but keep compiled workflows under VC.
# Do not use a bare ".grok/" line — that blocks re-including children.
.grok/*
!.grok/workflows/
!.grok/workflows/**
```

Details: [docs/using-in-a-grok-project.md](./docs/using-in-a-grok-project.md#6-keep-compiled-workflows-in-git-gitignore-exception).

## Complete example: twice-weekly office shopping

This is a **full authoring set** for Rhaiteous: every file type you need (workflow JSON, schemas, prompts), plus how to compile and run it. Scenario: a small company builds a **twice-weekly office supply** list through five stations:

| Station | What it does |
|---------|----------------|
| **Intake** | Collects requests from email, chat, forms, etc., and **deposits** them as structured records |
| **Inventory** | Turns each request into specific items and quantities |
| **Audit** | Challenges each line (necessity, quantity, duplicates, policy, budget) |
| **Procurement** | Selects a vendor / fulfillment path per surviving item |
| **Purchasing** | Performs (or simulates) purchases and records transactions |

Canonical tree (also under [`examples/rhaiteous/`](./examples/rhaiteous/)):

```text
rhaiteous/
  workflows/office-shopping.workflow.json
  schemas/
    shopping-requests.schema.json      # Intake
    shopping-items.schema.json         # Inventory
    shopping-audit.schema.json         # Audit
    shopping-vendor-pick.schema.json   # Procurement (per item)
    shopping-purchase-one.schema.json  # Purchasing (per pick)
  prompts/
    shopping-intake.txt
    shopping-inventory.txt
    shopping-audit.txt
    shopping-procurement.txt
    shopping-purchasing.txt
.grok/workflows/office-shopping.rhai   # generated — do not hand-author
```

**Full text of every file** (workflow + all five schemas + all five prompts):  
→ **[docs/office-shopping-example.md](./docs/office-shopping-example.md)**

### Compile and run

```bash
# Grok project root → ./.grok/workflows/office-shopping.rhai
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json

# this package (sample IR under examples/out/)
npx rhaiteous ./examples/rhaiteous/workflows/office-shopping.workflow.json \
  -b ./examples/rhaiteous -o ./examples/out/office-shopping.rhai
```

```text
/workflow office-shopping {"requests_dir":"./inbox/requests","company_name":"Acme Office"}
```

### 1. Workflow JSON

[`examples/rhaiteous/workflows/office-shopping.workflow.json`](./examples/rhaiteous/workflows/office-shopping.workflow.json) — orchestration: Intake agent → parallel Inventory → Audit + `zip_filter` → parallel Procurement → parallel Purchasing → `complete` with `$ref`s.

```json
{
  "name": "office-shopping",
  "description": "Twice-weekly office supply cycle: intake requests, inventory items, audit, procure vendors, purchase and record transactions",
  "phases": [
    { "title": "Intake", "detail": "collect and deposit requests from email, chat, forms" },
    { "title": "Inventory", "detail": "compile specific items and quantities per request" },
    { "title": "Audit", "detail": "challenge each line across validity facets" },
    { "title": "Procurement", "detail": "select a vendor for each surviving item" },
    { "title": "Purchasing", "detail": "buy and record each transaction" }
  ],
  "args": {
    "requests_dir": { "required": true },
    "company_name": { "default": "Acme Office" },
    "cycle": { "default": "twice-weekly" }
  },
  "schemas": {
    "requests": "shopping-requests.schema.json",
    "items": "shopping-items.schema.json",
    "audit": "shopping-audit.schema.json",
    "vendor_pick": "shopping-vendor-pick.schema.json",
    "purchase_one": "shopping-purchase-one.schema.json"
  },
  "steps": [
    { "op": "phase", "title": "Intake" },
    {
      "op": "agent",
      "as": "intake",
      "label": "intake",
      "agent_type": "stickler",
      "capability_mode": "read-only",
      "output_schema": "requests",
      "prompt": ["shopping-intake.txt"]
    },
    {
      "op": "if_failed",
      "path": "intake",
      "then": [
        { "op": "complete", "value": { "summary": "intake failed", "transactions": [] } }
      ]
    },
    { "op": "bind", "as": "requests", "from": "intake", "field": "requests" },
    {
      "op": "if_empty",
      "path": "requests",
      "then": [
        {
          "op": "complete",
          "value": { "summary": "No supply requests this cycle.", "transactions": [] }
        }
      ]
    },
    { "op": "log", "message": "Intake complete for {{args.company_name}} ({{args.cycle}})" },

    { "op": "phase", "title": "Inventory" },
    {
      "op": "parallel",
      "as": "inventory_results",
      "over": "requests",
      "item_as": "req",
      "index_as": "ri",
      "label_prefix": "inventory",
      "agent_type": "analyst",
      "capability_mode": "read-only",
      "output_schema": "items",
      "prompt": ["shopping-inventory.txt"]
    },
    { "op": "collect", "as": "items", "from": "inventory_results", "field": "items" },
    {
      "op": "if_empty",
      "path": "items",
      "then": [
        { "op": "complete", "value": { "summary": "No line items to buy.", "transactions": [] } }
      ]
    },

    { "op": "phase", "title": "Audit" },
    {
      "op": "parallel",
      "as": "audit_results",
      "over": "items",
      "item_as": "item",
      "index_as": "ai",
      "label_prefix": "audit",
      "agent_type": "skeptic",
      "capability_mode": "read-only",
      "output_schema": "audit",
      "prompt": ["shopping-audit.txt"]
    },
    {
      "op": "zip_filter",
      "as": "survivors",
      "dropped_as": "dropped_items",
      "left": "items",
      "right": "audit_results"
    },
    {
      "op": "if_empty",
      "path": "survivors",
      "then": [
        {
          "op": "complete",
          "value": {
            "summary": "No items survived audit.",
            "dropped": { "$ref": "dropped_items" },
            "transactions": []
          }
        }
      ]
    },
    { "op": "log", "message": "Audit complete for {{args.company_name}}" },

    { "op": "phase", "title": "Procurement" },
    {
      "op": "parallel",
      "as": "procurement_results",
      "over": "survivors",
      "item_as": "item",
      "index_as": "pi",
      "label_prefix": "procure",
      "agent_type": "analyst",
      "capability_mode": "read-only",
      "output_schema": "vendor_pick",
      "prompt": ["shopping-procurement.txt"]
    },
    { "op": "collect", "as": "vendor_picks", "from": "procurement_results", "field": "picks" },
    {
      "op": "if_empty",
      "path": "vendor_picks",
      "then": [
        {
          "op": "complete",
          "value": {
            "summary": "procurement produced no vendor picks",
            "items": { "$ref": "survivors" },
            "transactions": []
          }
        }
      ]
    },

    { "op": "phase", "title": "Purchasing" },
    {
      "op": "parallel",
      "as": "purchase_results",
      "over": "vendor_picks",
      "item_as": "pick",
      "index_as": "xi",
      "label_prefix": "purchase",
      "agent_type": "general-purpose",
      "capability_mode": "execute",
      "output_schema": "purchase_one",
      "prompt": ["shopping-purchasing.txt"]
    },
    {
      "op": "collect",
      "as": "transactions",
      "from": "purchase_results",
      "field": "transactions"
    },
    {
      "op": "complete",
      "value": {
        "summary": "office shopping cycle complete",
        "requests": { "$ref": "requests" },
        "items_audited": { "$ref": "survivors" },
        "dropped": { "$ref": "dropped_items" },
        "vendor_picks": { "$ref": "vendor_picks" },
        "transactions": { "$ref": "transactions" }
      }
    }
  ]
}
```

### 2. Schemas (under `{base}/schemas/`)

| Binding | File | Station |
|---------|------|---------|
| `requests` | [`shopping-requests.schema.json`](./examples/rhaiteous/schemas/shopping-requests.schema.json) | Intake |
| `items` | [`shopping-items.schema.json`](./examples/rhaiteous/schemas/shopping-items.schema.json) | Inventory |
| `audit` | [`shopping-audit.schema.json`](./examples/rhaiteous/schemas/shopping-audit.schema.json) | Audit (`real` + multi-facet + `evidence[]`) |
| `vendor_pick` | [`shopping-vendor-pick.schema.json`](./examples/rhaiteous/schemas/shopping-vendor-pick.schema.json) | Procurement (`picks[1]` for `collect`) |
| `purchase_one` | [`shopping-purchase-one.schema.json`](./examples/rhaiteous/schemas/shopping-purchase-one.schema.json) | Purchasing (`transactions[1]` for `collect`) |

Example — Intake contract (others use the same `$comment` + JSON Schema style; full text in the [example doc](./docs/office-shopping-example.md)):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rhaiteous.local/schemas/shopping-requests.schema.json",
  "$comment": "Intake station: every supply request gathered from email, chat, forms, etc., deposited into a structured catalog for the shopping cycle.",
  "title": "ShoppingRequestsResult",
  "type": "object",
  "required": ["requests", "notes"],
  "properties": {
    "requests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "channel", "requester", "summary", "body", "source"],
        "properties": {
          "id": { "type": "string" },
          "channel": { "type": "string" },
          "requester": { "type": "string" },
          "summary": { "type": "string" },
          "body": { "type": "string" },
          "source": { "type": "string" },
          "received_at": { "type": "string" }
        },
        "additionalProperties": false
      }
    },
    "notes": { "type": "string" }
  },
  "additionalProperties": false
}
```

### 3. Prompts (under `{base}/prompts/`)

Each step `prompt` is an **array of file names**. Bodies may use `{{args…}}` and loop bindings (`{{req…}}`, `{{item…}}`, `{{pick…}}`).

**Intake** — [`shopping-intake.txt`](./examples/rhaiteous/prompts/shopping-intake.txt):

```text
You are the Intake station for a twice-weekly office supply shopping cycle.

Company: {{args.company_name}}
Cycle label: {{args.cycle}}
Requests root: {{args.requests_dir}}

Collect every supply request you can find under the requests root (email exports,
chat transcripts, forms, notes). For each request:
- assign a stable id (req-001, …)
- record channel, requester, summary, full body
- set source to a path or locator so later stations can re-open it
- deposit (reposit) it into the structured requests array — do not leave raw-only

Skip spam and pure conversation with no supply ask.
notes = short intake narrative (what you covered, what you skipped).
Return the shopping-requests schema.
```

**Inventory** — [`shopping-inventory.txt`](./examples/rhaiteous/prompts/shopping-inventory.txt) (per request in parallel):

```text
You are the Inventory station for a twice-weekly office shopping cycle.
Normalize THIS deposited request into concrete buyable line items.

Company: {{args.company_name}}
Cycle: {{args.cycle}}

Request:
id: {{req.id}}
channel: {{req.channel}}
requester: {{req.requester}}
summary: {{req.summary}}
body: {{req.body}}
source: {{req.source}}

Rules:
- emit zero or more specific products (not vague categories)
- quantity + unit must be explicit
- request_ids must include {{req.id}} (and only this request for this shard)
- evidence: array of {source, quote} citing this request
- id format: {{req.id}}-item-1, {{req.id}}-item-2, …

Return the shopping-items schema (items array for this request only).
```

**Audit** — [`shopping-audit.txt`](./examples/rhaiteous/prompts/shopping-audit.txt):

```text
You are the Audit station. Adversarially validate ONE line item for this office shopping cycle.

Company: {{args.company_name}}
Cycle: {{args.cycle}}

Line under review:
id: {{item.id}}
name: {{item.name}}
quantity: {{item.quantity}}
unit: {{item.unit}}

Challenge validity across ALL facets (fill each facets.* field):
- necessity — needed for operations this cycle?
- quantity_sane — proportional, not a bulk accident?
- not_duplicate — not already covered elsewhere?
- policy_ok — allowed under normal small-office purchasing policy?
- budget_reasonable — spend plausible for a twice-weekly cycle?

real=true only when the line should proceed to procurement.
evidence must be a non-empty array of {source, quote} you can stand behind
(paths, request ids, or policy notes). Return the same id.
Return the shopping-audit schema.
```

**Procurement** — [`shopping-procurement.txt`](./examples/rhaiteous/prompts/shopping-procurement.txt):

```text
You are the Procurement station. Choose ONE vendor for this audited line item.

Company: {{args.company_name}}
Cycle: {{args.cycle}}

Line item:
id: {{item.id}}
name: {{item.name}}
quantity: {{item.quantity}}
unit: {{item.unit}}

Return picks as a one-element array with:
- item_id = {{item.id}}
- vendor_name, fulfillment (URL/SKU/instruction)
- optional unit_price_estimate + currency
- rationale, evidence[{source,quote}]

Return the shopping-vendor-pick schema.
```

**Purchasing** — [`shopping-purchasing.txt`](./examples/rhaiteous/prompts/shopping-purchasing.txt):

```text
You are the Purchasing station. Purchase (or simulate) THIS vendor pick and record one transaction.

Company: {{args.company_name}}
Cycle: {{args.cycle}}

Vendor pick:
item_id: {{pick.item_id}}
vendor_name: {{pick.vendor_name}}
fulfillment: {{pick.fulfillment}}

Perform a real purchase when tools/capability allow; otherwise status=simulated
with an honest confirmation_ref. Return transactions as a one-element array:
id (txn-…), item_id, vendor_name, quantity, status, confirmation_ref, notes,
optional amount/currency.

Return the shopping-purchase-one schema.
```

### 4. Generated Rhai (output only)

```bash
# produces .grok/workflows/office-shopping.rhai (or examples/out/… with -o)
```

You maintain JSON + schemas + prompts; Rhaiteous emits the IR Grok runs.

## Workflow JSON (summary)

Top-level document:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Grok workflow name: lowercase, digits, hyphens |
| `description` | yes | Short summary |
| `phases` | no | Dashboard phase rail: `{ "title", "detail?" }[]` |
| `args` | no | Input args → Rhai locals + required-arg pauses |
| `schemas` | no | Map of binding name → path under `{base}/schemas/` |
| `steps` | yes | Ordered orchestration steps |

**Step ops (v1):**

| `op` | Purpose |
|------|---------|
| `phase` | UI phase marker |
| `log` | Progress line (`{{templates}}` supported) |
| `agent` | Single subagent call |
| `parallel` | Fan-out over an array binding |
| `collect` | Merge `output.<field>` arrays from parallel results |
| `zip_filter` | Keep left items whose parallel verdict has `real: true` |
| `bind` | `let x = agent.output.field` |
| `if_empty` / `if_failed` | Conditional nested steps |
| `complete` | End run (supports `{ "$ref": "binding" }`) |
| `complete_from` | `complete(agent.output)` (+ optional static extras) |
| `pause` / `await_user` | Human gates |

Full field reference: **[docs/workflow-json.md](./docs/workflow-json.md)**.

## CLI

```text
rhaiteous <workflow.json> [options]

  -o, --out <path>   Output .rhai path (default: .grok/workflows/<name>.rhai)
  -b, --base <path>  Asset base with schemas/, prompts/, workflows/ (default: rhaiteous)
  --stdout           Print Rhai to stdout (no file write)
  --dry-run          Compile only; do not write
  -h, --help         Help
```

Details: **[docs/cli-and-api.md](./docs/cli-and-api.md)**.

## Project layout

```text
bin/rhaiteous.js            CLI entry
src/
  cli.js                    argv / exit codes
  compile-workflow.js       compileWorkflow / compileWorkflowFile
  json-to-rhai.js           JSON values → Rhai literals
  template.js               {{args.x}} / loop refs → string build
examples/
  rhaiteous/
    workflows/*.workflow.json
    schemas/*.schema.json
    prompts/*
  out/*.rhai                Sample IR for this package (demos)
test/                       node:test suite
docs/                       Extended documentation
```

## Design notes

- **JSON = authoring surface; Rhai = IR.** Recompile after editing JSON/schemas; do not hand-edit generated `.rhai` unless you are debugging the emitter.
- **Fail closed.** Unknown step `op` values throw at compile time.
- **No npm runtime deps.** Easier to audit and embed.
- **Standalone verifiability.** CLI and library share `compile-workflow.js`.
- **Not affiliated with xAI.** Grok Build is a product of xAI; Rhaiteous is an independent helper for its workflow format.

More context: **[docs/design.md](./docs/design.md)**.

## Examples

| Example | What it shows |
|---------|----------------|
| [`examples/rhaiteous/workflows/office-shopping.workflow.json`](./examples/rhaiteous/workflows/office-shopping.workflow.json) | Full 5-station shopping cycle — see [Complete example](#complete-example-twice-weekly-office-shopping) and [docs/office-shopping-example.md](./docs/office-shopping-example.md) |

Regenerate sample IR (package demos → `examples/out/`):

```bash
npx rhaiteous ./examples/rhaiteous/workflows/office-shopping.workflow.json -b ./examples/rhaiteous -o ./examples/out/office-shopping.rhai
```

## Tests

```bash
npm test
# or:
node --test ./test/json-to-rhai.test.js ./test/compile-workflow.test.js
```

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for setup, coding conventions, and PR expectations.

## License

[MIT](./LICENSE) — see file for full text.

## Related

- [Grok Build user guide](https://x.ai/) / local docs under `~/.grok/docs/user-guide/` when Grok is installed
- Grok workflows are Rhai scripts discovered from `.grok/workflows/*.rhai` and `~/.grok/workflows/*.rhai`
- Workflow host concepts: `agent`, `parallel`, `phase`, `complete`, `pause`, `await_user`, `output_schema`, `agent_budget`
