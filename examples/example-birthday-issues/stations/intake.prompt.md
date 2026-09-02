## Intake

### Prior capped / fatal

Unlikely as first station. If it happens: `to: []` with a short explanation.

### Process

`--treatment append`.

Your job is **curation**, not summarization.

1. Check each entry in `args.source_candidates` (files and URLs). Verify each is readable/fetchable.
2. Write **one** Markdown file at `args.curated` (else under `args.out_dir`) that **combines** those sources for Formulation.
3. **Verbatim body text only.** Strip images, styling, site chrome, nav, ads, scripts, cookie banners, “related articles,” and similar non-content. Do **not** paraphrase, prioritize, distill, or invent a “combined picture.”
4. **Structure for consumption (valid Markdown):**
   - Assign sources in order as **Source A**, **Source B**, … (uppercase letters).
   - Each source begins with an H1: `# Source A — <file-path-or-url>`
   - Immediately under that heading, emit a **GitHub-flavored Markdown table** with header row and separator:

     `| Id | Text |`  
     `| --- | --- |`

   - Then one data row per atomic unit (sentence, bullet, numbered item, table row from the source, heading line from the source, caption text if present in the source).
   - **Id** column: `A.00001`, `A.00002`, … then `B.00001`, … (zero-padded; **restart per source letter**).
   - **Text** column: verbatim unit text. **Escape markup that would break the table:**
     - Every literal `|` in the text → `\|`
     - No raw newlines inside a cell (collapse to a space if needed)
   - **Omit blank lines** between table rows (and do not insert empty spacer rows).
   - Do **not** put a top-level “Curated corpus” title or a Manifest — Source H1s are enough.
5. Structured result: schema key **`intake`** (what you verified; path to the curated file). `message.body` may briefly state verification status only.
6. Write **only** that curated file (no thread dumps).

Set `metadata.to` to `"Formulation"`.

### Own cap-out

`mode: "capped"`, `to: "Formulation"` (or `[]`).
