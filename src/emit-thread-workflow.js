/*
 * Skinny forum-runner emitter: stamp meta + workflow.json path + toolbox
 * into the shared Rhai template. Catalogs/prompts load at Init; stations
 * get Operational Guidance + Input + Station Instructions concatenated.
 */

import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeUrl from "node:url";

import jsonToRhaiMod from "./json-to-rhai.js";

const here = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const TEMPLATE_PATH = nodePath.join(here, "templates", "forum-runner.rhai.template");

/**
 * @returns {string} template source
 */
function loadForumRunnerTemplate() {
  if (!nodeFs.existsSync(TEMPLATE_PATH)) {
    throw new Error("forum runner template missing: " + TEMPLATE_PATH);
  }
  return nodeFs.readFileSync(TEMPLATE_PATH, "utf8");
}

/**
 * @param {object} metaWorkflow { name, description, phases }
 * @returns {string} `let meta = #{ ... };`
 */
function emitMetaStatement(metaWorkflow) {
  const phases = Array.isArray(metaWorkflow.phases) ? metaWorkflow.phases : [];
  const metaObj = {
    name: metaWorkflow.name,
    description: metaWorkflow.description,
    phases: phases.map(function mapPhase(p) {
      const out = { title: p.title };
      const detail =
        typeof p.detail === "string"
          ? p.detail
          : typeof p.uiDescription === "string"
            ? p.uiDescription
            : "";
      if (detail.length > 0) {
        out.detail = detail;
      }
      return out;
    }),
  };
  const hasPhase = function (title) {
    return metaObj.phases.some(function (p) {
      return p.title === title;
    });
  };
  if (!hasPhase("Init")) {
    metaObj.phases = [
      {
        title: "Init",
        detail: "create workflow context; load Operational Guidance and station prompts",
      },
    ].concat(metaObj.phases);
  }
  // Drop legacy phase titles
  metaObj.phases = metaObj.phases.filter(function (p) {
    return (
      p.title !== "Rhaiteous Initialization" &&
      p.title !== "Rhaiteous Finalization"
    );
  });
  return "let meta = " + jsonToRhaiMod.jsonToRhai(metaObj, "") + ";";
}

/**
 * Relativize an absolute path to cwd using forward slashes when possible.
 * @param {string} abs
 * @returns {string}
 */
function relativizeToCwd(abs) {
  try {
    const rel = nodePath.relative(process.cwd(), abs);
    if (rel && !rel.startsWith("..") && !nodePath.isAbsolute(rel)) {
      return rel.split(nodePath.sep).join("/");
    }
  } catch (_e) {
    /* fall through */
  }
  return String(abs).split(nodePath.sep).join("/");
}

/**
 * Emit full Rhai script from the shared forum-runner template.
 * @param {object} opts
 * @param {object} opts.metaWorkflow
 * @param {string} opts.workflowJsonPath workspace-relative path to workflow.json
 * @param {string} [opts.packWorkflowPath] deprecated alias of workflowJsonPath
 * @param {string} [opts.toolboxScriptPath] path to tools/toolbox/rhaiteous-toolbox.mjs
 * @param {string} [opts.writeThreadScriptPath] ignored (legacy)
 * @returns {string} full Rhai source (no file header)
 */
export function emitForumRunnerScript(opts) {
  let text = loadForumRunnerTemplate();
  const meta = emitMetaStatement(opts.metaWorkflow);
  const workflowJsonPath =
    typeof opts.workflowJsonPath === "string" && opts.workflowJsonPath.length > 0
      ? opts.workflowJsonPath
      : typeof opts.packWorkflowPath === "string"
        ? opts.packWorkflowPath
        : "";
  if (!workflowJsonPath) {
    throw new Error("emitForumRunnerScript requires workflowJsonPath");
  }

  const packageRoot = nodePath.resolve(here, "..");
  const defaultToolbox = nodePath.join(
    packageRoot,
    "tools",
    "toolbox",
    "rhaiteous-toolbox.mjs"
  );
  const toolboxAbs =
    typeof opts.toolboxScriptPath === "string" && opts.toolboxScriptPath.length > 0
      ? opts.toolboxScriptPath
      : defaultToolbox;
  const toolboxRel = relativizeToCwd(toolboxAbs);

  const replacements = {
    "@@META@@": meta,
    "@@WORKFLOW_JSON@@": jsonToRhaiMod.emitRhaiString(workflowJsonPath),
    "@@TOOLBOX_SCRIPT@@": jsonToRhaiMod.emitRhaiString(toolboxRel),
  };

  for (const marker of Object.keys(replacements)) {
    const idx = text.indexOf(marker);
    if (idx < 0) {
      throw new Error("forum runner template missing splice marker " + marker);
    }
    text =
      text.slice(0, idx) + replacements[marker] + text.slice(idx + marker.length);
    if (text.includes(marker)) {
      throw new Error(
        "forum runner template has duplicate splice marker " + marker
      );
    }
  }

  const leftover = text.match(/@@[A-Z_]+@@/g);
  if (leftover && leftover.length > 0) {
    throw new Error(
      "forum runner template still contains unresolved splices: " +
        leftover.join(", ")
    );
  }

  return text;
}

/**
 * @deprecated use emitForumRunnerScript
 */
export function emitThreadWorkflowBody(stations, ctx) {
  return emitForumRunnerScript({
    metaWorkflow: {
      name: "unnamed",
      description: "legacy emitThreadWorkflowBody call",
      phases: (stations || []).map(function (s) {
        return {
          title: s.name,
          detail: typeof s.uiDescription === "string" ? s.uiDescription : undefined,
        };
      }),
    },
    workflowJsonPath:
      (ctx && (ctx.workflowJsonPath || ctx.packWorkflowPath)) || "workflow.json",
  });
}
