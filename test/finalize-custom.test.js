/*
 * Unit test: knock-knock custom-finalize writes a summary from thread.json.
 */

import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeOs from "node:os";
import nodeUrl from "node:url";
import nodeChild from "node:child_process";

const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const repoRoot = nodePath.resolve(here, "..");
const packDir = nodePath.join(repoRoot, "examples", "example-knock-knock");
const finalizeJs = nodePath.join(packDir, "finalize.mjs");

nodeTest.test("finalize.mjs invokes custom-finalize and writes summary", function testCustom() {
  const tmp = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "rh-fin-"));
  try {
    const threadDir = nodePath.join(tmp, "output", "threads", "2026.01.01.00.00.00.000");
    nodeFs.mkdirSync(threadDir, { recursive: true });
    const threadPath = nodePath.join(threadDir, "thread.json");
    nodeFs.writeFileSync(
      threadPath,
      JSON.stringify({
        posts: [
          {
            metadata: { from: "Joker", to: "Audience" },
            message: { mime: "text/plain", body: "Knock knock." },
          },
          {
            metadata: { from: "Audience", to: [] },
            message: { mime: "text/plain", body: "Ha!" },
          },
        ],
      }),
      "utf8"
    );

    // Run finalize from a copy of the pack scripts so output lands under tmp
    const packCopy = nodePath.join(tmp, "pack");
    nodeFs.mkdirSync(packCopy, { recursive: true });
    nodeFs.copyFileSync(finalizeJs, nodePath.join(packCopy, "finalize.mjs"));
    nodeFs.copyFileSync(
      nodePath.join(packDir, "custom-finalize.mjs"),
      nodePath.join(packCopy, "custom-finalize.mjs")
    );

    // Point thread under packCopy/output/threads/... so custom-finalize finds output/
    const runThreadDir = nodePath.join(
      packCopy,
      "output",
      "threads",
      "2026.01.01.00.00.00.000"
    );
    nodeFs.mkdirSync(runThreadDir, { recursive: true });
    const runThread = nodePath.join(runThreadDir, "thread.json");
    nodeFs.copyFileSync(threadPath, runThread);

    const r = nodeChild.spawnSync(
      process.execPath,
      [nodePath.join(packCopy, "finalize.mjs"), runThread],
      { encoding: "utf8" }
    );
    nodeAssert.equal(r.status, 0, r.stderr || r.stdout);

    const summary = nodePath.join(packCopy, "output", "finalize-summary.md");
    nodeAssert.ok(nodeFs.existsSync(summary), "expected finalize-summary.md");
    const text = nodeFs.readFileSync(summary, "utf8");
    nodeAssert.match(text, /Knock knock/);
    nodeAssert.match(text, /Ha!/);
    nodeAssert.match(text, /Joker/);
  } finally {
    nodeFs.rmSync(tmp, { recursive: true, force: true });
  }
});
