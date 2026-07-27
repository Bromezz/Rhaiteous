/*
 * Compile simple {{path}} prompt templates into Rhai string-building statements.
 * Supported tokens: {{args.x}}, {{item}}, {{index}}, and bare {{binding}} for
 * known step result or loop locals introduced by the compiler.
 */

//reuse string escaping from the Rhai emitter
import jsonToRhaiMod from "./json-to-rhai.js";

/*
 * @description split a template string into literal and {{ref}} parts
 * @param template - prompt template text
 * @returns array of { kind: "lit"|"ref", value: string }
 */
function parseTemplate(template) {

  //variables
  const parts = []; //parsed segments
  const pattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g; //mustache-like refs
  let lastIndex = 0; //end of previous match
  let match = null; //regex match record
  let lit = ""; //literal slice

  //reject non-strings early
  if (typeof template !== "string") {

    //templates must be strings
    throw new Error("prompt template must be a string");

  //end type guard
  }

  //walk all {{ref}} matches
  match = pattern.exec(template);

  //continue until no matches remain
  while (match !== null) {

    //capture literal text before this match
    lit = template.slice(lastIndex, match.index);

    //store a non-empty literal segment
    if (lit.length > 0) {

      //literal segment
      parts.push({
        kind: "lit", //segment kind
        value: lit, //raw literal text
      });

    //end literal store
    }

    //store the reference path
    parts.push({
      kind: "ref", //segment kind
      value: match[1], //dot path inside braces
    });

    //advance past this match
    lastIndex = pattern.lastIndex;

    //find the next match
    match = pattern.exec(template);

  //end match walk
  }

  //capture trailing literal text
  lit = template.slice(lastIndex);

  //store trailing literal when present
  if (lit.length > 0) {

    //trailing literal
    parts.push({
      kind: "lit", //segment kind
      value: lit, //raw literal text
    });

  //end trailing literal
  }

  //empty template becomes a single empty literal
  if (parts.length === 0) {

    //empty string template
    parts.push({
      kind: "lit", //segment kind
      value: "", //empty text
    });

  //end empty-template branch
  }

  //return ordered segments
  return parts;

//end parseTemplate
}

/*
 * @description map a template ref path to a Rhai expression
 * @param refPath - path such as args.requests_dir, item, index, or a binding
 * @param scope - { argsLocals: object, itemAs?: string, indexAs?: string, knownVars: object }
 * @returns Rhai expression string that evaluates to a string-ish value
 */
function refToRhaiExpr(refPath, scope) {

  //variables
  let segments = null; //path segments
  let head = ""; //first path segment
  let rest = null; //remaining segments
  let i = 0; //loop index
  let expr = ""; //built expression
  let argLocal = ""; //local name for an args field

  //split the path on dots
  segments = refPath.split(".");

  //require at least one segment
  if (segments.length === 0 || segments[0] === "") {

    //invalid empty path
    throw new Error("empty template ref");

  //end empty-path guard
  }

  //head segment selects the root
  head = segments[0];

  //args.x → local arg binding emitted in the preamble
  if (head === "args") {

    //require args.field
    if (segments.length < 2) {

      //bare args is not supported in templates
      throw new Error("template ref 'args' requires a field (e.g. args.requests_dir)");

    //end args-field guard
    }

    //field name is the second segment
    argLocal = segments[1];

    //require the arg to be declared
    if (!scope.argsLocals[argLocal]) {

      //unknown arg field
      throw new Error("template ref args." + argLocal + " is not declared in workflow args");

    //end known-arg guard
    }

    //start from the local arg variable
    expr = argLocal;

    //append further property access when present
    i = 2;

    //walk remaining segments
    while (i < segments.length) {

      //chain field access
      expr += "." + segments[i];

      //next segment
      i += 1;

    //end remaining walk
    }

    //return the args expression
    return expr;

  //end args branch
  }

  //item alias for parallel loops
  if (head === "item" || (scope.itemAs && head === scope.itemAs)) {

    //use the configured loop item name
    expr = scope.itemAs || "item";

    //append property path after item
    rest = head === "item" ? segments.slice(1) : segments.slice(1);

    //when head was itemAs, rest is already correct from slice(1)
    if (head !== "item" && head === scope.itemAs) {

      //segments after the item binding
      rest = segments.slice(1);

    //end itemAs rest normalize
    }

    //chain fields
    i = 0;

    //walk rest
    while (i < rest.length) {

      //chain field access
      expr += "." + rest[i];

      //next
      i += 1;

    //end rest walk
    }

    //return item expression
    return expr;

  //end item branch
  }

  //index alias for parallel loops
  if (head === "index" || (scope.indexAs && head === scope.indexAs)) {

    //index is a number local; callers concat with .to_string()
    return scope.indexAs || "index";

  //end index branch
  }

  //known compiler bindings (step results, collected arrays, etc.)
  if (scope.knownVars[head]) {

    //start from the binding
    expr = head;

    //chain remaining fields
    i = 1;

    //walk remaining segments
    while (i < segments.length) {

      //chain field access
      expr += "." + segments[i];

      //next segment
      i += 1;

    //end field walk
    }

    //return binding expression
    return expr;

  //end known-var branch
  }

  //unknown root
  throw new Error("unknown template ref root '" + head + "'");

//end refToRhaiExpr
}

