/*
 * Command-line interface for Rhaiteous.
 * Subcommands: init, compile; bare path compiles a workflow JSON file.
 */

//node builtins
import nodeProcess from "node:process";
import nodeUtil from "node:util";
import nodePath from "node:path";
import nodeFs from "node:fs";

//shared modules
import compileMod from "./compile-workflow.js";
import initMod from "./init-project.js";
import cloneMod from "./clone-pack.js";

/*
 * @description print install verification / docs pointer to stderr
 * @returns nothing
 */
function printUsage() {

  //docs only — full usage lives in the README
  const text =
    "Rhaiteous is available.\n" +
    "Documentation: https://github.com/Bromezz/Rhaiteous#readme\n";

  //write help
  nodeProcess.stderr.write(text);

//end printUsage
}

/*
 * @description run init subcommand
 * @param argv - args after "init"
 * @returns exit code
 */
function runInit(argv) {

  //variables
  let parsed = null; //parseArgs
  let values = null; //flags
  let report = null; //init report
  let i = 0; //index

  try {

    //parse
    parsed = nodeUtil.parseArgs({
      args: argv, //after init
      options: {
        force: {
          type: "boolean", //overwrite seeds
          default: false, //default
        },
        "no-gitignore": {
          type: "boolean", //skip gi
          default: false, //default
        },
        dir: {
          type: "string", //host root
        },
        help: {
          type: "boolean", //help
          short: "h", //short
          default: false, //default
        },
      },
      allowPositionals: true, //unused
    });

  } catch (err) {

    //log
    console.error("failed to parse init arguments", err);

    //usage
    printUsage();

    //code
    return 2;

  }

  //values
  values = parsed.values;

  //help
  if (values.help) {

    //print
    printUsage();

    //ok
    return 0;

  //end help
  }

  try {

    //init
    report = initMod.initProject({
      hostRoot: values.dir, //optional
      force: values.force, //overwrite
      writeGitignore: !values["no-gitignore"], //gi
    });

  } catch (err) {

    //log
    console.error("rhaiteous init failed", err);

    //fail
    return 1;

  }

  //status
  nodeProcess.stderr.write(
    "ok: workflows mount " + nodePath.resolve(report.hostWorkflows) + "\n"
  );
  nodeProcess.stderr.write(
    "ok: seeds from package " +
      report.seedSource +
      " (" +
      report.seedsRoot +
      ")\n"
  );

  //copied
  i = 0;

  //each copied
  while (i < report.copied.length) {

    //line
    nodeProcess.stderr.write("ok: seeded " + report.copied[i] + "\n");

    //next
    i += 1;

  //end copied
  }

  //skipped
  i = 0;

  //each skipped
  while (i < report.skipped.length) {

    //line
    nodeProcess.stderr.write(
      "skip: " +
        report.skipped[i].id +
        " — " +
        report.skipped[i].reason +
        "\n"
    );

    //next
    i += 1;

  //end skipped
  }

  //gitignore
  if (report.gitignore && report.gitignore.action === "created") {

    //line
    nodeProcess.stderr.write(
      "ok: created " + nodePath.resolve(report.gitignore.path) + "\n"
    );

  } else if (report.gitignore && report.gitignore.action === "updated") {

    //line
    nodeProcess.stderr.write(
      "ok: updated " + nodePath.resolve(report.gitignore.path) + "\n"
    );

  //end gi
  }

  //hint
  if (report.copied.length > 0 || report.seedIds.length > 0) {

    //next step
    nodeProcess.stderr.write(
      "next: npx rhaiteous compile " +
        (report.copied[0] || report.seedIds[0]) +
        "\n"
    );

  //end hint
  }

  //ok
  return 0;

//end runInit
}

/*
 * @description resolve pack directory under host workflows/
 * @param packName - example-office-shopping or path
 * @param hostRoot - project root
 * @returns absolute pack directory
 */
function resolvePackDir(packName, hostRoot) {

  //variables
  let packDir = ""; //resolved

  //absolute or relative path containing workflow.json
  if (
    packName.indexOf("/") >= 0 ||
    packName.indexOf("\\") >= 0 ||
    packName.endsWith("workflow.json")
  ) {

    //path-like
    packDir = nodePath.resolve(hostRoot, packName);

    //if file, use dirname
    if (
      nodeFs.existsSync(packDir) &&
      nodeFs.statSync(packDir).isFile()
    ) {

      //dir of file
      return nodePath.dirname(packDir);

    //end file
    }

    //dir
    return packDir;

  //end path-like
  }

  //pack name under workflows/
  return nodePath.join(hostRoot, "workflows", packName);

//end resolvePackDir
}

/*
 * @description run compile for a pack name or workflow.json path
 * @param argv - args (first may be pack name)
 * @returns exit code
 */
