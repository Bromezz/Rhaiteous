# Office shopping — list development

This example is about **turning messy, multi-channel supply requests into a defensible shopping list**, then carrying that list through challenge, vendor choice, and purchase.

## What problem it models

In a real office, people ask for supplies over email, chat, forms, and hallway conversations. The hard part is not “order stuff”; it is **list development**:

- What was actually requested?
- What concrete items and quantities does that imply?
- What should *not* be bought this cycle (duplicates, policy, budget, nonsense quantities)?
- Who should supply each surviving line?
- What got bought (or would be bought), and what is the record?

This workflow walks that path as a staged handoff, not a single brainstorm dump.

## How the work unfolds (in plain language)

1. **Gather requests**  
   Collect inbound asks into a shared deposit so nothing depends on one person’s inbox.

2. **Expand into a draft list**  
   Turn vague requests (“we need paper”) into specific lines (product, quantity, unit) tied back to those requests.

3. **Challenge the list**  
   Adversarially test each line: needed? quantity sane? already covered? allowed? budget-plausible? Weak lines drop; strong ones become survivors.

4. **Choose fulfillment**  
   For each survivor, pick a vendor or channel and note how to buy it.

5. **Purchase and record**  
   Execute or simulate the buys and leave a transaction trail for the cycle.

The output is a **developed list with history**: not only what to buy, but why lines lived or died and how they were fulfilled.

## What you put in / what you get out

| In | Out |
|----|-----|
| A directory of request material (sample under `input/`) | Structured cycle state: requests → items → survivors → vendor picks → transactions |
| Company / cycle labels as launch args | A completed (or early-stopped) shopping cycle record |

## When this pattern fits

- Recurring procurement or replenishment cycles  
- Multi-source intake that must become one ordered list  
- Teams that need auditability between “someone asked” and “we spent money”

## When it is the wrong pattern

- Open-ended requirements or risk mining from documents → use **example-birthday-issues** (issue surfacing)  
- One-shot FAQ or summary with no list evolution  

## Related files

- **`README.md` (this file)** — purpose and story  
- **`workflow.md`** — generated technical guide (args, stations, compile); do not hand-edit  
- **`workflow.json`**, **`stations/`**, **`schema.json`** — authoring surface for the compiler  
