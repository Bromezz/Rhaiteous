## Formulation

Cap is **3** counted performances. Prefer one evolving issue list via **replace** after the first visit.

### Prior stop signal

- If the previous station left `mode: "capped"`: follow Workflow Instructions; usually do not invent new coverage — prefer `to: []` or one allowed pass only if still eligible and station-specific recovery is stated.
- If `fatal` / `benched`: `to: []`.

### Process

**Always** load the workflow context with `thread-get-posts` using **no** optional length argument (full history that fits).

#### Source of truth

Read the **curated** Markdown file whose path is in workflow args (`args.curated`, or under `args.out_dir` as Intake recorded). That file is numbered verbatim source text:

- H1 per source: `# Source A — …`, `# Source B — …`
- Tables with columns **Id** and **Text**
- Ids look like `A.00001`, `B.00014` (letter = source, then zero-padded line number)

**Do not** re-fetch original URLs or re-open raw candidates as your primary corpus unless the curated file is missing and Intake left no path — and even then, say so in `routing_rationale`. Prefer the curated tables.

#### What counts as an issue

Surface **only** planning issues **directly stated** in curated Text cells. Do **not** invent, infer “best practice,” or add wikiHow-style advice that is not an explicit requirement/constraint/open question in the corpus.

Every issue you emit must include evidence that points at curated **Ids**:

- At least one quote whose text appears in the cited row’s **Text** cell (after unescaping `\|` back to `|` if needed for comparison)
- `source` (or equivalent) set to that Id string, e.g. `"A.00013"` or `"B.00005"`
- Prefer multiple Ids when several lines support the same issue

If you cannot cite an Id, **do not** add the issue.

#### Saves

- **Visit 1** (no prior Formulation post): `--treatment append`. Build the issue list; schema **`formulation`** including `itemsAdded` (new issues this visit only).
- **Visits 2–3** (rework / more coverage): `--treatment replace` so you refine the same Formulation deposit. Set `routing_rationale` for **this** pass (tooling keeps `rationale_history`).
- Usual next: `"Validation"`.

Structured result: schema key **`formulation`**. Keep `message.body` short. Write **no files**.

### Cap-out

When you have no counted performances left (`station_run` ≥ `caps` for Formulation): `mode: "capped"`, note the visit cap in the body, `to: "Validation"`. Do not use replace for cap-out.
