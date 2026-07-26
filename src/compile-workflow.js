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

/*
 * @description validate that a name is a safe Rhai / workflow identifier
 * @param name - candidate identifier
 * @param label - field name for errors
 * @returns the same name when valid
 */
function assertIdent(name, label) {

  //variables
  const pattern = /^[A-Za-z_][A-Za-z0-9_]*$/; //rhai-friendly ident

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

  //schemas live under base/schemas
  schemasDir = nodePath.join(baseDir, "schemas");

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

    //store loaded schema
    loaded[key] = doc;

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
    throw new Error("prompt must be a non-empty array of source file names under prompts/");

  //end array guard
  }

  //prompts live under base/prompts
  promptsDir = nodePath.join(baseDir, "prompts");

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

      //optional detail
      if (typeof phaseIn.detail === "string") {

        //include detail
        phaseOut.detail = phaseIn.detail;

      //end detail branch
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
  lines.push("//json schemas loaded from disk (generated; do not hand-edit)");

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
  let def = null; //arg definition
  let lines = []; //rhai lines
  let defaultLit = ""; //default literal

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

    //definition object
    def = argsDef[keys[i]];

    //normalize shorthand: true means required
    if (def === true) {

      //required without default
      def = {
        required: true, //must be present
      };

    //end true shorthand
    }

    //require object definition
    if (!def || typeof def !== "object" || Array.isArray(def)) {

      //bad definition
      throw new Error("args." + key + " must be an object or true");

    //end def guard
    }

    //mark known for templates
    argsLocals[key] = true;

    //required without default → pause when missing
    if (def.required && def.default === undefined) {

      //bind from args or unit
      lines.push("let " + key + " = if args == () { () } else { args." + key + " };");

      //pause when missing
      lines.push(
        "if " + key + " == () { pause(\"verification\", " +
        jsonToRhaiMod.emitRhaiString("Pass args." + key + ".") +
        "); }"
      );

    } else if (def.default !== undefined) {

      //emit default literal
      defaultLit = jsonToRhaiMod.jsonToRhai(def.default, "");

      //bind with default when missing
      lines.push(
        "let " + key + " = if args == () || args." + key + " == () { " +
        defaultLit +
        " } else { args." + key + " };"
      );

    } else {

      //optional without default → unit when missing
      lines.push("let " + key + " = if args == () { () } else { args." + key + " };");

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
 * @description resolve output_schema field to a Rhai expression (binding_schema or inline)
 * @param spec - string binding name or object schema
 * @param loadedSchemas - loaded schema bindings
 * @returns Rhai expression for output_schema
 */
function resolveOutputSchemaExpr(spec, loadedSchemas) {

  //variables
  let binding = ""; //schema binding name

  //omitted schema
  if (spec === undefined || spec === null) {

    //no expression
    return null;

  //end omitted branch
  }

  //string → named binding loaded from disk
  if (typeof spec === "string") {

    //binding name
    binding = assertIdent(spec, "output_schema binding");

    //must be loaded
    if (!loadedSchemas[binding]) {

      //unknown schema
      throw new Error("output_schema '" + binding + "' was not declared in workflow.schemas");

    //end known guard
    }

    //compiler emits let <binding>_schema = ...
    return binding + "_schema";

  //end string branch
  }

  //inline object schema (discouraged but supported)
  if (typeof spec === "object" && !Array.isArray(spec)) {

    //emit inline map
    return jsonToRhaiMod.jsonToRhai(spec, "    ");

  //end inline branch
  }

  //bad type
  throw new Error("output_schema must be a schema binding name or a JSON object");

//end resolveOutputSchemaExpr
}

/*
 * @description emit agent option map fields shared by agent and parallel jobs
 * @param step - step object
 * @param promptVar - rhai variable holding the prompt string
 * @param loadedSchemas - schema bindings
 * @param indent - line indent
 * @returns Rhai map body fields (without outer #{})
 */
function emitAgentOptsFields(step, promptVar, loadedSchemas, indent) {

  //variables
  let lines = []; //field lines
  let schemaExpr = null; //output_schema expression

  //prompt is required
  lines.push(indent + "prompt: " + promptVar + ",");

  //optional label
  if (typeof step.label === "string") {

    //static label string
    lines.push(indent + "label: " + jsonToRhaiMod.emitRhaiString(step.label) + ",");

  //end label branch
  }

  //optional agent_type
  if (typeof step.agent_type === "string") {

    //agent type name
    lines.push(indent + "agent_type: " + jsonToRhaiMod.emitRhaiString(step.agent_type) + ",");

  //end agent_type branch
  }

  //optional capability_mode
  if (typeof step.capability_mode === "string") {

    //capability mode
    lines.push(indent + "capability_mode: " + jsonToRhaiMod.emitRhaiString(step.capability_mode) + ",");

  //end capability branch
  }

  //optional output_schema
  schemaExpr = resolveOutputSchemaExpr(step.output_schema, loadedSchemas);

  //include schema when present
  if (schemaExpr !== null) {

    //schema expression
    lines.push(indent + "output_schema: " + schemaExpr + ",");

  //end schema branch
  }

  //joined fields
  return lines.join("\n");

//end emitAgentOptsFields
}

/*
 * @description emit a single agent step
 * @param step - agent step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitAgentStep(step, ctx) {

  //variables
  let asName = ""; //result binding
  let lines = []; //source lines
  let scope = null; //template scope
  let promptBuild = ""; //prompt build block
  let fields = ""; //opts fields

  //require result binding
  asName = assertIdent(step.as, "agent.as");

  //template scope from context
  scope = {
    argsLocals: ctx.argsLocals, //args
    knownVars: ctx.knownVars, //prior bindings
    itemAs: null, //no loop item
    indexAs: null, //no loop index
  };

  //load prompt source files from {base}/prompts, then expand {{templates}}
  promptBuild = templateMod.emitPromptBuild(
    "p",
    loadPromptFiles(step.prompt, ctx.base),
    scope,
    ""
  );

  //opts fields
  fields = emitAgentOptsFields(step, "p", ctx.loadedSchemas, "  ");

  //comment and assignment
  lines.push("//agent step: " + asName);
  lines.push(promptBuild.trimEnd());
  lines.push("let " + asName + " = agent(p, #{\n" + fields + "\n});");

  //register binding
  ctx.knownVars[asName] = true;

  //joined source
  return lines.join("\n") + "\n";

//end emitAgentStep
}

/*
 * @description emit a parallel_over step that fans out over an array binding
 * @param step - parallel step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitParallelStep(step, ctx) {

  //variables
  let asName = ""; //results binding
  let overName = ""; //array to iterate
  let itemAs = ""; //loop item local
  let indexAs = ""; //loop index local
  let jobsName = ""; //jobs array local
  let labelPrefix = ""; //label prefix
  let lines = []; //source lines
  let scope = null; //template scope
  let promptBuild = ""; //inner prompt build
  let fields = ""; //job opts
  let labelExpr = ""; //label rhai expression

  //result binding
  asName = assertIdent(step.as, "parallel.as");

  //array source binding
  overName = assertIdent(step.over, "parallel.over");

  //require known collection
  if (!ctx.knownVars[overName]) {

    //unknown over target
    throw new Error("parallel.over '" + overName + "' is not a known binding");

  //end over guard
  }

  //loop item name
  itemAs = assertIdent(step.item_as || "item", "parallel.item_as");

  //loop index name
  indexAs = assertIdent(step.index_as || "index", "parallel.index_as");

  //jobs array name derived from result binding
  jobsName = asName + "_jobs";

  //label prefix
  labelPrefix = typeof step.label_prefix === "string" ? step.label_prefix : asName;

  //template scope includes loop locals
  scope = {
    argsLocals: ctx.argsLocals, //args
    knownVars: ctx.knownVars, //prior bindings
    itemAs: itemAs, //loop item
    indexAs: indexAs, //loop index
  };

  //also expose item/index aliases in knownVars for ref roots during prompt build
  scope.knownVars = Object.assign({}, ctx.knownVars);
  scope.knownVars[itemAs] = true;
  scope.knownVars[indexAs] = true;

  //load prompt source files from {base}/prompts, then expand {{templates}}
  promptBuild = templateMod.emitPromptBuild(
    "p",
    loadPromptFiles(step.prompt, ctx.base),
    scope,
    "  "
  );

  //job fields (label handled separately for dynamic index)
  fields = emitAgentOptsFields(
    {
      agent_type: step.agent_type, //type
      capability_mode: step.capability_mode, //mode
      output_schema: step.output_schema, //schema
      label: undefined, //dynamic label below
      prompt: step.prompt, //unused here
    },
    "p",
    ctx.loadedSchemas,
    "    "
  );

  //dynamic label with index
  labelExpr =
    jsonToRhaiMod.emitRhaiString(labelPrefix + ":") +
    " + " +
    indexAs +
    ".to_string()";

  //emit parallel fan-out
  lines.push("//parallel over " + overName + " → " + asName);
  lines.push("let " + jobsName + " = [];");
  lines.push("let " + indexAs + " = 0;");
  lines.push("for " + itemAs + " in " + overName + " {");
  lines.push(promptBuild.trimEnd());
  lines.push("  " + jobsName + ".push(#{");
  lines.push(fields);
  lines.push("    label: " + labelExpr + ",");
  lines.push("  });");
  lines.push("  " + indexAs + " += 1;");
  lines.push("}");
  lines.push("let " + asName + " = parallel(" + jobsName + ");");

  //register results binding
  ctx.knownVars[asName] = true;

  //joined source
  return lines.join("\n") + "\n";

//end emitParallelStep
}

/*
 * @description emit collect: merge a nested array field from parallel agent results
 * @param step - collect step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitCollectStep(step, ctx) {

  //variables
  let asName = ""; //output array
  let fromName = ""; //parallel results
  let field = ""; //output field name
  let lines = []; //source lines

  //bindings
  asName = assertIdent(step.as, "collect.as");
  fromName = assertIdent(step.from, "collect.from");
  field = assertIdent(step.field, "collect.field");

  //require known from
  if (!ctx.knownVars[fromName]) {

    //unknown source
    throw new Error("collect.from '" + fromName + "' is not a known binding");

  //end from guard
  }

  //emit merge loop
  lines.push("//collect " + fromName + "[].output." + field + " → " + asName);
  lines.push("let " + asName + " = [];");
  lines.push("for r in " + fromName + " {");
  lines.push("  if r != () && r.success && r.output." + field + " != () {");
  lines.push("    for item in r.output." + field + " {");
  lines.push("      " + asName + ".push(item);");
  lines.push("    }");
  lines.push("  }");
  lines.push("}");

  //register binding
  ctx.knownVars[asName] = true;

  //joined source
  return lines.join("\n") + "\n";

//end emitCollectStep
}

/*
 * @description emit zip_filter: keep left items whose parallel verdict says real=true
 * @param step - zip_filter step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitZipFilterStep(step, ctx) {

  //variables
  let asName = ""; //survivors binding
  let droppedAs = ""; //dropped ids binding
  let leftName = ""; //candidates
  let rightName = ""; //verdicts parallel results
  let lines = []; //source lines

  //bindings
  asName = assertIdent(step.as, "zip_filter.as");
  leftName = assertIdent(step.left, "zip_filter.left");
  rightName = assertIdent(step.right, "zip_filter.right");

  //optional dropped list
  droppedAs = step.dropped_as ? assertIdent(step.dropped_as, "zip_filter.dropped_as") : null;

  //require known inputs
  if (!ctx.knownVars[leftName]) {

    //unknown left
    throw new Error("zip_filter.left '" + leftName + "' is not a known binding");

  //end left guard
  }

  //require known right
  if (!ctx.knownVars[rightName]) {

    //unknown right
    throw new Error("zip_filter.right '" + rightName + "' is not a known binding");

  //end right guard
  }

  //emit zip filter
  lines.push("//zip_filter " + leftName + " with " + rightName + " → " + asName);
  lines.push("let " + asName + " = [];");

  //optional dropped accumulator
  if (droppedAs) {

    //dropped ids
    lines.push("let " + droppedAs + " = [];");

  //end dropped init
  }

  //index walk
  lines.push("let zi = 0;");
  lines.push("for v in " + rightName + " {");
  lines.push("  let cand = " + leftName + "[zi];");
  //evidence is an array of {source, quote}; require a non-empty list
  lines.push("  if v != () && v.success && v.output.real == true && v.output.evidence != () && v.output.evidence.len() > 0 {");
  lines.push("    " + asName + ".push(cand);");
  lines.push("  } else {");

  //dropped branch
  if (droppedAs) {

    //record dropped id when present
    lines.push("    " + droppedAs + ".push(cand.id);");

  //end dropped push
  }

  //close else and loop
  lines.push("  }");
  lines.push("  zi += 1;");
  lines.push("}");

  //register survivors
  ctx.knownVars[asName] = true;

  //register dropped when used
  if (droppedAs) {

    //known dropped
    ctx.knownVars[droppedAs] = true;

  //end dropped register
  }

  //joined source
  return lines.join("\n") + "\n";

//end emitZipFilterStep
}

/*
 * @description emit a complete() value tree with optional { "$ref": "binding" } nodes
 * @param value - static JSON or $ref markers
 * @param ctx - compiler context for known bindings
 * @param indent - current indent for nested maps/arrays
 * @returns Rhai expression source
 */
function emitCompleteValue(value, ctx, indent) {

  //variables
  let refName = ""; //$ref binding
  let keys = null; //object keys
  let i = 0; //loop index
  let key = ""; //field name
  let parts = []; //nested lines
  let nextIndent = ""; //child indent

  //default indent
  if (!indent) {

    //root indent
    indent = "";

  //end default indent
  }

  //live binding reference
  if (value && typeof value === "object" && !Array.isArray(value) && typeof value.$ref === "string") {

    //binding name
    refName = assertIdent(value.$ref, "complete.$ref");

    //must be known
    if (!ctx.knownVars[refName]) {

      //unknown ref
      throw new Error("complete $ref '" + refName + "' is not a known binding");

    //end known guard
    }

    //bare rhai identifier
    return refName;

  //end $ref branch
  }

  //null / scalars / arrays without $ref → standard json emitter
  if (value === null || typeof value !== "object") {

    //scalar or null
    return jsonToRhaiMod.jsonToRhai(value, indent);

  //end scalar branch
  }

  //arrays: recurse for possible $ref elements
  if (Array.isArray(value)) {

    //empty array
    if (value.length === 0) {

      //empty
      return "[]";

    //end empty array
    }

    //child indent
    nextIndent = indent + "  ";

    //collect elements
    parts = [];

    //walk elements
    i = 0;

    //each element
    while (i < value.length) {

      //emit element
      parts.push(nextIndent + emitCompleteValue(value[i], ctx, nextIndent) + ",");

      //next
      i += 1;

    //end element walk
    }

    //multi-line array
    return "[\n" + parts.join("\n") + "\n" + indent + "]";

  //end array branch
  }

  //objects as maps (sorted keys for stability)
  keys = Object.keys(value).sort();

  //empty map
  if (keys.length === 0) {

    //empty
    return "#{}";

  //end empty map
  }

  //child indent
  nextIndent = indent + "  ";

  //field lines
  parts = [];

  //walk keys
  i = 0;

  //each field
  while (i < keys.length) {

    //field name
    key = keys[i];

    //field line
    parts.push(
      nextIndent +
      jsonToRhaiMod.emitRhaiMapKey(key) +
      ": " +
      emitCompleteValue(value[key], ctx, nextIndent) +
      ","
    );

    //next key
    i += 1;

  //end key walk
  }

  //multi-line map
  return "#{\n" + parts.join("\n") + "\n" + indent + "}";

//end emitCompleteValue
}

/*
 * @description emit complete with a JSON-like value (supports { "$ref": "binding" })
 * @param step - complete step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitCompleteStep(step, ctx) {

  //variables
  let valueSrc = ""; //rhai value

  //require value object
  if (step.value === undefined) {

    //missing value
    throw new Error("complete.value is required");

  //end value guard
  }

  //emit value as Rhai (with optional $ref nodes)
  valueSrc = emitCompleteValue(step.value, ctx, "");

  //complete call
  return "//complete run\ncomplete(" + valueSrc + ");\n";

//end emitCompleteStep
}

/*
 * @description emit complete that merges a result binding's output with extra static fields
 * @param step - complete_from step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitCompleteFromStep(step, ctx) {

  //variables
  let fromName = ""; //agent result binding
  let lines = []; //source lines
  let extra = null; //extra static fields
  let keys = null; //extra keys
  let i = 0; //loop index
  let key = ""; //field name
  let mapFields = []; //map field lines

  //source binding
  fromName = assertIdent(step.from, "complete_from.from");

  //must be known
  if (!ctx.knownVars[fromName]) {

    //unknown from
    throw new Error("complete_from.from '" + fromName + "' is not a known binding");

  //end from guard
  }

  //optional extra static fields
  extra = step.extra && typeof step.extra === "object" && !Array.isArray(step.extra) ? step.extra : {};

  //build map fields starting with output passthrough helpers is hard in Rhai without spread
  //emit: complete(#{ summary: from.output.summary, ... static, output: from.output }) pattern
  //simpler approach: complete(from.output) when no extra; else build map with known keys from extra + from_output field
  mapFields = [];

  //when extras exist, emit them first
  keys = Object.keys(extra).sort();

  //walk extras
  i = 0;

  //each extra field
  while (i < keys.length) {

    //field name
    key = keys[i];

    //static field
    mapFields.push("  " + jsonToRhaiMod.emitRhaiMapKey(key) + ": " + jsonToRhaiMod.jsonToRhai(extra[key], "  ") + ",");

    //next
    i += 1;

  //end extra walk
  }

  //include full agent output under output key and common passthrough of issues when use_output_fields
  if (step.pass_output === true) {

    //attach entire output object
    mapFields.push("  output: " + fromName + ".output,");

  //end pass_output
  }

  //default: complete with the agent's output object when no map fields
  if (mapFields.length === 0) {

    //direct complete of output
    lines.push("//complete from " + fromName + ".output");
    lines.push("complete(" + fromName + ".output);");

  } else {

    //map complete
    lines.push("//complete from " + fromName + " with extra fields");
    lines.push("complete(#{");
    lines.push(mapFields.join("\n"));
    lines.push("});");

  //end map branch
  }

  //joined source
  return lines.join("\n") + "\n";

//end emitCompleteFromStep
}

/*
 * @description emit if_empty: when an array binding has length 0, run nested steps (usually complete)
 * @param step - if_empty step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitIfEmptyStep(step, ctx) {

  //variables
  let pathName = ""; //array binding
  let lines = []; //source lines
  let inner = ""; //nested steps source

  //array binding
  pathName = assertIdent(step.path, "if_empty.path");

  //must be known
  if (!ctx.knownVars[pathName]) {

    //unknown path
    throw new Error("if_empty.path '" + pathName + "' is not a known binding");

  //end path guard
  }

  //require then steps
  if (!Array.isArray(step.then) || step.then.length === 0) {

    //missing then
    throw new Error("if_empty.then must be a non-empty step array");

  //end then guard
  }

  //compile nested steps
  inner = emitSteps(step.then, ctx, "  ");

  //emit if
  lines.push("//if_empty " + pathName);
  lines.push("if " + pathName + ".len() == 0 {");
  lines.push(inner.trimEnd());
  lines.push("}");

  //joined source
  return lines.join("\n") + "\n";

//end emitIfEmptyStep
}

/*
 * @description emit if_failed: when agent result missing or unsuccessful, run then steps
 * @param step - if_failed step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitIfFailedStep(step, ctx) {

  //variables
  let pathName = ""; //result binding
  let lines = []; //source lines
  let inner = ""; //nested steps

  //result binding
  pathName = assertIdent(step.path, "if_failed.path");

  //must be known
  if (!ctx.knownVars[pathName]) {

    //unknown path
    throw new Error("if_failed.path '" + pathName + "' is not a known binding");

  //end path guard
  }

  //require then
  if (!Array.isArray(step.then) || step.then.length === 0) {

    //missing then
    throw new Error("if_failed.then must be a non-empty step array");

  //end then guard
  }

  //nested steps
  inner = emitSteps(step.then, ctx, "  ");

  //emit guard
  lines.push("//if_failed " + pathName);
  lines.push("if " + pathName + " == () || !" + pathName + ".success {");
  lines.push(inner.trimEnd());
  lines.push("}");

  //joined source
  return lines.join("\n") + "\n";

//end emitIfFailedStep
}

/*
 * @description emit bind: copy a field path from an agent result into a new local
 * @param step - bind step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitBindStep(step, ctx) {

  //variables
  let asName = ""; //new local
  let fromName = ""; //result binding
  let field = ""; //output field
  let lines = []; //source lines

  //names
  asName = assertIdent(step.as, "bind.as");
  fromName = assertIdent(step.from, "bind.from");
  field = assertIdent(step.field, "bind.field");

  //require known from
  if (!ctx.knownVars[fromName]) {

    //unknown from
    throw new Error("bind.from '" + fromName + "' is not a known binding");

  //end from guard
  }

  //emit bind from output field
  lines.push("//bind " + fromName + ".output." + field + " → " + asName);
  lines.push("let " + asName + " = " + fromName + ".output." + field + ";");

  //register
  ctx.knownVars[asName] = true;

  //joined
  return lines.join("\n") + "\n";

//end emitBindStep
}

/*
 * @description emit log step with template support
 * @param step - log step
 * @param ctx - compiler context
 * @returns Rhai source
 */
function emitLogStep(step, ctx) {

  //variables
  let scope = null; //template scope
  let build = ""; //prompt-style build for message
  let lines = []; //source lines

  //require message
  if (typeof step.message !== "string" && !Array.isArray(step.message)) {

    //bad message
    throw new Error("log.message must be a string or array of strings");

  //end message guard
  }

  //scope
  scope = {
    argsLocals: ctx.argsLocals, //args
    knownVars: ctx.knownVars, //bindings
    itemAs: null, //no item
    indexAs: null, //no index
  };

  //build message into m
  build = templateMod.emitPromptBuild("m", step.message, scope, "");

  //log call
  lines.push("//log progress");
  lines.push(build.trimEnd());
  lines.push("log(m);");

  //joined
  return lines.join("\n") + "\n";

//end emitLogStep
}

/*
 * @description emit phase marker
 * @param step - phase step
 * @returns Rhai source
 */
function emitPhaseStep(step) {

  //require title
  if (typeof step.title !== "string" || step.title.length === 0) {

    //missing title
    throw new Error("phase.title must be a non-empty string");

  //end title guard
  }

  //phase call
  return "//phase " + step.title + "\nphase(" + jsonToRhaiMod.emitRhaiString(step.title) + ");\n";

//end emitPhaseStep
}

/*
 * @description emit pause or await_user
 * @param step - pause or await_user step
 * @returns Rhai source
 */
function emitGateStep(step) {

  //variables
  let kind = ""; //pause kind
  let message = ""; //user message
  let fn = ""; //pause or await_user

  //function name from op
  fn = step.op === "await_user" ? "await_user" : "pause";

  //kind default
  kind = typeof step.kind === "string" ? step.kind : "verification";

  //message required
  if (typeof step.message !== "string" || step.message.length === 0) {

    //missing message
    throw new Error(fn + ".message must be a non-empty string");

  //end message guard
  }

  //message value
  message = step.message;

  //gate call
  return (
    "//" + fn + "\n" +
    fn + "(" +
    jsonToRhaiMod.emitRhaiString(kind) +
    ", " +
    jsonToRhaiMod.emitRhaiString(message) +
    ");\n"
  );

//end emitGateStep
}

/*
 * @description emit a list of steps with optional indent prefix on each line
 * @param steps - step array
 * @param ctx - compiler context
 * @param indent - prefix for each line
 * @returns Rhai source
 */
function emitSteps(steps, ctx, indent) {

  //variables
  let i = 0; //step index
  let step = null; //current step
  let chunk = ""; //emitted step source
  let parts = []; //chunks
  let lines = null; //indented lines
  let j = 0; //line index

  //default indent
  if (!indent) {

    //no indent
    indent = "";

  //end default indent
  }

  //require array
  if (!Array.isArray(steps)) {

    //bad steps
    throw new Error("steps must be an array");

  //end steps guard
  }

  //walk steps
  i = 0;

  //each step
  while (i < steps.length) {

    //current step
    step = steps[i];

    //require op
    if (!step || typeof step !== "object" || typeof step.op !== "string") {

      //bad step
      throw new Error("steps[" + i + "] must be an object with string op");

    //end step guard
    }

    //dispatch on op
    if (step.op === "phase") {

      //phase marker
      chunk = emitPhaseStep(step);

    } else if (step.op === "log") {

      //log line
      chunk = emitLogStep(step, ctx);

    } else if (step.op === "agent") {

      //single agent
      chunk = emitAgentStep(step, ctx);

    } else if (step.op === "parallel") {

      //fan-out
      chunk = emitParallelStep(step, ctx);

    } else if (step.op === "collect") {

      //merge arrays
      chunk = emitCollectStep(step, ctx);

    } else if (step.op === "zip_filter") {

      //verdict filter
      chunk = emitZipFilterStep(step, ctx);

    } else if (step.op === "bind") {

      //field bind
      chunk = emitBindStep(step, ctx);

    } else if (step.op === "if_empty") {

      //empty guard
      chunk = emitIfEmptyStep(step, ctx);

    } else if (step.op === "if_failed") {

      //failure guard
      chunk = emitIfFailedStep(step, ctx);

    } else if (step.op === "complete") {

      //complete with optional $ref bindings
      chunk = emitCompleteStep(step, ctx);

    } else if (step.op === "complete_from") {

      //complete from binding
      chunk = emitCompleteFromStep(step, ctx);

    } else if (step.op === "pause" || step.op === "await_user") {

      //human gate
      chunk = emitGateStep(step);

    } else {

      //unknown op
      throw new Error("steps[" + i + "]: unsupported op '" + step.op + "'");

    //end op dispatch
    }

    //apply indent to each line when nested
    if (indent.length > 0) {

      //split chunk lines
      lines = chunk.split("\n");

      //rejoin with indent (preserve empty trailing)
      j = 0;

      //indent non-empty lines
      while (j < lines.length) {

        //indent content lines
        if (lines[j].length > 0) {

          //prefix indent
          lines[j] = indent + lines[j];

        //end indent one line
        }

        //next line
        j += 1;

      //end line indent walk
      }

      //rebuild chunk
      chunk = lines.join("\n");

    //end indent apply
    }

    //store chunk
    parts.push(chunk);

    //next step
    i += 1;

  //end step walk
  }

  //join steps with blank lines
  return parts.join("\n");

//end emitSteps
}

/*
 * @description compile a workflow object into Rhai source text
 * @param workflow - parsed workflow document
 * @param options - { base?: string, baseDir?: string } asset root with schemas/ and prompts/
 * @returns { name, rhai, loadedSchemas, base }
 */
function compileWorkflow(workflow, options) {

  //variables
  let baseDir = ""; //absolute asset base (schemas/ + prompts/)
  let loadedSchemas = null; //binding → schema object
  let argsPreamble = null; //args source + locals
  let ctx = null; //step emit context
  let parts = []; //source sections
  let stepsSource = ""; //body source
  let header = ""; //file header comment

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

  //load schemas from {base}/schemas
  loadedSchemas = loadSchemas(workflow.schemas, baseDir);

  //args preamble
  argsPreamble = emitArgsPreamble(workflow.args);

  //step context
  ctx = {
    argsLocals: argsPreamble.argsLocals, //template args
    knownVars: {}, //bindings introduced by steps
    loadedSchemas: loadedSchemas, //schemas
    base: baseDir, //prompts + schema root
  };

  //require steps
  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {

    //missing steps
    throw new Error("workflow.steps must be a non-empty array");

  //end steps guard
  }

  //file header
  header =
    "//generated by rhaiteous — do not hand-edit\n" +
    "//source workflow JSON is the authoring surface; re-run the compiler after changes\n";

  //assemble sections
  parts.push(header);
  parts.push(emitMeta(workflow));
  parts.push(emitSchemaLocals(loadedSchemas));
  parts.push(argsPreamble.source);

  //body steps
  stepsSource = emitSteps(workflow.steps, ctx, "");

  //append body
  parts.push(stepsSource);

  //return compile result
  return {
    name: workflow.name, //workflow name
    rhai: parts.filter(function keepNonEmpty(section) {

      //drop empty sections
      return typeof section === "string" && section.length > 0;

    //end filter
    }).join("\n") + "\n", //full source
    loadedSchemas: loadedSchemas, //for tests/debug
    base: baseDir, //resolved asset base
  };

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

  //default output: .grok/workflows/<name>.rhai under cwd
  if (typeof options.outPath === "string" && options.outPath.length > 0) {

    //explicit output
    outPath = nodePath.resolve(options.outPath);

  } else {

    //conventional Grok project location
    outPath = nodePath.resolve(process.cwd(), ".grok", "workflows", result.name + ".rhai");

  //end out path branch
  }

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

  //end write branch
  }

  //return extended result
  return {
    name: result.name, //workflow name
    rhai: result.rhai, //source text
    loadedSchemas: result.loadedSchemas, //schemas
    base: result.base, //resolved asset base
    inputPath: absIn, //input path
    outputPath: outPath, //output path
    written: options.write !== false, //whether written
  };

//end compileWorkflowFile
}

//public API (library + CLI share this module)
export default {
  compileWorkflow: compileWorkflow,
  compileWorkflowFile: compileWorkflowFile,
  readJsonFile: readJsonFile,
  loadPromptFiles: loadPromptFiles,
  resolveBaseDir: resolveBaseDir,
  jsonToRhai: jsonToRhaiMod.jsonToRhai,
  assertWorkflowName: assertWorkflowName,
};
