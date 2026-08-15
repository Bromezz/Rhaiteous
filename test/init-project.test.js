/*
 * Tests for rhaiteous init (host workflows/ + example seeds).
 */

import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeOs from "node:os";
import nodeUrl from "node:url";
import nodeChild from "node:child_process";

import initMod from "../src/init-project.js";

const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const repoRoot = nodePath.resolve(here, "..");
const cliPath = nodePath.join(repoRoot, "bin", "rhaiteous.js");

function rmrf(p) {
  if (nodeFs.existsSync(p)) {
    nodeFs.rmSync(p, { recursive: true, force: true });
  }
}

nodeTest.test("resolveSeedCatalog finds example-* packs", function testCatalog() {
  const cat = initMod.resolveSeedCatalog();
  nodeAssert.ok(cat.seedIds.includes("example-office-shopping"));
  nodeAssert.ok(cat.seedIds.includes("example-issues-birthday"));
  nodeAssert.ok(cat.seedIds.every(function p(id) {
    return id.startsWith("example-");
  }));
});

nodeTest.test("initProject creates workflows/ and seeds example packs", function testInit() {
  const host = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "rh-init-"));
  try {
    const report = initMod.initProject({ hostRoot: host });
    nodeAssert.equal(
      nodePath.resolve(report.hostWorkflows),
      nodePath.resolve(host, "workflows")
    );
    nodeAssert.ok(report.copied.includes("example-office-shopping"));
    nodeAssert.ok(
      nodeFs.existsSync(
        nodePath.join(host, "workflows", "example-office-shopping", "workflow.json")
      )
    );
    nodeAssert.ok(
      nodeFs.existsSync(
        nodePath.join(host, "workflows", "example-issues-birthday", "workflow.json")
      )
    );
    nodeAssert.ok(nodeFs.existsSync(nodePath.join(host, ".gitignore")));
    const gi = nodeFs.readFileSync(nodePath.join(host, ".gitignore"), "utf8");
    nodeAssert.match(gi, /workflows\//);

    // second init skips existing seeds
    const report2 = initMod.initProject({ hostRoot: host });
    nodeAssert.equal(report2.copied.length, 0);
    nodeAssert.ok(report2.skipped.length >= 2);

    // force overwrites
    const report3 = initMod.initProject({ hostRoot: host, force: true });
    nodeAssert.ok(report3.copied.includes("example-office-shopping"));
  } finally {
    rmrf(host);
  }
});

nodeTest.test("init does not remove non-example host packs", function testCustom() {
  const host = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "rh-init2-"));
  try {
    const custom = nodePath.join(host, "workflows", "acme-custom-flow");
    nodeFs.mkdirSync(custom, { recursive: true });
    nodeFs.writeFileSync(nodePath.join(custom, "USER.md"), "KEEP\n", "utf8");

    initMod.initProject({ hostRoot: host });

    nodeAssert.equal(
      nodeFs.readFileSync(nodePath.join(custom, "USER.md"), "utf8"),
      "KEEP\n"
    );
    nodeAssert.ok(
      nodeFs.existsSync(
        nodePath.join(host, "workflows", "example-office-shopping", "workflow.json")
      )
    );
  } finally {
    rmrf(host);
  }
});

nodeTest.test("CLI init + compile pack end-to-end", function testCli() {
  const host = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "rh-cli-"));
  try {
    let r = nodeChild.spawnSync(
      process.execPath,
      [cliPath, "init", "--dir", host],
      { encoding: "utf8" }
    );
    nodeAssert.equal(r.status, 0, r.stderr || r.stdout);
    nodeAssert.ok(
      nodeFs.existsSync(
        nodePath.join(host, "workflows", "example-office-shopping", "workflow.json")
      )
    );

    r = nodeChild.spawnSync(
      process.execPath,
      [cliPath, "compile", "example-office-shopping"],
      { encoding: "utf8", cwd: host }
    );
    nodeAssert.equal(r.status, 0, r.stderr || r.stdout);
    nodeAssert.ok(
      nodeFs.existsSync(
        nodePath.join(host, "workflows", "example-office-shopping", "workflow.rhai")
      )
    );
    nodeAssert.ok(
      nodeFs.existsSync(
        nodePath.join(host, "workflows", "example-office-shopping", "workflow.md")
      )
    );
    nodeAssert.ok(
      nodeFs.existsSync(
        nodePath.join(host, ".grok", "workflows", "example-office-shopping.rhai")
      )
    );
  } finally {
    rmrf(host);
  }
});
