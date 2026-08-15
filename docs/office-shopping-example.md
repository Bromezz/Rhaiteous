# Office-shopping example (flow)

**Canonical pack:** [`examples/example-office-shopping/`](../examples/example-office-shopping/)  
**Grok id:** `example-office-shopping`

Five-station flow: Intake → Inventory → Audit → Procurement → Purchasing.

## Layout

```text
examples/example-office-shopping/
  workflow.json
  schema.json                 # flow.payload
  stations/
    common.md
    intake.md + intake.schema.json
    inventory.md + inventory.schema.json
    audit.md + audit.schema.json
    procurement.md + procurement.schema.json
    purchasing.md + purchasing.schema.json
  input/
  output/
```

Each station has its **own** schema file (station-named, no product-prefix clutter). `workflow.md` / `workflow.rhai` are compile products.

## Compile / run

```bash
npx rhaiteous init   # in a host project — or compile the pack in this repo:
npx rhaiteous ./examples/example-office-shopping/workflow.json \
  -b ./examples/example-office-shopping \
  -o ./examples/example-office-shopping/workflow.rhai
```

```text
/workflow example-office-shopping {"requests_dir":"workflows/example-office-shopping/input"}
```

## Stations

| Station | Schema | Capability |
|---------|--------|------------|
| Intake | `stations/intake.schema.json` | read-only |
| Inventory | `stations/inventory.schema.json` | read-only |
| Audit | `stations/audit.schema.json` | read-only |
| Procurement | `stations/procurement.schema.json` | read-only |
| Purchasing | `stations/purchasing.schema.json` | execute |

See [examples/README.md](../examples/README.md) and [workflow-json.md](./workflow-json.md).
