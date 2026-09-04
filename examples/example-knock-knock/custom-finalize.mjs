#!/usr/bin/env node
/**
 * Example pack-local custom finalizer logic.
 * Called from finalize.mjs with the absolute path to this run's thread.json.
 *
 * Demonstrates a post-run hook: read the thread, write a short summary next to
 * the pack output folder for humans/agents to open after /workflow.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} threadJsonPath - absolute path to thread.json
 * @returns {Promise<void>}
 */
export default async function customFinalize(threadJsonPath) {
  const abs = path.resolve(threadJsonPath);
  const raw = fs.readFileSync(abs, "utf8");
  const thread = JSON.parse(raw);
  const posts = Array.isArray(thread.posts) ? thread.posts : [];

  const lines = [];
  lines.push("# Knock-knock finalize summary");
  lines.push("");
  lines.push(`thread: ${abs}`);
  lines.push(`posts: ${posts.length}`);
  lines.push("");

  let i = 0;
  while (i < posts.length) {
    const p = posts[i];
    const from =
      p && p.metadata && typeof p.metadata.from === "string"
        ? p.metadata.from
        : "?";
    const body =
      p && p.message && typeof p.message.body === "string" ? p.message.body : "";
    lines.push(`${i + 1}. **${from}:** ${body}`);
    i += 1;
  }

  lines.push("");

  // pack output/ (…/output/threads/<id>/thread.json → …/output/)
  const outDir = path.resolve(path.dirname(abs), "..", "..");
  const summaryPath = path.join(outDir, "finalize-summary.md");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(summaryPath, lines.join("\n"), "utf8");
  console.log("custom-finalize: wrote", summaryPath);
}
