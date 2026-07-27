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
const shoppingPath = nodePath.join(
  repoRoot,
  "examples",
  "rhaiteous",
  "workflows",
  "office-shopping.workflow.json"
);
const examplesBase = nodePath.join(repoRoot, "examples", "rhaiteous");

//full five-station office shopping example
nodeTest.test("compiles office-shopping.workflow.json", function testShopping() {

  //variables
  let workflow = null; //parsed doc
  let result = null; //compile result

  //load example
  workflow = compileMod.readJsonFile(shoppingPath);

  //compile
  result = compileMod.compileWorkflow(workflow, {
    base: examplesBase, //asset root
  });

  //identity
  nodeAssert.equal(result.name, "office-shopping");

  //meta header present
  nodeAssert.match(result.rhai, /let meta = #\{/);
  nodeAssert.match(result.rhai, /name: "office-shopping"/);

  //all five station schemas loaded
  nodeAssert.match(result.rhai, /let requests_schema = #\{/);
  nodeAssert.match(result.rhai, /let items_schema = #\{/);
  nodeAssert.match(result.rhai, /let audit_schema = #\{/);
  nodeAssert.match(result.rhai, /let vendor_pick_schema = #\{/);
  nodeAssert.match(result.rhai, /let purchase_one_schema = #\{/);
  nodeAssert.match(result.rhai, /"type": "object"/);

  //required args pause
  nodeAssert.match(result.rhai, /Pass args\.requests_dir/);

  //station machinery
  nodeAssert.match(result.rhai, /phase\("Intake"\)/);
  nodeAssert.match(result.rhai, /phase\("Inventory"\)/);
  nodeAssert.match(result.rhai, /phase\("Audit"\)/);
  nodeAssert.match(result.rhai, /phase\("Procurement"\)/);
  nodeAssert.match(result.rhai, /phase\("Purchasing"\)/);
  nodeAssert.match(result.rhai, /let inventory_results = parallel\(/);
  nodeAssert.match(result.rhai, /for req in requests/);
  nodeAssert.match(result.rhai, /for item in items/);
  nodeAssert.match(result.rhai, /for item in survivors/);
  nodeAssert.match(result.rhai, /for pick in vendor_picks/);
  nodeAssert.match(result.rhai, /capability_mode: "execute"/);
  nodeAssert.match(result.rhai, /zip_filter/);
  nodeAssert.match(result.rhai, /let survivors = \[\];/);

  //evidence shape + zip_filter non-empty array check
  nodeAssert.match(result.rhai, /"source"/);
  nodeAssert.match(result.rhai, /"quote"/);
  nodeAssert.doesNotMatch(result.rhai, /"source_path"/);
  nodeAssert.match(result.rhai, /v\.output\.evidence\.len\(\) > 0/);
  nodeAssert.match(result.rhai, /"\$comment"/);

  //prompt banners
  nodeAssert.match(result.rhai, /===== \[shopping-intake\.txt\] =====/);
  nodeAssert.match(result.rhai, /===== \[shopping-inventory\.txt\] =====/);
  nodeAssert.match(result.rhai, /===== \[shopping-audit\.txt\] =====/);
  nodeAssert.match(result.rhai, /===== \[shopping-procurement\.txt\] =====/);
  nodeAssert.match(result.rhai, /===== \[shopping-purchasing\.txt\] =====/);

//end testShopping
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
  outPath = nodePath.join(tmpDir, "office-shopping.rhai");

  try {

    //compile and write
    result = compileMod.compileWorkflowFile(shoppingPath, {
      outPath: outPath, //explicit out
      base: examplesBase, //schemas + prompts
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
    nodeAssert.match(text, /===== \[shopping-intake\.txt\] =====/);

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

  //synthetic bad workflow (not a package example)
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
      base: examplesBase, //unused for this case
    });

  //end runCompile
  }, /unsupported op/);

//end testUnknownOp
});

//missing prompt file fails closed
nodeTest.test("rejects missing prompt file", function testMissingPrompt() {

  //variables
  let workflow = null; //doc with bad prompt ref

  //workflow with missing prompt (uses a real shopping schema for load path)
  workflow = {
    name: "missing-prompt", //name
    description: "should fail on prompt load", //desc
    schemas: {
      requests: "shopping-requests.schema.json", //valid schema under examples base
    },
    steps: [
      {
        op: "agent", //agent
        as: "result", //binding
        prompt: ["does-not-exist.txt"], //missing file
      },
    ],
  };

  //expect throw mentioning the file
  nodeAssert.throws(function runCompile() {

    //compile should fail
    compileMod.compileWorkflow(workflow, {
      base: examplesBase, //real base so schema path exists
    });

  //end runCompile
  }, /failed to load prompt file/);

//end testMissingPrompt
});

//prompt must be an array of file names
nodeTest.test("rejects inline prompt strings", function testInlinePrompt() {

  //variables
  let workflow = null; //doc with legacy inline prompt

  //legacy inline lines (no longer valid)
  workflow = {
    name: "inline-prompt", //name
    description: "should fail", //desc
    steps: [
      {
        op: "agent", //agent
        as: "result", //binding
        prompt: ["just a line of text, not a file"], //not a real file
      },
    ],
  };

  //expect throw
  nodeAssert.throws(function runCompile() {

    //compile should fail on missing file (array is required; content is file names)
    compileMod.compileWorkflow(workflow, {
      base: examplesBase, //asset base
    });

  //end runCompile
  }, /failed to load prompt file/);

//end testInlinePrompt
});
