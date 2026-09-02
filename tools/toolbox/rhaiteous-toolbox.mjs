#!/usr/bin/env node
/**
 * Dispatcher: node rhaiteous-toolbox.mjs <tool> [args...]
 * Peers always resolve next to this file.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOOLS = {
  "thread-create": "thread-create.mjs",
  "thread-get-posts": "thread-get-posts.mjs",
  "thread-add-post": "thread-add-post.mjs",
};

function usage() {
  process.stderr.write(
    `usage: node rhaiteous-toolbox.mjs <tool> [args...]\n` +
      `  tools: ${Object.keys(TOOLS).join(" | ")}\n`
  );
  process.exit(2);
}

const argv = process.argv.slice(2);
if (argv.length < 1 || argv[0] === "-h" || argv[0] === "--help") usage();

const tool = argv[0];
const rest = argv.slice(1);
const scriptName = TOOLS[tool];
if (!scriptName) {
  process.stderr.write(`unknown tool: ${tool}\n`);
  usage();
}

const scriptPath = path.join(__dirname, scriptName);
if (!fs.existsSync(scriptPath)) {
  process.stderr.write(`tool script missing: ${scriptPath}\n`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [scriptPath, ...rest], {
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) {
  process.stderr.write(String(result.error) + "\n");
  process.exit(1);
}
process.exit(result.status == null ? 1 : result.status);