function runCompile(argv) {

  //variables
  let parsed = null; //parse
  let positionals = null; //pos
  let values = null; //flags
  let packName = ""; //name
  let hostRoot = ""; //cwd
  let packDir = ""; //pack
  let inputPath = ""; //json
  let outPath = ""; //rhai
  let basePath = ""; //base
  let result = null; //compile
  let write = true; //disk
  let grokPath = ""; //grok ir
  let publishGrok = true; //default on for pack compile

  try {

    //parse
    parsed = nodeUtil.parseArgs({
      args: argv, //args
      options: {
        out: {
          type: "string", //out
          short: "o", //short
        },
        base: {
          type: "string", //base
          short: "b", //short
        },
        stdout: {
          type: "boolean", //stdout
          default: false, //off
        },
        "dry-run": {
          type: "boolean", //dry
          default: false, //off
        },
        "no-grok": {
          type: "boolean", //skip grok
          default: false, //off
        },
        help: {
          type: "boolean", //help
          short: "h", //short
          default: false, //off
        },
      },
      allowPositionals: true, //pack name
    });

  } catch (err) {

    //log
    console.error("failed to parse compile arguments", err);

    //usage
    printUsage();

    //code
    return 2;

  }

  //accessors
  positionals = parsed.positionals;
  values = parsed.values;

  //help
  if (values.help) {

    //print
    printUsage();

    //ok
    return 0;

  //end help
  }

  //need pack name or path
  if (!positionals || positionals.length < 1) {

    //missing
    nodeProcess.stderr.write("error: missing <pack-name> or <workflow.json>\n\n");

    //usage
    printUsage();

    //code
    return 2;

  //end missing
  }

  //name
  packName = positionals[0];
  hostRoot = process.cwd();

  //resolve pack
  packDir = resolvePackDir(packName, hostRoot);

  //workflow.json path
  if (packName.endsWith(".json") || packName.endsWith("workflow.json")) {

    //explicit file
    inputPath = nodePath.resolve(hostRoot, packName);

  } else {

    //pack convention
    inputPath = nodePath.join(packDir, "workflow.json");

  //end input path
  }

  //exists
  if (!nodeFs.existsSync(inputPath)) {

    //missing
    nodeProcess.stderr.write(
      "error: workflow not found: " +
        inputPath +
        "\n(run: npx rhaiteous init)\n"
    );

    //code
    return 2;

  //end exists
  }

  //base default = pack dir
  basePath =
    typeof values.base === "string" && values.base.length > 0
      ? values.base
      : packDir;

  //out default = pack workflow.rhai
  outPath =
    typeof values.out === "string" && values.out.length > 0
      ? values.out
      : nodePath.join(packDir, "workflow.rhai");

  //write flags
  write = !values.stdout && !values["dry-run"];
  publishGrok = !values["no-grok"] && write && !values.stdout;

  try {

    //always pass outPath for md path resolution; write flag controls disk
    result = compileMod.compileWorkflowFile(inputPath, {
      outPath: outPath, //rhai path
      base: basePath, //assets
      write: write, //disk
    });

  } catch (err) {

    //log
    console.error("workflow compile failed", err);

    //fail
    return 1;

  }

  //stdout body
  if (values.stdout) {

    //write rhai
    nodeProcess.stdout.write(result.rhai);

  //end stdout
  }

  //publish Grok discovery IR before the success summary
  if (publishGrok && result && result.name) {

    //path
    grokPath = nodePath.resolve(
      hostRoot,
      ".grok",
      "workflows",
      result.name + ".rhai"
    );

    try {

      //mkdir
      nodeFs.mkdirSync(nodePath.dirname(grokPath), {
        recursive: true, //parents
      });

      //write
      nodeFs.writeFileSync(grokPath, result.rhai, "utf8");

    } catch (err) {

      //warn but success compile
      console.error("warning: failed to write Grok IR " + grokPath, err);
      grokPath = "";

    //end grok write
    }

  //end publish grok
  }

  //friendly confirmation (enough detail for a human or agent)
  if (values["dry-run"]) {

    //dry
    nodeProcess.stderr.write(
      "ok: compile succeeded (dry-run) for workflow \"" +
        result.name +
        "\"\n" +
        "ok: source  " +
        nodePath.resolve(inputPath) +
        "\n" +
        "ok: would write pack IR + workflow.md; no files written\n" +
        "ok: Rhai size " +
        result.rhai.length +
        " bytes\n"
    );

  } else if (values.stdout) {

    //stdout
    nodeProcess.stderr.write(
      "ok: compile succeeded for workflow \"" +
        result.name +
        "\" (Rhai printed to stdout)\n" +
        "ok: source  " +
        nodePath.resolve(inputPath) +
        "\n" +
        "ok: Rhai size " +
        result.rhai.length +
        " bytes\n"
    );

  } else {

    //disk write summary
    nodeProcess.stderr.write(
      "ok: compile succeeded for workflow \"" + result.name + "\"\n"
    );
    nodeProcess.stderr.write(
      "ok: source  " + nodePath.resolve(inputPath) + "\n"
    );
    nodeProcess.stderr.write(
      "ok: wrote   " +
        nodePath.resolve(result.outputPath) +
        "  (pack IR — do not hand-edit)\n"
    );

    //md paths
    if (Array.isArray(result.workflowMdPaths)) {

      //each
      result.workflowMdPaths.forEach(function logMd(p) {

        //line
        nodeProcess.stderr.write(
          "ok: wrote   " +
            nodePath.resolve(p) +
            "  (human guide — do not hand-edit)\n"
        );

      //end forEach
      });

    //end md
    }

    //grok discovery
    if (publishGrok && grokPath) {

      //line
      nodeProcess.stderr.write(
        "ok: wrote   " +
          grokPath +
          "  (Grok Build discovery path)\n"
      );

    //end grok line
    }

    //how to run
    nodeProcess.stderr.write(
      "next: in Grok Build (workspace = this project root), run:\n" +
        "      /workflow " +
        result.name +
        " {}\n"
    );

  //end disk summary
  }

  //ok
  return 0;

//end runCompile
}

