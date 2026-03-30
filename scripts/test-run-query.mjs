#!/usr/bin/env node
/**
 * Test run_query directly against the DoiT API, including server-side alias normalization.
 * Usage: node scripts/test-run-query.mjs <your-api-token> [filter-value]
 *
 * Examples:
 *   node scripts/test-run-query.mjs <token> "amazon-web-services"   # canonical
 *   node scripts/test-run-query.mjs <token> "Amazon Web Services"   # alias → should normalize
 *   node scripts/test-run-query.mjs <token> "aws"                   # alias → should normalize
 */

const CLOUD_PROVIDER_ALIASES = {
    "aws": "amazon-web-services",
    "amazon": "amazon-web-services",
    "amazon web services": "amazon-web-services",
    "amazon_web_services": "amazon-web-services",
    "gcp": "google-cloud",
    "google": "google-cloud",
    "google cloud": "google-cloud",
    "google cloud platform": "google-cloud",
    "google_cloud": "google-cloud",
    "azure": "microsoft-azure",
    "microsoft azure": "microsoft-azure",
    "microsoft_azure": "microsoft-azure",
};

const [,, token, filterValue = "Amazon Web Services"] = process.argv;
if (!token) {
  console.error("Usage: node scripts/test-run-query.mjs <token> [filter-value]");
  process.exit(1);
}

const normalized = CLOUD_PROVIDER_ALIASES[filterValue.toLowerCase()] ?? filterValue;
console.log(`Filter input:      "${filterValue}"`);
console.log(`After normalize:   "${normalized}"\n`);

const DOIT_API_BASE = "https://api.doit.com";
const url = `${DOIT_API_BASE}/analytics/v1/reports/query`;

const config = {
  dataSource: "billing",
  metrics: [{ type: "basic", value: "cost" }],
  timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: true },
  filters: [{ id: "cloud_provider", type: "fixed", values: [normalized] }],
  group: [{
    id: "service_description",
    type: "fixed",
    limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 10 },
  }],
};

console.log("POST", url);
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ config }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, body);
  process.exit(1);
}

const { result } = JSON.parse(body);
console.log(`\nSchema: ${result.schema.map(f => `${f.name}(${f.type})`).join(", ")}`);
console.log(`Rows: ${result.rows.length}`);
if (result.rows.length > 0) {
  console.log("\nTop 5 rows:");
  result.rows.slice(0, 5).forEach(row => console.log(" ", row.join(" | ")));
} else {
  console.log("0 rows returned.");
}
