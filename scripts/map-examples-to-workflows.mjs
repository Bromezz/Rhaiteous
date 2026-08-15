/*
 * Option B prepack: copy examples/example-* → workflows/example-*
 * for the npm tarball. Repo versions seeds under examples/ only.
 */
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeUrl from "node:url";

const root = nodePath.resolve(
  nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url)),
  ".."
);
const examplesDir = nodePath.join(root, "examples");
const workflowsDir = nodePath.join(root, "workflows");

function rmrf(p) {
  if (nodeFs.existsSync(p)) {
    nodeFs.rmSync(p, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  nodeFs.mkdirSync(dest, { recursive: true });
  const entries = nodeFs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const from = nodePath.join(src, e.name);
    const to = nodePath.join(dest, e.name);
    if (e.isDirectory()) {
      copyDir(from, to);
    } else if (e.isFile()) {
      // do not ship compile products in the package seeds
      if (e.name === "workflow.rhai" || e.name === "workflow.md") {
        continue;
      }
      // skip runtime output dumps except .gitkeep
      if (e.name !== ".gitkeep" && src.replace(/\\/g, "/").endsWith("/output")) {
        continue;
      }
      nodeFs.copyFileSync(from, to);
    }
  }
}

if (!nodeFs.existsSync(examplesDir)) {
  console.error("map-examples-to-workflows: missing examples/");
  process.exit(1);
}

rmrf(workflowsDir);
nodeFs.mkdirSync(workflowsDir, { recursive: true });

const names = nodeFs.readdirSync(examplesDir, { withFileTypes: true });
let n = 0;
for (const e of names) {
  if (!e.isDirectory()) {
    continue;
  }
  if (!e.name.startsWith("example-")) {
    continue;
  }
  const src = nodePath.join(examplesDir, e.name);
  const dest = nodePath.join(workflowsDir, e.name);
  if (!nodeFs.existsSync(nodePath.join(src, "workflow.json"))) {
    console.warn("skip (no workflow.json):", e.name);
    continue;
  }
  copyDir(src, dest);
  n += 1;
  console.log("mapped examples/" + e.name + " → workflows/" + e.name);
}

if (n === 0) {
  console.error("map-examples-to-workflows: no example-* packs found");
  process.exit(1);
}

console.log("ok: " + n + " seed pack(s) under workflows/");
