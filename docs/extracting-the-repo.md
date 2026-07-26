# Standalone repository notes

**Rhaiteous** is maintained as its own project (not nested inside another app repo).

## Publishing to GitHub

1. Create an empty GitHub repository named `rhaiteous` (or your preferred name).
2. From this directory:

```bash
git init
git add .
git commit -m "Initial import of Rhaiteous"
git branch -M main
git remote add origin git+https://github.com/<you>/rhaiteous.git
git push -u origin main
```

3. Update `package.json` when ready to publish:

- set `"private": false`
- set `repository`, `bugs`, and `homepage` URLs
- optionally `npm publish` (after npm login)

## Suggested GitHub settings

| Setting | Suggestion |
|---------|------------|
| Description | Rhaiteous — compile JSON + JSON Schema into Grok Build Rhai workflows |
| Topics | `rhaiteous`, `grok`, `rhai`, `json-schema`, `workflow`, `nodejs` |
| License | MIT |

## Verify before push

```bash
npm test
node ./bin/rhaiteous.js ./examples/minimal.workflow.json --dry-run
node ./bin/rhaiteous.js ./examples/client-issues.workflow.json --dry-run
```
