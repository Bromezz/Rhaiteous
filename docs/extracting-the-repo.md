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

3. Package metadata and npm: this package is published as [`rhaiteous`](https://www.npmjs.com/package/rhaiteous). For a new release, bump `version`, then `npm publish --access public` (with auth/2FA as required).

## Suggested GitHub settings

| Setting | Suggestion |
|---------|------------|
| Description | Rhaiteous — compile JSON + JSON Schema into Grok Build Rhai workflows |
| Topics | `rhaiteous`, `grok`, `rhai`, `json-schema`, `workflow`, `nodejs` |
| License | MIT |

## Verify before push

```bash
npm test
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/office-shopping.workflow.json -b ./examples/rhaiteous --dry-run
```
