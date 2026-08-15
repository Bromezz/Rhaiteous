/*
 * JSON Schema $ref resolution and inlining for compile-time composition.
 * External file refs resolve under a schemas base directory; internal
 * #/… pointers resolve within the loaded document. Result is a deep-copied
 * schema tree with $ref nodes replaced by their targets (v1: no cycles,
 * no $ref siblings, no http(s) URLs).
 */

//node filesystem and path
import nodeFs from "node:fs";
import nodePath from "node:path";

/*
 * @description deep-clone JSON-compatible values
 * @param value - any JSON value
 * @returns clone
 */
function deepClone(value) {

  //null / undefined
  if (value === null || value === undefined) {

    //as-is
    return value;

  //end null
  }

  //array
  if (Array.isArray(value)) {

    //map clone
    return value.map(function cloneEl(el) {

      //recurse
      return deepClone(el);

    //end map
    });

  //end array
  }

  //object
  if (typeof value === "object") {

    //variables
    let out = {}; //clone
    let keys = Object.keys(value); //own keys
    let i = 0; //index
    let k = ""; //key

    //copy each key
    i = 0;

    //walk
    while (i < keys.length) {

      //key
      k = keys[i];

      //clone value
      out[k] = deepClone(value[k]);

      //next
      i += 1;

    //end walk
    }

    //object clone
    return out;

  //end object
  }

  //primitive
  return value;

//end deepClone
}

/*
 * @description parse a JSON Schema $ref into uri + fragment
 * @param ref - $ref string
 * @returns { uri: string, fragment: string|null }
 */
function splitRef(ref) {

  //variables
  let hash = -1; //index of #

  //require string
  if (typeof ref !== "string" || ref.length === 0) {

    //bad ref
    throw new Error("$ref must be a non-empty string");

  //end type guard
  }

  //split on first #
  hash = ref.indexOf("#");

  //no fragment
  if (hash < 0) {

    //whole string is uri
    return {
      uri: ref, //document
      fragment: null, //none
    };

  //end no hash
  }

  //uri may be empty (same document)
  return {
    uri: ref.slice(0, hash), //before #
    fragment: ref.slice(hash + 1), //after # (may be empty)
  };

//end splitRef
}

/*
 * @description walk a JSON pointer (RFC 6901) from a document root
 * @param doc - root object
 * @param pointer - pointer without leading # ("" = root, "/a/b" = path)
 * @param refLabel - for errors
 * @returns target node
 */
function getJsonPointer(doc, pointer, refLabel) {

  //variables
  let parts = null; //segments
  let i = 0; //index
  let cur = doc; //cursor
  let part = ""; //decoded segment

  //empty pointer → document root
  if (pointer === null || pointer === "") {

    //root
    return doc;

  //end root
  }

  //must start with /
  if (pointer.charAt(0) !== "/") {

    //bad pointer
    throw new Error(
      "invalid JSON pointer in $ref '" + refLabel + "': expected leading /"
    );

  //end slash guard
  }

  //split segments (drop leading empty from leading /)
  parts = pointer.split("/");

  //first element is ""
  i = 1;

  //walk segments
  while (i < parts.length) {

    //RFC 6901 unescape ~1 → / then ~0 → ~
    part = parts[i].replace(/~1/g, "/").replace(/~0/g, "~");

    //must be object or array
    if (cur === null || typeof cur !== "object") {

      //dead end
      throw new Error(
        "JSON pointer in $ref '" + refLabel + "' left a non-object at segment '" +
        part + "'"
      );

    //end type
    }

    //missing key / index
    if (!Object.prototype.hasOwnProperty.call(cur, part)) {

      //not found
      throw new Error(
        "JSON pointer in $ref '" + refLabel + "' not found: segment '" + part + "'"
      );

    //end missing
    }

    //descend
    cur = cur[part];

    //next
    i += 1;

  //end segment walk
  }

  //target
  return cur;

//end getJsonPointer
}

/*
 * @description read and parse a JSON schema file
 * @param absPath - absolute path
 * @returns parsed object
 */
