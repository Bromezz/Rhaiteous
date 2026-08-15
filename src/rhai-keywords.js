/*
 * Load and query the Rhai reserved-keyword list shipped with the package.
 * Zero third-party dependencies (Node fs/path/url only).
 */

//node builtins
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeUrl from "node:url";

//cached set after first load
let cachedKeywords = null; //Set of keyword strings

//keywords that appear as legitimate language/host tokens in our emitted IR
//(Layer B allowlist — not reported as identifier violations)
const emitAllowlist = {
  true: true,
  false: true,
  let: true,
  const: true,
  if: true,
  else: true,
  for: true,
  in: true,
  while: true,
  fn: true,
  Fn: true,
  return: true,
  //host / runtime calls and common fields we emit as identifiers
  agent: true,
  parallel: true,
  complete: true,
  phase: true,
  log: true,
  pause: true,
  await_user: true,
  push: true,
  len: true,
  to_string: true,
  success: true,
  output: true,
  args: true,
  real: true,
  evidence: true,
  call: true,
  json_encode: true,
  write_scratch_file: true,
};

/*
 * @description absolute path to the shipped keyword list
 * @returns absolute filesystem path
 */
function defaultKeywordsPath() {

  //this module's directory
  const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));

  //src/data/rhai-keywords.txt
  return nodePath.join(here, "data", "rhai-keywords.txt");

//end defaultKeywordsPath
}

/*
 * @description load keyword set from a text file (cached for default path)
 * @param filePath - optional absolute or relative path; default package list
 * @param options - { forceReload?: boolean }
 * @returns Set of keyword strings
 */
function loadKeywordSet(filePath, options) {

  //variables
  let path = ""; //resolved path
  let raw = ""; //file text
  let lines = null; //split lines
  let i = 0; //index
  let line = ""; //current line
  let set = null; //result set
  let force = false; //bypass cache

  //options
  if (!options || typeof options !== "object") {

    //empty
    options = {};

  //end options
  }

  force = options.forceReload === true;

  //path
  path = typeof filePath === "string" && filePath.length > 0
    ? nodePath.resolve(filePath)
    : defaultKeywordsPath();

  //return cache when using default path
  if (!force && cachedKeywords && path === defaultKeywordsPath()) {

    //cached
    return cachedKeywords;

  //end cache hit
  }

  try {

    //read utf-8
    raw = nodeFs.readFileSync(path, "utf8");

    //strip bom
    if (raw.charCodeAt(0) === 0xfeff) {

      //drop bom
      raw = raw.slice(1);

    //end bom
    }

  } catch (err) {

    //log and rethrow
    console.error("failed to load Rhai keyword list from " + path, err);

    //fail closed
    throw new Error("failed to load Rhai keyword list from " + path + ": " + err.message);

  }

  //parse lines
  set = new Set();
  lines = raw.split(/\r?\n/);

  //walk
  i = 0;

  //each line
  while (i < lines.length) {

    //trim
    line = lines[i].trim();

    //skip empty and comments
    if (line.length > 0 && line.charAt(0) !== "#") {

      //keyword token only (no spaces)
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(line)) {

        //store exact spelling
        set.add(line);

      //end valid keyword form
      }

    //end keep line
    }

    //next
    i += 1;

  //end line walk
  }

  //cache default
  if (path === defaultKeywordsPath()) {

    //store
    cachedKeywords = set;

  //end cache store
  }

  //result
  return set;

//end loadKeywordSet
}

/*
 * @description whether a name is a reserved Rhai keyword (identifier form)
 * @param name - candidate identifier
 * @param keywordSet - optional Set; default loaded list
 * @returns true when reserved
 */
function isReservedKeyword(name, keywordSet) {

  //variables
  let set = keywordSet; //working set

  //load default when omitted
  if (!set) {

    //default list
    set = loadKeywordSet();

  //end default
  }

  //non-string → not a keyword match
  if (typeof name !== "string") {

    //no
    return false;

  //end type
  }

  //membership
  return set.has(name);

//end isReservedKeyword
}

/*
 * @description format a multi-violation keyword report
 * @param violations - array of { name, label, detail? }
 * @returns multi-line error text
 */
function formatKeywordReport(violations) {

  //variables
  let lines = []; //report lines
  let i = 0; //index
  let v = null; //current
  let listPath = ""; //keyword file path for footer

  //empty
  if (!violations || violations.length === 0) {

    //nothing
    return "";

  //end empty
  }

  listPath = defaultKeywordsPath();

  //header
  lines.push(
    "rhaiteous: Rhai reserved keyword(s) used as identifiers (" +
    violations.length +
    ")"
  );
  lines.push("");

  //each violation
  i = 0;

  //walk
  while (i < violations.length) {

    //item
    v = violations[i];

    //numbered entry
    lines.push("  " + (i + 1) + ". keyword \"" + v.name + "\"");
    lines.push("     origin: " + (v.label || "unknown"));

    //optional detail
    if (typeof v.detail === "string" && v.detail.length > 0) {

      //extra context
      lines.push("     detail: " + v.detail);

    //end detail
    }

    //blank between items
    lines.push("");

    //next
    i += 1;

  //end walk
  }

  //footer
  lines.push("Rename these names in the workflow JSON (args, as, path, schema bindings, …) and recompile.");
  lines.push("Keyword list: " + listPath);

  //joined
  return lines.join("\n");

//end formatKeywordReport
}

