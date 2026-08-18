/*
 * Compile a JSON workflow document into a Grok Build Rhai workflow script.
 * Authors maintain JSON + real JSON Schema files; this module emits Rhai IR.
 */

//node filesystem and path
import nodeFs from "node:fs";
import nodePath from "node:path";

//local emitters
import jsonToRhaiMod from "./json-to-rhai.js";
import templateMod from "./template.js";
import rhaiKeywordsMod from "./rhai-keywords.js";
import schemaInlineMod from "./schema-inline.js";

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

  //legacy multi-workflow base
  legacy = nodePath.join(baseDir, "schemas");

  //use schemas/ when present
  if (nodeFs.existsSync(legacy) && nodeFs.statSync(legacy).isDirectory()) {

    //legacy root
    return legacy;

  //end legacy
  }

  //pack layout: asset base is the schemas boundary
  return baseDir;

//end resolveSchemasDir
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
 * @description load prompt source files and concatenate them with section banners
 * @param promptFiles - array of file names relative to {base}/prompts
 * @param baseDir - absolute asset base (contains schemas/ and prompts/)
 * @returns concatenated prompt template text (still may contain {{refs}})
 */
function loadPromptFiles(promptFiles, baseDir) {

  //variables
  let i = 0; //file index
  let rel = ""; //relative path under prompts/
  let abs = ""; //absolute path
  let raw = ""; //file text
  let parts = []; //banner + body chunks
  let promptsDir = ""; //absolute prompts directory
  let displayName = ""; //name shown in the banner

  //prompt must be a non-empty array of source file names
  if (!Array.isArray(promptFiles) || promptFiles.length === 0) {

    //bad shape
    throw new Error(
      "prompt must be a non-empty array of source file names under prompts/ or stations/"
    );

  //end array guard
  }

  //legacy {base}/prompts or pack {base}/stations
  promptsDir = resolvePromptsDir(baseDir);

  //load each referenced file in order
  i = 0;

  //walk files
  while (i < promptFiles.length) {

    //file entry
    rel = promptFiles[i];

    //require non-empty string path
    if (typeof rel !== "string" || rel.length === 0) {

      //bad entry
      throw new Error("prompt[" + i + "] must be a non-empty source file name");

    //end entry guard
    }

    //banner uses the path as authored (basename-friendly for nested files)
    displayName = rel.split(/[/\\]/).filter(function keepSeg(seg) {

      //drop empty segments
      return seg.length > 0;

    //end filter
    }).pop() || rel;

    //resolve under {base}/prompts
    abs = nodePath.resolve(promptsDir, rel);

    try {

      //read utf-8 text
      raw = nodeFs.readFileSync(abs, "utf8");

      //strip a leading utf-8 bom when present
      if (raw.charCodeAt(0) === 0xfeff) {

        //drop bom
        raw = raw.slice(1);

      //end bom strip
      }

    } catch (err) {

      //log full stack
      console.error("failed to load prompt file " + abs, err);

      //fail closed — any missing/unreadable file aborts compile
      throw new Error("failed to load prompt file '" + rel + "' from " + abs + ": " + err.message);

    }

    //each file is prefaced by newline, banner, newline, then body
    parts.push("\n===== [" + displayName + "] =====\n");
    parts.push(raw);

    //next file
    i += 1;

  //end file walk
  }

  //joined template text for emitPromptBuild
  return parts.join("");

//end loadPromptFiles
}

/*
 * @description normalize top-level workflow.prompts map (binding → path under prompts/)
 * @param prompts - author map or undefined
 * @returns map binding → relative path, or null when omitted
 */
