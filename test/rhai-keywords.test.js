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

  //rhai produced (skinny forum-runner — stations dispatched by name)
  nodeAssert.match(result.rhai, /let meta = #\{/);
  nodeAssert.match(result.rhai, /make_post_schema/);
  nodeAssert.match(result.rhai, /title: "Intake"/);
  nodeAssert.match(result.rhai, /fn run_station\(/);
  nodeAssert.match(result.rhai, /fn load_workflow_doc\(/);

//end testCleanExample
});

function writeKwPack(tmpDir) {
  const stations = nodePath.join(tmpDir, "stations");
  nodeFs.mkdirSync(stations, { recursive: true });
  nodeFs.writeFileSync(nodePath.join(stations, "a.prompt.md"), "A\n", "utf8");
}

//station name using a keyword fails
nodeTest.test("rejects reserved keyword as station name", function testBadStation() {
  let tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "kwst-"));
  writeKwPack(tmpDir);

  try {
    nodeAssert.throws(function runCompile() {
      compileMod.compileWorkflow(
        {
          name: "kw-demo",
          description: "keyword violation",
          args: { station_dir: "stations" },
          prompts: { a: "a.prompt.md" },
          stations: [{ name: "switch", prompt: ["a"] }],
        },
        { base: tmpDir }
      );
    }, /reserved keyword|keyword "switch"|Rhai reserved keyword/i);
  } finally {
    nodeFs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

//multiple violations listed together
nodeTest.test("reports multiple keyword violations", function testMulti() {
  let tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "kwmul-"));
  let err = null;
  writeKwPack(tmpDir);

  try {
    try {
      compileMod.compileWorkflow(
        {
          name: "kw-multi",
          description: "multiple keywords",
          args: {
            station_dir: "stations",
            for: true, // reserved arg name
          },
          prompts: { a: "a.prompt.md" },
          stations: [{ name: "match", prompt: ["a"] }],
        },
        { base: tmpDir }
      );
      nodeAssert.fail("expected throw");
    } catch (e) {
      err = e;
    }

    nodeAssert.match(String(err && err.message), /for/);
    nodeAssert.match(String(err && err.message), /match/);
    nodeAssert.match(String(err && err.message), /2\)|2\./);
  } finally {
    nodeFs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

//keyword only inside a prompt file does not fail (prompts are not grafted into IR)
nodeTest.test("prompt text containing keywords is allowed", function testStringOk() {
  let tmpDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "kwstr-"));
  const stations = nodePath.join(tmpDir, "stations");
  nodeFs.mkdirSync(stations, { recursive: true });
  nodeFs.writeFileSync(
    nodePath.join(stations, "a.prompt.md"),
    "Use the switch and match carefully; this is not code.\n",
    "utf8"
  );

  try {
    const result = compileMod.compileWorkflow(
      {
        name: "kw-str",
        description: "keywords in prompt text only",
        args: { station_dir: "stations" },
        prompts: { a: "a.prompt.md" },
        stations: [{ name: "Alpha", prompt: ["a"] }],
      },
      { base: tmpDir }
    );

    nodeAssert.match(result.rhai, /fn prepare_assets\(/);
    nodeAssert.doesNotMatch(result.rhai, /switch and match/);
  } finally {
    nodeFs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
