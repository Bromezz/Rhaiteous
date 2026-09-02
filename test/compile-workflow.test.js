/*
 * Tests for the workflow JSON → Rhai compiler (skinny forum-runner).
 */

import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeOs from "node:os";
import nodeUrl from "node:url";

import compileMod from "../src/compile-workflow.js";

const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const repoRoot = nodePath.resolve(here, "..");
const shoppingPack = nodePath.join(repoRoot, "examples", "example-office-shopping");
const shoppingPath = nodePath.join(shoppingPack, "workflow.json");
const issuesPack = nodePath.join(repoRoot, "examples", "example-birthday-issues");
const issuesPath = nodePath.join(issuesPack, "workflow.json");
const knockPack = nodePath.join(repoRoot, "examples", "example-knock-knock");
const knockPath = nodePath.join(knockPack, "workflow.json");

function assertForumRunnerIr(rhai) {
  nodeAssert.match(rhai, /BUILD ARTIFACT/);
  nodeAssert.match(rhai, /workflow-context orchestration|skinny forum-runner template/);
  nodeAssert.match(rhai, /let meta = #\{/);
  nodeAssert.match(rhai, /let default_workflow_json = /);
  nodeAssert.match(rhai, /let toolbox_script = /);
  nodeAssert.match(rhai, /fn build_station_prompt\(/);
  nodeAssert.match(rhai, /fn build_input_section\(/);
  nodeAssert.match(rhai, /thread-create/);
  nodeAssert.match(rhai, /rhaiteous-toolbox/);
  nodeAssert.match(rhai, /--threads-root/);
  nodeAssert.match(rhai, /out_dir\/threads/);
  nodeAssert.match(rhai, /## Station Instructions/);
  nodeAssert.match(rhai, /## Input/);
  nodeAssert.match(rhai, /context_only/);
  nodeAssert.match(rhai, /context_id/);
  nodeAssert.match(rhai, /while next_name/);
  nodeAssert.match(rhai, /phase\("Init"\)/);
  // catalogs / station_defs / default_args must NOT be stamped
  nodeAssert.doesNotMatch(rhai, /let default_args =/);
  nodeAssert.doesNotMatch(rhai, /let schema_catalog =/);
  nodeAssert.doesNotMatch(rhai, /let prompt_catalog =/);
  nodeAssert.doesNotMatch(rhai, /let station_defs = \[/);
  nodeAssert.doesNotMatch(rhai, /write_scratch_file\("thread\.json"/);
  nodeAssert.doesNotMatch(rhai, /fn make_flow_schema/);
  nodeAssert.doesNotMatch(rhai, /while flow\.next/);
  nodeAssert.doesNotMatch(rhai, /json_encode\(this\.conversation\)/);
  nodeAssert.doesNotMatch(rhai, /Conversation so far \(complete, inline\)/);
  nodeAssert.doesNotMatch(rhai, /let write_thread_script = /);
  nodeAssert.doesNotMatch(rhai, /phase\("Rhaiteous Finalization"\)/);
  nodeAssert.doesNotMatch(rhai, /fn rhaiteous_finalization\(/);
  nodeAssert.doesNotMatch(rhai, /fn persist_thread_file\(/);
  nodeAssert.doesNotMatch(rhai, /phase\("Rhaiteous Initialization"\)/);
}

function writeMinimalPack(tmpDir) {
  const stations = nodePath.join(tmpDir, "stations");
  nodeFs.mkdirSync(stations, { recursive: true });
  nodeFs.writeFileSync(nodePath.join(stations, "common.prompt.md"), "Common\n", "utf8");
  nodeFs.writeFileSync(nodePath.join(stations, "a.prompt.md"), "Do A\n", "utf8");
  nodeFs.writeFileSync(nodePath.join(stations, "b.prompt.md"), "Do B\n", "utf8");
  nodeFs.writeFileSync(
    nodePath.join(stations, "a.schema.json"),
    JSON.stringify({ type: "object" }),
    "utf8"
  );
}

nodeTest.test("compiles example-office-shopping as forum-runner", function testShopping() {
  const workflow = compileMod.readJsonFile(shoppingPath);
  const result = compileMod.compileWorkflow(workflow, {
    base: shoppingPack,
    workflowPath: shoppingPath,
  });
  nodeAssert.equal(result.name, "example-office-shopping");
  assertForumRunnerIr(result.rhai);
  nodeAssert.match(result.rhai, /title: "Intake"/);
  nodeAssert.match(result.rhai, /title: "Purchasing"/);
  nodeAssert.match(result.rhai, /default_workflow_json = ".*example-office-shopping.*workflow\.json"/);
  nodeAssert.match(result.workflowMd, /# example-office-shopping/);
  nodeAssert.match(result.workflowMd, /\/workflow example-office-shopping/);
  nodeAssert.equal(workflow.payloadSchema, undefined);
});

nodeTest.test("compiles example-birthday-issues as forum-runner", function testIssues() {
  const workflow = compileMod.readJsonFile(issuesPath);
  const result = compileMod.compileWorkflow(workflow, {
    base: issuesPack,
    workflowPath: issuesPath,
  });
  nodeAssert.equal(result.name, "example-birthday-issues");
  assertForumRunnerIr(result.rhai);
  nodeAssert.match(result.rhai, /title: "Formulation"/);
  nodeAssert.match(result.rhai, /title: "Validation"/);
  nodeAssert.match(result.workflowMd, /\/workflow example-birthday-issues/);
});

nodeTest.test("compiles example-knock-knock as forum-runner", function testKnock() {
  const workflow = compileMod.readJsonFile(knockPath);
  const result = compileMod.compileWorkflow(workflow, {
    base: knockPack,
    workflowPath: knockPath,
  });
  nodeAssert.equal(result.name, "example-knock-knock");
  assertForumRunnerIr(result.rhai);
  nodeAssert.match(result.rhai, /title: "Joker"/);
  nodeAssert.match(result.rhai, /title: "Audience"/);
  nodeAssert.match(result.workflowMd, /\/workflow example-knock-knock/);
  nodeAssert.equal(workflow.stations[0].max_visits, 3);
  nodeAssert.equal(workflow.stations[1].max_visits, 3);
});

nodeTest.test("rejects payloadSchema", function testNoPayloadSchema() {
  const tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "tps-"));
  writeMinimalPack(tmpDir);
  try {
    nodeAssert.throws(
      function run() {
        compileMod.compileWorkflow(
          {
            name: "no-payload",
            description: "x",
            payloadSchema: "payload.schema.json",
            args: { station_dir: "stations", out_dir: "output" },
            prompts: { a: "a.prompt.md" },
            schemas: { a: "a.schema.json" },
            stations: [{ name: "Alpha", prompt: ["a"] }],
          },
          { base: tmpDir, workflowPath: nodePath.join(tmpDir, "workflow.json") }
        );
      },
      /payloadSchema does not exist/
    );
  } finally {
    nodeFs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

nodeTest.test("rejects step scriptType and workflow.steps", function testRejectStep() {
  nodeAssert.throws(
    function run() {
      compileMod.compileWorkflow(
        {
          name: "x",
          description: "d",
          scriptType: "step",
          args: { station_dir: "s", out_dir: "output" },
          stations: [{ name: "A", prompt: ["a"] }],
        },
        { base: shoppingPack }
      );
    },
    /scriptType "step" was removed/
  );
  nodeAssert.throws(
    function run() {
      compileMod.compileWorkflow(
        {
          name: "x",
          description: "d",
          steps: [],
          args: { station_dir: "s", out_dir: "output" },
          stations: [{ name: "A", prompt: ["a"] }],
        },
        { base: shoppingPack }
      );
    },
    /workflow\.steps is not supported/
  );
});

nodeTest.test("compiles minimal stations to forum-runner", function testMinimal() {
  const tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "tmin-"));
  writeMinimalPack(tmpDir);
  const wfPath = nodePath.join(tmpDir, "workflow.json");
  try {
    const result = compileMod.compileWorkflow(
      {
        name: "mini-thread",
        description: "minimal",
        args: { station_dir: "stations", out_dir: "output" },
        prompts: { common: "common.prompt.md", a: "a.prompt.md", b: "b.prompt.md" },
        schemas: { a: "a.schema.json" },
        stations: [
          { name: "Alpha", prompt: ["common", "a"], uiDescription: "first", schemas: ["a"] },
          { name: "Beta", prompt: ["common", "b"], max_visits: 3 },
        ],
      },
      { base: tmpDir, workflowPath: wfPath }
    );
    assertForumRunnerIr(result.rhai);
    nodeAssert.match(result.rhai, /title: "Alpha"/);
    nodeAssert.match(result.rhai, /title: "Beta"/);
  } finally {
    nodeFs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

nodeTest.test("unknown prompts binding fails closed", function testBadPromptBinding() {
  nodeAssert.throws(
    function run() {
      compileMod.compileWorkflow(
        {
          name: "bad-prompt",
          description: "d",
          args: {
            station_dir: "workflows/example-office-shopping/stations",
            out_dir: "workflows/example-office-shopping/output",
          },
          prompts: { only: "common.prompt.md" },
          schemas: {},
          stations: [{ name: "A", prompt: ["missing"] }],
        },
        { base: shoppingPack, workflowPath: shoppingPath }
      );
    },
    /prompt/
  );
});

nodeTest.test("rejects schema path with stations/ prefix", function testNoSchemaPathPrefix() {
  const tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "tpref-"));
  writeMinimalPack(tmpDir);
  try {
    nodeAssert.throws(
      function run() {
        compileMod.compileWorkflow(
          {
            name: "bad-schema-path",
            description: "d",
            args: { station_dir: "stations", out_dir: "output" },
            prompts: { a: "a.prompt.md" },
            schemas: { a: "stations/a.schema.json" },
            stations: [{ name: "A", prompt: ["a"] }],
          },
          { base: tmpDir, workflowPath: nodePath.join(tmpDir, "workflow.json") }
        );
      },
      /bare filename/
    );
  } finally {
    nodeFs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

nodeTest.test("requires args.station_dir at compile (pack contract)", function testRequireStationDir() {
  const tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "tsd-"));
  writeMinimalPack(tmpDir);
  try {
    nodeAssert.throws(
      function run() {
        compileMod.compileWorkflow(
          {
            name: "no-station-dir",
            description: "d",
            args: { out_dir: "out" },
            prompts: { a: "a.prompt.md" },
            schemas: { a: "a.schema.json" },
            stations: [{ name: "A", prompt: ["a"] }],
          },
          { base: tmpDir, workflowPath: nodePath.join(tmpDir, "workflow.json") }
        );
      },
      /station_dir/
    );
  } finally {
    nodeFs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

nodeTest.test("requires args.out_dir at compile (pack contract)", function testRequireOutDir() {
  const tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "tod-"));
  writeMinimalPack(tmpDir);
  try {
    nodeAssert.throws(
      function run() {
        compileMod.compileWorkflow(
          {
            name: "no-out-dir",
            description: "d",
            args: { station_dir: "stations" },
            prompts: { a: "a.prompt.md" },
            schemas: { a: "a.schema.json" },
            stations: [{ name: "A", prompt: ["a"] }],
          },
          { base: tmpDir, workflowPath: nodePath.join(tmpDir, "workflow.json") }
        );
      },
      /out_dir/
    );
  } finally {
    nodeFs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

nodeTest.test("does not emit pack args into IR", function testNoDefaultArgsEmit() {
  const workflow = compileMod.readJsonFile(issuesPath);
  const result = compileMod.compileWorkflow(workflow, {
    base: issuesPack,
    workflowPath: issuesPath,
  });
  nodeAssert.doesNotMatch(result.rhai, /out_dir: "workflows\/example-birthday-issues\/output"/);
  nodeAssert.doesNotMatch(result.rhai, /let default_args/);
  nodeAssert.match(result.rhai, /fn build_station_prompt/);
});

nodeTest.test("rejects nested default under args", function testRejectNestedDefault() {
  const tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "tnest-"));
  writeMinimalPack(tmpDir);
  try {
    nodeAssert.throws(
      function run() {
        compileMod.compileWorkflow(
          {
            name: "bad-args",
            description: "d",
            args: { station_dir: "stations", out_dir: "output", x: { default: 1 } },
            prompts: { a: "a.prompt.md" },
            schemas: { a: "a.schema.json" },
            stations: [{ name: "A", prompt: ["a"] }],
          },
          { base: tmpDir, workflowPath: nodePath.join(tmpDir, "workflow.json") }
        );
      },
      /put the value directly after the key/
    );
  } finally {
    nodeFs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

nodeTest.test("compileWorkflowFile writes output", function testCompileFile() {
  const outDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "tcf-"));
  const outPath = nodePath.join(outDir, "example-birthday-issues.rhai");
  try {
    const result = compileMod.compileWorkflowFile(issuesPath, {
      base: issuesPack,
      outPath,
      write: true,
    });
    nodeAssert.equal(nodeFs.existsSync(outPath), true);
    const text = nodeFs.readFileSync(outPath, "utf8");
    assertForumRunnerIr(text);
    nodeAssert.equal(result.name, "example-birthday-issues");
  } finally {
    nodeFs.rmSync(outDir, { recursive: true, force: true });
  }
});