function normalizePromptRegistry(prompts) {

  //variables
  let keys = null; //binding names
  let i = 0; //index
  let key = ""; //binding
  let rel = ""; //path
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
      "workflow.prompts must be an object map of binding → path under prompts/"
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

    //path value
    rel = prompts[keys[i]];

    //require non-empty string path
    if (typeof rel !== "string" || rel.length === 0) {

      //bad path
      throw new Error("prompts." + key + " must be a non-empty path under prompts/");

    //end path guard
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

    //validate strings only; loadPromptFiles will open files
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
      "Stations run in `flow.stations` order. Default routing: set `flow.next` to the next name in the list after `flow.current`; last station → `null`."
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

  //payload / schemas summary
  lines.push("## Schemas");
  lines.push("");

  //payload
  if (typeof workflow.payloadSchema === "string" && workflow.payloadSchema.length > 0) {

    //payload file
    lines.push("- **Payload (host envelope):** `" + workflow.payloadSchema + "`");

  } else {

    //none
    lines.push("- **Payload:** *(none declared — nullable object default)*");

  //end payload
  }

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
 * @description emit the pure-literal meta header required by Grok Build
 * @param workflow - workflow document
 * @returns Rhai source for let meta = #{...};
 */
function emitMeta(workflow) {

  //variables
  let meta = null; //meta object for emission
  let phases = null; //normalized phases
  let i = 0; //loop index
  let phaseIn = null; //input phase
  let phaseOut = null; //normalized phase

  //validate name
  assertWorkflowName(workflow.name);

  //require description
  if (typeof workflow.description !== "string" || workflow.description.length === 0) {

    //missing description
    throw new Error("workflow description must be a non-empty string");

  //end description guard
  }

  //start meta object
  meta = {
    name: workflow.name, //workflow discovery name
    description: workflow.description, //human summary
  };

  //optional phases for the dashboard rail
  if (workflow.phases !== undefined) {

    //require array
    if (!Array.isArray(workflow.phases)) {

      //bad phases
      throw new Error("workflow phases must be an array when present");

    //end phases-type guard
    }

    //normalize phases
    phases = [];

    //walk phases
    i = 0;

    //each phase needs a title
    while (i < workflow.phases.length) {

      //input phase entry
      phaseIn = workflow.phases[i];

      //require object with title
      if (!phaseIn || typeof phaseIn !== "object" || typeof phaseIn.title !== "string") {

        //bad phase
        throw new Error("phases[" + i + "] must be an object with a string title");

      //end phase guard
      }

      //build normalized phase
      phaseOut = {
        title: phaseIn.title, //phase title
      };

      //optional UI description (author field uiDescription → Grok meta detail)
      if (phaseIn.detail !== undefined) {

        //old name rejected
        throw new Error(
          "phases[" + i + "].detail is not supported; use uiDescription " +
          "(emitted as meta.phases[].detail for Grok)"
        );

      //end old name guard
      }

      //optional uiDescription
      if (typeof phaseIn.uiDescription === "string") {

        //Grok phase rail subtitle
        phaseOut.detail = phaseIn.uiDescription;

      //end uiDescription branch
      }

      //store phase
      phases.push(phaseOut);

      //next phase
      i += 1;

    //end phase walk
    }

    //attach phases to meta
    meta.phases = phases;

  //end phases branch
  }

  //emit pure-literal meta assignment (jsonToRhai sorts keys; force name-first via custom emit)
  return "let meta = " + emitMetaMap(meta) + ";\n";

//end emitMeta
}

/*
 * @description emit meta map with stable field order (name, description, phases)
 * @param meta - meta object
 * @returns Rhai map literal
 */
function emitMetaMap(meta) {

  //variables
  let lines = []; //field lines
  let i = 0; //phase index
  let phase = null; //current phase
  let phaseLines = []; //phase map fields
  let phasesBlock = ""; //phases array source

  //name first
  lines.push("    name: " + jsonToRhaiMod.emitRhaiString(meta.name) + ",");

  //description second
  lines.push("    description: " + jsonToRhaiMod.emitRhaiString(meta.description) + ",");

  //phases when present
  if (meta.phases) {

    //build phase object lines
    phaseLines = [];

    //walk phases in order
    i = 0;

    //emit each phase map
    while (i < meta.phases.length) {

      //current phase
      phase = meta.phases[i];

      //phase with optional detail
      if (phase.detail !== undefined) {

        //title and detail
        phaseLines.push(
          "        #{\n" +
          "            title: " + jsonToRhaiMod.emitRhaiString(phase.title) + ",\n" +
          "            detail: " + jsonToRhaiMod.emitRhaiString(phase.detail) + ",\n" +
          "        },"
        );

      } else {

        //title only
        phaseLines.push(
          "        #{\n" +
          "            title: " + jsonToRhaiMod.emitRhaiString(phase.title) + ",\n" +
          "        },"
        );

      //end detail branch
      }

      //next phase
      i += 1;

    //end phase walk
    }

    //phases array block
    phasesBlock = "    phases: [\n" + phaseLines.join("\n") + "\n    ],";

    //append phases field
    lines.push(phasesBlock);

  //end phases field
  }

  //full map
  return "#{\n" + lines.join("\n") + "\n}";

//end emitMetaMap
}

/*
 * @description emit schema locals as Rhai maps from loaded JSON Schema objects
 * @param loadedSchemas - binding → schema object
 * @returns Rhai source declaring each schema local
 */
function emitSchemaLocals(loadedSchemas) {

  //variables
  let keys = null; //binding names
  let i = 0; //loop index
  let key = ""; //current binding
  let lines = []; //emitted lines
  let body = ""; //map body

  //stable order
  keys = Object.keys(loadedSchemas).sort();

  //nothing to emit
  if (keys.length === 0) {

    //empty preamble section
    return "";

  //end empty branch
  }

  //section banner
  lines.push("// json schemas embedded from disk (part of this build artifact; do not edit)");

  //emit each schema binding
  i = 0;

  //walk bindings
  while (i < keys.length) {

    //binding name
    key = keys[i];

    //convert schema object to Rhai map
    body = jsonToRhaiMod.jsonToRhai(loadedSchemas[key], "");

    //blank line before each binding after the first section comment is handled by join
    lines.push("let " + key + "_schema = " + body + ";");

    //next binding
    i += 1;

  //end binding walk
  }

  //join with blank lines between declarations for readability
  return lines[0] + "\n\n" + lines.slice(1).join("\n\n") + "\n";

//end emitSchemaLocals
}

/*
 * @description emit args preamble locals and required-arg pauses
 * @param argsDef - workflow.args map
 * @returns { source: string, argsLocals: object }
 */
function emitArgsPreamble(argsDef) {

  //variables
  const argsLocals = {}; //field → true for template scope
  let keys = null; //arg names
  let i = 0; //loop index
  let key = ""; //current arg
  let def = null; //raw author value for this arg
  let lines = []; //rhai lines
  let defaultLit = ""; //default literal
  let isPlainObject = false; //def is non-array object
  let onlyKeys = null; //object keys when inspecting forms
  let isRequired = false; //pause when missing
  let isOptionalUnit = false; //bind unit when missing, no default
  let hasLegacyDefault = false; //old { "default": ... } wrapper

  //no args section
  if (!argsDef || typeof argsDef !== "object" || Array.isArray(argsDef)) {

    //empty preamble
    return {
      source: "", //no source
      argsLocals: argsLocals, //empty locals
    };

  //end missing-args branch
  }

  //stable order
  keys = Object.keys(argsDef).sort();

  //section banner
  lines.push("//workflow args bound to locals");

  //emit each arg
  i = 0;

  //walk args
  while (i < keys.length) {

    //arg field name doubles as Rhai local
    key = assertIdent(keys[i], "args field");

    //value immediately after the key (default, true, {required:true}, or {})
    def = argsDef[keys[i]];

    //mark known for templates
    argsLocals[key] = true;

    //classify author form
    isPlainObject =
      def !== null &&
      typeof def === "object" &&
      !Array.isArray(def);
    onlyKeys = isPlainObject ? Object.keys(def) : null;
    isRequired =
      def === true ||
      (isPlainObject &&
        def.required === true &&
        onlyKeys.length === 1 &&
        onlyKeys[0] === "required");
    isOptionalUnit = isPlainObject && onlyKeys.length === 0;
    hasLegacyDefault =
      isPlainObject &&
      Object.prototype.hasOwnProperty.call(def, "default") &&
      onlyKeys.length === 1 &&
      onlyKeys[0] === "default";

    //legacy nested default clutters authoring — value goes on the key
    if (hasLegacyDefault) {

      //point authors at the flat form
      throw new Error(
        "args." + key +
        ": put the value directly after the key (e.g. \"" + key +
        "\": <value>) instead of { \"default\": ... }"
      );

    //end legacy guard
    }

    //required without default → pause when missing
    if (isRequired) {

      //bind from args or unit
      lines.push("let " + key + " = if args == () { () } else { args." + key + " };");

      //pause when missing
      lines.push(
        "if " + key + " == () { pause(\"verification\", " +
        jsonToRhaiMod.emitRhaiString("Pass args." + key + ".") +
        "); }"
      );

    } else if (isOptionalUnit) {

      //optional without default → unit when missing
      lines.push("let " + key + " = if args == () { () } else { args." + key + " };");

    } else {

      //value after the key is the default (string, number, array, object, …)
      defaultLit = jsonToRhaiMod.jsonToRhai(def, "");

      //bind with default when missing
      lines.push(
        "let " + key + " = if args == () || args." + key + " == () { " +
        defaultLit +
        " } else { args." + key + " };"
      );

    //end required/default branches
    }

    //next arg
    i += 1;

  //end arg walk
  }

  //return source and local map
  return {
    source: lines.join("\n") + "\n", //preamble source
    argsLocals: argsLocals, //template scope
  };

//end emitArgsPreamble
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

    //optional capability_mode
    if (typeof raw.capability_mode === "string") {

      //mode
      entry.capability_mode = raw.capability_mode;

    //end capability_mode
    }

    //optional schema binding names (prompt guidance only; not host-enforced)
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
 * @description Rhai lines that append Additional Schemas block onto station prompt extra
 * @param station - normalized station (may have schemas[])
 * @param loadedSchemas - binding → schema object
 * @param indent - leading whitespace for Rhai statements
 * @returns Rhai source (empty string when no schemas)
 */
function emitStationAdditionalSchemasAppend(station, loadedSchemas, indent) {

  //variables
  let lines = []; //rhai lines
  let i = 0; //index
  let binding = ""; //schema name
  let schemaJson = ""; //pretty JSON text
  let block = ""; //full section text
  let parts = []; //section pieces

  //nothing to append
  if (!Array.isArray(station.schemas) || station.schemas.length === 0) {

    //no section
    return "";

  //end empty
  }

  //heading + best-effort adjuration
  parts.push("");
  parts.push("## Additional Schemas");
  parts.push("");
  parts.push(
    "Make a best effort to conform to the following schemas wherever they apply, " +
    "as indicated by each schema's description (and related fields). " +
    "These guide how you read and write values inside the flow document " +
    "(especially under flow.state); they are not separately host-enforced beyond " +
    "the flow envelope output_schema."
  );
  parts.push("");

  //each referenced schema
  i = 0;

  //walk
  while (i < station.schemas.length) {

    //binding
    binding = station.schemas[i];

    //pretty-print schema for the prompt
    schemaJson = JSON.stringify(loadedSchemas[binding], null, 2);

    //subsection per binding
    parts.push("### " + binding);
    parts.push("");
    parts.push("```json");
    parts.push(schemaJson);
    parts.push("```");
    parts.push("");

    //next
    i += 1;

  //end walk
  }

  //joined section
  block = parts.join("\n");

  //append onto extra after author prompt files
  lines.push(indent + "//station schemas (prompt guidance; best effort)");
  lines.push(indent + "extra += " + jsonToRhaiMod.emitRhaiString(block) + ";");

  //rhai fragment
  return lines.join("\n");

//end emitStationAdditionalSchemasAppend
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
 * @description build the flow envelope JSON Schema object (optional payload subschema)
 * @param payloadSchema - inlined payload schema object, or null for open nullable payload
 * @returns envelope schema object
 */
function buildFlowEnvelopeSchema(payloadSchema) {

  //variables
  let payload = null; //payload property schema

  //payload: author schema or open object|null
  if (payloadSchema && typeof payloadSchema === "object") {

    //inlined author payload
    payload = payloadSchema;

  } else {

    //default open payload
    payload = {
      type: ["object", "null"], //nullable object
      description: "Workflow-specific payload (no payloadSchema declared)",
    };

  //end payload branch
  }

  //fixed envelope + modular payload
  return {
    type: "object",
    required: ["stations", "log", "current", "next", "msg", "state", "payload"],
    properties: {
      stations: {
        type: "array",
        items: { type: "string" },
      },
      log: {
        type: "array",
        items: {
          type: "object",
          required: ["station", "msg"],
          properties: {
            station: { type: "string" },
            msg: { type: "string" },
          },
        },
      },
      current: { type: ["string", "null"] },
      next: { type: ["string", "null"] },
      msg: { type: ["string", "null"] },
      state: {
        type: "object",
        additionalProperties: true,
      },
      payload: payload, //inlined or default
    },
  };

//end buildFlowEnvelopeSchema
}

/*
 * @description load optional workflow.payloadSchema and fully inline $refs
 * @param workflow - workflow document
 * @param baseDir - asset base
 * @returns inlined schema object or null when omitted
 */
function loadPayloadSchema(workflow, baseDir) {

  //variables
  let rel = ""; //path under schemas/
  let schemasDir = ""; //absolute schemas dir
  let inlined = null; //result

  //optional
  if (workflow.payloadSchema === undefined || workflow.payloadSchema === null) {

    //none
    return null;

  //end omit
  }

  //must be string path
  if (typeof workflow.payloadSchema !== "string" || workflow.payloadSchema.length === 0) {

    //bad
    throw new Error("workflow.payloadSchema must be a non-empty path under schemas/");

  //end type
  }

  //path under schemas root (legacy schemas/ or pack base)
  rel = workflow.payloadSchema;
  schemasDir = resolveSchemasDir(baseDir);

  //load + inline
  try {

    //resolve refs
    inlined = schemaInlineMod.loadAndInline(rel, schemasDir);

  } catch (err) {

    //log
    console.error("failed to load payloadSchema '" + rel + "'", err);

    //fail closed
    throw new Error(
      "failed to load workflow.payloadSchema '" + rel + "': " + err.message
    );

  //end load
  }

  //inlined payload schema
  return inlined;

//end loadPayloadSchema
}

/*
 * @description emit make_flow_schema() with optional inlined payload
 * @param payloadSchema - inlined payload schema or null
 * @returns Rhai source
 */
function emitMakeFlowSchemaFn(payloadSchema) {

  //variables
  let envelope = null; //JSON schema object
  let body = ""; //rhai map literal

  //build envelope (payload inlined into properties.payload)
  envelope = buildFlowEnvelopeSchema(payloadSchema);

  //emit as Rhai map
  body = jsonToRhaiMod.jsonToRhai(envelope, "    ");

  //function returning the envelope
  return (
    "//flow envelope schema (agent returns the full flow object; payload inlined at compile time)\n" +
    "fn make_flow_schema() {\n" +
    "    " + body + "\n" +
    "}\n"
  );

//end emitMakeFlowSchemaFn
}

/*
 * @description emit shared station_prompt + usage bookkeeping + run_station helpers
 * Host agent() returns tokens_used and duration_ms; wrapper records them on flow.state
 * (agents do not maintain these fields).
 * @returns Rhai source
 */
function emitFlowStationHelpers() {

  //standard imperatives; station-specific text is the extra argument
  return (
    "fn station_prompt(station_name, flow, extra) {\n" +
    "    let p = \"\";\n" +
    "    p += \"You are the workflow station named \\\"\" + station_name + \"\\\".\\n\";\n" +
    "    p += \"You receive a single JSON object called flow. You must return the FULL modified flow object.\\n\\n\";\n" +
    "    p += \"IMPERATIVES (do these in order):\\n\";\n" +
    "    p += \"1. FIRST set flow.next and flow.msg both to null.\\n\";\n" +
    "    p += \"2. Append one log entry to flow.log: { \\\"station\\\": \\\"\" + station_name + \"\\\", \\\"msg\\\": \\\"Hello from \" + station_name + \"\\\" }.\\n\";\n" +
    "    p += \"3. Ensure flow.state[\\\"\" + station_name + \"\\\"] is an object and set status to \\\"complete\\\". \";\n" +
    "    p += \"Preserve other keys on that object and other stations' state unless your station-specific rules say otherwise.\\n\";\n" +
    "    p += \"4. DEFAULT ROUTING: set flow.next to the station name immediately after flow.current in flow.stations \";\n" +
    "    p += \"(same array order). If this is the last station, set flow.next to null. \";\n" +
    "    p += \"Do not hard-code a successor by name for the default path — look it up on flow.stations. \";\n" +
    "    p += \"Only set flow.next to a different station name (or null early) when station-specific conditions require it.\\n\";\n" +
    "    p += \"5. You may set flow.msg for the next station, or leave it null.\\n\";\n" +
    "    p += \"6. Preserve flow.stations, flow.payload, prior log entries, and other stations' state " +
    "unless station-specific rules update payload.\\n\";\n" +
    "    p += \"7. Do not clear or rewrite flow.state.tokens, flow.state.elapsed, flow.state.token_total, \";\n" +
    "    p += \"flow.state.elapsed_total, or flow.state.station_run — the orchestrator owns those.\\n\";\n" +
    "    p += \"8. Return the complete modified flow object as your only structured result.\\n\";\n" +
    "    if extra != () && extra != \"\" {\n" +
    "        p += \"\\nSTATION-SPECIFIC INSTRUCTIONS:\\n\";\n" +
    "        p += extra;\n" +
    "        p += \"\\n\";\n" +
    "    }\n" +
    "    p += \"\\nCurrent flow JSON:\\n\";\n" +
    "    p += json_encode(flow);\n" +
    "    p\n" +
    "}\n" +
    "\n" +
    "//usage / visit bookkeeping on flow.state (orchestrator-owned; not agent-maintained)\n" +
    "fn ensure_usage_state(flow) {\n" +
    "    if flow.state == () {\n" +
    "        flow.state = #{};\n" +
    "    }\n" +
    "    if flow.state.tokens == () {\n" +
    "        flow.state.tokens = [];\n" +
    "    }\n" +
    "    if flow.state.elapsed == () {\n" +
    "        flow.state.elapsed = [];\n" +
    "    }\n" +
    "    if flow.state.token_total == () {\n" +
    "        flow.state.token_total = 0;\n" +
    "    }\n" +
    "    if flow.state.elapsed_total == () {\n" +
    "        flow.state.elapsed_total = 0;\n" +
    "    }\n" +
    "    if flow.state.station_run == () {\n" +
    "        flow.state.station_run = #{};\n" +
    "    }\n" +
    "    flow\n" +
    "}\n" +
    "\n" +
    "fn begin_station_visit(flow, station_name) {\n" +
    "    flow = ensure_usage_state(flow);\n" +
    "    let n = flow.state.station_run[station_name];\n" +
    "    if n == () {\n" +
    "        n = 0;\n" +
    "    }\n" +
    "    flow.state.station_run[station_name] = n + 1;\n" +
    "    flow\n" +
    "}\n" +
    "\n" +
    "fn record_usage_from_agent(flow, station_name, output) {\n" +
    "    flow = ensure_usage_state(flow);\n" +
    "    let tok = 0;\n" +
    "    let el = 0;\n" +
    "    if output != () {\n" +
    "        if output.tokens_used != () {\n" +
    "            tok = output.tokens_used;\n" +
    "        }\n" +
    "        if output.duration_ms != () {\n" +
    "            el = output.duration_ms;\n" +
    "        }\n" +
    "    }\n" +
    "    let tok_entry = #{};\n" +
    "    tok_entry[station_name] = tok;\n" +
    "    flow.state.tokens.push(tok_entry);\n" +
    "    let el_entry = #{};\n" +
    "    el_entry[station_name] = el;\n" +
    "    flow.state.elapsed.push(el_entry);\n" +
    "    flow.state.token_total = flow.state.token_total + tok;\n" +
    "    flow.state.elapsed_total = flow.state.elapsed_total + el;\n" +
    "    flow\n" +
    "}\n" +
    "\n" +
    "fn apply_agent_result(station_name, flow_before, output) {\n" +
    "    if output == () || !output.success || output.output == () {\n" +
    "        let flow = flow_before;\n" +
    "        flow = record_usage_from_agent(flow, station_name, output);\n" +
    "        flow.next = ();\n" +
    "        flow.msg = \"Station agent failed: \" + station_name;\n" +
    "        flow.log.push(#{\n" +
    "            station: station_name,\n" +
    "            msg: \"ORCHESTRATOR: agent failed; clearing next\",\n" +
    "        });\n" +
    "        return flow;\n" +
    "    }\n" +
    "    let flow = output.output;\n" +
    "    flow = ensure_usage_state(flow);\n" +
    "    flow.state.tokens = flow_before.state.tokens;\n" +
    "    flow.state.elapsed = flow_before.state.elapsed;\n" +
    "    flow.state.token_total = flow_before.state.token_total;\n" +
    "    flow.state.elapsed_total = flow_before.state.elapsed_total;\n" +
    "    flow.state.station_run = flow_before.state.station_run;\n" +
    "    flow = record_usage_from_agent(flow, station_name, output);\n" +
    "    flow\n" +
    "}\n" +
    "\n" +
    "fn run_station(station_name, flow, extra) {\n" +
    "    phase(station_name);\n" +
    "    flow.current = station_name;\n" +
    "    flow = begin_station_visit(flow, station_name);\n" +
    "    let output = agent(\n" +
    "        station_prompt(station_name, flow, extra),\n" +
    "        #{\n" +
    "            label: station_name,\n" +
    "            capability_mode: \"read-only\",\n" +
    "            output_schema: make_flow_schema(),\n" +
    "        }\n" +
    "    );\n" +
    "    apply_agent_result(station_name, flow, output)\n" +
    "}\n"
  );

//end emitFlowStationHelpers
}

/*
 * @description whether the workflow declares any args locals for station injection
 * @param ctx - compile context
 * @returns boolean
 */
function flowHasArgsLocals(ctx) {

  //has map with keys
  return !!(
    ctx &&
    ctx.argsLocals &&
    typeof ctx.argsLocals === "object" &&
    Object.keys(ctx.argsLocals).length > 0
  );

//end flowHasArgsLocals
}

/*
 * @description top-level Rhai: encode resolved args locals to workflow_args_json
 * (station fns cannot see outer lets or args — pass this string into each station)
 * @param ctx - compile context with argsLocals
 * @returns Rhai source or empty string
 */
function emitWorkflowArgsJsonLocal(ctx) {

  //variables
  let keys = null; //arg names
  let i = 0; //index
  let lines = []; //rhai
  let mapFields = []; //map fields

  //no args
  if (!flowHasArgsLocals(ctx)) {

    //empty
    return "";

  //end empty
  }

  //stable order
  keys = Object.keys(ctx.argsLocals).sort();
  i = 0;

  //walk
  while (i < keys.length) {

    //field from outer local (this runs at script top level, not inside a station fn)
    mapFields.push("    " + keys[i] + ": " + keys[i] + ",");

    //next
    i += 1;

  //end walk
  }

  //encode once for Fn(...).call(flow, workflow_args_json)
  lines.push("//JSON snapshot of workflow args — passed into station functions");
  lines.push("let workflow_args_json = json_encode(#{");
  lines.push(mapFields.join("\n"));
  lines.push("});");
  lines.push("");

  //source
  return lines.join("\n");

//end emitWorkflowArgsJsonLocal
}

/*
 * @description Rhai lines that append workflow_args_json onto station prompt extra
 * @param ctx - compile context with argsLocals
 * @param indent - leading whitespace
 * @returns Rhai source (empty when no args)
 */
function emitFlowArgsContextAppend(ctx, indent) {

  //variables
  let lines = []; //rhai

  //no args
  if (!flowHasArgsLocals(ctx)) {

    //empty
    return "";

  //end empty
  }

  //parameter workflow_args_json is passed into the station fn
  lines.push(indent + "//workflow args for source-agnostic station prompts");
  lines.push(indent + "extra += \"\\n## Workflow args (JSON)\\n\";");
  lines.push(indent + "extra += workflow_args_json + \"\\n\";");

  //fragment
  return lines.join("\n");

//end emitFlowArgsContextAppend
}

/*
 * @description emit one station function (fn Name(flow) { … })
 * @param station - normalized station
 * @param ctx - compile context (base, argsLocals)
 * @returns Rhai source
 */
function emitStationFunction(station, ctx) {

  //variables
  let lines = []; //source lines
  let scope = null; //template scope
  let promptBuild = ""; //extra body from prompt files
  let schemaAppend = ""; //Additional Schemas rhai fragment
  let argsAppend = ""; //workflow args JSON append
  let name = station.name; //fn name

  //template scope: args only (no step bindings in flow mode)
  scope = {
    argsLocals: ctx.argsLocals, //args
    knownVars: {}, //no step bindings
    itemAs: null, //no loop item
    indexAs: null, //no loop index
  };

  //resolve bindings → paths (or legacy paths), then load + merge in order
  promptBuild = templateMod.emitPromptBuild(
    "extra",
    loadPromptFiles(
      resolvePromptList(
        station.prompt,
        ctx.promptRegistry,
        "station " + name + ".prompt"
      ),
      ctx.base
    ),
    scope,
    "    "
  );

  //fn Name(flow) or Name(flow, workflow_args_json) — Rhai fns do not capture outer lets
  lines.push("//station: " + name);
  if (flowHasArgsLocals(ctx)) {

    //second param: JSON snapshot from top-level driver
    lines.push("fn " + name + "(flow, workflow_args_json) {");

  } else {

    //flow only
    lines.push("fn " + name + "(flow) {");

  //end signature
  }
  lines.push(promptBuild.trimEnd());

  //inject declared args as JSON (keeps prompt files free of hard-coded sources/paths)
  argsAppend = emitFlowArgsContextAppend(ctx, "    ");

  //append when present
  if (argsAppend.length > 0) {

    //args context
    lines.push(argsAppend);

  //end args append
  }

  //optional station schemas → Additional Schemas section on the prompt
  schemaAppend = emitStationAdditionalSchemasAppend(
    station,
    ctx.loadedSchemas,
    "    "
  );

  //append when present
  if (schemaAppend.length > 0) {

    //guidance block
    lines.push(schemaAppend);

  //end schema append
  }

  //optional capability / agent_type / label — re-call agent with overrides when needed
  //v1: always use run_station; stamp label from station when not default
  //capability_mode and agent_type on station: emit a local override of run_station inline when present
  if (
    typeof station.capability_mode === "string" ||
    typeof station.agent_type === "string" ||
    typeof station.label === "string"
  ) {

    //custom agent opts path (same usage bookkeeping as run_station)
    lines.push("    phase(" + jsonToRhaiMod.emitRhaiString(name) + ");");
    lines.push("    flow.current = " + jsonToRhaiMod.emitRhaiString(name) + ";");
    lines.push(
      "    flow = begin_station_visit(flow, " +
      jsonToRhaiMod.emitRhaiString(name) +
      ");"
    );
    lines.push("    let output = agent(");
    lines.push("        station_prompt(" + jsonToRhaiMod.emitRhaiString(name) + ", flow, extra),");
    lines.push("        #{");

    //label
    if (typeof station.label === "string") {

      //author label
      lines.push("            label: " + jsonToRhaiMod.emitRhaiString(station.label) + ",");

    } else {

      //default label = name
      lines.push("            label: " + jsonToRhaiMod.emitRhaiString(name) + ",");

    //end label
    }

    //capability
    if (typeof station.capability_mode === "string") {

      //mode
      lines.push(
        "            capability_mode: " +
        jsonToRhaiMod.emitRhaiString(station.capability_mode) +
        ","
      );

    } else {

      //default read-only
      lines.push("            capability_mode: \"read-only\",");

    //end capability
    }

    //agent_type
    if (typeof station.agent_type === "string") {

      //type
      lines.push(
        "            agent_type: " +
        jsonToRhaiMod.emitRhaiString(station.agent_type) +
        ","
      );

    //end agent_type
    }

    //schema
    lines.push("            output_schema: make_flow_schema(),");
    lines.push("        }");
    lines.push("    );");
    lines.push(
      "    apply_agent_result(" +
      jsonToRhaiMod.emitRhaiString(name) +
      ", flow, output)"
    );

  } else {

    //default helper path
    lines.push(
      "    run_station(" +
      jsonToRhaiMod.emitRhaiString(name) +
      ", flow, extra)"
    );

  //end custom vs default
  }

  //close fn
  lines.push("}");
  lines.push("");

  //joined
  return lines.join("\n");

//end emitStationFunction
}

/*
 * @description emit flow object, station functions, and next-dispatch driver
 * @param stations - normalized stations
 * @param ctx - compile context (includes payloadSchema?)
 * @returns Rhai source (body after meta/schemas/args)
 */
function emitFlowBody(stations, ctx) {

  //variables
  let parts = []; //sections
  let names = []; //station name list for flow.stations
  let i = 0; //index
  let payloadSchema = null; //optional inlined payload

  //payload from context (loaded earlier)
  if (ctx.payloadSchema) {

    //inlined
    payloadSchema = ctx.payloadSchema;

  //end payload
  }

  //collect names for flow.stations array
  i = 0;

  //walk
  while (i < stations.length) {

    //name as Rhai string
    names.push(jsonToRhaiMod.emitRhaiString(stations[i].name));

    //next
    i += 1;

  //end name walk
  }

  //flow object at top of body (after meta in assemble order we emit flow after args)
  parts.push("//flow object — stations drive phases, functions, and routing");
  parts.push("let flow = #{");
  parts.push("    stations: [" + names.join(", ") + "],");
  parts.push("    log: [],");
  parts.push("    current: (),");
  parts.push("    next: (),");
  parts.push("    msg: (),");
  parts.push("    state: #{");
  parts.push("        tokens: [],");
  parts.push("        elapsed: [],");
  parts.push("        token_total: 0,");
  parts.push("        elapsed_total: 0,");
  parts.push("        station_run: #{},");
  parts.push("    },");
  parts.push("    payload: (),");
  parts.push("};");
  parts.push("");

  //schema + helpers (payload subschema inlined into envelope)
  parts.push(emitMakeFlowSchemaFn(payloadSchema));
  parts.push("");
  parts.push(emitFlowStationHelpers());
  parts.push("");

  //one fn per station
  i = 0;

  //walk stations
  while (i < stations.length) {

    //emit fn
    parts.push(emitStationFunction(stations[i], ctx));

    //next
    i += 1;

  //end station fn walk
  }

  //encode args at top level (after station defs; before driver) for Fn.call second arg
  parts.push(emitWorkflowArgsJsonLocal(ctx));

  //driver: start at first station, dispatch by flow.next
  parts.push("//driver: route by flow.next until null");
  parts.push("flow.next = flow.stations[0];");
  parts.push("while flow.next != () {");
  parts.push("    log(\"Dispatching station: \" + flow.next);");
  if (flowHasArgsLocals(ctx)) {

    //pass JSON snapshot — station fns cannot see outer lets or args
    parts.push("    flow = Fn(flow.next).call(flow, workflow_args_json);");

  } else {

    //flow only
    parts.push("    flow = Fn(flow.next).call(flow);");

  //end call arity
  }
  parts.push("}");
  parts.push("");
  parts.push("complete(#{");
  parts.push("    flow: flow,");
  parts.push("    flow_json: json_encode(flow),");
  parts.push("});");
  parts.push("");

  //joined body
  return parts.join("\n");

//end emitFlowBody
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
  let baseDir = ""; //absolute asset base (schemas/ + prompts/)
  let loadedSchemas = null; //binding → schema object
  let argsPreamble = null; //args source + locals
  let ctx = null; //compile context
  let parts = []; //source sections
  let header = ""; //file header comment
  let rhai = ""; //full script
  let keywordSet = null; //reserved keywords
  let scanHits = null; //layer B findings
  let si = 0; //scan index
  let report = ""; //keyword error text
  let stations = null; //normalized stations
  let metaWorkflow = null; //workflow object for emitMeta
  let bodySource = ""; //flow body
  let promptRegistry = null; //workflow.prompts map or null

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

    //load schemas from {base}/schemas
    loadedSchemas = loadSchemas(workflow.schemas, baseDir);

    //args preamble
    argsPreamble = emitArgsPreamble(workflow.args);

    //top-level prompt registry (optional; stations use binding names when set)
    promptRegistry = normalizePromptRegistry(workflow.prompts);

    //compile context
    ctx = {
      argsLocals: argsPreamble.argsLocals, //template args
      knownVars: {}, //unused in flow (kept for template API)
      declaredLets: {}, //names already introduced with let
      loadedSchemas: loadedSchemas, //schemas
      payloadSchema: null, //optional payload
      promptRegistry: promptRegistry, //binding → path or null
      workflowArgs: workflow.args || null, //raw args def
      base: baseDir, //prompts + schema root
      keywordViolations: activeKeywordCtx.keywordViolations, //shared list
    };

    //args are already let-bound in the preamble
    Object.keys(argsPreamble.argsLocals).forEach(function markArgDeclared(argName) {

      //arg local exists as let
      ctx.declaredLets[argName] = true;

    //end forEach
    });

    //file header: mark IR as build artifact (analysis only; not an edit surface)
    header =
      "// =============================================================================\n" +
      "// BUILD ARTIFACT — generated by rhaiteous\n" +
      "// Suitable for analysis and debugging only. Do not edit this file.\n" +
      "// Authoring surface: workflow JSON (+ schemas + prompts). Recompile after changes.\n" +
      "// Hand-edits will be overwritten on the next compile and are not supported.\n" +
      "// scriptType: flow\n" +
      "// =============================================================================\n";

    //normalize stations
    stations = normalizeStations(workflow.stations);

    //station schemas[] must resolve against top-level workflow.schemas
    assertStationSchemasResolved(stations, loadedSchemas);

    //optional payload schema (file under schemas/, $ref inlined)
    ctx.payloadSchema = loadPayloadSchema(workflow, baseDir);

    //meta with derived phases
    metaWorkflow = {
      name: workflow.name, //name
      description: workflow.description, //description
      phases: phasesFromStations(stations), //from stations[]
    };

    //body: flow object + fns + driver
    bodySource = emitFlowBody(stations, ctx);

    //assemble sections
    parts.push(header);
    parts.push(emitMeta(metaWorkflow));
    parts.push(emitSchemaLocals(loadedSchemas));
    parts.push(argsPreamble.source);
    parts.push(bodySource);

    //full script
    rhai = parts.filter(function keepNonEmpty(section) {

      //drop empty sections
      return typeof section === "string" && section.length > 0;

    //end filter
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
      scriptType: "flow", //flow-only product
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

  //compile with shared base
  result = compileWorkflow(workflow, {
    base: baseDir, //schemas + prompts root
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
  loadPromptFiles: loadPromptFiles,
  normalizePromptRegistry: normalizePromptRegistry,
  resolvePromptList: resolvePromptList,
  resolveBaseDir: resolveBaseDir,
  resolveSchemasDir: resolveSchemasDir,
  resolvePromptsDir: resolvePromptsDir,
  jsonToRhai: jsonToRhaiMod.jsonToRhai,
  assertWorkflowName: assertWorkflowName,
  assertIdent: assertIdent,
};
