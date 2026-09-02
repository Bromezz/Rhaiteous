#!/usr/bin/env node
/**
 * Create an empty workflow context under threads/<stamp>/thread.json.
 * Prefer: node tools/toolbox/rhaiteous-toolbox.mjs thread-create
 *
 * This wrapper accepts the legacy flags and forwards to thread-create.
 *
 * Usage:
 *   node tools/init.mjs --threads-dir <dir>
 *   echo '{"stations":["A"],"caps":{"A":1},"schemas":{}}' | node tools/init.mjs --threads-dir <dir>
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const createScript = path.join(__dirname, "toolbox", "thread-create.mjs");

function usage() {
  process.stderr.write(
    "usage: node init.mjs --threads-dir <dir> | --pack-dir <pack> | --workflow <workflow.json>\n" +
      "  Pass context JSON on stdin: { stations, caps?, schemas? }\n" +
      "  Or omit stdin to create a minimal one-station stub (not recommended).\n"
  );
  process.exit(2);
}

function parseArgs(argv) {
  let threadsDir = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--threads-dir" && argv[i + 1]) threadsDir = path.resolve(argv[++i]);
    else if (a === "--pack-dir" && argv[i + 1])
      threadsDir = path.resolve(argv[++i], "threads");
    else if (a === "--workflow" && argv[i + 1])
      threadsDir = path.resolve(path.dirname(path.resolve(argv[++i])), "threads");
    else if (a === "-h" || a === "--help") usage();
  }
  if (!threadsDir) usage();
  return threadsDir;
}

const threadsDir = parseArgs(process.argv.slice(2));
fs.mkdirSync(threadsDir, { recursive: true });

// Point toolbox config at this threads dir via cwd-relative override file is awkward;
// thread-create uses loadConfig().threadsRoot. Set env for child by writing nothing —
// instead create under threadsDir by temporarily chdir... Better: pass via modifying
 // spawn env RHAITEOUS_THREADS_ROOT if we add support. For now resolve by running
 // with cwd = parent of threadsDir and threadsRoot = basename.

const parent = path.dirname(threadsDir);
const base = path.basename(threadsDir);
let stdin = "";
try {
  if (!process.stdin.isTTY) {
    stdin = fs.readFileSync(0, "utf8");
  }
} catch (_e) {
  stdin = "";
}
if (!stdin || !String(stdin).trim()) {
  stdin = JSON.stringify({
    stations: ["Station"],
    caps: { Station: 1 },
    schemas: {},
  });
}

const env = { ...process.env, RHAITEOUS_THREADS_ROOT: threadsDir };
const result = spawnSync(process.execPath, [createScript], {
  input: stdin,
  encoding: "utf8",
  env,
  cwd: parent,
});
if (result.stderr) process.stderr.write(result.stderr);
if (result.stdout) process.stdout.write(result.stdout);
process.exit(result.status == null ? 1 : result.status);
