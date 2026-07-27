# Complete example: twice-weekly office shopping

This guide walks through a **complete Rhaiteous example** you can copy, compile, and run. The scenario is a small company that builds a **twice-weekly office-supply shopping list** in five stages (called **stations** below).

By the end you will know:

- What files Rhaiteous needs (workflow, schemas, and prompts)
- What every step in the workflow does, in plain language
- How to compile those files into something Grok Build can run
- How to start the workflow inside Grok Build

Ready-to-copy sources live in this repository under [`examples/rhaiteous/`](../examples/rhaiteous/). A sample of the compiled output is checked in as [`examples/out/office-shopping.rhai`](../examples/out/office-shopping.rhai).

---

## Concepts you will need

**Rhaiteous** is a small compiler: you write a workflow in **JSON** (JavaScript Object Notation—a plain-text data format), plus normal **JSON Schema** files and prompt text files. Rhaiteous turns that into a **Rhai** script (`.rhai`). **Rhai** is the scripting language Grok Build uses to run multi-agent workflows.

**Grok Build** is the product that discovers and runs those `.rhai` files. For a project, it looks in `.grok/workflows/`. You launch a saved workflow with the slash command `/workflow`.

An **agent** (also called a **subagent**) is a specialized helper Grok starts to do one job—read files, reason about data, optionally use tools. In the workflow JSON, the field `agent_type` picks a **role label** for that helper. This example uses:

| `agent_type` value | Plain-language role in this example |
|--------------------|-------------------------------------|
| `stickler` | Careful intake clerk: gather and structure every request without inventing items |
| `analyst` | Detail worker: turn requests into line items, or choose vendors |
| `skeptic` | Auditor: try to disprove a line item before money is spent |
| `general-purpose` | Hands-on buyer: may use tools to place or simulate a purchase |

These names are **role labels** you choose when authoring; configure matching agent types in your Grok environment if your setup requires named custom types. The important part is the *job* each station performs, not the brand name of the role.

**Capability mode** (`capability_mode`) limits what an agent may do with tools:

| Value | Meaning |
|-------|---------|
| `read-only` | May inspect files and context; should not change the outside world |
| `execute` | May run tools that perform real actions (for example placing an order), subject to Grok’s safety settings |

A **prompt file** is ordinary text the agent receives as its instructions. Rhaiteous loads the file(s) listed in each step’s `prompt` array from the `prompts/` folder, stitches them together, and expands placeholders such as `{{args.company_name}}` or `{{item.name}}`.

A **JSON Schema** file describes the **shape of data** an agent must return (which fields, which types). Rhaiteous loads schemas from the `schemas/` folder and attaches them so Grok can enforce structured output.

