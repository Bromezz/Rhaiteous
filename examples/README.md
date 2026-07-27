# Examples

The package ships one full authoring tree: the **twice-weekly office shopping** pipeline.

## Layout

```text
examples/
  rhaiteous/                    # asset base (-b ./examples/rhaiteous)
    workflows/
      office-shopping.workflow.json
    schemas/                    # shopping-*.schema.json
    prompts/                    # shopping-*.txt
  out/
    office-shopping.rhai        # sample generated IR
```

In a real Grok Build project, the same shape lives at the repo root as `./rhaiteous/…`, and the compiler’s **default** output is **`.grok/workflows/<name>.rhai`**. These package demos write sample IR under `examples/out/` so this repo does not depend on a local `.grok/` tree.

**User guide (concepts, every step, all files):**  
→ [docs/office-shopping-example.md](../docs/office-shopping-example.md)

## office-shopping

- Path: `rhaiteous/workflows/office-shopping.workflow.json`
- Stations: Intake → Inventory → Audit (`zip_filter`) → Procurement → Purchasing
- Schemas: `shopping-requests`, `shopping-items`, `shopping-audit`, `shopping-vendor-pick`, `shopping-purchase-one`
- Prompts: `shopping-intake.txt` … `shopping-purchasing.txt`
- `evidence` is an array of `{ "source", "quote" }`

```bash
npx rhaiteous ./examples/rhaiteous/workflows/office-shopping.workflow.json \
  -b ./examples/rhaiteous \
  -o ./examples/out/office-shopping.rhai
# from a clone without install:
# node ./bin/rhaiteous.js … (same args)
```

```text
/workflow office-shopping {"requests_dir":"./inbox/requests","company_name":"Acme Office"}
```

## Note on generated `out/`

Files under `out/` are **compiler output**. Prefer editing `rhaiteous/workflows/*`, `schemas/*`, and `prompts/*`, then recompile. They are committed so visitors can inspect IR without running Node.
