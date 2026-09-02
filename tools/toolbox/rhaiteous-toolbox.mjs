#!/usr/bin/env node
/**
 * Dispatcher: node rhaiteous-toolbox.mjs [--threads-root <dir>] <tool> [args...]
 * Peers always resolve next to this file.
 *
 * Product runs pass --threads-root <out_dir>/threads so workflow context
 * lives under the workflow's out_dir (never a bare cwd/threads default).
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
    `usage: node rhaiteous-toolbox.mjs [--threads-root <dir>] <tool> [args...]\n` +
      `  tools: ${Object.keys(TOOLS).join(" | ")}\n` +
      `  --threads-root  directory for thread.json storage (product: <out_dir>/threads)\n`
  );
  process.exit(2);
}

function parseArgv(argv) {
  let threadsRoot = "";
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") usage();
    if (a === "--threads-root") {
      if (!argv[i + 1] || String(argv[i + 1]).startsWith("-")) {
        process.stderr.write("--threads-root requires a directory path\n");
        usage();
      }
      threadsRoot = path.resolve(argv[++i]);
      continue;
    }
    if (a.startsWith("--threads-root=")) {
      threadsRoot = path.resolve(a.slice("--threads-root=".length));
      continue;
    }
    out.push(a);
  }
  return { threadsRoot, args: out };
}

const { threadsRoot, args } = parseArgv(process.argv.slice(2));
if (args.length < 1) usage();

const tool = args[0];
const rest = args.slice(1);
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

const env = { ...process.env };
if (threadsRoot) {
  env.RHAITEOUS_THREADS_ROOT = threadsRoot;
}

const result = spawnSync(process.execPath, [scriptPath, ...rest], {
  stdio: "inherit",
  windowsHide: true,
  env,
});

if (result.error) {
  process.stderr.write(String(result.error) + "\n");
  process.exit(1);
}
process.exit(result.status == null ? 1 : result.status);
