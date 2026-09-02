/*
 * Compile a JSON workflow document into a Grok Build Rhai workflow script.
 * Authors maintain JSON + real JSON Schema files; this module emits Rhai IR.
 */

//node filesystem and path
import nodeFs from "node:fs";
import nodePath from "node:path";

//local emitters
import jsonToRhaiMod from "./json-to-rhai.js";
import rhaiKeywordsMod from "./rhai-keywords.js";
import schemaInlineMod from "./schema-inline.js";
import { emitForumRunnerScript } from "./emit-thread-workflow.js";

//active compile context for keyword collection (set only during compileWorkflow)
let activeKeywordCtx = null; //ctx with keywordViolations[]

/*
 * @description validate that a name is a safe Rhai / workflow identifier
 * @param name - candidate identifier
 * @param label - field name for errors
 * @returns the same name when valid
 */
function assertIdent(name, label) {

  //variables
  const pattern = /^[A-Za-z_][A-Za-z0-9_]*$/; //rhai-friendly ident
  let ctx = activeKeywordCtx; //optional violation collector

  //require a string
  if (typeof name !== "string" || name.length === 0) {

    //missing identifier
    throw new Error(label + " must be a non-empty string");

  //end type guard
  }

  //require pattern match
  if (!pattern.test(name)) {

    //illegal characters
    throw new Error(label + " must match " + pattern + " (got " + name + ")");

  //end pattern guard
  }

  //reserved Rhai keyword cannot be an identifier
  if (rhaiKeywordsMod.isReservedKeyword(name)) {

    //collect all hits when compiling
    if (ctx && Array.isArray(ctx.keywordViolations)) {

      //record without aborting yet
      ctx.keywordViolations.push({
        name: name, //keyword
        label: label, //origin
        detail: "cannot be used as a Rhai identifier (binding, arg, path, …)", //detail
      });

    } else {

      //standalone use → fail immediately
      throw new Error(
        label + " uses reserved Rhai keyword \"" + name + "\" " +
        "(see src/data/rhai-keywords.txt)"
      );

    //end collect vs throw
    }

  //end keyword guard
  }

  //return the validated name
  return name;

//end assertIdent
}

/*
 * @description validate workflow meta.name for Grok discovery (hyphenated)
 * @param name - workflow name
 * @returns the same name when valid
 */
function assertWorkflowName(name) {

  //variables
  const pattern = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/; //grok meta.name style

  //require a string
  if (typeof name !== "string" || name.length === 0) {

    //missing name
    throw new Error("workflow name must be a non-empty string");

  //end type guard
  }

  //require hyphenated lowercase form
  if (!pattern.test(name)) {

    //bad workflow name
    throw new Error("workflow name must be lowercase letters, digits, hyphens (got " + name + ")");

  //end pattern guard
  }

  //return the validated name
  return name;

//end assertWorkflowName
}

/*
 * @description read and parse a JSON file from disk
 * @param filePath - absolute or relative path
 * @returns parsed JSON value
 */
function readJsonFile(filePath) {

  //variables
  let raw = ""; //file text
  let parsed = null; //parsed value

  try {

    //read utf-8 text
    raw = nodeFs.readFileSync(filePath, "utf8");

    //strip a leading utf-8 bom when present (windows editors often add one)
    if (raw.charCodeAt(0) === 0xfeff) {

      //drop the bom character
      raw = raw.slice(1);

    //end bom strip
    }

    //parse JSON
    parsed = JSON.parse(raw);

  } catch (err) {

    //log full stack before rethrowing
    console.error("readJsonFile failed for " + filePath, err);

    //propagate
    throw err;

  }

  //return parsed document
  return parsed;

//end readJsonFile
}

/*
 * @description resolve schemas root under an asset base
 * Prefers {base}/schemas (legacy). Pack layout: schemas live under {base}
 * (e.g. schema.json + stations/*.schema.json).
 * @param baseDir - absolute asset base
 * @returns absolute schemas directory
 */
function resolveSchemasDir(baseDir) {

  //variables
  let legacy = ""; //base/schemas
  let stations = ""; //base/stations (forum pack)

  //legacy multi-workflow base
  legacy = nodePath.join(baseDir, "schemas");

  //use schemas/ when present
  if (nodeFs.existsSync(legacy) && nodeFs.statSync(legacy).isDirectory()) {

    //legacy root
    return legacy;

  //end legacy
  }

  //forum pack: schemas live beside prompts under stations/
  stations = nodePath.join(baseDir, "stations");
  if (nodeFs.existsSync(stations) && nodeFs.statSync(stations).isDirectory()) {
    return stations;
  }

  //pack layout: asset base is the schemas boundary
  return baseDir;

//end resolveSchemasDir
}

/*
 * @description authoring stations directory ({base}/stations)
 * @param baseDir - pack root
 * @returns absolute stations directory
 */
function resolveStationsDir(baseDir) {
  let stations = nodePath.join(baseDir, "stations");
  if (!nodeFs.existsSync(stations) || !nodeFs.statSync(stations).isDirectory()) {
    throw new Error(
      "pack stations directory missing (expected *.schema.json and *.prompt.md here): " +
        stations
    );
  }
  return stations;
}

/*
 * @description bare filename under station_dir (no path segments)
 * @param rel - catalog value
 * @param label - error label
 * @returns rel when valid
 */
function assertBarePackFilename(rel, label) {
  if (typeof rel !== "string" || rel.length === 0) {
    throw new Error(label + " must be a non-empty filename");
  }
  if (
    rel.includes("/") ||
    rel.includes("\\") ||
    rel.includes("..") ||
    nodePath.isAbsolute(rel)
  ) {
    throw new Error(
      label +
        " must be a bare filename under args.station_dir (no path segments); got " +
        JSON.stringify(rel)
    );
  }
  return rel;
}

