#!/usr/bin/env node
/**
 * thread-get-posts <id> [n]
 *
 * Always returns full envelope header (schemas, stations, caps, station_run, benched).
 * posts: last n, or newest-first fill under maxWindowChars.
 */
import {
  fail,
  loadConfig,
  readThread,
  writeJsonStdout,
} from "./lib.mjs";

function usage() {
  fail(
    "usage: thread-get-posts <id> [n]\n" +
      "  n optional: 1 = latest, 3 = three most recent; omit or large n = all that fit under char budget\n",
    2
  );
}

const argv = process.argv.slice(2);
if (argv.length < 1 || argv[0] === "-h" || argv[0] === "--help") usage();

const id = argv[0];
let n = null;
if (argv[1] != null && argv[1] !== "") {
  n = Number.parseInt(argv[1], 10);
  if (!Number.isFinite(n) || n < 1) {
    fail("n must be a positive integer when provided\n", 2);
  }
}

try {
  const cfg = loadConfig();
  const { data } = readThread(cfg, id);
  const total = data.posts.length;
  const budget = cfg.maxWindowChars;

  let candidates =
    n == null || n >= total ? data.posts.slice() : data.posts.slice(-n);

  const selected = [];
  let truncated = false;
  for (let i = candidates.length - 1; i >= 0; i--) {
    const trial = [candidates[i], ...selected];
    if (JSON.stringify(trial).length > budget) {
      truncated = true;
      break;
    }
    selected.unshift(candidates[i]);
  }
  if (selected.length === 0 && candidates.length > 0) truncated = true;

  const last = total > 0 ? data.posts[total - 1] : null;
  let next_hint = null;
  if (last && last.metadata && last.metadata.to != null) {
    const t = last.metadata.to;
    if (typeof t === "string" && t !== "") next_hint = t;
    else if (Array.isArray(t) && t.length === 0) next_hint = null;
    else if (typeof t === "string") next_hint = null;
  }

  writeJsonStdout({
    id: data.id || id,
    schemas: data.schemas,
    stations: data.stations,
    caps: data.caps,
    station_run: data.station_run,
    benched: data.benched,
    next_hint,
    returned: selected.length,
    total,
    truncated,
    maxWindowChars: budget,
    charsPerTokenEstimate: cfg.charsPerTokenEstimate,
    posts: selected,
  });
} catch (e) {
  fail(e.message || String(e));
}
