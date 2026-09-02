#!/usr/bin/env node
/**
 * Optional export helper: create out_dir/<stamp>/thread.json from stdin JSON
 * (or --from-file). Prints the absolute path to thread.json on stdout.
 *
 * The skinny forum-runner does not call this. Mid-run persistence uses
 * tools/toolbox (thread-add-post). Use this only for manual/export copy-out.
 *
 * Usage:
 *   node tools/write-thread.mjs --out-dir <dir> < result.json
 *   node tools/write-thread.mjs --out-dir <dir> --from-file <path>
 */

import fs from "node:fs";
import path from "node:path";

function usage() {
  process.stderr.write(
    "usage: node write-thread.mjs --out-dir <dir> [--from-file <path>]\n" +
      "  JSON body via stdin unless --from-file is set.\n"
  );
  process.exit(2);
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
    pad(d.getMilliseconds(), 3)
  );
}

function parseArgs(argv) {
  let outDir = "";
  let fromFile = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out-dir" && argv[i + 1]) {
      outDir = argv[++i];
    } else if (a === "--from-file" && argv[i + 1]) {
      fromFile = argv[++i];
    } else if (a === "-h" || a === "--help") {
      usage();
    }
  }
  if (!outDir) usage();
  return { outDir: path.resolve(outDir), fromFile };
}

const { outDir, fromFile } = parseArgs(process.argv.slice(2));

let raw;
if (fromFile) {
  raw = fs.readFileSync(path.resolve(fromFile), "utf8");
} else {
  raw = fs.readFileSync(0, "utf8");
}
if (!raw || !String(raw).trim()) {
  process.stderr.write("write-thread.mjs: empty JSON input\n");
  process.exit(1);
}

// Validate JSON
JSON.parse(raw);

const stampDir = path.join(outDir, stampName());
fs.mkdirSync(stampDir, { recursive: true });
const threadPath = path.join(stampDir, "thread.json");
const text = raw.endsWith("\n") ? raw : raw + "\n";
fs.writeFileSync(threadPath, text, "utf8");
process.stdout.write(threadPath);
