/*
 * Smoke tests for tools/toolbox (create → add → get).
 */

import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import nodeFs from "node:fs";
import nodeOs from "node:os";
import nodePath from "node:path";
import nodeUrl from "node:url";
import { spawnSync } from "node:child_process";

const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const repoRoot = nodePath.resolve(here, "..");
const toolbox = nodePath.join(
  repoRoot,
  "tools",
  "toolbox",
  "rhaiteous-toolbox.mjs"
);

function runTool(args, opts = {}) {
  const result = spawnSync(process.execPath, [toolbox, ...args], {
    encoding: "utf8",
    input: opts.input,
    env: { ...process.env, ...(opts.env || {}) },
    cwd: opts.cwd || repoRoot,
  });
  return result;
}

nodeTest.test("toolbox create → add append → get posts", function testRoundTrip() {
  const tmp = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "rh-tb-"));
  const threadsRoot = nodePath.join(tmp, "threads");
  nodeFs.mkdirSync(threadsRoot, { recursive: true });

  const create = runTool(["thread-create"], {
    input: JSON.stringify({
      stations: ["Intake", "Inventory"],
      caps: { Intake: 1, Inventory: 1 },
      schemas: { intake: { type: "object" } },
    }),
    env: { RHAITEOUS_THREADS_ROOT: threadsRoot },
  });
  nodeAssert.equal(create.status, 0, create.stderr || create.stdout);
  const created = JSON.parse(create.stdout);
  nodeAssert.ok(created.id);
  nodeAssert.ok(created.path);
  nodeAssert.equal(nodeFs.existsSync(created.path), true);

  const post = {
    metadata: {
      from: "Intake",
      to: "Inventory",
      routing_rationale: "next",
    },
    message: {
      mime: "text/markdown",
      body: "hello",
      attachments: [
        {
          name: "result",
          mime: "application/json",
          schema: "intake",
          content: { ok: true },
        },
      ],
    },
  };

  const add = runTool(
    ["thread-add-post", created.id, "--treatment", "append", "--json-stdin"],
    {
      input: JSON.stringify(post),
      env: { RHAITEOUS_THREADS_ROOT: threadsRoot },
    }
  );
  nodeAssert.equal(add.status, 0, add.stderr || add.stdout);
  const added = JSON.parse(add.stdout);
  nodeAssert.ok(added.post);
  nodeAssert.equal(added.post.metadata.from, "Intake");
  nodeAssert.equal(added.station_run.Intake, 1);

  const get = runTool(["thread-get-posts", created.id], {
    env: { RHAITEOUS_THREADS_ROOT: threadsRoot },
  });
  nodeAssert.equal(get.status, 0, get.stderr || get.stdout);
  const got = JSON.parse(get.stdout);
  nodeAssert.equal(got.id, created.id);
  nodeAssert.deepEqual(got.stations, ["Intake", "Inventory"]);
  nodeAssert.equal(got.posts.length, 1);
  nodeAssert.equal(got.station_run.Intake, 1);
  nodeAssert.equal(got.benched.Intake, false);

  nodeFs.rmSync(tmp, { recursive: true, force: true });
});

nodeTest.test("toolbox --threads-root stores under out_dir/threads", function testOutDirThreads() {
  const tmp = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "rh-tb-out-"));
  const outDir = nodePath.join(tmp, "output");
  const threadsRoot = nodePath.join(outDir, "threads");
  const alienCwd = nodePath.join(tmp, "alien-cwd");
  nodeFs.mkdirSync(alienCwd, { recursive: true });

  const env = { ...process.env };
  delete env.RHAITEOUS_THREADS_ROOT;

  const create = runTool(["--threads-root", threadsRoot, "thread-create"], {
    input: JSON.stringify({
      stations: ["A"],
      caps: { A: 1 },
      schemas: {},
    }),
    cwd: alienCwd,
    env,
  });
  nodeAssert.equal(create.status, 0, create.stderr || create.stdout);
  const created = JSON.parse(create.stdout);
  nodeAssert.ok(String(created.path).startsWith(threadsRoot));
  nodeAssert.equal(nodeFs.existsSync(created.path), true);
  nodeAssert.equal(nodeFs.existsSync(nodePath.join(alienCwd, "threads")), false);
  nodeAssert.equal(nodeFs.existsSync(nodePath.join(repoRoot, "threads", created.id)), false);

  nodeFs.rmSync(tmp, { recursive: true, force: true });
});