/*
 * @description resolve prompts root under an asset base
 * Prefers {base}/prompts (legacy). Pack layout: {base}/stations/*.md
 * @param baseDir - absolute asset base
 * @returns absolute prompts directory
 */
function resolvePromptsDir(baseDir) {

  //variables
  let legacy = ""; //base/prompts
  let stations = ""; //base/stations

  //legacy
  legacy = nodePath.join(baseDir, "prompts");

  //use prompts/ when present
  if (nodeFs.existsSync(legacy) && nodeFs.statSync(legacy).isDirectory()) {

    //legacy root
    return legacy;

  //end legacy
  }

  //pack layout
  stations = nodePath.join(baseDir, "stations");

  //stations holds station prompts
  if (nodeFs.existsSync(stations) && nodeFs.statSync(stations).isDirectory()) {

    //pack prompts root
    return stations;

  //end stations
  }

  //default path (load will fail with a clear missing-file error)
  return legacy;

//end resolvePromptsDir
}

/*
 * @description resolve the asset base directory (contains schemas/ and prompts/)
 * @param options - compiler options that may include base
 * @returns absolute path to the base directory
 */
function resolveBaseDir(options) {

  //variables
  let base = ""; //requested or default base

  //options may be missing
  if (!options || typeof options !== "object") {

    //empty options
    options = {};

  //end options default
  }

  //explicit base wins (absolute or relative to cwd)
  if (typeof options.base === "string" && options.base.length > 0) {

    //resolve against process cwd
    return nodePath.resolve(options.base);

  //end explicit base
  }

  //legacy alias: baseDir treated as the asset base when base is absent
  if (typeof options.baseDir === "string" && options.baseDir.length > 0) {

    //resolve against process cwd
    return nodePath.resolve(options.baseDir);

  //end legacy baseDir
  }

  //conventional project layout: ./rhaiteous under cwd
  base = "rhaiteous";

  //absolute base path
  return nodePath.resolve(process.cwd(), base);

//end resolveBaseDir
}

/*
 * @description load schema bindings from files under {base}/schemas
 * @param schemas - map of binding name → path relative to {base}/schemas
 * @param baseDir - absolute asset base (contains schemas/ and prompts/)
 * @returns map of binding name → parsed JSON schema object
 */
function loadSchemas(schemas, baseDir) {

  //variables
  const loaded = {}; //binding → schema object
  let keys = null; //schema binding names
  let i = 0; //loop index
  let key = ""; //current binding
  let rel = ""; //relative path under schemas/
  let abs = ""; //absolute path
  let doc = null; //parsed schema
  let schemasDir = ""; //absolute schemas directory

  //nothing to load
  if (!schemas || typeof schemas !== "object" || Array.isArray(schemas)) {

    //empty set
    return loaded;

  //end missing-schemas branch
  }

  //legacy {base}/schemas or pack {base}
  schemasDir = resolveSchemasDir(baseDir);

  //stable key order
  keys = Object.keys(schemas).sort();

  //load each schema file
  i = 0;

  //walk bindings
  while (i < keys.length) {

    //binding name becomes a Rhai local
    key = assertIdent(keys[i], "schema binding");

    //path value relative to schemas/
    rel = schemas[keys[i]];

    //require string path
    if (typeof rel !== "string" || rel.length === 0) {

      //bad path
      throw new Error("schema '" + key + "' path must be a non-empty string");

    //end path guard
    }

    //resolve under {base}/schemas (absolute paths still resolve correctly)
    abs = nodePath.resolve(schemasDir, rel);

    //parse the schema JSON (throws with stack on failure)
    try {

      //read and parse
      doc = readJsonFile(abs);

    } catch (err) {

      //log and wrap with schema binding context
      console.error("failed to load schema '" + key + "' from " + abs, err);

      //fail closed
      throw new Error("failed to load schema '" + key + "' from " + abs + ": " + err.message);

    }

    //require an object schema root
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {

      //schemas must be objects
      throw new Error("schema '" + key + "' root must be a JSON object");

    //end object guard
    }

    //inline $ref (external files + in-document pointers) at compile time
    try {

      //resolve under schemasDir
      loaded[key] = schemaInlineMod.inlineParsedSchema(doc, abs, schemasDir);

    } catch (err) {

      //log and wrap with binding context
      console.error("failed to inline $ref in schema '" + key + "' from " + abs, err);

      //fail closed
      throw new Error(
        "failed to inline $ref in schema '" + key + "' from " + abs + ": " + err.message
      );

    //end inline
    }

    //next binding
    i += 1;

  //end binding walk
  }

  //return loaded schemas
  return loaded;

//end loadSchemas
}


/*
 * @description normalize top-level workflow.prompts map (binding → bare *.prompt.md filename)
 * @param prompts - author map or undefined
 * @returns map binding → filename, or null when omitted
 */
function normalizePromptRegistry(prompts) {

  //variables
  let keys = null; //binding names
  let i = 0; //index
  let key = ""; //binding
  let rel = ""; //filename
  let out = {}; //registry

  //omit → legacy path arrays on stations / steps
  if (prompts === undefined || prompts === null) {

    //no registry
    return null;

  //end omit
  }

  //must be object map
  if (typeof prompts !== "object" || Array.isArray(prompts)) {

    //bad
    throw new Error(
      "workflow.prompts must be an object map of binding → *.prompt.md filename"
    );

  //end type
  }

  //each binding
  keys = Object.keys(prompts);
  i = 0;

  //walk
  while (i < keys.length) {

    //binding name
    key = assertIdent(keys[i], "prompts binding");

    //filename value
    rel = assertBarePackFilename(prompts[keys[i]], "prompts." + key);

    if (!rel.endsWith(".prompt.md")) {
      throw new Error(
        "prompts." + key + " must end with .prompt.md (got " + JSON.stringify(rel) + ")"
      );
    }

    //store
    out[key] = rel;

    //next
    i += 1;

  //end walk
  }

  //empty map is useless
  if (Object.keys(out).length === 0) {

    //fail closed
    throw new Error("workflow.prompts must declare at least one binding when present");

  //end empty
  }

  //registry
  return out;

//end normalizePromptRegistry
}

