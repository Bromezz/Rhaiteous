/*
 * Normalize example packs: one schema file per station, short station-based names.
 */
import fs from "node:fs";
import path from "node:path";

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function openStationSchema(packId, stationFile, title, description) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://rhaiteous.local/packs/${packId}/stations/${stationFile}`,
    title,
    description:
      description ||
      "Station guidance schema. Undocumented properties are allowed.",
    type: "object",
    additionalProperties: true,
  };
}

// --- example-office-shopping ---
const shop = "examples/example-office-shopping";
const shopSt = path.join(shop, "stations");

const shopIdMap = {
  "intake.schema.json":
    "https://rhaiteous.local/packs/example-office-shopping/stations/intake.schema.json",
  "inventory.schema.json":
    "https://rhaiteous.local/packs/example-office-shopping/stations/inventory.schema.json",
  "audit.schema.json":
    "https://rhaiteous.local/packs/example-office-shopping/stations/audit.schema.json",
  "procurement.schema.json":
    "https://rhaiteous.local/packs/example-office-shopping/stations/procurement.schema.json",
  "purchasing.schema.json":
    "https://rhaiteous.local/packs/example-office-shopping/stations/purchasing.schema.json",
};

for (const [f, id] of Object.entries(shopIdMap)) {
  const p = path.join(shopSt, f);
  if (!fs.existsSync(p)) {
    throw new Error("missing " + p);
  }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.$id = id;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}

// payload $refs → station-named files
let payload = fs.readFileSync(path.join(shop, "schema.json"), "utf8");
const refPairs = [
  ["stations/requests.schema.json", "stations/intake.schema.json"],
  ["stations/items.schema.json", "stations/inventory.schema.json"],
  ["stations/shopping-requests.schema.json", "stations/intake.schema.json"],
  ["stations/shopping-items.schema.json", "stations/inventory.schema.json"],
  ["stations/shopping-audit.schema.json", "stations/audit.schema.json"],
  ["stations/vendor-pick.schema.json", "stations/procurement.schema.json"],
  ["stations/shopping-vendor-pick.schema.json", "stations/procurement.schema.json"],
  ["stations/purchase-one.schema.json", "stations/purchasing.schema.json"],
  ["stations/shopping-purchase-one.schema.json", "stations/purchasing.schema.json"],
];
for (const [a, b] of refPairs) {
  payload = payload.split(a).join(b);
}
fs.writeFileSync(path.join(shop, "schema.json"), payload);

const shopWf = JSON.parse(
  fs.readFileSync(path.join(shop, "workflow.json"), "utf8")
);
shopWf.schemas = {
  intake: "stations/intake.schema.json",
  inventory: "stations/inventory.schema.json",
  audit: "stations/audit.schema.json",
  procurement: "stations/procurement.schema.json",
  purchasing: "stations/purchasing.schema.json",
};
shopWf.stations = shopWf.stations.map(function mapSt(st) {
  const name = st.name;
  const binding = {
    Intake: "intake",
    Inventory: "inventory",
    Audit: "audit",
    Procurement: "procurement",
    Purchasing: "purchasing",
  }[name];
  if (!binding) {
    throw new Error("unknown shopping station " + name);
  }
  return Object.assign({}, st, { schemas: [binding] });
});
writeJson(path.join(shop, "workflow.json"), shopWf);

// --- example-issues-birthday ---
const issues = "examples/example-issues-birthday";
const issuesSt = path.join(issues, "stations");
const packId = "example-issues-birthday";

// rename formulation-state → formulation if present
const oldForm = path.join(issuesSt, "formulation-state.schema.json");
const newForm = path.join(issuesSt, "formulation.schema.json");
if (fs.existsSync(oldForm)) {
  const j = JSON.parse(fs.readFileSync(oldForm, "utf8"));
  j.$id = `https://rhaiteous.local/packs/${packId}/stations/formulation.schema.json`;
  j.title = j.title || "FormulationStationGuidance";
  j.additionalProperties = true;
  writeJson(newForm, j);
  fs.unlinkSync(oldForm);
} else if (fs.existsSync(newForm)) {
  const j = JSON.parse(fs.readFileSync(newForm, "utf8"));
  j.$id = `https://rhaiteous.local/packs/${packId}/stations/formulation.schema.json`;
  j.additionalProperties = true;
  writeJson(newForm, j);
}

const openStations = [
  ["intake.schema.json", "IntakeStationGuidance", "Intake station guidance."],
  [
    "validation.schema.json",
    "ValidationStationGuidance",
    "Validation station guidance.",
  ],
  [
    "presentation.schema.json",
    "PresentationStationGuidance",
    "Presentation station guidance.",
  ],
  ["qa.schema.json", "QaStationGuidance", "QA station guidance."],
];
for (const [f, title, desc] of openStations) {
  writeJson(
    path.join(issuesSt, f),
    openStationSchema(packId, f, title, desc)
  );
}

const issuesWf = JSON.parse(
  fs.readFileSync(path.join(issues, "workflow.json"), "utf8")
);
issuesWf.schemas = {
  intake: "stations/intake.schema.json",
  formulation: "stations/formulation.schema.json",
  validation: "stations/validation.schema.json",
  presentation: "stations/presentation.schema.json",
  qa: "stations/qa.schema.json",
};
issuesWf.stations = issuesWf.stations.map(function mapIss(st) {
  const binding = {
    Intake: "intake",
    Formulation: "formulation",
    Validation: "validation",
    Presentation: "presentation",
    QA: "qa",
  }[st.name];
  if (!binding) {
    throw new Error("unknown issues station " + st.name);
  }
  return Object.assign({}, st, { schemas: [binding] });
});
writeJson(path.join(issues, "workflow.json"), issuesWf);

console.log("normalized station schemas for all example packs");
