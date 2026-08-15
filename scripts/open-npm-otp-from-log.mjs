/*
 * Open the latest npm EOTP browser auth URL from the npm debug log.
 * Does not print the full URL (may be redacted in some environments).
 */
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeChild from "node:child_process";
import nodeOs from "node:os";

const logDir = nodePath.join(
  nodeOs.homedir(),
  "AppData",
  "Local",
  "npm-cache",
  "_logs"
);

if (!nodeFs.existsSync(logDir)) {
  console.error("No npm log directory:", logDir);
  process.exit(1);
}

const logs = nodeFs
  .readdirSync(logDir)
  .filter(function isLog(f) {
    return f.endsWith(".log");
  })
  .map(function withMtime(f) {
    return {
      f: f,
      t: nodeFs.statSync(nodePath.join(logDir, f)).mtimeMs,
    };
  })
  .sort(function byTime(a, b) {
    return b.t - a.t;
  });

if (logs.length === 0) {
  console.error("No npm logs found");
  process.exit(1);
}

const latest = nodePath.join(logDir, logs[0].f);
const text = nodeFs.readFileSync(latest, "utf8");
const match = text.match(
  /https:\/\/www\.npmjs\.com\/auth\/cli\/[0-9a-fA-F-]+/
);

if (!match) {
  console.error("No auth/cli URL in", latest);
  process.exit(1);
}

const url = match[0];
nodeChild.execFileSync("cmd.exe", ["/c", "start", "", url], {
  stdio: "ignore",
});
console.log("Opened npm 2FA approval page in your default browser.");
console.log("Source log:", nodePath.basename(latest));
console.log("Approve the request in the browser, then say when done.");
