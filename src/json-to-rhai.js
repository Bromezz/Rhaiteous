/*
 * Emit Rhai literals from JSON values.
 * Used so workflow authors keep real JSON Schema files while the compiler
 * produces the Rhai map form Grok Build's output_schema expects.
 */

/*
 * @description escape a string for a double-quoted Rhai string literal
 * @param text - raw string content
 * @returns escaped content without surrounding quotes
 */
function escapeRhaiStringContent(text) {

  //variables
  let out = ""; //escaped accumulator
  let i = 0; //character index
  let ch = ""; //current character

  //walk every character and escape Rhai specials
  while (i < text.length) {

    //read the current character
    ch = text.charAt(i);

    //dispatch on characters that need escaping
    if (ch === "\\") {

      //escape a backslash
      out += "\\\\";

    } else if (ch === "\"") {

      //escape a double quote
      out += "\\\"";

    } else if (ch === "\n") {

      //escape a newline
      out += "\\n";

    } else if (ch === "\r") {

      //escape a carriage return
      out += "\\r";

    } else if (ch === "\t") {

      //escape a tab
      out += "\\t";

    } else {

      //keep ordinary characters as-is
      out += ch;

    //end escape dispatch
    }

    //advance to the next character
    i += 1;

  //end character walk
  }

  //return the escaped body
  return out;

//end escapeRhaiStringContent
}

/*
 * @description emit a double-quoted Rhai string literal
 * @param text - raw string content
 * @returns a Rhai string literal including quotes
 */
function emitRhaiString(text) {

  //wrap escaped content in double quotes
  return "\"" + escapeRhaiStringContent(text) + "\"";

//end emitRhaiString
}

/*
 * @description decide whether a map key can be a bare Rhai identifier
 * @param key - object property name
 * @returns true when the key is safe unquoted in Rhai
 */
function isBareRhaiIdent(key) {

  //variables
  const bareIdent = /^[A-Za-z_][A-Za-z0-9_]*$/; //allowed bare identifier pattern

  //reject empty keys
  if (!key) {

    //empty keys must be quoted
    return false;

  //end empty-key guard
  }

  //reject keys that are not bare identifiers
  if (!bareIdent.test(key)) {

    //non-identifier keys must be quoted
    return false;

  //end pattern guard
  }

  //quote Rhai reserved words used often in JSON Schema
  if (key === "type" || key === "const" || key === "void" || key === "fn" || key === "true" || key === "false") {

    //reserved words must be quoted
    return false;

  //end reserved-word guard
  }

  //safe bare identifier
  return true;

//end isBareRhaiIdent
}

/*
 * @description emit a Rhai map key with quoting when required
 * @param key - object property name
 * @returns Rhai map key token
 */
function emitRhaiMapKey(key) {

  //use a bare key when legal
  if (isBareRhaiIdent(key)) {

    //bare identifier key
    return key;

  //end bare-key branch
  }

  //quote all other keys as strings
  return emitRhaiString(key);

//end emitRhaiMapKey
}

/*
 * @description convert a JSON value into a Rhai expression string
 * @param value - any JSON-compatible value
 * @param indent - current indentation string (spaces)
 * @returns Rhai source for the value
 */
function jsonToRhai(value, indent) {

  //variables
  let nextIndent = ""; //indent for nested lines
  let parts = null; //line or fragment accumulator
  let i = 0; //loop index
  let keys = null; //object keys
  let key = ""; //current object key
  let emitted = ""; //current emitted fragment

  //default indent to empty when omitted
  if (indent === undefined || indent === null) {

    //start at column zero
    indent = "";

  //end default indent
  }

  //emit Rhai unit for JSON null
  if (value === null) {

    //unit is Rhai's null
    return "()";

  //end null branch
  }

  //emit booleans
  if (value === true) {

    //true literal
    return "true";

  //end true branch
  }

  //emit false
  if (value === false) {

    //false literal
    return "false";

  //end false branch
  }

  //emit finite numbers as decimal literals
  if (typeof value === "number") {

    //reject non-finite numbers
    if (!Number.isFinite(value)) {

      //non-finite values are not valid Rhai number literals
      throw new Error("cannot emit non-finite number as Rhai");

    //end non-finite guard
    }

    //use JSON number formatting
    return String(value);

  //end number branch
  }

  //emit strings
  if (typeof value === "string") {

    //string literal
    return emitRhaiString(value);

  //end string branch
  }

  //emit arrays
  if (Array.isArray(value)) {

    //empty array
    if (value.length === 0) {

      //empty list literal
      return "[]";

    //end empty-array branch
    }

    //build nested indent
    nextIndent = indent + "  ";

    //collect element lines
    parts = [];

    //emit each element on its own line when multi-line
    i = 0;

    //walk array elements
    while (i < value.length) {

      //emit one element with a trailing comma
      parts.push(nextIndent + jsonToRhai(value[i], nextIndent) + ",");

      //next element
      i += 1;

    //end element walk
    }

    //join multi-line array
    return "[\n" + parts.join("\n") + "\n" + indent + "]";

  //end array branch
  }

  //emit plain objects as Rhai maps
  if (typeof value === "object") {

    //read own keys in stable sorted order for deterministic output
    keys = Object.keys(value).sort();

    //empty map
    if (keys.length === 0) {

      //empty map literal
      return "#{}";

    //end empty-map branch
    }

    //build nested indent
    nextIndent = indent + "  ";

    //collect field lines
    parts = [];

    //walk keys in sorted order
    i = 0;

    //emit each field
    while (i < keys.length) {

      //current key
      key = keys[i];

      //emit key and nested value
      emitted = nextIndent + emitRhaiMapKey(key) + ": " + jsonToRhai(value[key], nextIndent) + ",";

      //store the field line
      parts.push(emitted);

      //next key
      i += 1;

    //end key walk
    }

    //join multi-line map
    return "#{\n" + parts.join("\n") + "\n" + indent + "}";

  //end object branch
  }

  //unsupported runtime types (functions, symbols, etc.)
  throw new Error("cannot emit value of type " + typeof value + " as Rhai");

//end jsonToRhai
}

//export the public emitters
export default {
  escapeRhaiStringContent: escapeRhaiStringContent,
  emitRhaiString: emitRhaiString,
  isBareRhaiIdent: isBareRhaiIdent,
  emitRhaiMapKey: emitRhaiMapKey,
  jsonToRhai: jsonToRhai,
};
