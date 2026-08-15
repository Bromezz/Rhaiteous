/*
 * Initialize a host project: create workflows/, seed example-* packs from
 * the installed package (or monorepo examples/), and sandbox .gitignore.
 */

//node builtins
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeUrl from "node:url";

//this module lives in package src/
const packageRoot = nodePath.resolve(
  nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url)),
  ".."
);

/*
 * @description copy a directory tree (files and dirs)
 * @param src - source directory
 * @param dest - destination directory
 * @returns nothing
 */
function copyDir(src, dest) {

  //ensure dest
  nodeFs.mkdirSync(dest, {
    recursive: true, //parents
  });

  //entries
  const entries = nodeFs.readdirSync(src, {
    withFileTypes: true, //dirs vs files
  });

  //walk
  let i = 0;

  //each entry
  while (i < entries.length) {

    //entry
    const e = entries[i];
    const from = nodePath.join(src, e.name);
    const to = nodePath.join(dest, e.name);

    //directory
    if (e.isDirectory()) {

      //recurse
      copyDir(from, to);

    } else if (e.isFile()) {

      //skip compile products in seeds (keep human README.md)
      if (e.name === "workflow.rhai" || e.name === "workflow.md") {

        //next
        i += 1;
        continue;

      //end skip artifacts
      }

      //copy file
      nodeFs.copyFileSync(from, to);

    //end file
    }

    //next
    i += 1;

  //end walk
  }

//end copyDir
}

/*
 * @description list immediate subdirectory names
 * @param dir - directory path
 * @returns string array of names
 */
function listSubdirs(dir) {

  //missing
  if (!nodeFs.existsSync(dir)) {

    //empty
    return [];

  //end missing
  }

  //filter dirs
  return nodeFs
    .readdirSync(dir, {
      withFileTypes: true, //types
    })
    .filter(function onlyDir(e) {

      //directory
      return e.isDirectory();

    //end filter
    })
    .map(function nameOf(e) {

      //name
      return e.name;

    //end map
    });

//end listSubdirs
}

/*
 * @description resolve seed packs shipped with this package
 * Prefers package workflows/example-* (npm tarball). Falls back to
 * examples/example-* when developing this monorepo without prepack map.
 * @returns { packageRoot, seedsRoot, seedIds }
 */
function resolveSeedCatalog() {

  //variables
  let workflowsRoot = ""; //package workflows/
  let examplesRoot = ""; //repo examples/
  let ids = null; //seed names
  let seedsRoot = ""; //chosen root

  //npm layout
  workflowsRoot = nodePath.join(packageRoot, "workflows");
  ids = listSubdirs(workflowsRoot).filter(function isExample(n) {

    //product seed prefix
    return n.startsWith("example-");

  //end filter
  });

  //use workflows/ when seeds present
  if (ids.length > 0) {

    //npm / prepack layout
    return {
      packageRoot: packageRoot, //install root
      seedsRoot: workflowsRoot, //source of packs
      seedIds: ids.sort(), //stable order
      source: "workflows", //label
    };

  //end workflows branch
  }

  //monorepo fallback
  examplesRoot = nodePath.join(packageRoot, "examples");
  ids = listSubdirs(examplesRoot).filter(function isExample(n) {

    //prefix
    return n.startsWith("example-");

  //end filter
  });

  //must have seeds
  if (ids.length === 0) {

    //fail closed
    throw new Error(
      "no example-* seed packs found under " +
        workflowsRoot +
        " or " +
        examplesRoot +
        " (reinstall rhaiteous@0.4.1+ or run npm run map:workflows in the monorepo)"
    );

  //end empty
  }

  //examples catalog
  return {
    packageRoot: packageRoot, //root
    seedsRoot: examplesRoot, //git catalog
    seedIds: ids.sort(), //ids
    source: "examples", //label
  };

//end resolveSeedCatalog
}

/*
 * @description ensure host .gitignore mentions workflows/ sandbox
 * @param hostRoot - project root
 * @param options - { writeGitignore?: boolean }
 * @returns { path, action: "created"|"updated"|"skipped"|"unchanged" }
 */