/*
 * @description normalize workflow.schemas map (binding → bare *.schema.json filename)
 * @param schemas - author map
 * @returns map binding → filename
 */
function normalizeSchemaCatalog(schemas) {
  let keys = null;
  let i = 0;
  let key = "";
  let rel = "";
  let out = {};

  if (schemas === undefined || schemas === null) {
    return out;
  }
  if (typeof schemas !== "object" || Array.isArray(schemas)) {
    throw new Error(
      "workflow.schemas must be an object map of binding → *.schema.json filename"
    );
  }

  keys = Object.keys(schemas);
  i = 0;
  while (i < keys.length) {
    key = assertIdent(keys[i], "schema binding");
    rel = assertBarePackFilename(schemas[keys[i]], "schemas." + key);
    if (!rel.endsWith(".schema.json")) {
      throw new Error(
        "schemas." + key + " must end with .schema.json (got " + JSON.stringify(rel) + ")"
      );
    }
    out[key] = rel;
    i += 1;
  }
  return out;
}

/*
 * @description ensure catalog files exist under {base}/stations and are non-empty / valid JSON
 * @param schemaCatalog - binding → filename
 * @param promptCatalog - binding → filename
 * @param stationsDir - absolute stations directory
 */
function assertPackAssetsOnDisk(schemaCatalog, promptCatalog, stationsDir) {
  let keys = null;
  let i = 0;
  let key = "";
  let abs = "";
  let text = "";

  keys = Object.keys(schemaCatalog);
  i = 0;
  while (i < keys.length) {
    key = keys[i];
    abs = nodePath.join(stationsDir, schemaCatalog[key]);
    if (!nodeFs.existsSync(abs)) {
      throw new Error("schema file missing: " + abs);
    }
    i += 1;
  }

  keys = Object.keys(promptCatalog || {});
  i = 0;
  while (i < keys.length) {
    key = keys[i];
    abs = nodePath.join(stationsDir, promptCatalog[key]);
    if (!nodeFs.existsSync(abs)) {
      throw new Error("prompt file missing: " + abs);
    }
    text = nodeFs.readFileSync(abs, "utf8");
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("prompt file empty: " + abs);
    }
    i += 1;
  }
}

/*
 * @description validate workflow.args: flat values + required station_dir
 * @param argsDef - workflow.args
 * @returns args object (possibly {})
 */
function validateWorkflowArgs(argsDef) {
  let keys = null;
  let i = 0;
  let key = "";
  let def = null;
  let isPlainObject = false;
  let onlyKeys = null;
  let hasLegacyDefault = false;
  let out = {};

  if (!argsDef || typeof argsDef !== "object" || Array.isArray(argsDef)) {
    throw new Error(
      "workflow.args is required and must include station_dir (directory of *.schema.json / *.prompt.md)"
    );
  }

  keys = Object.keys(argsDef);
  i = 0;
  while (i < keys.length) {
    key = assertIdent(keys[i], "args field");
    def = argsDef[keys[i]];
    isPlainObject = def !== null && typeof def === "object" && !Array.isArray(def);
    onlyKeys = isPlainObject ? Object.keys(def) : null;
    hasLegacyDefault =
      isPlainObject &&
      Object.prototype.hasOwnProperty.call(def, "default") &&
      onlyKeys.length === 1 &&
      onlyKeys[0] === "default";
    if (hasLegacyDefault) {
      throw new Error(
        "args." +
          key +
          ': put the value directly after the key (e.g. "' +
          key +
          '": <value>) instead of { "default": ... }'
      );
    }
    out[key] = def;
    i += 1;
  }

  if (typeof out.station_dir !== "string" || out.station_dir.length === 0) {
    throw new Error(
      "workflow.args.station_dir is required (runtime directory containing *.schema.json and *.prompt.md)"
    );
  }

  return out;
}

/*
 * @description resolve station/step prompt entries to file paths under prompts/
 * @param promptList - array of binding names (when registry set) or file paths (legacy)
 * @param promptRegistry - binding → path map, or null for legacy paths
 * @param origin - error label (e.g. stations[0].prompt)
 * @returns ordered array of relative prompt file paths
 */
function resolvePromptList(promptList, promptRegistry, origin) {

  //variables
  let i = 0; //index
  let entry = ""; //binding or path
  let paths = []; //resolved paths
  let label = ""; //error origin

  //require non-empty array
  if (!Array.isArray(promptList) || promptList.length === 0) {

    //bad
    throw new Error(
      (origin || "prompt") +
      " must be a non-empty array of prompt bindings or file names"
    );

  //end array
  }

  //legacy: no registry → each entry is a file path
  if (promptRegistry === null || promptRegistry === undefined) {

    // validate binding names only; files checked in assertPackAssetsOnDisk
    i = 0;

    //walk
    while (i < promptList.length) {

      //entry
      entry = promptList[i];

      //string path
      if (typeof entry !== "string" || entry.length === 0) {

        //bad
        throw new Error(
          (origin || "prompt") + "[" + i + "] must be a non-empty prompt file path"
        );

      //end guard
      }

      //as-is path
      paths.push(entry);

      //next
      i += 1;

    //end walk
    }

    //paths
    return paths;

  //end legacy
  }

  //registry mode: each entry is a binding name
  i = 0;

  //walk
  while (i < promptList.length) {

    //binding
    entry = promptList[i];
    label = (origin || "prompt") + "[" + i + "]";

    //string
    if (typeof entry !== "string" || entry.length === 0) {

      //bad
      throw new Error(label + " must be a non-empty prompt binding name");

    //end string
    }

    //identifier (keyword-safe)
    entry = assertIdent(entry, label);

    //must exist in registry
    if (!promptRegistry[entry]) {

      //unknown
      throw new Error(
        label + " '" + entry + "' was not declared in workflow.prompts"
      );

    //end missing
    }

    //resolved path
    paths.push(promptRegistry[entry]);

    //next
    i += 1;

  //end walk
  }

  //ordered file paths
  return paths;

//end resolvePromptList
}

