/*
 * Tests for rhaiteous clonepack.
 */

import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeOs from "node:os";
import nodeUrl from "node:url";
import nodeChild from "node:child_process";

import cloneMod from "../src/clone-pack.js";
import initMod from "../src/init-project.js";

const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const repoRoot = nodePath.resolve(here, "..");
const cliPath = nodePath.join(repoRoot, "bin", "rhaiteous.js");

function rmrf(p) {
  if (nodeFs.existsSync(p)) {
    nodeFs.rmSync(p, { recursive: true, force: true });
  }
}

nodeTest.test("clonePack copies stations and input; skips artifacts; rewrites json", function testClone() {
  const host = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "rh-clone-"));
  try {
    initMod.initProject({ hostRoot: host });

    // pollute source with artifacts that must not copy
    const src = nodePath.join(host, "workflows", "example-knock-knock");
    nodeFs.writeFileSync(nodePath.join(src, "workflow.rhai"), "// artifact\n", "utf8");
    nodeFs.writeFileSync(nodePath.join(src, "workflow.md"), "# artifact\n", "utf8");
    const threadDir = nodePath.join(
      src,
      "output",
      "threads",
      "2026.01.01.00.00.00.000"
    );
    nodeFs.mkdirSync(threadDir, { recursive: true });
    nodeFs.writeFileSync(
      nodePath.join(threadDir, "thread.json"),
      "{\"posts\":[]}\n",
      "utf8"
    );

    const report = cloneMod.clonePack({
      hostRoot: host,
      source: "example-knock-knock",
      destination: "my-knock-knock",
    });

    nodeAssert.equal(report.destination, "my-knock-knock");
    const dest = nodePath.join(host, "workflows", "my-knock-knock");
    nodeAssert.ok(nodeFs.existsSync(nodePath.join(dest, "stations", "joker.prompt.md")));
    nodeAssert.ok(nodeFs.existsSync(nodePath.join(dest, "stations", "common.prompt.md")));
    nodeAssert.ok(
      nodeFs.existsSync(nodePath.join(dest, "input", "README.md")),
      "input samples copied by default"
    );
    nodeAssert.equal(nodeFs.existsSync(nodePath.join(dest, "workflow.rhai")), false);
    nodeAssert.equal(nodeFs.existsSync(nodePath.join(dest, "workflow.md")), false);
    nodeAssert.equal(
      nodeFs.existsSync(nodePath.join(dest, "output", "threads")),
      false
    );
    nodeAssert.ok(nodeFs.existsSync(nodePath.join(dest, "output", ".gitkeep")));

    const wf = JSON.parse(
      nodeFs.readFileSync(nodePath.join(dest, "workflow.json"), "utf8")
    );
    nodeAssert.equal(wf.name, "my-knock-knock");
    nodeAssert.equal(wf.args.station_dir, "workflows/my-knock-knock/stations");
    nodeAssert.equal(wf.args.out_dir, "workflows/my-knock-knock/output");
  } finally {
    rmrf(host);
  }
});

nodeTest.test("clonePack fails when destination exists", function testExists() {
  const host = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "rh-clone2-"));
  try {
    initMod.initProject({ hostRoot: host });
    cloneMod.clonePack({
      hostRoot: host,
      source: "example-knock-knock",
      destination: "dup-pack",
    });
    nodeAssert.throws(function again() {
      cloneMod.clonePack({
        hostRoot: host,
        source: "example-knock-knock",
        destination: "dup-pack",
      });
    }, /already exists/);
  } finally {
    rmrf(host);
  }
});

nodeTest.test("CLI clonepack accepts flags and positionals", function testCli() {
  const host = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "rh-clone3-"));
  try {
    initMod.initProject({ hostRoot: host });

    const flags = nodeChild.spawnSync(
      process.execPath,
      [
        cliPath,
        "clonepack",
        "--source",
        "example-knock-knock",
        "--destination",
        "via-flags",
        "--dir",
        host,
      ],
      { encoding: "utf8" }
    );
    nodeAssert.equal(flags.status, 0, flags.stderr);
    nodeAssert.ok(
      nodeFs.existsSync(
        nodePath.join(host, "workflows", "via-flags", "workflow.json")
      )
    );

    const pos = nodeChild.spawnSync(
      process.execPath,
      [cliPath, "clonepack", "example-office-shopping", "via-pos", "--dir", host],
      { encoding: "utf8" }
    );
    nodeAssert.equal(pos.status, 0, pos.stderr);
    const wf = JSON.parse(
      nodeFs.readFileSync(
        nodePath.join(host, "workflows", "via-pos", "workflow.json"),
        "utf8"
      )
    );
    nodeAssert.equal(wf.name, "via-pos");
    nodeAssert.match(wf.args.station_dir, /workflows\/via-pos\/stations/);
  } finally {
    rmrf(host);
  }
});
