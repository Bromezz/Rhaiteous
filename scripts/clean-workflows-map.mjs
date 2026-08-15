/*
 * Remove generated workflows/ map (postpack / local cleanup).
 * Does not touch a consumer project's workflows/ outside this repo.
 */
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeUrl from "node:url";

const root = nodePath.resolve(
  nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url)),
  ".."
);
const workflowsDir = nodePath.join(root, "workflows");

if (nodeFs.existsSync(workflowsDir)) {
  nodeFs.rmSync(workflowsDir, { recursive: true, force: true });
  console.log("removed", workflowsDir);
} else {
  console.log("nothing to clean");
}