/*
 * @description run clonepack subcommand
 * @param argv - args after "clonepack"
 * @returns exit code
 */
function runClonePack(argv) {

  //variables
  let parsed = null; //parse
  let positionals = null; //pos
  let values = null; //flags
  let source = ""; //from
  let destination = ""; //to
  let posIndex = 0; //consume positionals
  let report = null; //result

  try {

    //parse
    parsed = nodeUtil.parseArgs({
      args: argv, //after clonepack
      options: {
        source: {
          type: "string", //pack id
        },
        destination: {
          type: "string", //pack id
        },
        dir: {
          type: "string", //host root
        },
        help: {
          type: "boolean", //help
          short: "h", //short
          default: false, //default
        },
      },
      allowPositionals: true, //source dest
    });

  } catch (err) {

    //log
    console.error("failed to parse clonepack arguments", err);

    //usage
    printUsage();

    //code
    return 2;

  }

  //accessors
  positionals = parsed.positionals || [];
  values = parsed.values;

  //help
  if (values.help) {

    //print
    printUsage();

    //ok
    return 0;

  //end help
  }

  //source: flag or next positional
  source = typeof values.source === "string" ? values.source : "";
  if (!source && posIndex < positionals.length) {

    //from positional
    source = positionals[posIndex];
    posIndex += 1;

  //end source positional
  }

  //destination: flag or next positional
  destination =
    typeof values.destination === "string" ? values.destination : "";
  if (!destination && posIndex < positionals.length) {

    //from positional
    destination = positionals[posIndex];
    posIndex += 1;

  //end destination positional
  }

  //extra positionals
  if (posIndex < positionals.length) {

    //error
    nodeProcess.stderr.write(
      "error: unexpected argument: " + positionals[posIndex] + "\n\n"
    );

    //usage
    printUsage();

    //code
    return 2;

  //end extra
  }

  //need both
  if (!source || !destination) {

    //missing
    nodeProcess.stderr.write(
      "error: clonepack requires --source and --destination " +
        "(or two positional pack names)\n\n"
    );

    //usage
    printUsage();

    //code
    return 2;

  //end missing
  }

  try {

    //clone
    report = cloneMod.clonePack({
      hostRoot: values.dir, //optional
      source: source, //from
      destination: destination, //to
    });

  } catch (err) {

    //log
    console.error("rhaiteous clonepack failed", err);

    //fail
    return 1;

  }

  //status
  nodeProcess.stderr.write(
    "ok: cloned " +
      report.source +
      " → " +
      report.destination +
      "\n" +
      "ok: " +
      report.destinationDir +
      "\n" +
      "next: npx rhaiteous compile " +
      report.destination +
      "\n"
  );

  //ok
  return 0;

//end runClonePack
}

/*
 * @description run the CLI against process.argv
 * @returns exit code
 */
function main() {

  //variables
  let argv = null; //user args
  let cmd = ""; //subcommand or path

  //args
  argv = nodeProcess.argv.slice(2);

  //empty → help
  if (!argv || argv.length === 0) {

    //usage
    printUsage();

    //code
    return 2;

  //end empty
  }

  //first token
  cmd = argv[0];

  //help flags
  if (cmd === "-h" || cmd === "--help" || cmd === "help") {

    //print
    printUsage();

    //ok
    return 0;

  //end help
  }

  //init
  if (cmd === "init") {

    //run
    return runInit(argv.slice(1));

  //end init
  }

  //compile subcommand
  if (cmd === "compile") {

    //run
    return runCompile(argv.slice(1));

  //end compile
  }

  //clonepack subcommand
  if (cmd === "clonepack") {

    //run
    return runClonePack(argv.slice(1));

  //end clonepack
  }

  //legacy / explicit: first arg is workflow.json path
  if (
    cmd.endsWith(".json") ||
    cmd.endsWith(".workflow.json") ||
    nodeFs.existsSync(cmd)
  ) {

    //treat full argv as compile path form
    return runCompile(argv);

  //end legacy file
  }

  //unknown command — if it looks like a pack name, compile it
  if (/^[A-Za-z0-9._-]+$/.test(cmd)) {

    //pack name convenience: rhaiteous example-office-shopping
    return runCompile(argv);

  //end pack name
  }

  //unknown
  nodeProcess.stderr.write("error: unknown command: " + cmd + "\n\n");

  //usage
  printUsage();

  //code
  return 2;

//end main
}

//run and set exit code
nodeProcess.exitCode = main();
