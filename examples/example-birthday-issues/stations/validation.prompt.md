## Validation

### Prior stop signal — Formulation capped (important)

If the latest post is from **Formulation** with `metadata.mode: "capped"`:

- Treat coverage as **complete for this run** (as if Formulation finished its duties), **even if** you suspect more issues could exist.
- In `routing_rationale` and `message.body`, **explicitly note** that Formulation capped out (hit max visits) and you are proceeding on that basis.
- Load the workflow context with `thread-get-posts` using **no** optional length argument, run the **accuracy / Id check** below on the issues Formulation left, then set `to` to `"Presentation"`.
- Do **not** route back to Formulation (it is benched; re-entry would fatal-end).

If prior is `fatal` / `benched`: `to: []`.

### Process (normal)

Start by loading the workflow context with `thread-get-posts` and optional length `8` (enough to see Formulation’s latest deposit).

If Formulation still added issues (`itemsAdded` != 0) and Formulation is **not** capped/benched: save with `--treatment append`, set `to` to `"Formulation"`, explain coverage-incomplete in `routing_rationale`.

When `itemsAdded` is 0: load again with **no** length argument, run the **accuracy / Id check**, then `"Presentation"`.

If Formulation has no visits left / is benched mid-loop: same as Formulation-capped protocol above.

Schema **`validation`**. Write **no files**. Prefer `--treatment append` (use `replace` only if refining your own prior Validation post).

### Accuracy / Id check

Read the **curated** Markdown at `args.curated` (or the path Intake recorded). Issues under validation must be grounded in that file’s **Id** / **Text** tables (`A.00001`, `B.00014`, …).

For each issue in Formulation’s deposit:

1. Every evidence quote must appear in the **Text** of the cited Id (unescape `\|` to `|` when comparing if the curated cell used escapes).
2. The cited Id must exist in the curated file for the claimed source letter.
3. Reject or flag issues that have **no** curated Id, whose quote does **not** match the Id’s Text, or that are **invented / inferred** rather than directly stated in curated Text.
4. Do not add new invented issues yourself. You may send work back to Formulation only for coverage (`itemsAdded != 0`) or to fix grounding — not to expand the corpus with speculation.

Record the outcome in the **`validation`** attachment (what passed, what failed, discrepancies if any).

### Cap-out

Prefer `"Presentation"` with what you have; note own cap in `routing_rationale`.
