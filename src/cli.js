/*
 * Command-line interface for Rhaiteous.
 * Shares compileWorkflowFile with the library API (standalone verifiability).
 */

//node builtins
import nodeProcess from "node:process";
import nodeUtil from "node:util";
import nodePath from "node:path";
import nodeFs from "node:fs";

//shared compiler
import compileMod from "./compile-workflow.js";

/*
 * @description print CLI usage to stderr
 * @returns nothing
 */
function printUsage() {

  //usage text
  const text =
    "Usage: rhaiteous <workflow.json> [options]\n" +
    "\n" +
    "Rhaiteous — compile a JSON workflow document into a Grok Build Rhai script.\n" +
    "\n" +
    "Options:\n" +
    "  -o, --out <path>   Output .rhai path (default: .grok/workflows/<name>.rhai)\n" +
    "  --stdout           Print Rhai to stdout instead of writing a file\n" +
    "  --dry-run          Compile but do not write (implies success on compile only)\n" +
    "  -h, --help         Show this help\n";

  //write help
  nodeProcess.stderr.write(text);

//end printUsage
}

/*
 * @description run the CLI against process.argv
 * @returns exit code
 */
function main() {

  //variables
  let parsed = null; //parseArgs result
  let positionals = null; //positional args
  let values = null; //flag values
  let inputPath = ""; //workflow json path
  let result = null; //compile result
  let write = true; //whether to write disk

  try {

    //parse argv
    parsed = nodeUtil.parseArgs({
      args: nodeProcess.argv.slice(2), //user args
      options: {
        out: {
          type: "string", //output path
          short: "o", //short flag
        },
        stdout: {
          type: "boolean", //print instead of write
          default: false, //default off
        },
        "dry-run": {
          type: "boolean", //compile only
          default: false, //default off
        },
        help: {
          type: "boolean", //help
          short: "h", //short flag
          default: false, //default off
        },
      },
      allowPositionals: true, //input file
    });

  } catch (err) {

    //log full stack
    console.error("failed to parse CLI arguments", err);

    //usage on parse failure
    printUsage();

    //exit code
    return 2;

  }

  //structured accessors
  positionals = parsed.positionals;
  values = parsed.values;

  //help
  if (values.help) {

    //print help
    printUsage();

    //success
    return 0;

  //end help branch
  }

  //require input path
  if (!positionals || positionals.length < 1) {

    //missing input
    nodeProcess.stderr.write("error: missing <workflow.json>\n\n");

    //usage
    printUsage();

    //exit code
    return 2;

  //end missing-input branch
  }

  //input workflow path
  inputPath = positionals[0];

  //input must exist
  if (!nodeFs.existsSync(inputPath)) {

    //missing file
    nodeProcess.stderr.write("error: file not found: " + inputPath + "\n");

    //exit code
    return 2;

  //end exists guard
  }

  //stdout or dry-run skips write
  write = !values.stdout && !values["dry-run"];

  try {

    //compile (and maybe write)
    result = compileMod.compileWorkflowFile(inputPath, {
      outPath: values.out, //optional explicit out
      write: write, //disk write flag
    });

  } catch (err) {

    //log full stack
    console.error("workflow compile failed", err);

    //failure
    return 1;

  }

  //print source to stdout when requested
  if (values.stdout) {

    //write rhai body
    nodeProcess.stdout.write(result.rhai);

  //end stdout branch
  }

  //status line on stderr so stdout stays pure for pipes
  if (values["dry-run"]) {

    //dry-run summary
    nodeProcess.stderr.write(
      "ok: compiled " + result.name + " (" + result.rhai.length + " bytes, dry-run)\n"
    );

  } else if (values.stdout) {

    //stdout mode summary
    nodeProcess.stderr.write(
      "ok: compiled " + result.name + " (" + result.rhai.length + " bytes, stdout)\n"
    );

  } else {

    //wrote file
    nodeProcess.stderr.write(
      "ok: wrote " + nodePath.resolve(result.outputPath) + "\n"
    );

  //end status branch
  }

  //success
  return 0;

//end main
}

//run and set exit code
nodeProcess.exitCode = main();
