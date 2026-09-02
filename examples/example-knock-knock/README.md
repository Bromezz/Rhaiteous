# example-knock-knock

Minimal **Joker ⇄ Audience** dialogue that exercises the workflow-context toolbox.

## Flow

| Visit | Station | Typical line | Next |
|-------|---------|--------------|------|
| 1 | Joker | `Knock knock.` | Audience |
| 2 | Audience | `Who's there?` | Joker |
| 3 | Joker | setup name | Audience |
| 4 | Audience | `<name> who?` | Joker |
| 5 | Joker | punchline | Audience |
| 6 | Audience | laugh | `[]` (end) |

Both stations have **`max_visits: 3`**. Saves are **`--treatment append` only** (no replace). If Joker caps before the punchline, Audience ends with `This isn't funny.`

Common prompt is **Operational Guidance**; the orchestrator concatenates Guidance + Input + Station Instructions.
