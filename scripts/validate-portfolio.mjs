/** Offline checks only: no workflow execution, environment loading, or network calls. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file).replace(/^\uFEFF/, ""));
// Reuse the ignore parser already installed with the frontend lint tooling.
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const ignored = require("ignore")().add(read(".gitignore"));
const specs = [
  ["01_Monthly_Sales_Ingestion.json", 14], ["02_Document_Processing.json", 17],
  ["03_AI_Assistant_RAG_Gmail.json", 10], ["03B_Web_AI_Assistant.json", 7],
  ["04A_Reports_Catalog_API.json", 5],
];
const workflows = new Map();
let codeCount = 0;
let expressionCount = 0;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function inspect(value, location) {
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!["credentials", "webhookId", "instanceId", "versionId", "staticData"].includes(key), `${location}: private metadata field`);
    assert.ok(!key.startsWith("cachedResult"), `${location}: cached resource metadata`);
    if (key === "jsCode") {
      new AsyncFunction(item); // Parse only; never execute workflow code.
      codeCount++;
    } else if (typeof item === "string" && /^=\{\{[\s\S]*\}\}$/.test(item)) {
      new Function(`return (${item.slice(3, -2)});`); // Parse only.
      expressionCount++;
    }
    inspect(item, `${location}.${key}`);
  }
}

for (const [file, count] of specs) {
  const workflow = json(`workflows/${file}`);
  assert.equal(workflow.active, false, `${file}: must remain inactive`);
  assert.ok(!Object.hasOwn(workflow, "id") && !Object.hasOwn(workflow, "meta"), `${file}: instance identity`);
  assert.deepEqual(workflow.pinData, {});
  assert.equal(workflow.nodes.length, count);
  const names = new Set(workflow.nodes.map(node => node.name));
  assert.equal(names.size, count, `${file}: duplicate node names`);
  assert.equal(new Set(workflow.nodes.map(node => node.id)).size, count, `${file}: duplicate node IDs`);
  for (const node of workflow.nodes) {
    assert.ok(node.name && node.id && node.type && Number.isFinite(node.typeVersion));
    assert.ok(Array.isArray(node.position) && node.position.length === 2);
    inspect(node, `${file}/${node.name}`);
  }
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    assert.ok(names.has(source), `${file}: missing source node`);
    for (const ports of Object.values(outputs)) for (const port of ports) for (const edge of port) {
      assert.ok(names.has(edge.node), `${file}: missing target node`);
      assert.ok(typeof edge.type === "string" && Number.isInteger(edge.index) && edge.index >= 0);
    }
  }
  workflows.set(file, workflow);
  console.log(`PASS workflow ${file}: ${count} nodes, inactive, no credential assignments`);
}

const ingestion = workflows.get(specs[0][0]);
assert.equal(ingestion.nodes.find(n => n.type === "n8n-nodes-base.webhook").parameters.httpMethod, "POST");
const email = workflows.get(specs[2][0]);
assert.equal(email.connections["Gmail - Send Approved Summary"].ai_tool[0][0].node, "Human Review - Approve Email in Chat");
assert.equal(email.connections["Human Review - Approve Email in Chat"].ai_tool[0][0].node, "NileMart AI Agent");
const web = workflows.get(specs[3][0]);
assert.equal(web.nodes.find(n => n.type.endsWith(".chatTrigger")).parameters.authentication, "basicAuth");
assert.ok(!web.nodes.some(n => /gmail/i.test(n.type)));
const catalog = workflows.get(specs[4][0]);
const catalogTrigger = catalog.nodes.find(n => n.type === "n8n-nodes-base.webhook");
assert.equal(catalogTrigger.parameters.httpMethod || "GET", "GET");
assert.equal(catalogTrigger.parameters.authentication, "basicAuth");
assert.equal(catalogTrigger.parameters.path, "nilemart-reports-catalog-v1");
assert.ok(catalog.nodes.filter(n => /googleSheets/.test(n.type)).every(n => !n.parameters.operation || n.parameters.operation === "read"));
console.log(`PASS executable syntax: ${codeCount} Code nodes and ${expressionCount} complete expressions (not executed)`);

function csv(file) {
  const lines = read(`sample-data/${file}`).trimEnd().split(/\r?\n/);
  // These selected source records have no quoted fields or multiline cells.
  assert.ok(lines.every(line => !line.includes('"')), `${file}: needs a quoted CSV parser`);
  const headers = lines.shift().split(",");
  return lines.map(line => {
    const fields = line.split(",");
    assert.equal(fields.length, headers.length);
    assert.ok(fields.every(field => !/^[=+@]/.test(field)), `${file}: spreadsheet formula content`);
    return Object.fromEntries(headers.map((header, index) => [header, fields[index]]));
  });
}
const reports = csv("report_index.csv");
const sales = csv("sales_transactions_summary.csv");
const inventory = csv("inventory_ledger.csv");
const expected = json("sample-data/expected_rag_answers.json");
assert.equal(reports.length, 2);
assert.equal(sales.length, 24);
assert.equal(inventory.length, 24);
assert.equal(expected.report_count, reports.length);
assert.equal(expected.synthetic, true);
const reportIds = new Set(reports.map(row => row.report_id));
for (const row of [...sales, ...inventory]) assert.ok(reportIds.has(row.report_id));
for (const row of sales) {
  assert.equal(Number(row.gross_sales_egp), Number(row.units_sold) * Number(row.unit_price_egp));
  assert.equal(Number(row.net_sales_egp), Number(row.gross_sales_egp) - Number(row.discount_egp) - Number(row.returns_refund_egp));
}
for (const row of inventory) {
  assert.equal(Number(row.closing_stock), Number(row.opening_stock) + Number(row.received_units) - Number(row.units_sold) + Number(row.returned_to_stock) - Number(row.damaged_units));
  assert.equal(row.low_stock === "True", Number(row.closing_stock) <= Number(row.reorder_point));
}

// These two reviewed PDFs use ReportLab's ASCII85 + Flate streams.
function decode85(source) {
  const text = source.replace(/\s/g, "").replace(/^<~/, "").replace(/~>$/, "");
  const output = [];
  let group = [];
  const bytes = values => {
    const n = values.reduce((sum, value) => sum * 85 + value, 0);
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  };
  for (const character of text) {
    if (character === "z" && !group.length) { output.push(0, 0, 0, 0); continue; }
    group.push(character.charCodeAt(0) - 33);
    if (group.length === 5) { output.push(...bytes(group)); group = []; }
  }
  if (group.length) { const count = group.length; while (group.length < 5) group.push(84); output.push(...bytes(group).slice(0, count - 1)); }
  return Buffer.from(output);
}
const pdfText = new Map();
for (const report of reports) {
  const rows = sales.filter(row => row.report_id === report.report_id);
  assert.equal(rows.reduce((sum, row) => sum + Number(row.net_sales_egp), 0), Number(report.net_sales));
  const answer = expected.reports.find(row => row.file_name === report.filename);
  assert.equal(answer?.net_sales_egp, Number(report.net_sales));
  const file = `sample-data/reports/${report.filename}`;
  const raw = fs.readFileSync(path.join(root, file)).toString("latin1");
  assert.ok(raw.startsWith("%PDF-"));
  assert.match(raw, /\/Author \(NileMart Synthetic Data Lab\)/);
  assert.doesNotMatch(raw, /\/(?:JavaScript|EmbeddedFiles|OpenAction|Launch)\b/);
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map(match => zlib.inflateSync(decode85(match[1])).toString("utf8"));
  assert.equal(streams.length, 2, `${file}: expected two reviewed pages`);
  const text = streams.join("\n");
  assert.ok(text.includes("SYNTHETIC TEST DATA"));
  assert.ok(text.includes(Number(report.net_sales).toLocaleString("en-US")));
  pdfText.set(file, text + "\n" + raw);
}
assert.equal(expected.combined_net_sales_egp, reports.reduce((sum, report) => sum + Number(report.net_sales), 0));
assert.deepEqual(expected.low_stock, inventory.filter(row => row.low_stock === "True").map(row => ({ branch: row.branch, sku: row.sku, product: row.product, closing_stock: Number(row.closing_stock), reorder_point: Number(row.reorder_point) })));
console.log("PASS sample data: 2 PDFs, 2 report rows, 24 sales rows, 24 inventory rows, scoped expected answers");

const required = ["README.md", "docs/ARCHITECTURE.md", "docs/BACKEND_SETUP.md", "docs/UPLOAD_API.md", "docs/CHAT_ASSISTANT.md", "docs/sales-reports.md", "docs/VALIDATION.md", "docs/PUBLICATION_REVIEW.md", "docs/screenshots/README.md", "workflows/README.md", "sample-data/README.md", "frontend/.env.example"];
for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
const publicFiles = [];
function walk(directory = "") {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = [directory, entry.name].filter(Boolean).join("/");
    if (entry.name === ".git" || ignored.ignores(file + (entry.isDirectory() ? "/" : ""))) continue;
    if (entry.isDirectory()) walk(file); else publicFiles.push(file);
  }
}
walk();
assert.deepEqual(publicFiles.filter(file => file.startsWith("workflows/") && file.endsWith(".json")).sort(), specs.map(([file]) => `workflows/${file}`).sort());
for (const file of ["frontend/.env.local", "_Private_Resources/current-exports/example.json", "frontend/node_modules/example.js", "frontend/.next/example.js", "frontend/tests/.markdown-render-test-x/module.mjs", "frontend/tests/.reports-render-test-x/module.mjs", "frontend/tests/.dashboard-render-test-x/module.mjs"]) assert.ok(ignored.ignores(file), `Ignore rule missing: ${file}`);
assert.ok(!ignored.ignores("frontend/.env.example"));

let localLinks = 0;
for (const file of publicFiles.filter(file => file.endsWith(".md"))) {
  const markdown = read(file).replace(/```[\s\S]*?```/g, "");
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
    const [targetPath, anchor] = target.split("#");
    target = decodeURIComponent(targetPath);
    const destination = path.resolve(root, path.dirname(file), target);
    assert.ok(fs.existsSync(destination), `Broken link in ${file}`);
    if (anchor && destination.endsWith(".md")) {
      const headings = [...fs.readFileSync(destination, "utf8").matchAll(/^#{1,6}\s+(.+)$/gm)]
        .map(match => match[1].toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, "").replace(/ /g, "-"));
      assert.ok(headings.includes(decodeURIComponent(anchor)), `Broken heading link in ${file}`);
    }
    localLinks++;
  }
}

const signatures = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["google-key", /AIza[\w-]{30,}/], ["oauth-token", /ya29\.[\w-]{15,}/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ["jwt", /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/],
  ["supabase-secret", /\bsb_secret_[\w-]{16,}/],
  ["machine-path", /[A-Z]:[\\/](?:Users|Eslam)[\\/]/i],
];
for (const file of publicFiles) {
  const text = pdfText.get(file) || (/\.(?:md|json|mjs|tsx?|css|csv|svg)$/.test(file) || file.endsWith(".env.example") ? read(file) : "");
  for (const [category, pattern] of signatures) assert.ok(!pattern.test(text), `${file}: ${category} review required`);
}
for (const line of read("frontend/.env.example").split(/\r?\n/)) {
  if (/^[A-Z0-9_]*(?:PASSWORD|USERNAME|TOKEN|SECRET|KEY)=/.test(line)) assert.equal(line.split("=").slice(1).join("").trim(), "", "Environment template credential must be empty");
}
console.log(`PASS publication checks: ${publicFiles.length} non-ignored files, ${localLinks} local documentation links, ignore rules and targeted secret scan`);
console.log("No workflows executed. No live import, service health, or complete secret-detection guarantee is implied.");
