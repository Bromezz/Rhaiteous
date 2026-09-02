/**
 * Shared helpers for the Rhaiteous toolbox (workflow context + station_run + benched).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function toolboxDir() {
  return __dirname;
}

export function loadConfig() {
  const configPath = path.join(__dirname, "config", "config-thread.json");
  const raw = fs.readFileSync(configPath, "utf8");
  const cfg = JSON.parse(raw);
  const estimate =
    typeof cfg.charsPerTokenEstimate === "number" && cfg.charsPerTokenEstimate > 0
      ? cfg.charsPerTokenEstimate
      : 4;
  const fromTokens =
    typeof cfg.maxEstimatedTokens === "number" && cfg.maxEstimatedTokens > 0
      ? Math.floor(cfg.maxEstimatedTokens * estimate)
      : null;
  let maxWindowChars =
    typeof cfg.maxWindowChars === "number" && cfg.maxWindowChars > 0
      ? cfg.maxWindowChars
      : 800000;
  if (fromTokens != null) {
    maxWindowChars = Math.min(maxWindowChars, fromTokens);
  }
  // Prefer env override (e.g. tools/init.mjs), else config; relative → process.cwd().
  const rawRoot =
    process.env.RHAITEOUS_THREADS_ROOT || cfg.threadsRoot || "threads";
  const threadsRoot = path.isAbsolute(rawRoot)
    ? rawRoot
    : path.resolve(process.cwd(), rawRoot);
  return {
    ...cfg,
    charsPerTokenEstimate: estimate,
    maxWindowChars,
    threadsRoot,
    configPath,
  };
}

export function stampName(d = new Date()) {
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

export function threadDir(cfg, id) {
  return path.join(cfg.threadsRoot, id);
}

export function threadFile(cfg, id) {
  return path.join(threadDir(cfg, id), "thread.json");
}

export function ensureLedger(data) {
  if (!data.schemas || typeof data.schemas !== "object") data.schemas = {};
  if (!Array.isArray(data.stations)) data.stations = [];
  if (!data.caps || typeof data.caps !== "object") data.caps = {};
  if (!data.station_run || typeof data.station_run !== "object") data.station_run = {};
  if (!data.benched || typeof data.benched !== "object") data.benched = {};
  if (!Array.isArray(data.posts)) data.posts = [];
  for (const name of data.stations) {
    if (data.station_run[name] == null) data.station_run[name] = 0;
    if (data.benched[name] == null) data.benched[name] = false;
    if (data.caps[name] == null) data.caps[name] = 1;
  }
  return data;
}

export function readThread(cfg, id) {
  const file = threadFile(cfg, id);
  if (!fs.existsSync(file)) {
    throw new Error(`thread not found: ${file}`);
  }
  const data = ensureLedger(JSON.parse(fs.readFileSync(file, "utf8")));
  return { file, data };
}

export function writeThread(file, data) {
  const text = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(file, text, "utf8");
}

export function writeJsonStdout(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

export function fail(msg, code = 1) {
  process.stderr.write(String(msg).endsWith("\n") ? msg : msg + "\n");
  process.exit(code);
}

export function defaultNextStation(stations, fromName) {
  if (!Array.isArray(stations) || stations.length === 0) return null;
  const i = stations.indexOf(fromName);
  if (i < 0 || i + 1 >= stations.length) return null;
  return stations[i + 1];
}
