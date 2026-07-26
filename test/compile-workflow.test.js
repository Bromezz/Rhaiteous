/*
 * Tests for the workflow JSON → Rhai compiler.
 */

//node builtins and test
import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeOs from "node:os";
import nodeUrl from "node:url";

//compiler library
import compileMod from "../src/compile-workflow.js";

//paths relative to this test file
const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const repoRoot = nodePath.resolve(here, "..");
const minimalPath = nodePath.join(repoRoot, "examples", "minimal.workflow.json");
const clientPath = nodePath.join(repoRoot, "examples", "client-issues.workflow.json");

//compile the minimal example without writing
nodeTest.test("compiles minimal.workflow.json", function testMinimal() {

  //variables
  let workflow = null; //parsed doc
  let result = null; //compile result

  //load example
  workflow = compileMod.readJsonFile(minimalPath);

  //compile against example dir for schemas
  result = compileMod.compileWorkflow(workflow, {
    baseDir: nodePath.dirname(minimalPath), //schema root
  });

  //name preserved
  nodeAssert.equal(result.name, "minimal-summary");

  //meta header present
  nodeAssert.match(result.rhai, /let meta = #\{/);
  nodeAssert.match(result.rhai, /name: "minimal-summary"/);

  //schema loaded as real JSON and emitted
  nodeAssert.match(result.rhai, /let summary_schema = #\{/);
  nodeAssert.match(result.rhai, /"type": "object"/);

  //args pause for required target
  nodeAssert.match(result.rhai, /Pass args\.target/);

  //agent call
  nodeAssert.match(result.rhai, /let result = agent\(/);
  nodeAssert.match(result.rhai, /output_schema: summary_schema/);

  //complete from result
  nodeAssert.match(result.rhai, /complete\(result\.output\);/);

//end testMinimal
});

//compile client-issues fan-out example
nodeTest.test("compiles client-issues.workflow.json with parallel and zip_filter", function testClient() {

  //variables
  let workflow = null; //parsed doc
  let result = null; //compile result

  //load example
  workflow = compileMod.readJsonFile(clientPath);

  //compile
  result = compileMod.compileWorkflow(workflow, {
    baseDir: nodePath.dirname(clientPath), //schema root
  });

  //expected constructs
  nodeAssert.match(result.rhai, /let inventory_schema = #\{/);
  nodeAssert.match(result.rhai, /let candidates_schema = #\{/);
  nodeAssert.match(result.rhai, /let verdict_schema = #\{/);
  nodeAssert.match(result.rhai, /let analysis_results = parallel\(/);
  nodeAssert.match(result.rhai, /for f in files/);
  nodeAssert.match(result.rhai, /zip_filter/);
  nodeAssert.match(result.rhai, /let survivors = \[\];/);
  nodeAssert.match(result.rhai, /agent_type: "skeptic"/);

//end testClient
});

//file API writes under a temp directory
nodeTest.test("compileWorkflowFile writes output", function testWrite() {

  //variables
  let tmpDir = ""; //temp root
  let outPath = ""; //target rhai
  let result = null; //compile result
  let text = ""; //written file body

  //temp dir
  tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "wfcompile-"));

  //output path
  outPath = nodePath.join(tmpDir, "minimal-summary.rhai");

  try {

    //compile and write
    result = compileMod.compileWorkflowFile(minimalPath, {
      outPath: outPath, //explicit out
      write: true, //write disk
    });

    //flags
    nodeAssert.equal(result.written, true);
    nodeAssert.equal(result.outputPath, outPath);

    //file exists
    nodeAssert.equal(nodeFs.existsSync(outPath), true);

    //content looks like rhai
    text = nodeFs.readFileSync(outPath, "utf8");
    nodeAssert.match(text, /let meta = #\{/);

  } finally {

    //cleanup written file and temp dir
    try {

      //remove file
      nodeFs.rmSync(tmpDir, {
        recursive: true, //remove tree
        force: true, //ignore missing
      });

    } catch (err) {

      //log cleanup failure with stack
      console.error("temp cleanup failed", err);

    //end cleanup catch
    }

  //end try
  }

//end testWrite
});

//unknown op fails closed
nodeTest.test("rejects unknown step op", function testUnknownOp() {

  //variables
  let workflow = null; //bad doc

  //minimal bad workflow
  workflow = {
    name: "bad-op", //name
    description: "should fail", //desc
    steps: [
      {
        op: "teleport", //unsupported
      },
    ],
  };

  //expect throw
  nodeAssert.throws(function runCompile() {

    //compile should fail
    compileMod.compileWorkflow(workflow, {
      baseDir: repoRoot, //unused
    });

  //end runCompile
  }, /unsupported op/);

//end testUnknownOp
});
