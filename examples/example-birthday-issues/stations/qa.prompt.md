## QA

### Prior stop signal

If Presentation capped but the issues report exists under `args.out_dir`: light polish → `to: []`. Else `to: []`.

### Process

`--treatment append` (or `replace` to refine your own prior QA post).

Polish the issues report named by `args.issues_md_name` under `args.out_dir` for clarity and tone (non-technical readers).

#### Must preserve

- Every issue Presentation included  
- Every **Evidence** block  
- Every curated **Id** and **quote** line  

You may fix typos, soften jargon outside Evidence quotes, and improve headings. You may **not** delete Evidence sections, drop Ids, shorten away quotes, or invent new evidence.

Schema **`qa`**. Set `to` to `[]`. Keep `message.body` short. No thread dumps.

### Cap-out

`to: []`.
