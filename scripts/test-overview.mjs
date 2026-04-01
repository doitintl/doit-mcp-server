/**
 * Test get_cloud_overview end-to-end: handler + adapter + widget data simulation.
 * Usage: node scripts/test-overview.mjs  (reads .env.local automatically)
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
}

const token = process.env.DOIT_TOKEN;
if (!token) { console.error("DOIT_TOKEN not found in .env.local"); process.exit(1); }

import { handleCloudOverviewRequest } from "../dist/tools/overview.js";
import { adaptToolResponse } from "../dist/utils/responseAdapter.js";

console.log("Calling get_cloud_overview...\n");
const raw = await handleCloudOverviewRequest({}, token);
const adapted = adaptToolResponse("get_cloud_overview", raw);
const sc = adapted.structuredContent;

// ── Verify keys ──────────────────────────────────────────────────────────────
const EXPECTED = ["costByCloud", "topServices", "topProjects", "anomalies", "incidents"];
const missing = EXPECTED.filter(k => !(k in sc));
if (missing.length) { console.error("❌ Missing keys:", missing); process.exit(1); }
console.log("✅ All expected keys present\n");

// ── Helpers ──────────────────────────────────────────────────────────────────
const PROVIDER_NAMES = {
  "amazon-web-services":"AWS","google-cloud":"GCP","microsoft-azure":"Azure",
  "cursor":"Cursor","github":"GitHub","openai":"OpenAI","mongodb":"MongoDB","anthropic":"Anthropic",
};
const name = id => PROVIDER_NAMES[id] ?? id.split("-").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ");
const fmt = v => v>=1e6?`$${(v/1e6).toFixed(1)}M`:v>=1e3?`$${(v/1e3).toFixed(1)}K`:`$${v.toFixed(0)}`;
const isOther = s => s.startsWith("∑") || s.toLowerCase().startsWith("other");

function aggByCloud(cols, rows) {
  const ci = cols.findIndex(c=>c.name==="cloud_provider");
  const vi = cols.findIndex(c=>c.type?.toUpperCase().includes("FLOAT")||c.name==="cost");
  if (ci<0||vi<0) return new Map();
  const m = new Map();
  for (const r of rows) {
    const c = String(r[ci]??""); if (isOther(c)) continue;
    m.set(c,(m.get(c)??0)+(Number(r[vi])||0));
  }
  return m;
}

// ── Cost by Cloud ────────────────────────────────────────────────────────────
const costMap = aggByCloud(sc.costByCloud.columns, sc.costByCloud.rows);
const totalCost = [...costMap.values()].reduce((s,v)=>s+v,0);
console.log(`=== Cloud Spend (last 30 days): ${fmt(totalCost)} ===`);
for (const [cloud, cost] of [...costMap.entries()].sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${name(cloud).padEnd(12)} ${fmt(cost)}`);
}

// ── Top Services ─────────────────────────────────────────────────────────────
const svCols = sc.topServices.columns;
const svCloudIdx = svCols.findIndex(c=>c.name==="cloud_provider");
const svNameIdx  = svCols.findIndex(c=>c.name==="service_description");
const svCostIdx  = svCols.findIndex(c=>c.type?.toUpperCase().includes("FLOAT")||c.name==="cost");
const svcAgg = new Map();
for (const r of sc.topServices.rows) {
  const key=`${r[svCloudIdx]}||${r[svNameIdx]}`; const c=Number(r[svCostIdx])||0;
  svcAgg.set(key,(svcAgg.get(key)??0)+c);
}
console.log("\n=== Top 5 services ===");
[...svcAgg.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([key,cost])=>{
  const [cloud,svc]=key.split("||");
  console.log(`  [${name(cloud).padEnd(4)}] ${(svc??"").padEnd(45)} ${fmt(cost)}`);
});

// ── Anomalies ────────────────────────────────────────────────────────────────
console.log(`\n=== Anomalies (${sc.anomalies.length}) ===`);
for (const a of sc.anomalies.slice(0,5)) {
  const hasId = !!a.id;
  console.log(`  [${(a.severityLevel??"").padEnd(8)}] ${(a.serviceName??a.platform??"").padEnd(40)} ${fmt(Number(a.costOfAnomaly??0))}  id=${hasId?a.id:"MISSING"}`);
}

// ── Incidents ────────────────────────────────────────────────────────────────
console.log(`\n=== Incidents (${sc.incidents.length}) ===`);
for (const i of sc.incidents.slice(0,5)) {
  const hasId = !!i.id;
  console.log(`  [${(i.status??"").padEnd(10)}] ${(i.title??i.product??"").padEnd(50)} id=${hasId?i.id:"MISSING"}`);
}

console.log("\n✅ All checks passed");