/*
 * @description emit Rhai statements that build a prompt string into a variable
 * @param varName - Rhai local to assign (e.g. p)
 * @param template - string or array of strings (joined with newlines)
 * @param scope - template scope for refs
 * @param indent - leading whitespace for each line
 * @returns multi-line Rhai source ending with a newline
 */
function emitPromptBuild(varName, template, scope, indent) {

  //variables
  let text = ""; //flattened template text
  let parts = null; //parsed segments
  let lines = []; //emitted Rhai lines
  let i = 0; //segment index
  let seg = null; //current segment
  let expr = ""; //ref expression
  let lit = ""; //literal fragment for emission

  //default indent
  if (!indent) {

    //no indent
    indent = "";

  //end default indent
  }

  //normalize array templates to a single string with newlines
  if (Array.isArray(template)) {

    //join prompt lines
    text = template.join("\n");

  } else {

    //single string template
    text = template;

  //end template normalize
  }

  //parse into segments
  parts = parseTemplate(text);

  //initialize the prompt accumulator
  lines.push(indent + "let " + varName + " = \"\";");

  //emit one append per segment
  i = 0;

  //walk segments
  while (i < parts.length) {

    //current segment
    seg = parts[i];

    //literal append
    if (seg.kind === "lit") {

      //skip empty literals
      if (seg.value.length > 0) {

        //escape and append literal text
        lit = jsonToRhaiMod.emitRhaiString(seg.value);

        //append literal
        lines.push(indent + varName + " += " + lit + ";");

      //end non-empty literal
      }

    } else {

      //resolve the reference to a Rhai expression
      expr = refToRhaiExpr(seg.value, scope);

      //index refs are numbers and need to_string for concat
      if (seg.value === "index" || (scope.indexAs && (seg.value === scope.indexAs || seg.value.indexOf(scope.indexAs + ".") === 0))) {

        //only bare index (not index.something) uses to_string
        if (seg.value === "index" || seg.value === scope.indexAs) {

          //append stringified index
          lines.push(indent + varName + " += " + expr + ".to_string();");

        } else {

          //property on index is unusual; append directly
          lines.push(indent + varName + " += " + expr + ";");

        //end index property branch
        }

      } else {

        //append string-ish expression
        lines.push(indent + varName + " += " + expr + ";");

      //end non-index ref
      }

    //end segment kind branch
    }

    //next segment
    i += 1;

  //end segment walk
  }

  //join lines with newlines and a trailing newline
  return lines.join("\n") + "\n";

//end emitPromptBuild
}

//export template helpers
export default {
  parseTemplate: parseTemplate,
  refToRhaiExpr: refToRhaiExpr,
  emitPromptBuild: emitPromptBuild,
};