function ensureGitignore(hostRoot, options) {

  //variables
  let giPath = ""; //file path
  let existing = ""; //current text
  let block = ""; //rhaiteous block
  let writeGitignore = true; //default on

  //options
  if (options && options.writeGitignore === false) {

    //skip
    writeGitignore = false;

  //end flag
  }

  //skip
  if (!writeGitignore) {

    //report
    return {
      path: null, //none
      action: "skipped", //skipped
    };

  //end skip
  }

  //path
  giPath = nodePath.join(hostRoot, ".gitignore");

  //block to ensure
  block =
    "\n# Rhaiteous: workflow pack mount (local by default; promote deliberately)\n" +
    "workflows/\n" +
    "# If you track workflows/, exclude product seeds:\n" +
    "# workflows/example-*/\n";

  //create
  if (!nodeFs.existsSync(giPath)) {

    //write
    nodeFs.writeFileSync(giPath, block.trimStart(), "utf8");

    //created
    return {
      path: giPath, //path
      action: "created", //new file
    };

  //end create
  }

  //read
  existing = nodeFs.readFileSync(giPath, "utf8");

  //already has workflows/ rule (simple contains)
  if (/(^|[\r\n])workflows\/([\r\n]|$)/.test(existing)) {

    //unchanged
    return {
      path: giPath, //path
      action: "unchanged", //already present
    };

  //end unchanged
  }

  //append
  if (existing.length > 0 && !existing.endsWith("\n")) {

    //newline first
    existing += "\n";

  //end nl
  }

  //write
  nodeFs.writeFileSync(giPath, existing + block, "utf8");

  //updated
  return {
    path: giPath, //path
    action: "updated", //appended
  };

//end ensureGitignore
}

/*
 * @description initialize host project workflows/ from package seeds
 * @param options - {
 *   hostRoot?: string,
 *   force?: boolean,
 *   writeGitignore?: boolean,
 *   only?: string[]  // optional seed ids without path
 * }
 * @returns report object
 */
function initProject(options) {

  //variables
  let hostRoot = ""; //project root
  let force = false; //overwrite example-*
  let catalog = null; //seed catalog
  let hostWorkflows = ""; //./workflows
  let copied = []; //copied ids
  let skipped = []; //skipped ids
  let only = null; //filter
  let i = 0; //index
  let id = ""; //seed id
  let src = ""; //source pack
  let dest = ""; //dest pack
  let gi = null; //gitignore result

  //normalize options
  if (!options || typeof options !== "object") {

    //empty
    options = {};

  //end default
  }

  //host root
  hostRoot =
    typeof options.hostRoot === "string" && options.hostRoot.length > 0
      ? nodePath.resolve(options.hostRoot)
      : process.cwd();

  //force
  force = options.force === true;

  //only filter
  if (Array.isArray(options.only) && options.only.length > 0) {

    //list
    only = options.only;

  //end only
  }

  //catalog
  catalog = resolveSeedCatalog();

  //filter ids
  if (only) {

    //intersect
    catalog = {
      packageRoot: catalog.packageRoot, //root
      seedsRoot: catalog.seedsRoot, //root
      seedIds: catalog.seedIds.filter(function keep(id) {

        //in only
        return only.indexOf(id) >= 0;

      //end filter
      }),
      source: catalog.source, //label
    };

    //must keep some
    if (catalog.seedIds.length === 0) {

      //fail
      throw new Error(
        "none of the requested packs found in seed catalog: " + only.join(", ")
      );

    //end empty only
    }

  //end only branch
  }

  //create workflows mount
  hostWorkflows = nodePath.join(hostRoot, "workflows");
  nodeFs.mkdirSync(hostWorkflows, {
    recursive: true, //create
  });

  //copy each seed
  i = 0;

  //walk seeds
  while (i < catalog.seedIds.length) {

    //id
    id = catalog.seedIds[i];
    src = nodePath.join(catalog.seedsRoot, id);
    dest = nodePath.join(hostWorkflows, id);

    //must be a pack
    if (!nodeFs.existsSync(nodePath.join(src, "workflow.json"))) {

      //skip broken
      skipped.push({
        id: id, //name
        reason: "source missing workflow.json", //why
      });
      i += 1;
      continue;

    //end missing json
    }

    //exists and not force
    if (nodeFs.existsSync(dest) && !force) {

      //skip
      skipped.push({
        id: id, //name
        reason: "already exists (use --force to overwrite example seeds)", //why
      });
      i += 1;
      continue;

    //end skip existing
    }

    //remove dest when force
    if (nodeFs.existsSync(dest) && force) {

      //rm
      nodeFs.rmSync(dest, {
        recursive: true, //tree
        force: true, //ok missing
      });

    //end force rm
    }

    //copy
    copyDir(src, dest);

    //ensure output dir
    nodeFs.mkdirSync(nodePath.join(dest, "output"), {
      recursive: true, //ok
    });

    //record
    copied.push(id);

    //next
    i += 1;

  //end seed walk
  }

  //gitignore
  gi = ensureGitignore(hostRoot, options);

  //report
  return {
    hostRoot: hostRoot, //project
    hostWorkflows: hostWorkflows, //mount
    packageRoot: catalog.packageRoot, //pkg
    seedsRoot: catalog.seedsRoot, //seeds source
    seedSource: catalog.source, //workflows|examples
    seedIds: catalog.seedIds, //available
    copied: copied, //written
    skipped: skipped, //left alone
    gitignore: gi, //gi report
  };

//end initProject
}

//public API
export default {
  initProject: initProject,
  resolveSeedCatalog: resolveSeedCatalog,
  ensureGitignore: ensureGitignore,
  packageRoot: packageRoot,
};
