# Office-shopping example (flow)

> **Canonical pack path (current):** [`examples/example-office-shopping/`](../examples/example-office-shopping/)  
> Workflow name / Grok id: **`example-office-shopping`**.  
> Layout below may still mention older shared-base paths; prefer the pack README and [examples/README.md](../examples/README.md).

The package flagship example is a **five-station flow**: Intake → Inventory → Audit → Procurement → Purchasing.

## Layout

```text
examples/rhaiteous/                 # asset base (-b)
  workflows/
    office-shopping.workflow.json   # machine authoring
    workflow.md                     # generated with the IR (do not edit)
  schemas/
    shopping-payload.schema.json    # flow.payload
    shopping-requests.schema.json   # station guidance
    shopping-items.schema.json
    shopping-audit.schema.json
    shopping-vendor-pick.schema.json
    shopping-purchase-one.schema.json
  prompts/stations/
    common.md
    intake.md … purchasing.md
examples/out/office-shopping.rhai   # compiled IR sample
```

Human guide is **`workflow.md`**, written whenever you compile (same cycle as the `.rhai`).

## Compile

```bash
npx rhaiteous ./examples/rhaiteous/workflows/office-shopping.workflow.json \
  -b ./examples/rhaiteous \
  -o ./examples/out/office-shopping.rhai
```

## Run (Grok)

```text
/workflow office-shopping {"requests_dir":"./inbox/requests","company_name":"Acme Office"}
```

## Args

| Arg | Role |
|-----|------|
| `requests_dir` | **Required** root for request sources |
| `company_name` | Default `"Acme Office"` |
| `cycle` | Default `"twice-weekly"` |

## Stations

| Station | Role | Capability |
|---------|------|------------|
| **Intake** | Deposit requests into `flow.payload.requests`; early-stop if empty | read-only |
| **Inventory** | Expand requests → `items` | read-only |
| **Audit** | Verdicts → `survivors` / `dropped_items` | read-only |
| **Procurement** | Vendor picks for survivors | read-only |
| **Purchasing** | Transactions (real or simulated) | **execute** |

Each station receives shared `common.md` + duty prompt, optional **Additional Schemas** guidance, and **Workflow args (JSON)**. Host-checked shape is the **flow envelope** + `payloadSchema` (`shopping-payload.schema.json`).

## Payload (shared state)

Stations own slices of `flow.payload`:

- `requests`, `items`, `survivors`, `dropped_items`, `audit_verdicts`, `vendor_picks`, `transactions`
- `cycle_status`, `summary`

Empty intake / inventory / audit-none-passed may set `flow.next` to null to end early.

## What the compiler emits

- `meta.phases` from station names / `uiDescription`
- Schema locals for top-level `schemas` bindings
- Args preamble + `workflow_args_json`
- `fn Intake` … `fn Purchasing` + `while flow.next` driver
- `complete(#{ flow, flow_json })`

See [workflow-json.md](./workflow-json.md) for the full authoring reference.
