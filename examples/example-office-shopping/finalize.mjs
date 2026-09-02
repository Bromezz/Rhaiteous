#!/usr/bin/env node
/**
 * Optional pack finalizer (post-process only).
 * Invoked as: node finalize.mjs <full-path-to-thread.json>
 *
 * Mid-run persistence is owned by station agents via the Rhaiteous toolbox
 * (thread-add-post). The skinny forum-runner does not call this script.
 * Use it when you want a pack-local hook after exporting or inspecting a
 * workflow-context file on disk.
 */

import fs from "node:fs";
import path from "node:path";

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

/*
 * Example: pull in user-supplied logic (uncomment and adapt):
 *
 * import { pathToFileURL } from "node:url";
 * const custom = path.resolve(path.dirname(abs), "..", "custom-finalize.mjs");
 * if (fs.existsSync(custom)) {
 *   const mod = await import(pathToFileURL(custom).href);
 *   if (typeof mod.default === "function") {
 *     await mod.default(abs);
 *   }
 * }
 */

process.exit(0);
