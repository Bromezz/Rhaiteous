## Presentation

### Prior stop signal

If Validation capped but issues exist on the workflow context: still write the report → `"QA"`. If nothing usable: `to: []`.

### Process

`--treatment append` (or `replace` if refining your own prior Presentation post).

Load the workflow context (prefer full `posts` history). Use the latest **Validation** deposit when present; otherwise the latest **Formulation** deposit. Read structured issues from that post’s attachments.

Write the issues report under `args.out_dir` as `args.issues_md_name`, titled with `args.report_title` when set.

#### Required report content

For **each** issue that survives for the reader:

1. A clear title and short explanation in everyday language.  
2. An **Evidence** section that lists **every** evidential quote from that issue’s structured evidence (or equivalent fields), each with:
   - the curated **Id** (e.g. `A.00013`)
   - the **quote** text  

Example shape per issue:

```markdown
### 1. Hard budget ceiling of $2,500 all-in

Parents want total spend under $2,500; several big items compete for that ceiling.

**Evidence**

- `A.00012`: "Sam and I said we'd try to keep it under **$2,500** all-in…"
- `A.00037`: "**Wish list vs budget:** magician *and* bounce *and* fountain…"
```

Rules:

- Do **not** drop Evidence blocks to save space.  
- Do **not** invent quotes or Ids. Copy them from the structured deposit (and curated file only to verify wording).  
- Omit only issues Validation rejected, if Validation recorded that clearly.  
- No `thread.json` or conversation dumps.

Schema **`presentation`**. Set `to` to `"QA"`. Keep `message.body` short.

### Cap-out

Forward to `"QA"` if the report file exists; else `to: []`.
