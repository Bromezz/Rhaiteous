#!/usr/bin/env node
/**
 * thread-add-post <id> [--treatment append|replace] [--no-count] [--json-stdin]
 *
 * Appends a forum post { metadata, message }.
 *
 * --treatment append (default): push post; station_run[from] += 1 (unless no-count).
 * --treatment replace: delete last post with metadata.from == this station, then
 *   append the new post. If no prior post from this station, fall back to append.
 *   Builds rationale_history (newest first) including current routing_rationale.
 *
 * Cap-out (--no-count or mode capped/fatal/benched): always append; ignore replace.
 * mode=capped also sets benched[from]=true. Visit increments only on process path.
 */
import fs from "node:fs";
import {
  fail,
  loadConfig,
  readThread,
  writeJsonStdout,
  writeThread,
} from "./lib.mjs";

function usage() {
  fail(
    "usage: thread-add-post <id> [--treatment append|replace] [--no-count] --json-stdin\n" +
      "  stdin: forum post { metadata: { from, to, mode?, routing_rationale?, ... }, message }\n",
    2
  );
}

function parseArgs(argv) {
  let id = "";
  let noCount = false;
  let jsonStdin = false;
  let treatment = "append";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") usage();
    if (a === "--no-count") {
      noCount = true;
      continue;
    }
    if (a === "--json-stdin") {
      jsonStdin = true;
      continue;
    }
    if (a === "--treatment" && argv[i + 1]) {
      treatment = String(argv[++i]).toLowerCase();
      if (treatment !== "append" && treatment !== "replace") {
        fail("--treatment must be append or replace\n", 2);
      }
      continue;
    }
    if (!a.startsWith("-") && !id) {
      id = a;
      continue;
    }
    fail(`unknown arg: ${a}\n`, 2);
  }
  if (!id || !jsonStdin) usage();
  return { id, noCount, treatment };
}

function findLastIndexFrom(posts, from) {
  for (let i = posts.length - 1; i >= 0; i--) {
    const p = posts[i];
    if (p && p.metadata && p.metadata.from === from) return i;
  }
  return -1;
}

function buildRationaleHistory(oldPost, newRationale) {
  const history = [];
  const current = newRationale != null ? String(newRationale) : "";
  if (current !== "") {
    history.push({ text: current });
  }
  if (oldPost && oldPost.metadata) {
    const prevHist = oldPost.metadata.rationale_history;
    if (Array.isArray(prevHist) && prevHist.length > 0) {
      for (const entry of prevHist) {
        if (entry == null) continue;
        if (typeof entry === "string") {
          if (entry !== "") history.push({ text: entry });
        } else if (typeof entry === "object" && entry.text != null) {
          const t = String(entry.text);
          if (t !== "") history.push({ text: t, visit: entry.visit });
        }
      }
    } else if (oldPost.metadata.routing_rationale) {
      const t = String(oldPost.metadata.routing_rationale);
      if (t !== "" && t !== current) {
        history.push({
          text: t,
          visit: oldPost.metadata.visit,
        });
      }
    }
  }
  // Dedupe consecutive identical texts
  const out = [];
  for (const e of history) {
    if (out.length && out[out.length - 1].text === e.text) continue;
    out.push(e);
  }
  return out;
}

const { id, noCount: noCountFlag, treatment: treatmentArg } =
  parseArgs(process.argv.slice(2));

try {
  const raw = fs.readFileSync(0, "utf8");
  const post = JSON.parse(raw);
  if (!post || typeof post !== "object") fail("post must be an object\n", 2);
  if (!post.metadata || typeof post.metadata !== "object") {
    fail("post.metadata required\n", 2);
  }
  if (!post.message || typeof post.message !== "object") {
    fail("post.message required\n", 2);
  }
  const from = post.metadata.from;
  if (!from || typeof from !== "string") {
    fail("post.metadata.from (station name) required\n", 2);
  }

  const mode =
    post.metadata.mode != null ? String(post.metadata.mode).toLowerCase() : "";
  const suppressModes = new Set(["capped", "fatal", "benched"]);
  const noCount = noCountFlag || suppressModes.has(mode);

  // Cap-out / fatal: always append; ignore replace.
  let treatment = treatmentArg;
  let treatmentIgnored = false;
  if (noCount && treatment === "replace") {
    treatment = "append";
    treatmentIgnored = true;
  }

  const cfg = loadConfig();
  const { file, data } = readThread(cfg, id);

  if (data.stations.indexOf(from) < 0) {
    fail(`unknown station from=${from}\n`, 2);
  }

  if (data.benched[from] === true && mode === "capped") {
    fail(
      `station '${from}' is already benched; refuse another capped save (use mode=fatal to end)\n`
    );
  }

  let replaced = false;
  let replacedIndex = -1;
  let oldPost = null;

  if (treatment === "replace") {
    replacedIndex = findLastIndexFrom(data.posts, from);
    if (replacedIndex >= 0) {
      oldPost = data.posts[replacedIndex];
      data.posts.splice(replacedIndex, 1);
      replaced = true;
      const hist = buildRationaleHistory(
        oldPost,
        post.metadata.routing_rationale
      );
      post.metadata.rationale_history = hist;
      if (
        (post.metadata.routing_rationale == null ||
          post.metadata.routing_rationale === "") &&
        hist.length > 0
      ) {
        post.metadata.routing_rationale = hist[0].text;
      }
    }
    // else: no prior → fall back to append (replaced stays false)
  }

  if (!noCount) {
    const cap = data.caps[from] != null ? data.caps[from] : 1;
    if (data.station_run[from] >= cap) {
      fail(
        `station '${from}' at cap (${data.station_run[from]}/${cap}); use --no-count or mode=capped/fatal\n`
      );
    }
    data.station_run[from] = (data.station_run[from] || 0) + 1;
    post.metadata.visit = data.station_run[from];
  } else {
    if (post.metadata.visit == null) {
      post.metadata.visit = data.station_run[from] || 0;
    }
    if (mode === "capped") {
      data.benched[from] = true;
    }
  }

  // Stamp visit onto newest rationale_history entry when present
  if (
    Array.isArray(post.metadata.rationale_history) &&
    post.metadata.rationale_history.length > 0 &&
    post.metadata.visit != null
  ) {
    const top = post.metadata.rationale_history[0];
    if (top && typeof top === "object") {
      top.visit = post.metadata.visit;
    }
  }

  if (post.message.mime == null) post.message.mime = "text/markdown";
  if (post.message.attachments == null) post.message.attachments = [];

  data.posts.push(post);
  writeThread(file, data);

  writeJsonStdout({
    id,
    total: data.posts.length,
    station_run: data.station_run,
    benched: data.benched,
    no_count: noCount,
    treatment: replaced ? "replace" : "append",
    treatment_ignored: treatmentIgnored,
    replaced,
    replaced_index: replaced ? replacedIndex : null,
    post,
  });
} catch (e) {
  fail(e.message || String(e));
}
