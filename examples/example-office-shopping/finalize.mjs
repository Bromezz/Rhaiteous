#!/usr/bin/env node
/**
 * Pack finalizer (post-run).
 * Invoked by the forum-runner after the last station as:
 *   node finalize.mjs <full-path-to-thread.json>
 *
 * Configured in workflow.json via top-level "finalizer" (omit / "" / false to skip).
 * This seed logs the thread path only; see example-knock-knock for a custom-script pattern.
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

process.exit(0);
