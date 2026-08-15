/*
 * Tests for compile-time JSON Schema $ref inlining.
 */

//node test
import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeOs from "node:os";

//module under test
import schemaInlineMod from "../src/schema-inline.js";

//helpers
function makeSchemasDir(files) {

  //variables
  let dir = ""; //temp schemas dir
  let keys = null; //filenames
  let i = 0; //index

  //temp
  dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "schinline-"));

  //write each file
  keys = Object.keys(files);
  i = 0;

  //walk
  while (i < keys.length) {

    //write JSON
    nodeFs.writeFileSync(
      nodePath.join(dir, keys[i]),
      typeof files[keys[i]] === "string"
        ? files[keys[i]]
        : JSON.stringify(files[keys[i]], null, 2),
      "utf8"
    );

    //next
    i += 1;

  //end walk
  }

  //dir
  return dir;

//end makeSchemasDir
}

//inline external $ref
nodeTest.test("inlines external $ref file into parent", function testExternalRef() {

  //variables
  let dir = ""; //schemas dir
  let result = null; //inlined

  //files: parent refs child
  dir = makeSchemasDir({
    "child.schema.json": {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        count: { type: "integer" },
      },
    },
    "parent.schema.json": {
      type: "object",
      properties: {
        item: { $ref: "child.schema.json" },
      },
      required: ["item"],
    },
  });

  try {

    //load parent
    result = schemaInlineMod.loadAndInline("parent.schema.json", dir);

    //no $ref left on item
    nodeAssert.equal(result.properties.item.$ref, undefined);

    //child shape present
    nodeAssert.equal(result.properties.item.type, "object");
    nodeAssert.deepEqual(result.properties.item.required, ["name"]);
    nodeAssert.equal(result.properties.item.properties.name.type, "string");
    nodeAssert.equal(result.properties.item.properties.count.type, "integer");

  } finally {

    //cleanup
    nodeFs.rmSync(dir, { recursive: true, force: true });

  //end try
  }

//end testExternalRef
});

//inline internal $defs $ref
nodeTest.test("inlines in-document $defs $ref", function testInternalRef() {

  //variables
  let dir = ""; //dir
  let result = null; //inlined

  //one file with $defs
  dir = makeSchemasDir({
    "with-defs.schema.json": {
      type: "object",
      required: ["item"],
      properties: {
        item: { $ref: "#/$defs/item" },
      },
      $defs: {
        item: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
          },
        },
      },
    },
  });

  try {

    //load
    result = schemaInlineMod.loadAndInline("with-defs.schema.json", dir);

    //expanded
    nodeAssert.equal(result.properties.item.$ref, undefined);
    nodeAssert.equal(result.properties.item.type, "object");
    nodeAssert.equal(result.properties.item.properties.name.type, "string");

  } finally {

    //cleanup
    nodeFs.rmSync(dir, { recursive: true, force: true });

  //end try
  }

//end testInternalRef
});

//external + fragment
nodeTest.test("inlines external file with JSON pointer fragment", function testFragment() {

  //variables
  let dir = ""; //dir
  let result = null; //inlined

  //shared defs file
  dir = makeSchemasDir({
    "shared.schema.json": {
      $defs: {
        status: {
          type: "string",
          enum: ["open", "closed"],
        },
      },
    },
    "uses-shared.schema.json": {
      type: "object",
      properties: {
        status: { $ref: "shared.schema.json#/$defs/status" },
      },
    },
  });

  try {

    //load
    result = schemaInlineMod.loadAndInline("uses-shared.schema.json", dir);

    //status inlined
    nodeAssert.equal(result.properties.status.$ref, undefined);
    nodeAssert.equal(result.properties.status.type, "string");
    nodeAssert.deepEqual(result.properties.status.enum, ["open", "closed"]);

  } finally {

    //cleanup
    nodeFs.rmSync(dir, { recursive: true, force: true });

  //end try
  }

//end testFragment
});

//circular fails
nodeTest.test("rejects circular $ref", function testCircular() {

  //variables
  let dir = ""; //dir

  //a → b → a
  dir = makeSchemasDir({
    "a.schema.json": {
      type: "object",
      properties: {
        b: { $ref: "b.schema.json" },
      },
    },
    "b.schema.json": {
      type: "object",
      properties: {
        a: { $ref: "a.schema.json" },
      },
    },
  });

  try {

    //throws
    nodeAssert.throws(function throwCirc() {

      //load
      schemaInlineMod.loadAndInline("a.schema.json", dir);

    }, /circular \$ref/);

  } finally {

    //cleanup
    nodeFs.rmSync(dir, { recursive: true, force: true });

  //end try
  }

//end testCircular
});

//siblings on $ref fail
nodeTest.test("rejects $ref with sibling keywords", function testSiblings() {

  //variables
  let dir = ""; //dir

  //ref + description
  dir = makeSchemasDir({
    "child.schema.json": { type: "string" },
    "sib.schema.json": {
      type: "object",
      properties: {
        x: {
          $ref: "child.schema.json",
          description: "not allowed in v1",
        },
      },
    },
  });

  try {

    //throws
    nodeAssert.throws(function throwSib() {

      //load
      schemaInlineMod.loadAndInline("sib.schema.json", dir);

    }, /only key/);

  } finally {

    //cleanup
    nodeFs.rmSync(dir, { recursive: true, force: true });

  //end try
  }

//end testSiblings
});

//network rejected
nodeTest.test("rejects network $ref", function testNetwork() {

  //variables
  let dir = ""; //dir

  //http ref
  dir = makeSchemasDir({
    "net.schema.json": {
      $ref: "https://example.com/schema.json",
    },
  });

  try {

    //throws
    nodeAssert.throws(function throwNet() {

      //load
      schemaInlineMod.loadAndInline("net.schema.json", dir);

    }, /network \$ref/);

  } finally {

    //cleanup
    nodeFs.rmSync(dir, { recursive: true, force: true });

  //end try
  }

//end testNetwork
});