/*
 * @description format a workflow args value for the generated workflow.md table
 * @param value - raw args entry (flat default, true required, {}, or { required: true })
 * @returns short display string
 */
function formatArgDefaultForGuide(value) {

  //required flag
  if (value === true) {

    //required, no default
    return "*(required)*";

  //end required true
  }

  //object forms
  if (value && typeof value === "object" && !Array.isArray(value)) {

    //explicit required
    if (value.required === true && value.default === undefined) {

      //required
      return "*(required)*";

    //end required object
    }

    //optional empty
    if (Object.keys(value).length === 0) {

      //no default
      return "*(optional, no default)*";

    //end empty object
    }

  //end object branch
  }

  //scalar / array / map default — compact JSON
  try {

    //stable JSON for guide
    return "`" + JSON.stringify(value) + "`";

  } catch (err) {

    //fallback
    return String(value);

  //end json
  }

//end formatArgDefaultForGuide
}

/*
 * @description emit human-readable workflow.md (build product; same cycle as Rhai)
 * @param workflow - workflow document object
 * @returns markdown source
 */
function emitWorkflowMarkdown(workflow) {

  //variables
  let lines = []; //markdown lines
  let name = ""; //workflow name
  let desc = ""; //description
  let args = null; //args map
  let argKeys = null; //arg names
  let ai = 0; //arg index
  let argName = ""; //one arg
  let stations = null; //station list
  let si = 0; //station index
  let st = null; //one station
  let cap = ""; //capability_mode
  let schemas = ""; //station schemas list
  let promptNote = ""; //prompt binding hint

  //name / description
  name = typeof workflow.name === "string" ? workflow.name : "(unnamed)";
  desc =
    typeof workflow.description === "string" && workflow.description.length > 0
      ? workflow.description
      : "*(no description in workflow JSON)*";

  //banner — analysis / onboarding only
  lines.push("# " + name);
  lines.push("");
  lines.push("> **BUILD ARTIFACT** — generated by **rhaiteous** in the same compile cycle as the Rhai IR.");
  lines.push("> Suitable for reading and onboarding only. **Do not edit** this file.");
  lines.push("> Authoring surface: workflow JSON (+ schemas + prompts). Recompile after changes.");
  lines.push("");

  //purpose
  lines.push("## Purpose");
  lines.push("");
  lines.push(desc);
  lines.push("");

  //compile
  lines.push("## Compile (Rhaiteous)");
  lines.push("");
  lines.push("Rhaiteous **compiles only**; it does not execute the pipeline.");
  lines.push("");
  lines.push("```bash");
  lines.push("# typical project compile → .grok/workflows/" + name + ".rhai");
  lines.push("# and workflow.md next to the authoring workflow JSON (always named workflow.md)");
  lines.push("npx rhaiteous ./path/to/workflow.json -b ./path/to/asset-base");
  lines.push("");
  lines.push("# pack-style output (both artifacts in the pack directory):");
  lines.push("# npx rhaiteous ./workflows/" + name + "/workflow.json -b ./workflows/" + name + " \\");
  lines.push("#   -o ./workflows/" + name + "/workflow.rhai");
  lines.push("```");
  lines.push("");

  //run
  lines.push("## Run (Grok — no recompile)");
  lines.push("");
  lines.push("Place or compile IR to `.grok/workflows/" + name + ".rhai` (or `~/.grok/workflows/`), then:");
  lines.push("");
  lines.push("```text");
  lines.push("/workflow " + name + " { /* args — see table below */ }");
  lines.push("```");
  lines.push("");

  //args
  lines.push("### Args");
  lines.push("");
  args = workflow.args && typeof workflow.args === "object" ? workflow.args : null;

  //no args
  if (!args || Object.keys(args).length === 0) {

    //none declared
    lines.push("This workflow declares no `args`. Launch with `{}` or omit the JSON object per Grok.");
    lines.push("");

  } else {

    //table
    lines.push("| Arg | Default / requirement |");
    lines.push("|-----|------------------------|");
    argKeys = Object.keys(args);
    ai = 0;

    //each arg
    while (ai < argKeys.length) {

      //row
      argName = argKeys[ai];
      lines.push(
        "| `" +
          argName +
          "` | " +
          formatArgDefaultForGuide(args[argName]) +
          " |"
      );

      //next
      ai += 1;

    //end args walk
    }

    lines.push("");
    lines.push("Args are **flat**: the value after the key in workflow JSON is the default when the launch arg is missing.");
    lines.push("");

  //end args branch
  }

  //stations
  lines.push("## Stations and participation");
  lines.push("");
  stations = Array.isArray(workflow.stations) ? workflow.stations : [];

  //empty
  if (stations.length === 0) {

    //none
    lines.push("*(no stations declared)*");
    lines.push("");

  } else {

    //order note
    lines.push(
      "Stations run in roster order. Each station persists via the Rhaiteous toolbox and returns one post; the driver follows `metadata.to` (terminal: `[]`)."
    );
    lines.push("");
    lines.push("| # | Station | Capability | Role (`uiDescription`) | Schemas (guidance) | Prompts |");
    lines.push("|---|---------|------------|--------------------------|--------------------|---------|");
    si = 0;

    //each station
    while (si < stations.length) {

      //station object
      st = stations[si] && typeof stations[si] === "object" ? stations[si] : {};
      cap =
        typeof st.capability_mode === "string" && st.capability_mode.length > 0
          ? st.capability_mode
          : "*(default)*";
      schemas =
        Array.isArray(st.schemas) && st.schemas.length > 0
          ? st.schemas.map(function quote(s) {

              //backtick binding
              return "`" + s + "`";

            //end map
            }).join(", ")
          : "—";
      promptNote =
        Array.isArray(st.prompt) && st.prompt.length > 0
          ? st.prompt.map(function quoteP(p) {

              //binding or path
              return "`" + p + "`";

            //end map
            }).join(" + ")
          : "—";

      //row
      lines.push(
        "| " +
          String(si + 1) +
          " | **" +
          (typeof st.name === "string" ? st.name : "?") +
          "** | `" +
          cap +
          "` | " +
          (typeof st.uiDescription === "string" && st.uiDescription.length > 0
            ? st.uiDescription
            : "—") +
          " | " +
          schemas +
          " | " +
          promptNote +
          " |"
      );

      //next
      si += 1;

    //end stations walk
    }

    lines.push("");

    //sequence line
    lines.push("**Sequence:** " + stations.map(function seqName(s) {

      //name or ?
      return s && typeof s.name === "string" ? s.name : "?";

    //end map
    }).join(" → ") + ".");
    lines.push("");

  //end stations branch
  }

  //schemas summary (attachment schema bindings; no flow.payload)
  lines.push("## Schemas");
  lines.push("");
  lines.push(
    "Structured attachment `content` uses these bindings (loaded into the workflow context at Init)."
  );
  lines.push("");

  //top-level schema bindings
  if (workflow.schemas && typeof workflow.schemas === "object") {

    //list bindings
    Object.keys(workflow.schemas).forEach(function listSchema(binding) {

      //bullet
      lines.push(
        "- **`" +
          binding +
          "`:** `" +
          workflow.schemas[binding] +
          "`"
      );

    //end forEach
    });

  //end schemas map
  }

  lines.push("");

  //footer
  lines.push("## Notes");
  lines.push("");
  lines.push("- Generated **`.rhai`** and **`workflow.md`** are both build artifacts; do not hand-edit.");
  lines.push("- Grok discovers saved workflows only under `.grok/workflows/*.rhai` or `~/.grok/workflows/*.rhai`.");
  lines.push("- This file is always named **`workflow.md`** (one workflow pack per directory).");
  lines.push("");

  //join
  return lines.join("\n");

//end emitWorkflowMarkdown
}

