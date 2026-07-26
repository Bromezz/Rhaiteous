/*
 * Tests for JSON → Rhai value emission.
 */

//node test runner
import nodeTest from "node:test";
import nodeAssert from "node:assert/strict";

//module under test
import jsonToRhaiMod from "../src/json-to-rhai.js";

//basic scalars
nodeTest.test("emits scalars", function testScalars() {

  //null becomes unit
  nodeAssert.equal(jsonToRhaiMod.jsonToRhai(null), "()");

  //booleans
  nodeAssert.equal(jsonToRhaiMod.jsonToRhai(true), "true");
  nodeAssert.equal(jsonToRhaiMod.jsonToRhai(false), "false");

  //numbers
  nodeAssert.equal(jsonToRhaiMod.jsonToRhai(42), "42");

  //strings escape quotes
  nodeAssert.equal(jsonToRhaiMod.jsonToRhai("a\"b"), "\"a\\\"b\"");

//end testScalars
});

//json schema fragment with reserved type key
nodeTest.test("quotes type keys in schema-like objects", function testTypeKey() {

  //variables
  let src = ""; //emitted rhai

  //emit a tiny schema object
  src = jsonToRhaiMod.jsonToRhai({
    type: "object", //reserved word in rhai
    required: ["summary"], //array field
  });

  //must quote type
  nodeAssert.match(src, /"type": "object"/);

  //required array present
  nodeAssert.match(src, /required:/);

//end testTypeKey
});
