/*
 * Tests for Rhai reserved-keyword loading and compile-time guard.
 */

//node test
import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import nodePath from "node:path";
import nodeUrl from "node:url";

//modules under test
import rhaiKeywordsMod from "../src/rhai-keywords.js";
import compileMod from "../src/compile-workflow.js";

//paths
const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const repoRoot = nodePath.resolve(here, "..");
const examplesBase = nodePath.join(repoRoot, "examples", "rhaiteous");
const shoppingPath = nodePath.join(
  examplesBase,
  "workflows",
  "office-shopping.workflow.json"
);

//keyword list loads and contains known reserved words
nodeTest.test("loads rhai keyword list", function testLoad() {

  //variables
  let set = null; //keyword set

  //load
  set = rhaiKeywordsMod.loadKeywordSet();

  //expected membership
  nodeAssert.equal(set.has("switch"), true);
  nodeAssert.equal(set.has("let"), true);
  nodeAssert.equal(set.has("for"), true);
  nodeAssert.equal(set.has("match"), true);
  nodeAssert.equal(set.has("intake"), false);

//end testLoad
});

//office-shopping must stay clean
nodeTest.test("office-shopping has no keyword violations", function testCleanExample() {

  //variables
  let workflow = null; //doc
  let result = null; //compile

  //load
  workflow = compileMod.readJsonFile(shoppingPath);

  //must compile
  result = compileMod.compileWorkflow(workflow, {
    base: examplesBase, //assets
  });

  //rhai produced
  nodeAssert.match(result.rhai, /let meta = #\{/);

//end testCleanExample
});

//agent.as using a keyword fails with multi-report style message
nodeTest.test("rejects reserved keyword as agent.as", function testBadAs() {

  //variables
  let workflow = null; //doc

  //bad binding name
  workflow = {
    name: "kw-demo", //name
    description: "keyword violation", //desc
    steps: [
      {
        op: "set", //set
        as: "switch", //reserved
        value: "x", //value
      },
    ],
  };

  //expect keyword report
  nodeAssert.throws(function runCompile() {

    //compile
    compileMod.compileWorkflow(workflow, {
      base: examplesBase, //base
    });

  //end run
  }, /reserved keyword|keyword "switch"|Rhai reserved keyword/i);

//end testBadAs
});

//multiple violations listed together
nodeTest.test("reports multiple keyword violations", function testMulti() {

  //variables
  let workflow = null; //doc
  let err = null; //caught error

  //two bad names
  workflow = {
    name: "kw-multi", //name
    description: "multiple keywords", //desc
    args: {
      for: { required: true }, //reserved
    },
    steps: [
      {
        op: "set", //set
        as: "match", //reserved
      },
    ],
  };

  //capture error
  try {

    //compile
    compileMod.compileWorkflow(workflow, {
      base: examplesBase, //base
    });

    //should not reach
    nodeAssert.fail("expected throw");

  } catch (e) {

    //keep
    err = e;

  //end try
  }

  //message lists both
  nodeAssert.match(String(err && err.message), /for/);
  nodeAssert.match(String(err && err.message), /match/);
  nodeAssert.match(String(err && err.message), /2\)|2\./);

//end testMulti
});

//keyword only inside a string does not fail layer B for clean idents
nodeTest.test("prompt text containing keywords is allowed", function testStringOk() {

  //variables
  let workflow = null; //doc
  let result = null; //compile

  //set with string value containing "if"
  workflow = {
    name: "kw-string", //name
    description: "keyword in string only", //desc
    steps: [
      {
        op: "set", //set
        as: "msg", //safe name
        value: "use if carefully", //contains keyword as text
      },
      {
        op: "complete", //end
        value: { $ref: "msg" }, //ref
      },
    ],
  };

  //must compile
  result = compileMod.compileWorkflow(workflow, {
    base: examplesBase, //base
  });

  //string present
  nodeAssert.match(result.rhai, /use if carefully/);

//end testStringOk
});