/*
 * @description resolve path(s) for workflow.md written in the same cycle as the Rhai
 * @param absIn - absolute workflow JSON path
 * @param outPath - absolute .rhai output path
 * @returns array of absolute paths (unique) for workflow.md
 */
function resolveWorkflowMdPaths(absIn, outPath) {

  //variables
  let paths = []; //result
  let seen = {}; //dedupe
  let candidate = ""; //one path
  let inBase = ""; //input basename
  let outBase = ""; //output basename

  //helpers push unique
  function pushPath(p) {

    //skip empty
    if (typeof p !== "string" || p.length === 0) {

      //nothing
      return;

    //end empty
    }

    //dedupe
    if (seen[p]) {

      //already
      return;

    //end seen
    }

    //record
    seen[p] = true;
    paths.push(p);

  //end pushPath
  }

  inBase = nodePath.basename(absIn);
  outBase = nodePath.basename(outPath);

  //pack-style IR: always workflow.md beside workflow.rhai
  if (outBase === "workflow.rhai") {

    //beside IR
    pushPath(nodePath.join(nodePath.dirname(outPath), "workflow.md"));

  //end pack out
  }

  //pack-style or flat authoring dir: always workflow.md beside the JSON
  // (one workflow authoring file per directory recommended)
  pushPath(nodePath.join(nodePath.dirname(absIn), "workflow.md"));

  //do not write workflow.md into multi-workflow .grok/workflows when IR is <name>.rhai
  // (only the authoring-dir / workflow.rhai cases above)

  //silence unused when only authoring path
  void candidate;

  //paths to write
  return paths;

//end resolveWorkflowMdPaths
}


/*
 * @description validate and normalize stations[] for flow scripts
 * @param stations - raw stations array
 * @returns normalized station objects { name, prompt, uiDescription?, label?, … }
 */
