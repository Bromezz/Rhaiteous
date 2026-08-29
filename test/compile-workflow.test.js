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

function assertForumRunnerIr(rhai) {
  nodeAssert.match(rhai, /BUILD ARTIFACT/);
  nodeAssert.match(rhai, /skinny forum-runner template/);
  nodeAssert.match(rhai, /let meta = #\{/);
  nodeAssert.match(rhai, /let default_workflow_json = /);
  nodeAssert.match(rhai, /fn load_workflow_doc\(/);
  nodeAssert.match(rhai, /fn prepare_assets\(/);
  nodeAssert.match(rhai, /fn run_station\(/);
  nodeAssert.match(rhai, /fn apply_station_result\(/);
  nodeAssert.match(rhai, /fn rhaiteous_initialization\(/);
  nodeAssert.match(rhai, /fn persist_thread_file\(/);
  nodeAssert.match(rhai, /let init_script = /);
  nodeAssert.match(rhai, /phase\("Rhaiteous Initialization"\)/);
  nodeAssert.match(rhai, /title: "Rhaiteous Initialization"/);
  nodeAssert.match(rhai, /Conversation thread \(authoritative\)/);
  nodeAssert.match(rhai, /context_only/);
  nodeAssert.match(rhai, /station_dir/);
  nodeAssert.match(rhai, /let ctx = #\{/);
  nodeAssert.match(rhai, /"thread"/);
  nodeAssert.match(rhai, /do \{/);
  // catalogs / station_defs / default_args must NOT be stamped
  nodeAssert.doesNotMatch(rhai, /let default_args =/);
  nodeAssert.doesNotMatch(rhai, /let schema_catalog =/);
  nodeAssert.doesNotMatch(rhai, /let prompt_catalog =/);
  nodeAssert.doesNotMatch(rhai, /let station_defs = \[/);
  nodeAssert.doesNotMatch(rhai, /write_scratch_file\("thread\.json"/);
  nodeAssert.doesNotMatch(rhai, /fn make_flow_schema/);
  nodeAssert.doesNotMatch(rhai, /while flow\.next/);
  nodeAssert.doesNotMatch(rhai, /===== \[/);
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
            args: { station_dir: "stations" },
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
          args: { station_dir: "s" },
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
          args: { station_dir: "s" },
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
        args: { station_dir: "stations" },
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
          args: { station_dir: "workflows/example-office-shopping/stations" },
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
            args: { station_dir: "stations" },
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

nodeTest.test("does not emit pack args into IR", function testNoDefaultArgsEmit() {
  const workflow = compileMod.readJsonFile(issuesPath);
  const result = compileMod.compileWorkflow(workflow, {
    base: issuesPack,
    workflowPath: issuesPath,
  });
  nodeAssert.doesNotMatch(result.rhai, /out_dir: "workflows\/example-birthday-issues\/output"/);
  nodeAssert.doesNotMatch(result.rhai, /let default_args/);
  nodeAssert.match(result.rhai, /fn load_workflow_doc/);
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
            args: { station_dir: "stations", x: { default: 1 } },
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