function readSchemaFile(absPath) {

  //variables
  let text = ""; //file text
  let doc = null; //parsed

  //read
  try {

    //utf8
    text = nodeFs.readFileSync(absPath, "utf8");

  } catch (err) {

    //wrap
    throw new Error("failed to read schema file '" + absPath + "': " + err.message);

  //end read
  }

  //parse
  try {

    //JSON
    doc = JSON.parse(text);

  } catch (err) {

    //wrap
    throw new Error("failed to parse schema JSON '" + absPath + "': " + err.message);

  //end parse
  }

  //require object root (array schemas are rare; reject for v1)
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {

    //bad root
    throw new Error("schema root must be a JSON object: " + absPath);

  //end root guard
  }

  //parsed
  return doc;

//end readSchemaFile
}

/*
 * @description true if ref uri looks like a network URL
 * @param uri - ref uri part
 * @returns boolean
 */
function isNetworkUri(uri) {

  //http(s) or protocol-ish
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri);

//end isNetworkUri
}

/*
 * @description resolve a $ref to a target node + document context
 * @param ref - $ref string
 * @param docRoot - current document root
 * @param docPath - absolute path of current document (for relative files)
 * @param schemasDir - absolute schemas base (boundary for file refs)
 * @param cache - map absPath → parsed doc
 * @returns { node, docRoot, docPath }
 */
function resolveRefTarget(ref, docRoot, docPath, schemasDir, cache) {

  //variables
  let parts = null; //uri + fragment
  let nextPath = docPath; //target document path
  let nextRoot = docRoot; //target document root
  let node = null; //target node
  let abs = ""; //resolved file path
  let rel = ""; //relative display

  //split
  parts = splitRef(ref);

  //external document?
  if (parts.uri.length > 0) {

    //no network
    if (isNetworkUri(parts.uri)) {

      //unsupported
      throw new Error(
        "network $ref is not supported (got '" + ref + "'); use local files under schemas/"
      );

    //end network guard
    }

    //resolve relative to current document directory
    abs = nodePath.resolve(nodePath.dirname(docPath), parts.uri);

    //normalize schemasDir for prefix check
    schemasDir = nodePath.resolve(schemasDir);

    //must stay under schemasDir
    if (
      abs !== schemasDir &&
      !abs.startsWith(schemasDir + nodePath.sep)
    ) {

      //escape
      throw new Error(
        "$ref '" + ref + "' resolves outside schemas directory: " + abs
      );

    //end boundary
    }

    //load or cache
    if (cache[abs]) {

      //cached
      nextRoot = cache[abs];

    } else {

      //read
      nextRoot = readSchemaFile(abs);

      //cache
      cache[abs] = nextRoot;

    //end cache
    }

    //document path for nested relative refs
    nextPath = abs;

  //end external
  }

  //pointer (fragment may be "" meaning root, or "/a/b")
  if (parts.fragment === null) {

    //no # → whole document
    node = nextRoot;

  } else {

    //JSON pointer after #
    node = getJsonPointer(nextRoot, parts.fragment, ref);

  //end fragment
  }

  //must have a node
  if (node === undefined) {

    //missing
    throw new Error("$ref '" + ref + "' resolved to undefined");

  //end missing
  }

  //target context
  return {
    node: node, //schema node
    docRoot: nextRoot, //document for further internal refs
    docPath: nextPath, //path for further relative refs
  };

//end resolveRefTarget
}

/*
 * @description count own keys on an object (for $ref sibling detection)
 * @param obj - object
 * @returns number
 */
function ownKeyCount(obj) {

  //Object.keys length
  return Object.keys(obj).length;

//end ownKeyCount
}

/*
 * @description inline all $ref nodes in a schema value (mutates via rebuild)
 * @param node - current schema node
 * @param docRoot - root of the document that contains node
 * @param docPath - absolute path of that document
 * @param schemasDir - schemas base directory
 * @param cache - file cache
 * @param stack - array of cycle keys currently being expanded
 * @returns inlined value (new structure)
 */
