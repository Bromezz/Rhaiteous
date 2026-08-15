/*
 * Tests for Rhai reserved-keyword loading and compile-time guard.
 */

//node test
import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import nodePath from "node:path";
import nodeUrl from "node:url";
import nodeFs from "node:fs";
import nodeOs from "node:os";

//modules under test
import rhaiKeywordsMod from "../src/rhai-keywords.js";
import compileMod from "../src/compile-workflow.js";

//paths
const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const repoRoot = nodePath.resolve(here, "..");
const shoppingPack = nodePath.join(repoRoot, "examples", "example-office-shopping");
const shoppingPath = nodePath.join(shoppingPack, "workflow.json");

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

//example-office-shopping must stay clean
nodeTest.test("example-office-shopping has no keyword violations", function testCleanExample() {

  //variables
  let workflow = null; //doc
  let result = null; //compile

  //load
  workflow = compileMod.readJsonFile(shoppingPath);

  //must compile
  result = compileMod.compileWorkflow(workflow, {
    base: shoppingPack, //pack assets
  });

  //rhai produced
  nodeAssert.match(result.rhai, /let meta = #\{/);
  nodeAssert.match(result.rhai, /fn Intake\(/);

//end testCleanExample
});

//station name using a keyword fails
nodeTest.test("rejects reserved keyword as station name", function testBadStation() {

  //variables
  let tmpDir = ""; //temp
  let promptsDir = ""; //prompts

  tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "kwst-"));
  promptsDir = nodePath.join(tmpDir, "prompts");
  nodeFs.mkdirSync(promptsDir, { recursive: true });
  nodeFs.writeFileSync(nodePath.join(promptsDir, "a.md"), "A\n", "utf8");

  try {

    nodeAssert.throws(function runCompile() {

      compileMod.compileWorkflow(
        {
          name: "kw-demo", //name
          description: "keyword violation", //desc
          stations: [
            {
              name: "switch", //reserved
              prompt: ["a.md"], //prompt
            },
          ],
        },
        { base: tmpDir }
      );

    //end run
    }, /reserved keyword|keyword "switch"|Rhai reserved keyword/i);

  } finally {

    nodeFs.rmSync(tmpDir, { recursive: true, force: true });

  //end try
  }

//end testBadStation
});

//multiple violations listed together
nodeTest.test("reports multiple keyword violations", function testMulti() {

  //variables
  let tmpDir = ""; //temp
  let promptsDir = ""; //prompts
  let err = null; //caught error

  tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "kwmul-"));
  promptsDir = nodePath.join(tmpDir, "prompts");
  nodeFs.mkdirSync(promptsDir, { recursive: true });
  nodeFs.writeFileSync(nodePath.join(promptsDir, "a.md"), "A\n", "utf8");

  try {

    try {

      compileMod.compileWorkflow(
        {
          name: "kw-multi", //name
          description: "multiple keywords", //desc
          args: {
            for: true, //reserved
          },
          stations: [
            {
              name: "match", //reserved
              prompt: ["a.md"], //prompt
            },
          ],
        },
        { base: tmpDir }
      );

      nodeAssert.fail("expected throw");

    } catch (e) {

      err = e;

    //end try
    }

    nodeAssert.match(String(err && err.message), /for/);
    nodeAssert.match(String(err && err.message), /match/);
    nodeAssert.match(String(err && err.message), /2\)|2\./);

  } finally {

    nodeFs.rmSync(tmpDir, { recursive: true, force: true });

  //end try
  }

//end testMulti
});

//keyword only inside a prompt string does not fail
nodeTest.test("prompt text containing keywords is allowed", function testStringOk() {

  //variables
  let tmpDir = ""; //temp
  let promptsDir = ""; //prompts
  let result = null; //compile

  tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "kwstr-"));
  promptsDir = nodePath.join(tmpDir, "prompts");
  nodeFs.mkdirSync(promptsDir, { recursive: true });
  nodeFs.writeFileSync(
    nodePath.join(promptsDir, "a.md"),
    "Use the switch and match carefully; this is not code.\n",
    "utf8"
  );

  try {

    result = compileMod.compileWorkflow(
      {
        name: "kw-str", //name
        description: "keywords in prompt text only", //desc
        stations: [
          {
            name: "Alpha", //ok
            prompt: ["a.md"], //contains reserved words as text
          },
        ],
      },
      { base: tmpDir }
    );

    nodeAssert.match(result.rhai, /switch and match/);

  } finally {

    nodeFs.rmSync(tmpDir, { recursive: true, force: true });

  //end try
  }

//end testStringOk
});
