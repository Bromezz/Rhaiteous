import fs from "node:fs";

const wf = fs.readFileSync("examples/rhaiteous/workflows/office-shopping.workflow.json", "utf8");
const pretty = JSON.stringify(JSON.parse(wf), null, 2);
const marker = '"name": "office-shopping"';

function replaceJsonFence(mdPath) {
  const md = fs.readFileSync(mdPath, "utf8");
  const nameIdx = md.indexOf(marker);
  if (nameIdx < 0) {
    console.error("marker not found in", mdPath);
    process.exit(1);
  }
  const fenceOpen = md.lastIndexOf("```json", nameIdx);
  if (fenceOpen < 0) {
    console.error("```json fence not found before marker in", mdPath);
    process.exit(1);
  }
  const afterOpen = md.indexOf("\n", fenceOpen);
  const bodyStart = afterOpen + 1;
  // find closing fence after bodyStart
  let fenceClose = md.indexOf("\n```", bodyStart);
  if (fenceClose < 0) {
    fenceClose = md.indexOf("```", bodyStart);
  } else {
    fenceClose = fenceClose + 1; // point at ```
  }
  if (fenceClose < 0) {
    console.error("closing fence not found in", mdPath);
    process.exit(1);
  }
  const next = md.slice(fenceClose);
  // ensure we are at ```
  const closeLen = next.startsWith("```") ? 3 : 0;
  if (closeLen === 0) {
    console.error("unexpected close in", mdPath, JSON.stringify(next.slice(0, 20)));
    process.exit(1);
  }
  const updated =
    md.slice(0, bodyStart) +
    pretty +
    "\n" +
    md.slice(fenceClose);
  fs.writeFileSync(mdPath, updated);
  console.log("updated", mdPath);
}

replaceJsonFence("docs/office-shopping-example.md");
replaceJsonFence("README.md");