function normalizeStations(stations) {

  //variables
  let i = 0; //index
  let raw = null; //input entry
  let name = ""; //station name / fn name
  let out = []; //normalized list
  let seen = {}; //duplicate name guard
  let entry = null; //normalized entry

  //require non-empty array
  if (!Array.isArray(stations) || stations.length === 0) {

    //missing stations
    throw new Error("workflow.stations must be a non-empty array");

  //end array guard
  }

  //walk stations
  i = 0;

  //each station object
  while (i < stations.length) {

    //raw entry
    raw = stations[i];

    //require object
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {

      //bad entry
      throw new Error("stations[" + i + "] must be an object");

    //end object guard
    }

    //name → Rhai fn name and phase title
    name = assertIdent(raw.name, "stations[" + i + "].name");

    //unique names
    if (seen[name]) {

      //duplicate
      throw new Error("stations[" + i + "].name duplicates station \"" + name + "\"");

    //end dup guard
    }

    //mark seen
    seen[name] = true;

    //require prompt list (binding names when workflow.prompts set, else file paths)
    if (!Array.isArray(raw.prompt) || raw.prompt.length === 0) {

      //missing prompts
      throw new Error(
        "stations[" + i + "].prompt must be a non-empty array of prompt " +
        "binding names (workflow.prompts) or file paths under prompts/"
      );

    //end prompt guard
    }

    //normalized station
    entry = {
      name: name, //ident
      prompt: raw.prompt, //bindings or paths (resolved at emit)
    };

    //reject old phase subtitle name
    if (raw.detail !== undefined) {

      //rename required
      throw new Error(
        "stations[" + i + "].detail is not supported; use uiDescription " +
        "(emitted as meta.phases[].detail for Grok)"
      );

    //end old name guard
    }

    //optional UI description → meta.phases[].detail
    if (typeof raw.uiDescription === "string") {

      //phase rail subtitle
      entry.uiDescription = raw.uiDescription;

    //end uiDescription
    }

    //optional agent label (default name)
    if (typeof raw.label === "string") {

      //label
      entry.label = raw.label;

    //end label
    }

    //optional agent_type
    if (typeof raw.agent_type === "string") {

      //type
      entry.agent_type = raw.agent_type;

    //end agent_type
    }

    //optional capability_mode (omit → read-only at run)
    if (typeof raw.capability_mode === "string") {
      if (
        raw.capability_mode !== "read-only" &&
        raw.capability_mode !== "read-write" &&
        raw.capability_mode !== "execute" &&
        raw.capability_mode !== "all"
      ) {
        throw new Error(
          "stations[" +
            i +
            '].capability_mode must be "read-only"|"read-write"|"execute"|"all" (got ' +
            JSON.stringify(raw.capability_mode) +
            ")"
        );
      }
      entry.capability_mode = raw.capability_mode;
    }

    //optional max_visits (default 1 at emit)
    if (raw.max_visits !== undefined && raw.max_visits !== null) {
      if (typeof raw.max_visits !== "number" || !Number.isInteger(raw.max_visits) || raw.max_visits < 1) {
        throw new Error(
          "stations[" + i + "].max_visits must be an integer >= 1"
        );
      }
      entry.max_visits = raw.max_visits;
    }

    //optional schema binding names (attachment schema keys for this station)
    if (raw.schemas !== undefined) {

      //must be an array of binding names
      if (!Array.isArray(raw.schemas)) {

        //bad type
        throw new Error(
          "stations[" + i + "].schemas must be an array of schema binding names"
        );

      //end array guard
      }

      //normalize each binding
      entry.schemas = normalizeStationSchemaRefs(raw.schemas, i);

    //end schemas field
    }

    //store
    out.push(entry);

    //next
    i += 1;

  //end station walk
  }

  //normalized stations
  return out;

//end normalizeStations
}

/*
 * @description normalize stations[].schemas to binding name strings
 * @param refs - raw array of schema binding names
 * @param stationIndex - stations[] index for error labels
 * @returns array of binding identifiers
 */
function normalizeStationSchemaRefs(refs, stationIndex) {

  //variables
  let i = 0; //index
  let out = []; //normalized bindings
  let binding = ""; //one name
  let label = ""; //error origin

  //each element must be a schema binding ident
  i = 0;

  //walk refs
  while (i < refs.length) {

    //origin label
    label = "stations[" + stationIndex + "].schemas[" + i + "]";

    //require non-empty string
    if (typeof refs[i] !== "string" || refs[i].length === 0) {

      //bad entry
      throw new Error(label + " must be a non-empty schema binding name");

    //end string guard
    }

    //identifier (keyword-guarded)
    binding = assertIdent(refs[i], label);

    //store
    out.push(binding);

    //next
    i += 1;

  //end walk
  }

  //binding list (may be empty)
  return out;

//end normalizeStationSchemaRefs
}

/*
 * @description resolve station schema refs against loaded top-level schemas
 * @param stations - normalized stations
 * @param loadedSchemas - binding → schema object
 */
function assertStationSchemasResolved(stations, loadedSchemas) {

  //variables
  let i = 0; //station index
  let j = 0; //schema ref index
  let st = null; //station
  let binding = ""; //schema binding

  //each station
  i = 0;

  //walk stations
  while (i < stations.length) {

    //station
    st = stations[i];

    //only when schemas listed
    if (Array.isArray(st.schemas)) {

      //each ref
      j = 0;

      //walk refs
      while (j < st.schemas.length) {

        //binding name
        binding = st.schemas[j];

        //must exist in workflow.schemas
        if (!loadedSchemas[binding]) {

          //unknown binding
          throw new Error(
            "stations[" + i + "].schemas[" + j + "] '" + binding +
            "' was not declared in workflow.schemas"
          );

        //end missing guard
        }

        //next ref
        j += 1;

      //end ref walk
      }

    //end has schemas
    }

    //next station
    i += 1;

  //end station walk
  }

//end assertStationSchemasResolved
}


/*
 * @description build meta.phases from stations array
 * @param stations - normalized stations
 * @returns phases array for emitMeta
 */
function phasesFromStations(stations) {

  //variables
  let i = 0; //index
  let phases = []; //result
  let st = null; //station
  let phase = null; //phase entry

  //each station → one phase
  i = 0;

  //walk
  while (i < stations.length) {

    //station
    st = stations[i];

    //phase title is station name
    phase = {
      title: st.name, //phase rail title
    };

    //optional UI description (emitMeta maps to Grok detail)
    if (typeof st.uiDescription === "string") {

      //author-facing field until emit
      phase.uiDescription = st.uiDescription;

    //end uiDescription
    }

    //store
    phases.push(phase);

    //next
    i += 1;

  //end walk
  }

  //phases for meta
  return phases;

//end phasesFromStations
}


/*
 * @description reject removed authoring surfaces (step mode, hand-authored phases)
 * @param workflow - parsed workflow document
 */
