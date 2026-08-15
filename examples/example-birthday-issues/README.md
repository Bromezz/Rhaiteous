# Birthday planning — issue surfacing

This example is about **surfacing issues, constraints, and gaps** from raw planning material—not building a shopping list, and not writing the party plan for you.

## What problem it models

Planning work (a birthday party here; a product launch or fundraising campaign elsewhere) usually starts from **uneven sources**: a chat dump, a transcript, a web how-to, a half-filled brief. Stakeholders disagree, leave things implicit, or invent commitments that never appear in the same place twice.

**Issue surfacing** means:

- What wants, needs, and constraints are actually present in the material?
- Where do sources conflict, leave holes, or invent undiscussed requirements?
- What still needs a decision, owner, or evidence before the plan is safe?

The fixture uses birthday-party discussion text plus a public how-to page so the pipeline is small and inspectable. The **shape** of the work is what transfers: corpus → issues → challenge → report.

## How the work unfolds (in plain language)

1. **Verify and curate sources**  
   Check that candidate files/URLs are usable, then reduce them into one Markdown corpus with clear section headers per original source. Later work reads that corpus—not ad-hoc re-fetching of every original.

2. **Surface issues**  
   From the curated text only, propose concrete issues (wants, needs, risks, missing decisions). Track how many *new* items appeared this pass so the loop can exhaust coverage.

3. **Challenge and loop**  
   Skeptical validation: if coverage is incomplete, send work back for more surfacing; when the list stabilizes, validate each item hard.

4. **Present**  
   Write a stakeholder-facing issues report (and full structured state) under the output directory.

5. **Polish**  
   QA the wording and structure so the report is usable in a meeting, not only machine-valid.

The product is a **defensible issue list with provenance**, not a finished party itinerary.

## What you put in / what you get out

| In | Out |
|----|-----|
| Source candidates (sample under `input/`; optional URLs in args) | Curated Markdown corpus |
| | Issues list with validation/quality flags |
| | Flow JSON + issues report under `output/` |

## When this pattern fits

- Discovery and requirements mining from mixed documents  
- Pre-design “what did we actually hear?” pass  
- Diligence-style coverage: keep looking until new issues stop appearing  

## When it is the wrong pattern

- Building and buying a **line-item list** through audit and procurement → use **example-office-shopping** (list development)  
- Pure summarization with no issue ledger or challenge loop  

## Related files

- **`README.md` (this file)** — purpose and story  
- **`workflow.md`** — generated technical guide (args, stations, compile); do not hand-edit  
- **`workflow.json`**, **`stations/`**, **`schema.json`** — authoring surface for the compiler  