A **binding** is simply a **named value that later steps can use**—like a variable name. When a step says `"as": "intake"`, the result of that step is stored under the name `intake`. When a step says `"over": "requests"`, it loops over whatever is currently stored under the name `requests`. The section [How data moves between steps](#how-data-moves-between-steps) explains this with a diagram.

An **op** (operation) is one instruction in the workflow’s ordered list of steps—for example “run an agent,” “loop in parallel,” or “stop with a result.”

---

## The five stations

Think of the shopping cycle as an assembly line. Each **station** is a stage of work:

| Station | Business goal | What the automation does |
|---------|---------------|---------------------------|
| **Intake** | Hear every supply ask | One agent reads email exports, chat logs, forms, and notes under a folder you provide, then **deposits** each ask as a structured request record |
| **Inventory** | Know exactly what to buy | For each request, an agent proposes concrete products and quantities (not vague categories) |
| **Audit** | Catch bad or wasteful lines | For each product line, a skeptical agent checks necessity, quantity, duplicates, policy, and budget; only lines that pass continue |
| **Procurement** | Choose where to buy | For each surviving line, an agent picks a vendor and how to fulfill the order |
| **Purchasing** | Spend and keep a ledger | For each vendor choice, an agent purchases (or honestly simulates a purchase) and records a transaction |

---

## Files involved

Rhaiteous expects an **asset base** folder (by default `./rhaiteous` in your project). Under that base:

```text
rhaiteous/
  workflows/
    office-shopping.workflow.json    # the pipeline definition (JSON)
  schemas/
    shopping-requests.schema.json    # Intake output shape
    shopping-items.schema.json       # Inventory output shape
    shopping-audit.schema.json       # Audit output shape
    shopping-vendor-pick.schema.json # Procurement output shape (one pick)
    shopping-purchase-one.schema.json # Purchasing output shape (one transaction)
  prompts/
    shopping-intake.txt
    shopping-inventory.txt
    shopping-audit.txt
    shopping-procurement.txt
    shopping-purchasing.txt
```

After a successful compile for a real Grok project, you also get:

```text
.grok/workflows/office-shopping.rhai   # generated script Grok discovers and runs
```

You **author** the workflow, schemas, and prompts. You **do not** hand-write the `.rhai` file day to day—recompile when sources change.

In **this Git repository**, the same authoring files sit under `examples/rhaiteous/` so demos do not depend on your personal Grok project layout. Sample generated script for browsing: `examples/out/office-shopping.rhai`.

---

## How to compile and how to run

There are **three different commands** below. They are **not** three steps of one procedure. Pick the command that matches your situation.

### Command A — Compile inside your own Grok project (normal day-to-day use)

**When to use:** You have copied the authoring files into *your* project as `./rhaiteous/...`, and you are standing in that project’s root folder in a terminal. Prefer the published package: `npm install --save-dev rhaiteous`, then `npx rhaiteous` (or a global install / npm script).

**What it does:** Reads `./rhaiteous/workflows/office-shopping.workflow.json`, loads schemas from `./rhaiteous/schemas/` and prompts from `./rhaiteous/prompts/`, and **writes** the compiled script to:

```text
./.grok/workflows/office-shopping.rhai
```

That path is where Grok Build looks for **project** workflows.

```bash
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json
```

Equivalent explicit form (same defaults spelled out):

```bash
npx rhaiteous ./rhaiteous/workflows/office-shopping.workflow.json \
  -b ./rhaiteous \
  -o ./.grok/workflows/office-shopping.rhai
```

- **`-b` / `--base`** — folder that contains `schemas/` and `prompts/` (and, by convention, `workflows/`)
- **`-o` / `--out`** — where to write the `.rhai` file

### Command B — Compile the copy that ships inside the Rhaiteous repository

**When to use:** You are developing or exploring **this** repo (`Bromezz/Rhaiteous`), not your company Grok project. You want a sample `.rhai` under `examples/out/` without writing into a local `.grok/` tree.

**What it does:** Same compilation, but the asset base is `examples/rhaiteous` and the output is forced to `examples/out/office-shopping.rhai`.

```bash
npx rhaiteous ./examples/rhaiteous/workflows/office-shopping.workflow.json \
  -b ./examples/rhaiteous \
  -o ./examples/out/office-shopping.rhai
# from a clone without npm install: node ./bin/rhaiteous.js … (same args)
```

### Command C — Run the workflow inside Grok Build (after compiling)

**When to use:** Command A (or any compile that left `office-shopping.rhai` where Grok can see it) already succeeded. You are in the Grok Build **TUI** (text user interface—the interactive terminal app), with that project open.

**What it does:** Does **not** compile. It **starts a run** of the saved workflow named `office-shopping`, passing input arguments as JSON.

```text
/workflow office-shopping {"requests_dir":"./inbox/requests","company_name":"Acme Office"}
```

| Argument | Required? | Default if omitted | Meaning |
|----------|-----------|--------------------|---------|
| `requests_dir` | **Yes** | (none—Grok will pause and ask) | Directory containing email exports, chat transcripts, forms, or notes to mine |
| `company_name` | No | `Acme Office` | Company label baked into agent prompts and log lines |
| `cycle` | No | `twice-weekly` | Cycle label (for example which shopping cadence this run is) |

**Typical sequence for a company project:** Command A once (or after every edit) → Command C to execute.

---

## How data moves between steps

Rhaiteous workflows pass information using **bindings**: named slots that hold data after a step finishes. Later steps refer to those names.

Think of a binding as a labeled box on a shelf:

1. A step produces a result and sticks a **label** on the box (`"as": "intake"`).
2. Another step may **rename or extract** part of that box (`bind` copies `intake.output.requests` into a new box labeled `requests`).
3. A **parallel** step opens the box named in `"over"` and runs one child agent **for each item** in that list.
4. A **collect** step opens many agent results and stacks one field from each into a single new list.
5. A **zip_filter** step walks two lists in lockstep (same index) and keeps or drops items from the left list based on the right list’s verdict.
6. A **complete** step ends the run and can attach labeled boxes to the final report using `{ "$ref": "name" }` (a reference: “include whatever is in the box named …”).

### Picture of the labels in this example

```text
[Intake agent result]  labeled "intake"
        |
        |  bind: take .output.requests
        v
[list of requests]  labeled "requests"
        |
        |  parallel Inventory (one agent per request)
        |  collect: stack each agent's .output.items
        v
[list of line items]  labeled "items"
        |
        |  parallel Audit (one skeptic per item)
        |  zip_filter: keep items that pass
        v
[list of approved items]  labeled "survivors"
   (+ list of dropped item ids labeled "dropped_items")
        |
        |  parallel Procurement (one agent per survivor)
        |  collect: stack each agent's .output.picks
        v
[list of vendor choices]  labeled "vendor_picks"
        |
        |  parallel Purchasing (one agent per pick)
        |  collect: stack each agent's .output.transactions
        v
[list of ledger rows]  labeled "transactions"
        |
        |  complete: package selected labels into the final report
        v
[run finished]
```

### What each arrow means (same story in a table)

| From | How | To | Meaning |
|------|-----|-----|---------|
| Intake agent | `bind` field `requests` | `requests` | “Use only the array of deposited requests, not the whole agent wrapper.” |
| `requests` | parallel Inventory + `collect` field `items` | `items` | “Turn every request into line items; merge all shards into one shopping list.” |
| `items` | parallel Audit + `zip_filter` | `survivors` / `dropped_items` | “Keep lines the auditor approved; remember ids of rejects.” |
| `survivors` | parallel Procurement + `collect` field `picks` | `vendor_picks` | “One vendor decision per approved line; merge into one list.” |
| `vendor_picks` | parallel Purchasing + `collect` field `transactions` | `transactions` | “One purchase record per vendor decision; merge into the ledger.” |
| several labels | `complete` with `$ref` | final report | “Hand the important lists back to the human as the run result.” |

Procurement and Purchasing agents each return a **one-element array** (`picks` or `transactions` with a single entry). That packaging exists so `collect` can always concatenate the same field name from every parallel result into one flat list.

---

## Step-by-step: every operation in the workflow

The workflow’s `steps` array runs **in order**. Below, **#** is the step number, **Operation** is the `op` field, and the description is what that step means for the office-shopping story.

### Station: Intake

| # | Operation | What it does in plain language |
|---|-----------|--------------------------------|
| 1 | `phase` | Tells Grok’s progress user interface (UI) that work has entered the **Intake** stage (the phase rail in the workflows dashboard). |
| 2 | `agent` | Starts **one** subagent (role label `stickler`, tools limited to **read-only**). Gives it the Intake prompt file and the Intake JSON Schema. The agent must deposit structured requests from `requests_dir`. Stores the full agent result under the name **`intake`**. |
| 3 | `if_failed` | If that agent crashed or reported failure, **stop the whole run** immediately with a short summary and an empty transactions list. No point inventorying nothing trustworthy. |
| 4 | `bind` | From the successful agent result, pull out only the `requests` array and store it under the simpler name **`requests`**. |
| 5 | `if_empty` | If that array has zero entries, **stop**: there were no supply asks this cycle. |
| 6 | `log` | Write a progress line naming the company and cycle (using the run arguments). |

### Station: Inventory

| # | Operation | What it does in plain language |
|---|-----------|--------------------------------|
| 7 | `phase` | Progress UI: **Inventory** stage. |
| 8 | `parallel` | For **each** request in `requests`, start an **analyst** subagent (read-only) with the Inventory prompt and schema. Each child sees one request (`req`) and may propose several product lines. All child results are stored as **`inventory_results`**. |
| 9 | `collect` | From each successful child, take the `items` array and concatenate them into one master list named **`items`**. |
| 10 | `if_empty` | If nobody proposed anything buyable, **stop** with “No line items to buy.” |

### Station: Audit

| # | Operation | What it does in plain language |
|---|-----------|--------------------------------|
| 11 | `phase` | Progress UI: **Audit** stage. |
| 12 | `parallel` | For **each** line in `items`, start a **skeptic** subagent (read-only) with the Audit prompt and schema. Each child must argue keep-or-drop across several facets (necessity, quantity, duplicates, policy, budget) and attach evidence. Results: **`audit_results`**. |
| 13 | `zip_filter` | Walk `items` and `audit_results` together by position (index 0 with index 0, and so on). **Keep** the original line item in **`survivors`** only when that audit result succeeded, marked the line `real: true`, and supplied a non-empty `evidence` list. For rejects, push the line’s **id** into **`dropped_items`**. |
| 14 | `if_empty` | If nothing survived, **stop** and still report which ids were dropped. |
| 15 | `log` | Progress line: audit finished for this company. |

### Station: Procurement

| # | Operation | What it does in plain language |
|---|-----------|--------------------------------|
| 16 | `phase` | Progress UI: **Procurement** stage. |
| 17 | `parallel` | For **each** surviving line, start an **analyst** (read-only) to choose a vendor and fulfillment path. Results: **`procurement_results`**. |
| 18 | `collect` | Concatenate each child’s `picks` array into **`vendor_picks`**. |
| 19 | `if_empty` | If no vendor choices appeared, **stop** (and still include the surviving items in the report for debugging). |

### Station: Purchasing

| # | Operation | What it does in plain language |
|---|-----------|--------------------------------|
| 20 | `phase` | Progress UI: **Purchasing** stage. |
| 21 | `parallel` | For **each** vendor pick, start a **general-purpose** subagent with **execute** capability. It should buy when tools allow, or record an honest **simulated** purchase. Results: **`purchase_results`**. |
| 22 | `collect` | Concatenate each child’s `transactions` array into **`transactions`** (the cycle ledger). |
| 23 | `complete` | **End the run successfully.** Build the final report object: a summary string, plus references to the deposited requests, approved items, dropped ids, vendor picks, and transactions. |

---

## 1. Workflow definition (JSON)

**File:** [`examples/rhaiteous/workflows/office-shopping.workflow.json`](../examples/rhaiteous/workflows/office-shopping.workflow.json)

This is the pipeline itself: name, human description, dashboard phases, input arguments, which schema files to load, and the ordered steps above.

| Top-level field | Meaning |
|-----------------|---------|
| `name` | Identifier Grok uses in `/workflow <name>…` and the default `.rhai` file name |
| `description` | Short explanation for humans browsing workflows |
| `phases` | Labels for the progress UI rail (should match `phase` steps) |
| `args` | Inputs the human passes when starting a run |
| `schemas` | Short names → schema files under the asset base’s `schemas/` folder |
| `steps` | Ordered list of operations |

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
        {
          "op": "complete",
          "value": { "summary": "intake failed", "transactions": [] }
        }
      ]
    },
    {
      "op": "bind",
      "as": "requests",
      "from": "intake",
      "field": "requests"
    },
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
    {
      "op": "log",
      "message": "Intake complete for {{args.company_name}} ({{args.cycle}})"
    },

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
    {
      "op": "collect",
      "as": "items",
      "from": "inventory_results",
      "field": "items"
    },
    {
      "op": "if_empty",
      "path": "items",
      "then": [
        {
          "op": "complete",
          "value": { "summary": "No line items to buy.", "transactions": [] }
        }
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
    {
      "op": "log",
      "message": "Audit complete for {{args.company_name}}"
    },

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
    {
      "op": "collect",
      "as": "vendor_picks",
      "from": "procurement_results",
      "field": "picks"
    },
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

## 2. Schema: Intake output (`requests`)

Describes each deposited supply request: who asked, through which channel, the full text, and a locator (`source`) so later stations can reopen the original message.

**File:** [`examples/rhaiteous/schemas/shopping-requests.schema.json`](../examples/rhaiteous/schemas/shopping-requests.schema.json)

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
      "$comment": "One entry per distinct request. Empty is allowed; the workflow short-circuits later if nothing arrived.",
      "type": "array",
      "items": {
        "$comment": "A single inbound request, re-posited with a stable id and source locator.",
        "type": "object",
        "required": ["id", "channel", "requester", "summary", "body", "source"],
        "properties": {
          "id": {
            "$comment": "Stable id for this cycle, e.g. req-001.",
            "type": "string"
          },
          "channel": {
            "$comment": "How the request arrived: email, chat, form, voice-note, other.",
            "type": "string"
          },
          "requester": {
            "$comment": "Person or team who asked.",
            "type": "string"
          },
          "summary": {
            "$comment": "One-line restatement of what they want.",
            "type": "string"
          },
          "body": {
            "$comment": "Full request text as received (or cleaned transcript).",
            "type": "string"
          },
          "source": {
            "$comment": "Where to re-open the original: mailbox path, chat permalink, file path, etc.",
            "type": "string"
          },
          "received_at": {
            "$comment": "Optional ISO-ish timestamp when the request arrived.",
            "type": "string"
          }
        },
        "additionalProperties": false
      }
    },
    "notes": {
      "$comment": "Intake narrative: coverage, noise skipped, open questions.",
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

## 3. Schema: Inventory output (`items`)

Describes concrete buyable lines: product name, quantity, unit, which request ids drove the line, and evidence quotes. Used by each Inventory parallel child.

**File:** [`examples/rhaiteous/schemas/shopping-items.schema.json`](../examples/rhaiteous/schemas/shopping-items.schema.json)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rhaiteous.local/schemas/shopping-items.schema.json",
  "$comment": "Inventory station: concrete SKUs/items and quantities derived from deposited requests.",
  "title": "ShoppingItemsResult",
  "type": "object",
  "required": ["items"],
  "properties": {
    "items": {
      "$comment": "Normalized line items for this twice-weekly cycle. Cap keeps audit fan-out bounded.",
      "type": "array",
      "maxItems": 40,
      "items": {
        "$comment": "One buyable line. id must stay stable through Audit, Procurement, and Purchasing.",
        "type": "object",
        "required": ["id", "name", "quantity", "unit", "request_ids", "evidence"],
        "properties": {
          "id": {
            "$comment": "Stable line id; office-shopping prompt uses {requestId}-item-N (e.g. req-001-item-1).",
            "type": "string"
          },
          "name": {
            "$comment": "Specific product description (not a vague category).",
            "type": "string"
          },
          "quantity": {
            "$comment": "How many units to buy this cycle.",
            "type": "number"
          },
          "unit": {
            "$comment": "Unit of measure: each, box, ream, pack, case, etc.",
            "type": "string"
          },
          "category": {
            "$comment": "Optional bucket: paper, kitchen, IT, cleaning, other.",
            "type": "string"
          },
          "request_ids": {
            "$comment": "Intake request ids that drove this line (merge duplicates here).",
            "type": "array",
            "items": { "type": "string" }
          },
          "evidence": {
            "$comment": "Citations back to deposited requests or policy docs.",
            "type": "array",
            "items": {
              "type": "object",
              "required": ["source", "quote"],
              "properties": {
                "source": {
                  "type": "string",
                  "description": "Request id, path, or URL"
                },
                "quote": {
                  "type": "string",
                  "description": "Supporting excerpt"
                }
              },
              "additionalProperties": false
            }
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

## 4. Schema: Audit output (`audit`)

Describes one auditor verdict for one line: keep flag (`real`), written reason, five facet notes, and evidence. Drives zip_filter keep/drop.

**File:** [`examples/rhaiteous/schemas/shopping-audit.schema.json`](../examples/rhaiteous/schemas/shopping-audit.schema.json)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rhaiteous.local/schemas/shopping-audit.schema.json",
  "$comment": "Audit station: adversarial check of one line item across necessity, quantity, policy, duplicates, and budget reasonableness. zip_filter keeps items when real==true and evidence is non-empty.",
  "title": "ShoppingAuditVerdict",
  "type": "object",
  "required": ["id", "real", "reason", "facets", "evidence"],
  "properties": {
    "id": {
      "$comment": "Must match the line item id under review.",
      "type": "string"
    },
    "real": {
      "$comment": "true only when the line should proceed to procurement. false drops it in zip_filter.",
      "type": "boolean"
    },
    "reason": {
      "$comment": "Short overall rationale for pass/fail.",
      "type": "string"
    },
    "facets": {
      "$comment": "Structured multi-facet audit notes (validity dimensions).",
      "type": "object",
      "required": [
        "necessity",
        "quantity_sane",
        "not_duplicate",
        "policy_ok",
        "budget_reasonable"
      ],
      "properties": {
        "necessity": {
          "$comment": "Is this needed for office operations this cycle?",
          "type": "string"
        },
        "quantity_sane": {
          "$comment": "Is quantity proportional to headcount / burn rate?",
          "type": "string"
        },
        "not_duplicate": {
          "$comment": "Not already covered by another line or recent purchase.",
          "type": "string"
        },
        "policy_ok": {
          "$comment": "Allowed under company purchasing policy.",
          "type": "string"
        },
        "budget_reasonable": {
          "$comment": "Plausible spend for a small office cycle.",
          "type": "string"
        }
      },
      "additionalProperties": false
    },
    "evidence": {
      "$comment": "Independent citations supporting the verdict. Empty array drops the item even if real were true.",
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source", "quote"],
        "properties": {
          "source": { "type": "string" },
          "quote": { "type": "string" }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

## 5. Schema: Procurement output (`vendor_pick`)

Describes one vendor choice. The `picks` array always holds a single element so parallel results can be collected into one list.

**File:** [`examples/rhaiteous/schemas/shopping-vendor-pick.schema.json`](../examples/rhaiteous/schemas/shopping-vendor-pick.schema.json)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rhaiteous.local/schemas/shopping-vendor-pick.schema.json",
  "$comment": "Procurement station (per line): one vendor choice wrapped in picks[] so parallel results can be collect'ed.",
  "title": "ShoppingVendorPickResult",
  "type": "object",
  "required": ["picks"],
  "properties": {
    "picks": {
      "$comment": "Always a single-element array for this shard (the item under review).",
      "type": "array",
      "minItems": 1,
      "maxItems": 1,
      "items": {
        "type": "object",
        "required": ["item_id", "vendor_name", "fulfillment", "rationale", "evidence"],
        "properties": {
          "item_id": { "type": "string" },
          "vendor_name": { "type": "string" },
          "fulfillment": {
            "$comment": "URL, SKU, catalog id, or buy instruction.",
            "type": "string"
          },
          "unit_price_estimate": { "type": "number" },
          "currency": { "type": "string" },
          "rationale": { "type": "string" },
          "evidence": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["source", "quote"],
              "properties": {
                "source": { "type": "string" },
                "quote": { "type": "string" }
              },
              "additionalProperties": false
            }
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

## 6. Schema: Purchasing output (`purchase_one`)

Describes one ledger row (purchase, backorder, failure, or simulation). The `transactions` array always holds a single element for the same collect pattern.

**File:** [`examples/rhaiteous/schemas/shopping-purchase-one.schema.json`](../examples/rhaiteous/schemas/shopping-purchase-one.schema.json)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rhaiteous.local/schemas/shopping-purchase-one.schema.json",
  "$comment": "Purchasing station (per vendor pick): one transaction wrapped in transactions[] for collect.",
  "title": "ShoppingPurchaseOneResult",
  "type": "object",
  "required": ["transactions"],
  "properties": {
    "transactions": {
      "$comment": "Single-element array: the purchase (or simulation) for this pick.",
      "type": "array",
      "minItems": 1,
      "maxItems": 1,
      "items": {
        "type": "object",
        "required": [
          "id",
          "item_id",
          "vendor_name",
          "quantity",
          "status",
          "confirmation_ref",
          "notes"
        ],
        "properties": {
          "id": { "type": "string" },
          "item_id": { "type": "string" },
          "vendor_name": { "type": "string" },
          "quantity": { "type": "number" },
          "amount": { "type": "number" },
          "currency": { "type": "string" },
          "status": {
            "$comment": "purchased | backordered | failed | simulated",
            "type": "string"
          },
          "confirmation_ref": { "type": "string" },
          "notes": { "type": "string" }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

## 7. Prompt: Intake

Instructions for the Intake agent. Placeholders `{{args.company_name}}`, `{{args.cycle}}`, and `{{args.requests_dir}}` are filled from the run arguments at compile time into the generated script.

**File:** [`examples/rhaiteous/prompts/shopping-intake.txt`](../examples/rhaiteous/prompts/shopping-intake.txt)

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

## 8. Prompt: Inventory

Instructions for each Inventory child. Placeholders such as `{{req.id}}` refer to the current request in the parallel loop (`item_as` is `req` in the workflow).

**File:** [`examples/rhaiteous/prompts/shopping-inventory.txt`](../examples/rhaiteous/prompts/shopping-inventory.txt)

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

## 9. Prompt: Audit

Instructions for each Audit child. Placeholders such as `{{item.name}}` refer to the current line item (`item_as` is `item`).

**File:** [`examples/rhaiteous/prompts/shopping-audit.txt`](../examples/rhaiteous/prompts/shopping-audit.txt)

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

## 10. Prompt: Procurement

Instructions for each Procurement child. Uses the same `item` loop variable over the survivor list.

**File:** [`examples/rhaiteous/prompts/shopping-procurement.txt`](../examples/rhaiteous/prompts/shopping-procurement.txt)

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

## 11. Prompt: Purchasing

Instructions for each Purchasing child. Placeholders such as `{{pick.vendor_name}}` refer to the current vendor choice (`item_as` is `pick`).

**File:** [`examples/rhaiteous/prompts/shopping-purchasing.txt`](../examples/rhaiteous/prompts/shopping-purchasing.txt)

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

## Generated script (you do not edit this by hand)

After **Command A** or **Command B**, Rhaiteous emits a Rhai script. Grok Build loads project scripts from:

```text
.grok/workflows/office-shopping.rhai
```

In this repository, a sample of that output (for reading only) is:

```text
examples/out/office-shopping.rhai
```

Whenever you change the workflow JSON, a schema, or a prompt, compile again, then use **Command C** to run.

---

## Related guides

- [Using Rhaiteous in a Grok project](./using-in-a-grok-project.md) — install the compiler, project layout, keeping `.rhai` files in Git
- [Workflow JSON reference](./workflow-json.md) — every operation field in the authoring language
- [Command-line interface (CLI) and application programming interface (API)](./cli-and-api.md) — flags and library usage