function assertFlowOnlyWorkflow(workflow) {

  //legacy linear step pipelines removed
  if (workflow.scriptType === "step") {

    //explicit step no longer supported
    throw new Error(
      "workflow.scriptType \"step\" was removed; use stations[] (flow-only authoring)"
    );

  //end step scriptType
  }

  //optional scriptType may only be flow when present
  if (
    workflow.scriptType !== undefined &&
    workflow.scriptType !== null &&
    workflow.scriptType !== "flow"
  ) {

    //unknown value
    throw new Error(
      "workflow.scriptType must be omitted or \"flow\" (got " +
      JSON.stringify(workflow.scriptType) +
      ")"
    );

  //end scriptType value guard
  }

  //steps[] is the old step IR body
  if (workflow.steps !== undefined) {

    //reject steps
    throw new Error(
      "workflow.steps is not supported; use stations[] (flow-only authoring)"
    );

  //end steps guard
  }

  //phases come only from stations
  if (workflow.phases !== undefined) {

    //reject hand-authored phases
    throw new Error(
      "workflow.phases is not supported; meta.phases are derived from stations[]"
    );

  //end phases guard
  }

  //payloadSchema is not part of the thread+posts dialect
  if (workflow.payloadSchema !== undefined && workflow.payloadSchema !== null) {
    throw new Error(
      "workflow.payloadSchema does not exist in this dialect; use workflow.schemas " +
      "and post attachments with schema keys"
    );
  }

//end assertFlowOnlyWorkflow
}

/*
 * @description compile a workflow object into Rhai source text (flow / stations only)
 * @param workflow - parsed workflow document
 * @param options - { base?: string, baseDir?: string } asset root with schemas/ and prompts/
 * @returns { name, rhai, loadedSchemas, base, scriptType }
 */
function compileWorkflow(workflow, options) {

  //variables
  let baseDir = ""; //absolute pack root
  let loadedSchemas = null; //binding → schema object (validate only)
  let validatedArgs = null; //workflow.args after flat/station_dir checks
  let schemaCatalog = null; //binding → bare *.schema.json
  let stationsDir = ""; //absolute {base}/stations
  let ctx = null; //compile context
  let parts = []; //source sections
  let header = ""; //file header comment
  let rhai = ""; //full script
  let keywordSet = null; //reserved keywords
  let scanHits = null; //layer B findings
  let si = 0; //scan / station index
  let report = ""; //keyword error text
  let stations = null; //normalized stations
  let metaWorkflow = null; //workflow object for emitMeta
  let bodySource = ""; //template-filled script body
  let promptRegistry = null; //binding → bare *.prompt.md
  let workflowJsonPath = ""; //stamped into IR for runtime load

  //options normalize
  if (!options || typeof options !== "object") {

    //empty options
    options = {};

  //end options default
  }

  //asset base: default ./rhaiteous (cwd), override with -b / options.base
  baseDir = resolveBaseDir(options);

  //require object workflow
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {

    //bad root
    throw new Error("workflow root must be a JSON object");

  //end root guard
  }

  //load keyword list (fail closed if missing)
  keywordSet = rhaiKeywordsMod.loadKeywordSet(
    typeof options.keywordsPath === "string" ? options.keywordsPath : null
  );

  //collect keyword violations across assertIdent during this compile
  activeKeywordCtx = {
    keywordViolations: [], //accumulated hits
  };

  try {

    //flow-only authoring surface
    assertFlowOnlyWorkflow(workflow);

    //args: flat values + required station_dir (runtime asset root)
    validatedArgs = validateWorkflowArgs(workflow.args);

    //catalogs: bare filenames under station_dir / {base}/stations
    schemaCatalog = normalizeSchemaCatalog(workflow.schemas);
    promptRegistry = normalizePromptRegistry(workflow.prompts);
    if (!promptRegistry) {
      throw new Error(
        "workflow.prompts is required (binding → *.prompt.md filename under args.station_dir)"
      );
    }

    stationsDir = resolveStationsDir(baseDir);
    assertPackAssetsOnDisk(schemaCatalog, promptRegistry, stationsDir);

    //load + $ref-inline schemas for fail-closed validation (not grafted into Rhai)
    loadedSchemas = loadSchemas(schemaCatalog, baseDir);

    //compile context (keyword scan + station schema checks)
    ctx = {
      argsLocals: {},
      knownVars: {},
      declaredLets: {},
      loadedSchemas: loadedSchemas,
      payloadSchema: null,
      promptRegistry: promptRegistry,
      workflowArgs: validatedArgs,
      base: baseDir,
      keywordViolations: activeKeywordCtx.keywordViolations,
    };

    //file header: mark IR as build artifact (analysis only; not an edit surface)
    header =
      "// =============================================================================\n" +
      "// BUILD ARTIFACT — generated by rhaiteous\n" +
      "// Suitable for analysis and debugging only. Do not edit this file.\n" +
      "// Authoring surface: workflow JSON (+ schemas + prompts). Recompile after changes.\n" +
      "// Hand-edits will be overwritten on the next compile and are not supported.\n" +
      "// model: workflow-context orchestration (skinny forum-runner template)\n" +
      "// =============================================================================\n";

    //normalize stations
    stations = normalizeStations(workflow.stations);

    //each station.prompt entry must be a prompts binding
    for (si = 0; si < stations.length; si += 1) {
      resolvePromptList(
        stations[si].prompt,
        promptRegistry,
        "station " + stations[si].name + ".prompt"
      );
    }

    //station schemas[] must resolve against top-level workflow.schemas
    assertStationSchemasResolved(stations, loadedSchemas);

    //meta with derived phases (emitter also prepends Init)
    metaWorkflow = {
      name: workflow.name,
      description: workflow.description,
      phases: phasesFromStations(stations),
    };

    // skinny emit: meta + workflow.json path only (catalogs/defs at run time)
    workflowJsonPath =
      typeof options.workflowPath === "string" && options.workflowPath.length > 0
        ? options.workflowPath
        : nodePath.join(baseDir, "workflow.json");
    // Prefer a path relative to cwd when under the project (agent read_file friendly)
    try {
      const rel = nodePath.relative(process.cwd(), workflowJsonPath);
      if (rel && !rel.startsWith("..") && !nodePath.isAbsolute(rel)) {
        workflowJsonPath = rel.split(nodePath.sep).join("/");
      } else {
        workflowJsonPath = String(workflowJsonPath).split(nodePath.sep).join("/");
      }
    } catch (_e) {
      workflowJsonPath = String(workflowJsonPath).split(nodePath.sep).join("/");
    }

    bodySource = emitForumRunnerScript({
      metaWorkflow: metaWorkflow,
      workflowJsonPath: workflowJsonPath,
    });

    //assemble
    parts.push(header);
    parts.push(bodySource);

    //full script
    rhai = parts.filter(function keepNonEmpty(section) {
      return typeof section === "string" && section.length > 0;
    }).join("\n") + "\n";

    //layer B: scan emitted IR for keyword identifiers not on allowlist
    scanHits = rhaiKeywordsMod.scanEmittedRhaiForKeywords(rhai, keywordSet);

    //merge scan hits
    si = 0;

    //each scan hit
    while (si < scanHits.length) {

      //append
      ctx.keywordViolations.push(scanHits[si]);

      //next
      si += 1;

    //end scan merge
    }

    //fail closed with full report
    if (ctx.keywordViolations.length > 0) {

      //format
      report = rhaiKeywordsMod.formatKeywordReport(ctx.keywordViolations);

      //abort compile (no write from file API when this throws)
      throw new Error(report);

    //end keyword fail
    }

    //return compile result (Rhai + human guide; both build products)
    return {
      name: workflow.name, //workflow name
      rhai: rhai, //full source
      workflowMd: emitWorkflowMarkdown(workflow), //always workflow.md content
      loadedSchemas: loadedSchemas, //for tests/debug
      base: baseDir, //resolved asset base
      scriptType: "flow", //stations[] authoring; IR model is thread+posts
    };

  } finally {

    //clear active keyword context
    activeKeywordCtx = null;

  //end try/finally
  }

//end compileWorkflow
}

