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

3. Package metadata and npm: this package is published as [`rhaiteous`](https://www.npmjs.com/package/rhaiteous). For a new release, bump `version` in `package.json`, update [CHANGELOG.md](../CHANGELOG.md), commit, tag (`vX.Y.Z`), push, then `npm publish --access public` (with auth/2FA as required).

### npm metadata (`package.json`)

| Field | Role |
|-------|------|
| `keywords` | Indexed on the npm package page (sidebar **Keywords**); aids search for Grok Build / Rhai / workflow tools |
| `repository` / `homepage` / `bugs` | Link the npm page back to GitHub |
| `bin` / `files` | What installs as the CLI and what is included in the tarball |

Keywords are published with each release. Edit the `keywords` array, then ship a new version so [npmjs.com/package/rhaiteous](https://www.npmjs.com/package/rhaiteous) updates.

### README badges

The main [README](../README.md) shows shields.io badges for **npm version** and **license** (linked to the package page and `LICENSE`).

## Suggested GitHub settings

| Setting | Suggestion |
|---------|------------|
| Description | Compile JSON + JSON Schema workflows into Grok Build Rhai scripts |
| Website | https://www.npmjs.com/package/rhaiteous |
| Topics | Align with npm keywords: `rhaiteous`, `grok`, `grok-build`, `xai`, `rhai`, `workflow`, `json-schema`, `nodejs`, `cli`, `multi-agent` |
| License | MIT |

## Verify before push

```bash
npm test
node ./bin/rhaiteous.js ./examples/rhaiteous/workflows/office-shopping.workflow.json -b ./examples/rhaiteous --dry-run
```
