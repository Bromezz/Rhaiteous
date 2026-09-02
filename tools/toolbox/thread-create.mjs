#!/usr/bin/env node
/**
 * thread-create [--id <stamp>] [--json-stdin]
 *
 * Creates threads/<id>/thread.json with schemas/stations/caps/station_run/benched/posts.
 * Without --json-stdin, reads a JSON envelope from stdin (stations+caps required;
 * schemas optional). With neither stdin nor --json-stdin empty object, use
 * --stations and --caps flags (experiment convenience).
 *
 * Prints { id, path } on stdout.
 */
import fs from "node:fs";
import path from "node:path";
import {
  fail,
  loadConfig,
  stampName,
  threadDir,
  threadFile,
  ensureLedger,
  writeThread,
  writeJsonStdout,
} from "./lib.mjs";

function usage() {
  fail(
    "usage: thread-create [--id <stamp>] [--json-stdin]\n" +
      "  stdin JSON: { schemas?, stations, caps? }\n",
    2
  );
}

function parseArgs(argv) {
  let id = "";
  let jsonStdin = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") usage();
    if (a === "--id" && argv[i + 1]) {
      id = argv[++i];
      continue;
    }
    if (a === "--json-stdin") {
      jsonStdin = true;
      continue;
    }
    fail(`unknown arg: ${a}\n`, 2);
  }
  return { id, jsonStdin };
}

const { id: idArg } = parseArgs(process.argv.slice(2));

try {
  const raw = fs.readFileSync(0, "utf8");
  if (!raw || !String(raw).trim()) {
    fail("thread-create: empty JSON stdin (need { stations, caps?, schemas? })\n", 2);
  }
  const body = JSON.parse(raw);
  if (!Array.isArray(body.stations) || body.stations.length === 0) {
    fail("thread-create: stations array required\n", 2);
  }

  const cfg = loadConfig();
  const id = idArg || stampName();
  const dir = threadDir(cfg, id);
  const file = threadFile(cfg, id);
  if (fs.existsSync(file)) {
    fail(`thread already exists: ${file}\n`);
  }

  const caps = body.caps && typeof body.caps === "object" ? { ...body.caps } : {};
  for (const name of body.stations) {
    if (caps[name] == null) caps[name] = 1;
  }
  const station_run = {};
  const benched = {};
  for (const name of body.stations) {
    station_run[name] = 0;
    benched[name] = false;
  }

  const data = ensureLedger({
    id,
    schemas: body.schemas && typeof body.schemas === "object" ? body.schemas : {},
    stations: body.stations.slice(),
    caps,
    station_run,
    benched,
    posts: [],
  });

  fs.mkdirSync(dir, { recursive: true });
  writeThread(file, data);
  writeJsonStdout({ id, path: path.resolve(file) });
} catch (e) {
  fail(e.message || String(e));
}