/*
 * @description compile a workflow JSON file from disk
 * @param workflowPath - path to *.workflow.json
 * @param options - { outPath?: string, write?: boolean, base?: string }
 * @returns compile result plus paths
 */
function compileWorkflowFile(workflowPath, options) {

  //variables
  let absIn = ""; //absolute input path
  let baseDir = ""; //asset base with schemas/ and prompts/
  let workflow = null; //parsed document
  let result = null; //compile result
  let outPath = ""; //output rhai path
  let outDir = ""; //output directory
  let mdPaths = null; //workflow.md destinations
  let mi = 0; //md path index
  let mdPath = ""; //one md path
  let writtenMdPaths = []; //paths actually written

  //options normalize
  if (!options || typeof options !== "object") {

    //empty options
    options = {};

  //end options default
  }

  //resolve input
  absIn = nodePath.resolve(workflowPath);

  //asset base (default cwd/rhaiteous); not the workflow file directory
  baseDir = resolveBaseDir(options);

  //parse workflow JSON
  workflow = readJsonFile(absIn);

  // compile with shared base; stamp absIn as workflow.json path (relativized in emit)
  result = compileWorkflow(workflow, {
    base: baseDir, // schemas + prompts root
    workflowPath: absIn,
  });

  //default output: Grok project discovery path .grok/workflows/<name>.rhai under cwd
  if (typeof options.outPath === "string" && options.outPath.length > 0) {

    //explicit output (e.g. examples/out or ~/.grok/workflows)
    outPath = nodePath.resolve(options.outPath);

  } else {

    //project location Grok scans for named /workflow launches
    outPath = nodePath.resolve(process.cwd(), ".grok", "workflows", result.name + ".rhai");

  //end out path branch
  }

  //human guide path(s): always named workflow.md (same compile cycle as Rhai)
  mdPaths = resolveWorkflowMdPaths(absIn, outPath);

  //write when requested (default true)
  if (options.write !== false) {

    //ensure parent directory exists
    outDir = nodePath.dirname(outPath);

    //create directories
    nodeFs.mkdirSync(outDir, {
      recursive: true, //create parents
    });

    //write utf-8 rhai
    nodeFs.writeFileSync(outPath, result.rhai, "utf8");

    //write workflow.md beside authoring pack / pack-style IR
    mi = 0;

    //each destination
    while (mi < mdPaths.length) {

      //path
      mdPath = mdPaths[mi];

      //ensure dir
      nodeFs.mkdirSync(nodePath.dirname(mdPath), {
        recursive: true, //parents
      });

      //write guide
      nodeFs.writeFileSync(mdPath, result.workflowMd, "utf8");

      //record
      writtenMdPaths.push(mdPath);

      //next
      mi += 1;

    //end md write walk
    }

  //end write branch
  }

  //return extended result
  return {
    name: result.name, //workflow name
    rhai: result.rhai, //source text
    workflowMd: result.workflowMd, //guide source
    loadedSchemas: result.loadedSchemas, //schemas
    base: result.base, //resolved asset base
    inputPath: absIn, //input path
    outputPath: outPath, //rhai output path
    workflowMdPaths: writtenMdPaths.length > 0 ? writtenMdPaths : mdPaths, //guide path(s)
    written: options.write !== false, //whether written
  };

//end compileWorkflowFile
}

//public API (library + CLI share this module)
export default {
  compileWorkflow: compileWorkflow,
  compileWorkflowFile: compileWorkflowFile,
  emitWorkflowMarkdown: emitWorkflowMarkdown,
  resolveWorkflowMdPaths: resolveWorkflowMdPaths,
  readJsonFile: readJsonFile,
  normalizePromptRegistry: normalizePromptRegistry,
  resolvePromptList: resolvePromptList,
  resolveBaseDir: resolveBaseDir,
  resolveSchemasDir: resolveSchemasDir,
  resolvePromptsDir: resolvePromptsDir,
  jsonToRhai: jsonToRhaiMod.jsonToRhai,
  assertWorkflowName: assertWorkflowName,
  assertIdent: assertIdent,
};
