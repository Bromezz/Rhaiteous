/*
 * Clone a host workflow pack to a new name without runtime/build artifacts.
 */

//node builtins
import nodeFs from "node:fs";
import nodePath from "node:path";

/*
 * @description validate pack / workflow id (same rules as workflow.name)
 * @param name - candidate id
 * @param label - for error text
 * @returns name when valid
 */
function assertPackName(name, label) {

  //pattern matches compile-workflow assertWorkflowName
  const pattern = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/;

  //type
  if (typeof name !== "string" || name.length === 0) {

    //missing
    throw new Error(label + " must be a non-empty string");

  //end type
  }

  //shape
  if (!pattern.test(name)) {

    //bad
    throw new Error(
      label +
        " must be lowercase letters, digits, hyphens (got " +
        name +
        ")"
    );

  //end shape
  }

  //ok
  return name;

//end assertPackName
}

/*
 * @description whether a relative path under the pack should be skipped
 * @param relPosix - relative path with /
 * @returns true to skip
 */
function shouldSkipRel(relPosix) {

  //compile products at pack root
  if (relPosix === "workflow.rhai" || relPosix === "workflow.md") {

    //skip
    return true;

  //end compile products
  }

  //entire output tree (recreate empty later)
  if (relPosix === "output" || relPosix.startsWith("output/")) {

    //skip
    return true;

  //end output
  }

  //keep
  return false;

//end shouldSkipRel
}

/*
 * @description copy pack tree skipping artifacts
 * @param srcRoot - source pack abs
 * @param destRoot - destination pack abs
 * @returns list of relative paths copied
 */
function copyPackFiltered(srcRoot, destRoot) {

  //results
  const copied = [];

  /*
   * @description walk
   * @param rel - relative posix-ish under pack
   * @returns nothing
   */
  function walk(rel) {

    //abs
    const from = rel ? nodePath.join(srcRoot, rel) : srcRoot;
    const st = nodeFs.statSync(from);
    const relPosix = rel.split(nodePath.sep).join("/");

    //skip filtered
    if (rel && shouldSkipRel(relPosix)) {

      //done
      return;

    //end skip
    }

    //directory
    if (st.isDirectory()) {

      //ensure dest dir
      const toDir = rel ? nodePath.join(destRoot, rel) : destRoot;
      nodeFs.mkdirSync(toDir, {
        recursive: true, //parents
      });

      //children
      const names = nodeFs.readdirSync(from);
      let i = 0;

      //each
      while (i < names.length) {

        //child rel
        const childRel = rel
          ? nodePath.join(rel, names[i])
          : names[i];

        //recurse
        walk(childRel);

        //next
        i += 1;

      //end each
      }

      //done dir
      return;

    //end directory
    }

    //file
    if (st.isFile()) {

      //dest
      const to = nodePath.join(destRoot, rel);
      nodeFs.mkdirSync(nodePath.dirname(to), {
        recursive: true, //parents
      });
      nodeFs.copyFileSync(from, to);
      copied.push(relPosix);

    //end file
    }

  //end walk
  }

  //start
  walk("");

  //list
  return copied;

//end copyPackFiltered
}

/*
 * @description rewrite workflow.json name and pack-path args
 * @param workflow - parsed object
 * @param sourceId - old pack id
 * @param destId - new pack id
 * @returns mutated workflow
 */
function rewriteWorkflowJson(workflow, sourceId, destId) {

  //name
  workflow.name = destId;

  //args map
  if (workflow.args && typeof workflow.args === "object") {

    //keys
    const keys = Object.keys(workflow.args);
    let i = 0;
    const fromPrefix = "workflows/" + sourceId + "/";
    const toPrefix = "workflows/" + destId + "/";

    //each arg
    while (i < keys.length) {

      //key
      const k = keys[i];
      const v = workflow.args[k];

      //string path rewrite
      if (typeof v === "string" && v.includes(fromPrefix)) {

        //replace all occurrences of old pack prefix
        workflow.args[k] = v.split(fromPrefix).join(toPrefix);

      //end string
      }

      //next
      i += 1;

    //end each
    }

    //canonical dirs
    workflow.args.station_dir = "workflows/" + destId + "/stations";
    workflow.args.out_dir = "workflows/" + destId + "/output";

  //end args
  }

  //ok
  return workflow;

//end rewriteWorkflowJson
}

/*
 * @description clone a pack under host workflows/
 * @param options - { hostRoot?, source, destination }
 * @returns report object
 */
function clonePack(options) {

  //options
  const opts = options && typeof options === "object" ? options : {};

  //ids
  const sourceId = assertPackName(opts.source, "source");
  const destId = assertPackName(opts.destination, "destination");

  //same
  if (sourceId === destId) {

    //reject
    throw new Error("source and destination must be different pack names");

  //end same
  }

  //host
  const hostRoot =
    typeof opts.hostRoot === "string" && opts.hostRoot.length > 0
      ? nodePath.resolve(opts.hostRoot)
      : process.cwd();

  //paths
  const srcRoot = nodePath.join(hostRoot, "workflows", sourceId);
  const destRoot = nodePath.join(hostRoot, "workflows", destId);
  const srcJson = nodePath.join(srcRoot, "workflow.json");

  //source exists
  if (!nodeFs.existsSync(srcRoot) || !nodeFs.statSync(srcRoot).isDirectory()) {

    //missing
    throw new Error("source pack not found: " + srcRoot);

  //end missing source
  }

  //need workflow.json
  if (!nodeFs.existsSync(srcJson)) {

    //missing json
    throw new Error("source pack missing workflow.json: " + srcJson);

  //end missing json
  }

  //destination must not exist
  if (nodeFs.existsSync(destRoot)) {

    //exists
    throw new Error(
      "destination pack already exists: " +
        destRoot +
        " (remove it or choose another name)"
    );

  //end exists
  }

  //copy filtered
  const copied = copyPackFiltered(srcRoot, destRoot);

  //rewrite json
  const raw = nodeFs.readFileSync(nodePath.join(destRoot, "workflow.json"), "utf8");
  const workflow = JSON.parse(raw);
  rewriteWorkflowJson(workflow, sourceId, destId);
  nodeFs.writeFileSync(
    nodePath.join(destRoot, "workflow.json"),
    JSON.stringify(workflow, null, 2) + "\n",
    "utf8"
  );

  //empty output shell
  const outDir = nodePath.join(destRoot, "output");
  nodeFs.mkdirSync(outDir, {
    recursive: true, //parents
  });
  const gitkeep = nodePath.join(outDir, ".gitkeep");
  if (!nodeFs.existsSync(gitkeep)) {

    //placeholder
    nodeFs.writeFileSync(gitkeep, "", "utf8");

  //end gitkeep
  }

  //ensure input dir exists even if source had none
  nodeFs.mkdirSync(nodePath.join(destRoot, "input"), {
    recursive: true, //parents
  });

  //report
  return {
    hostRoot: hostRoot, //project
    source: sourceId, //from
    destination: destId, //to
    sourceDir: srcRoot, //abs
    destinationDir: destRoot, //abs
    copied: copied, //rel paths
  };

//end clonePack
}

//exports
export default {
  clonePack: clonePack,
  assertPackName: assertPackName,
  rewriteWorkflowJson: rewriteWorkflowJson,
  shouldSkipRel: shouldSkipRel,
};