/*
 * @description strip // comments and "…" strings from Rhai-ish source for scanning
 * @param source - full Rhai text
 * @returns scrubbed text (same length replaced with spaces where needed for line counts? we keep newlines)
 */
function scrubRhaiForScan(source) {

  //variables
  let out = ""; //result
  let i = 0; //index
  let ch = ""; //char
  let next = ""; //lookahead
  let inString = false; //inside double-quoted string
  let inLineComment = false; //inside //

  //non-string
  if (typeof source !== "string") {

    //empty
    return "";

  //end type
  }

  //walk characters
  i = 0;

  //each
  while (i < source.length) {

    //current
    ch = source.charAt(i);
    next = i + 1 < source.length ? source.charAt(i + 1) : "";

    //end line comment
    if (inLineComment) {

      //keep newline
      if (ch === "\n") {

        //exit comment
        inLineComment = false;
        out += "\n";

      } else {

        //space out
        out += " ";

      //end newline
      }

      //advance
      i += 1;

      //continue
      continue;

    //end in comment
    }

    //end string
    if (inString) {

      //escape
      if (ch === "\\") {

        //skip escape pair as spaces
        out += "  ";
        i += 2;

        //continue
        continue;

      //end escape
      }

      //close quote
      if (ch === "\"") {

        //exit string
        inString = false;
        out += " ";
        i += 1;

        //continue
        continue;

      //end close
      }

      //preserve newlines inside strings for line numbers; other chars blanked
      if (ch === "\n") {

        //keep
        out += "\n";

      } else {

        //blank
        out += " ";

      //end newline in string
      }

      //advance
      i += 1;

      //continue
      continue;

    //end in string
    }

    //start line comment
    if (ch === "/" && next === "/") {

      //enter comment
      inLineComment = true;
      out += "  ";
      i += 2;

      //continue
      continue;

    //end comment start
    }

    //start string
    if (ch === "\"") {

      //enter string
      inString = true;
      out += " ";
      i += 1;

      //continue
      continue;

    //end string start
    }

    //normal
    out += ch;
    i += 1;

  //end char walk
  }

  //scrubbed
  return out;

//end scrubRhaiForScan
}

/*
 * @description scan emitted Rhai for keyword tokens not on the emit allowlist
 * @param rhaiSource - full generated script
 * @param keywordSet - Set of keywords
 * @returns array of { name, label, detail }
 */
function scanEmittedRhaiForKeywords(rhaiSource, keywordSet) {

  //variables
  let scrubbed = ""; //comment/string free
  let lines = null; //line array
  let li = 0; //line index
  let line = ""; //current line
  let re = /[A-Za-z_][A-Za-z0-9_]*/g; //identifier
  let match = null; //regex match
  let word = ""; //token
  let found = []; //violations
  let set = keywordSet; //working set

  //default set
  if (!set) {

    //load
    set = loadKeywordSet();

  //end default
  }

  //scrub
  scrubbed = scrubRhaiForScan(rhaiSource);
  lines = scrubbed.split("\n");

  //walk lines
  li = 0;

  //each line
  while (li < lines.length) {

    //line text
    line = lines[li];

    //reset regex
    re.lastIndex = 0;

    //find idents
    match = re.exec(line);

    //all matches
    while (match !== null) {

      //token
      word = match[0];

      //keyword not allowlisted → report
      if (set.has(word) && !emitAllowlist[word]) {

        //violation
        found.push({
          name: word, //keyword
          label: "emitted Rhai line " + (li + 1), //origin
          detail: "identifier token in generated IR (not on emit allowlist)", //detail
        });

      //end hit
      }

      //next match
      match = re.exec(line);

    //end matches
    }

    //next line
    li += 1;

  //end lines
  }

  //all findings
  return found;

//end scanEmittedRhaiForKeywords
}

//public API
export default {
  defaultKeywordsPath: defaultKeywordsPath,
  loadKeywordSet: loadKeywordSet,
  isReservedKeyword: isReservedKeyword,
  formatKeywordReport: formatKeywordReport,
  scrubRhaiForScan: scrubRhaiForScan,
  scanEmittedRhaiForKeywords: scanEmittedRhaiForKeywords,
  emitAllowlist: emitAllowlist,
};
