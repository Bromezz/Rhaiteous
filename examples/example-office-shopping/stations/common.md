## Shared station rules (all stations)

You receive and must return the **full flow** object (envelope + `payload` + `state` + `log`).

Invocation-specific inputs appear under **Workflow args (JSON)** at the end of this prompt when the workflow declares `args`. Use those values; do **not** invent paths or company labels.

### Default routing (required)
1. After your work, set `flow.next` to the **next station name in `flow.stations` after `flow.current`** (same array order).
2. If this station is the **last** entry in `flow.stations`, set `flow.next` to **null**.
3. **Do not** hard-code a default successor by name. Look up the successor on `flow.stations`.
4. Only set `flow.next` to a **different** name (or null early) when **this station’s own** instructions explicitly require non-default routing (e.g. early complete after empty intake).

### Other shared rules
1. Work in this order relative to routing fields:
   - If this station’s instructions require acting on a non-null `flow.msg` first, do that work **before** clearing `flow.msg`.
   - Otherwise set `flow.next` and `flow.msg` to null early, then apply default routing (or a documented exception) when done.
2. Append one `flow.log` entry with your station name and a short status message.
3. Preserve `flow.stations` and other stations’ `flow.state` keys unless your station owns them.
4. Preserve `flow.payload` fields your station does not own. Change only the payload fields your station instructions assign to you.
5. Return only the structured flow object as your result (host envelope schema applies).
