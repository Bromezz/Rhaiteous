/*
 * One-shot / maintenance: build examples/example-* packs from legacy assets.
 * Safe to re-run (overwrites pack authoring files; keeps input samples if present).
 */
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeUrl from "node:url";

const root = nodePath.resolve(
  nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url)),
  ".."
);

function ensureDir(p) {
  nodeFs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(nodePath.dirname(dest));
  nodeFs.copyFileSync(src, dest);
}

function writeJson(dest, obj) {
  ensureDir(nodePath.dirname(dest));
  nodeFs.writeFileSync(dest, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function writeText(dest, text) {
  ensureDir(nodePath.dirname(dest));
  nodeFs.writeFileSync(dest, text, "utf8");
}

// --- example-office-shopping ---
const shopLegacy = nodePath.join(root, "examples", "rhaiteous");
const shopPack = nodePath.join(root, "examples", "example-office-shopping");
ensureDir(nodePath.join(shopPack, "stations"));
ensureDir(nodePath.join(shopPack, "input"));
ensureDir(nodePath.join(shopPack, "output"));

// Prefer already-normalized station schemas under the pack when present.
// Legacy monorepo shopping-* names are no longer used.
for (const f of [
  "common.md",
  "intake.md",
  "inventory.md",
  "audit.md",
  "procurement.md",
  "purchasing.md",
]) {
  copyFile(
    nodePath.join(shopLegacy, "prompts", "stations", f),
    nodePath.join(shopPack, "stations", f)
  );
}

const payload = JSON.parse(
  nodeFs.readFileSync(
    nodePath.join(shopLegacy, "schemas", "shopping-payload.schema.json"),
    "utf8"
  )
);
payload.$id =
  "https://rhaiteous.local/packs/example-office-shopping/schema.json";
let payloadText = JSON.stringify(payload, null, 2).replace(
  /"\$ref": "shopping-/g,
  '"$ref": "stations/shopping-'
);
writeText(nodePath.join(shopPack, "schema.json"), payloadText + "\n");

writeJson(nodePath.join(shopPack, "workflow.json"), {
  name: "example-office-shopping",
  description:
    "Example seed: twice-weekly office supply cycle (Intake → Inventory → Audit → Procurement → Purchasing).",
  payloadSchema: "schema.json",
  args: {
    requests_dir: "workflows/example-office-shopping/input",
    company_name: "Acme Office",
    cycle: "twice-weekly",
  },
  schemas: {
    requests: "stations/shopping-requests.schema.json",
    items: "stations/shopping-items.schema.json",
    audit: "stations/shopping-audit.schema.json",
    vendor_pick: "stations/shopping-vendor-pick.schema.json",
    purchase_one: "stations/shopping-purchase-one.schema.json",
  },
  prompts: {
    flow_common: "common.md",
    intake: "intake.md",
    inventory: "inventory.md",
    audit: "audit.md",
    procurement: "procurement.md",
    purchasing: "purchasing.md",
  },
  stations: [
    {
      name: "Intake",
      uiDescription: "collect and deposit requests from email, chat, forms",
      prompt: ["flow_common", "intake"],
      schemas: ["requests"],
      capability_mode: "read-only",
    },
    {
      name: "Inventory",
      uiDescription: "compile specific items and quantities per request",
      prompt: ["flow_common", "inventory"],
      schemas: ["items"],
      capability_mode: "read-only",
    },
    {
      name: "Audit",
      uiDescription: "challenge each line across validity facets",
      prompt: ["flow_common", "audit"],
      schemas: ["audit"],
      capability_mode: "read-only",
    },
    {
      name: "Procurement",
      uiDescription: "select a vendor for each surviving item",
      prompt: ["flow_common", "procurement"],
      schemas: ["vendor_pick"],
      capability_mode: "read-only",
    },
    {
      name: "Purchasing",
      uiDescription: "buy and record each transaction",
      prompt: ["flow_common", "purchasing"],
      schemas: ["purchase_one"],
      capability_mode: "execute",
    },
  ],
});

const sampleReq = nodePath.join(shopPack, "input", "sample-request.md");
if (!nodeFs.existsSync(sampleReq)) {
  writeText(
    sampleReq,
    "# Sample request\n\nPlease order 2 boxes of letter paper and 1 stapler.\n"
  );
}
writeText(nodePath.join(shopPack, "output", ".gitkeep"), "");

// --- example-issues-birthday ---
const issuesSrc = nodePath.join(root, "experiments", "fulltest2");
const issuesPack = nodePath.join(root, "examples", "example-issues-birthday");
ensureDir(nodePath.join(issuesPack, "stations"));
ensureDir(nodePath.join(issuesPack, "input"));
ensureDir(nodePath.join(issuesPack, "output"));

const issuesPayloadPath = nodePath.join(
  issuesSrc,
  "schemas",
  "issues-payload.schema.json"
);
if (!nodeFs.existsSync(issuesPayloadPath)) {
  console.error(
    "missing experiments/fulltest2 (needed once to seed issues example). " +
      "Create examples/example-issues-birthday manually if experiments/ is gone."
  );
  process.exit(1);
}

const issuesPayload = JSON.parse(
  nodeFs.readFileSync(issuesPayloadPath, "utf8")
);
issuesPayload.$id =
  "https://rhaiteous.local/packs/example-issues-birthday/schema.json";
writeJson(nodePath.join(issuesPack, "schema.json"), issuesPayload);

copyFile(
  nodePath.join(issuesSrc, "schemas", "formulation-state.schema.json"),
  nodePath.join(issuesPack, "stations", "formulation-state.schema.json")
);
for (const f of [
  "common.md",
  "intake.md",
  "formulation.md",
  "validation.md",
  "presentation.md",
  "qa.md",
]) {
  copyFile(
    nodePath.join(issuesSrc, "prompts", "stations", f),
    nodePath.join(issuesPack, "stations", f)
  );
}

const birthdaySrc = nodePath.join(
  issuesSrc,
  "sources",
  "birthday-party-discussion.md"
);
copyFile(
  birthdaySrc,
  nodePath.join(issuesPack, "input", "birthday-party-discussion.md")
);

writeJson(nodePath.join(issuesPack, "workflow.json"), {
  name: "example-issues-birthday",
  description:
    "Example seed: source-agnostic issues mining (Intake curated corpus → Formulation ⇄ Validation → Presentation → QA) over a birthday-planning fixture.",
  payloadSchema: "schema.json",
  args: {
    source_candidates: [
      {
        type: "file",
        source:
          "workflows/example-issues-birthday/input/birthday-party-discussion.md",
      },
      {
        type: "url",
        source: "https://www.wikihow.com/Plan-a-Birthday-Party",
      },
    ],
    out_dir: "workflows/example-issues-birthday/output",
    curated: null,
    flow_json_name: "example-issues-birthday-flow.json",
    issues_md_name: "example-issues-birthday-issues.md",
    report_title: "Birthday planning issues",
  },
  schemas: {
    formulation_state: "stations/formulation-state.schema.json",
  },
  prompts: {
    flow_common: "common.md",
    intake: "intake.md",
    formulation: "formulation.md",
    validation: "validation.md",
    presentation: "presentation.md",
    qa: "qa.md",
  },
  stations: [
    {
      name: "Intake",
      uiDescription: "Verify sources; curate Markdown corpus",
      prompt: ["flow_common", "intake"],
      capability_mode: "read-write",
    },
    {
      name: "Formulation",
      uiDescription: "Surface issues from curated only; itemsAdded",
      prompt: ["flow_common", "formulation"],
      schemas: ["formulation_state"],
      capability_mode: "read-only",
    },
    {
      name: "Validation",
      uiDescription: "Coverage gate then skeptical validity",
      prompt: ["flow_common", "validation"],
      capability_mode: "read-only",
    },
    {
      name: "Presentation",
      uiDescription: "Write flow JSON + issues markdown under out_dir",
      prompt: ["flow_common", "presentation"],
      capability_mode: "read-write",
    },
    {
      name: "QA",
      uiDescription: "Polish wording and formatting",
      prompt: ["flow_common", "qa"],
      capability_mode: "read-write",
    },
  ],
});

writeText(nodePath.join(issuesPack, "output", ".gitkeep"), "");

console.log("scaffolded:");
console.log(" ", shopPack);
console.log(" ", issuesPack);
