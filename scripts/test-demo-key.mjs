/**
 * Tests the demo_key interceptor by calling makeDoitRequest-equivalent
 * URLs and validating the data shapes the CloudOverview widget needs.
 *
 * Run: npx tsx scripts/test-demo-key.mjs
 */

import { getDemoResponse } from "../src/utils/demoData.js";

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
    if (condition) {
        console.log(`  ✓ ${label}`);
        passed++;
    } else {
        console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
        failed++;
    }
}

function hasColumns(section, ...names) {
    const cols = section?.columns?.map(c => c.name) ?? [];
    return names.every(n => cols.includes(n));
}

// ── Panel 1: Cloud Spend ───────────────────────────────────────────────────────

console.log("\nPanel 1: Cloud Spend (costByCloud)");
const costBody = { config: { dataSource: "billing", metrics: [{ type: "basic", value: "cost" }], group: [{ id: "cloud_provider", type: "fixed" }] } };
const costRes = getDemoResponse("https://api.doit.com/analytics/v1/reports/query", "POST", costBody);
const costData = costRes?.result;
assert("has result.schema", Array.isArray(costData?.schema));
assert("has cloud_provider column", hasColumns({ columns: costData?.schema }, "cloud_provider"), JSON.stringify(costData?.schema));
assert("has cost column", hasColumns({ columns: costData?.schema }, "cost"), JSON.stringify(costData?.schema));
assert("has rows", costData?.rows?.length > 0);
assert("GCP row present", costData?.rows?.some(r => r[0] === "google-cloud"));
assert("AWS row present", costData?.rows?.some(r => r[0] === "amazon-web-services"));

// ── Panel 2: Top Services ──────────────────────────────────────────────────────

console.log("\nPanel 2: Top Services (topServices)");
const svcBody = { config: { group: [{ id: "cloud_provider" }, { id: "service_description" }] } };
const svcRes = getDemoResponse("https://api.doit.com/analytics/v1/reports/query", "POST", svcBody);
const svcData = svcRes?.result;
assert("has result.schema", Array.isArray(svcData?.schema));
assert("has cloud_provider column", hasColumns({ columns: svcData?.schema }, "cloud_provider"), JSON.stringify(svcData?.schema));
assert("has service_description column", hasColumns({ columns: svcData?.schema }, "service_description"), JSON.stringify(svcData?.schema));
assert("has cost column", hasColumns({ columns: svcData?.schema }, "cost"));
assert("has rows", svcData?.rows?.length > 0);

// ── Panel 3: Top Projects ──────────────────────────────────────────────────────

console.log("\nPanel 3: Top Projects (topProjects)");
const projBody = { config: { group: [{ id: "cloud_provider" }, { id: "project_id" }] } };
const projRes = getDemoResponse("https://api.doit.com/analytics/v1/reports/query", "POST", projBody);
const projData = projRes?.result;
assert("has result.schema", Array.isArray(projData?.schema));
assert("has cloud_provider column", hasColumns({ columns: projData?.schema }, "cloud_provider"));
assert("has project_id column", hasColumns({ columns: projData?.schema }, "project_id"));
assert("has cost column", hasColumns({ columns: projData?.schema }, "cost"));
assert("has rows", projData?.rows?.length > 0);

// ── Panel 4: Cost Anomalies ────────────────────────────────────────────────────

console.log("\nPanel 4: Cost Anomalies");
const anomRes = getDemoResponse("https://api.doit.com/anomalies/v1?maxResults=5", "GET");
const anomalies = anomRes?.anomalies;
assert("anomalies is array", Array.isArray(anomalies));
assert("has items", anomalies?.length > 0);
const a = anomalies?.[0];
assert("has id", !!a?.id);
assert("has platform", !!a?.platform, `got: ${a?.platform}`);
assert("has serviceName", !!a?.serviceName, `got: ${a?.serviceName}`);
assert("has costOfAnomaly", a?.costOfAnomaly != null, `got: ${a?.costOfAnomaly}`);
assert("has severityLevel", !!a?.severityLevel, `got: ${a?.severityLevel}`);
assert("has status", !!a?.status, `got: ${a?.status}`);

// ── Panel 5: Cloud Incidents ───────────────────────────────────────────────────

console.log("\nPanel 5: Cloud Incidents");
const incRes = getDemoResponse("https://api.doit.com/core/v1/cloudincidents?maxResults=5", "GET");
const incidents = incRes?.incidents;
assert("incidents is array", Array.isArray(incidents));
assert("has items", incidents?.length > 0);
const inc = incidents?.[0];
assert("has id", !!inc?.id);
assert("has title", !!inc?.title, `got: ${inc?.title}`);
assert("has platform", !!inc?.platform, `got: ${inc?.platform}`);
assert("has product", !!inc?.product, `got: ${inc?.product}`);
assert("has status", !!inc?.status, `got: ${inc?.status}`);
assert("has createTime", !!inc?.createTime, `got: ${inc?.createTime}`);

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
