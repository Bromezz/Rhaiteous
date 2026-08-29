#!/usr/bin/env node
/**
 * Create an empty timestamped forum thread JSON under a pack's threads/ directory.
 * Prints the full filesystem path on stdout (no other noise).
 *
 * Usage:
 *   node tools/init.mjs --threads-dir <dir>
 *   node tools/init.mjs --pack-dir <pack-root>      # → <pack-root>/threads
 *   node tools/init.mjs --workflow <workflow.json>  # → <dir(workflow)>/threads
 */

import fs from "node:fs";
import path from "node:path";

function usage() {
  process.stderr.write(
    "usage: node init.mjs --threads-dir <dir> | --pack-dir <pack-root> | --workflow <workflow.json>\n"
  );
  process.exit(2);
}

function parseArgs(argv) {
  let threadsDir = "";
  let packDir = "";
  let workflow = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--threads-dir" && argv[i + 1]) {
      threadsDir = argv[++i];
    } else if (a === "--pack-dir" && argv[i + 1]) {
      packDir = argv[++i];
    } else if (a === "--workflow" && argv[i + 1]) {
      workflow = argv[++i];
    } else if (a === "-h" || a === "--help") {
      usage();
    }
  }
  if (threadsDir) return path.resolve(threadsDir);
  if (packDir) return path.resolve(packDir, "threads");
  if (workflow) return path.resolve(path.dirname(path.resolve(workflow)), "threads");
  usage();
}

function stampName(d = new Date()) {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return (
    d.getFullYear() +
    "." +
    pad(d.getMonth() + 1) +
    "." +
    pad(d.getDate()) +
    "." +
    pad(d.getHours()) +
    "." +
    pad(d.getMinutes()) +
    "." +
    pad(d.getSeconds()) +
    "." +
    pad(d.getMilliseconds(), 3) +
    ".json"
  );
}

const threadsDir = parseArgs(process.argv.slice(2));
fs.mkdirSync(threadsDir, { recursive: true });

const filePath = path.join(threadsDir, stampName());
const emptyThread = {
  schemas: {},
  posts: [],
};
fs.writeFileSync(filePath, JSON.stringify(emptyThread, null, 2) + "\n", "utf8");
process.stdout.write(filePath);
