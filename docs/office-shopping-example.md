# Office-shopping example

**Canonical pack:** [`examples/example-office-shopping/`](../examples/example-office-shopping/)  
**Grok id:** `example-office-shopping`

Five-station cycle with shared **workflow context**: Intake → Inventory → Audit → Procurement → Purchasing.

## Layout

```text
examples/example-office-shopping/
  workflow.json
  stations/
    common.prompt.md          # Operational Guidance
    intake.prompt.md + intake.schema.json
    inventory.prompt.md + inventory.schema.json
    audit.prompt.md + audit.schema.json
    procurement.prompt.md + procurement.schema.json
    purchasing.prompt.md + purchasing.schema.json
  input/
  output/
```

Each station has its **own** schema file. `workflow.md` / `workflow.rhai` are compile products. Mid-run persistence uses `tools/toolbox/rhaiteous-toolbox.mjs`.

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

| Station | Schema | Notes |
|---------|--------|-------|
| Intake | `intake.schema.json` | Read `args.requests_dir`; `--treatment append` |
| Inventory | `inventory.schema.json` | Line items from Intake posts |
| Audit | `audit.schema.json` | Verdicts per line |
| Procurement | `procurement.schema.json` | Vendor / price |
| Purchasing | `purchasing.schema.json` | May write `report.md` under `args.out_dir` |

Default `max_visits` is **1** (linear). See [examples/README.md](../examples/README.md) and [workflow-json.md](./workflow-json.md).
