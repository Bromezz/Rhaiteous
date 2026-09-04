#!/usr/bin/env node
/**
 * Pack finalizer (post-run).
 * Invoked by the forum-runner after the last station as:
 *   node finalize.mjs <full-path-to-thread.json>
 *
 * Configured in workflow.json:
 *   "finalizer": "finalize.mjs"   // omit, "", or false to skip
 *
 * This example delegates to custom-finalize.mjs in the same pack.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const threadPath = process.argv[2];
if (!threadPath) {
  console.error("finalize.mjs: missing thread.json path argument");
  process.exit(2);
}

const abs = path.resolve(threadPath);
console.log("Rhaiteous finalize.mjs called");
console.log("thread path:", abs);

if (!fs.existsSync(abs)) {
  console.error("finalize.mjs: file not found:", abs);
  process.exit(1);
}

const packDir = path.dirname(fileURLToPath(import.meta.url));
const customPath = path.join(packDir, "custom-finalize.mjs");

if (!fs.existsSync(customPath)) {
  console.error("finalize.mjs: custom-finalize.mjs not found at", customPath);
  process.exit(1);
}

const mod = await import(pathToFileURL(customPath).href);
if (typeof mod.default !== "function") {
  console.error("finalize.mjs: custom-finalize.mjs must export default async function");
  process.exit(1);
}

await mod.default(abs);
process.exit(0);