function inlineNode(node, docRoot, docPath, schemasDir, cache, stack) {

  //variables
  let target = null; //resolved ref
  let cycleKey = ""; //identity for cycle detection
  let i = 0; //index
  let keys = null; //object keys
  let k = ""; //key
  let out = null; //rebuilt object / array
  let ref = ""; // $ref string

  //primitives / null
  if (node === null || typeof node !== "object") {

    //as-is
    return node;

  //end primitive
  }

  //arrays: inline each element
  if (Array.isArray(node)) {

    //new array
    out = [];

    //each element
    i = 0;

    //walk
    while (i < node.length) {

      //inline element
      out.push(
        inlineNode(node[i], docRoot, docPath, schemasDir, cache, stack)
      );

      //next
      i += 1;

    //end walk
    }

    //array
    return out;

  //end array
  }

  //object with $ref → replace entire node with target (no siblings in v1)
  if (Object.prototype.hasOwnProperty.call(node, "$ref")) {

    //ref string
    ref = node.$ref;

    //siblings not allowed (JSON Schema composition edge cases)
    if (ownKeyCount(node) !== 1) {

      //fail closed
      throw new Error(
        "$ref must be the only key on its object in v1 (siblings present at $ref '" +
        ref +
        "')"
      );

    //end sibling guard
    }

    //resolve
    target = resolveRefTarget(ref, docRoot, docPath, schemasDir, cache);

    //cycle key: path + fragment-ish identity
    cycleKey = target.docPath + "::" + ref;

    //cycle?
    if (stack.indexOf(cycleKey) >= 0) {

      //loop
      throw new Error("circular $ref detected: " + stack.concat([cycleKey]).join(" → "));

    //end cycle
    }

    //push
    stack.push(cycleKey);

    //inline the target in its document context
    out = inlineNode(
      target.node,
      target.docRoot,
      target.docPath,
      schemasDir,
      cache,
      stack
    );

    //pop
    stack.pop();

    //deep clone so later mutations of $defs do not alias
    return deepClone(out);

  //end $ref
  }

  //plain object: rebuild with inlined children
  out = {};
  keys = Object.keys(node);
  i = 0;

  //walk keys
  while (i < keys.length) {

    //key
    k = keys[i];

    //inline child in same document
    out[k] = inlineNode(node[k], docRoot, docPath, schemasDir, cache, stack);

    //next
    i += 1;

  //end walk
  }

  //object
  return out;

//end inlineNode
}

/*
 * @description load a schema file and fully inline $refs
 * @param relOrAbs - path relative to schemasDir or absolute under it
 * @param schemasDir - absolute schemas directory
 * @returns fully inlined schema object (deep clone, no file $refs)
 */
function loadAndInline(relOrAbs, schemasDir) {

  //variables
  let abs = ""; //absolute schema path
  let root = null; //parsed root
  let cache = {}; //path → doc
  let schemasAbs = ""; //resolved base

  //require schemas dir
  if (typeof schemasDir !== "string" || schemasDir.length === 0) {

    //missing
    throw new Error("loadAndInline requires schemasDir");

  //end dir guard
  }

  //resolve base
  schemasAbs = nodePath.resolve(schemasDir);

  //resolve file
  abs = nodePath.resolve(schemasAbs, relOrAbs);

  //boundary check
  if (abs !== schemasAbs && !abs.startsWith(schemasAbs + nodePath.sep)) {

    //escape
    throw new Error("schema path escapes schemas directory: " + abs);

  //end boundary
  }

  //read root
  root = readSchemaFile(abs);

  //cache root document
  cache[abs] = root;

  //inline from root
  return inlineNode(root, root, abs, schemasAbs, cache, []);

//end loadAndInline
}

/*
 * @description inline $refs in an already-parsed schema object that was loaded from absPath
 * @param doc - parsed schema root
 * @param absPath - absolute file path of doc
 * @param schemasDir - schemas base
 * @returns inlined schema
 */
function inlineParsedSchema(doc, absPath, schemasDir) {

  //variables
  let cache = {}; //file cache
  let schemasAbs = nodePath.resolve(schemasDir); //base
  let abs = nodePath.resolve(absPath); //doc path

  //seed cache with this document
  cache[abs] = doc;

  //inline
  return inlineNode(doc, doc, abs, schemasAbs, cache, []);

//end inlineParsedSchema
}

//public API
export default {
  loadAndInline: loadAndInline,
  inlineParsedSchema: inlineParsedSchema,
  deepClone: deepClone,
  splitRef: splitRef,
  getJsonPointer: getJsonPointer,
};
