/**
 * Preview widget data with real API responses rendered as HTML tables.
 *
 * Run: npx tsx scripts/preview-widgets.mjs [tool1 tool2 ...]
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const { adaptToolResponse } = await import("../doit-mcp-server/src/responseAdapter.ts");

const token = process.env.DOIT_API_KEY || process.env.DOIT_TOKEN;
if (!token) { console.error("Set DOIT_API_KEY or DOIT_TOKEN"); process.exit(1); }

const DEFAULT_TOOLS = [
    { name: "list_insights", args: { displayStatus: ["actionable"], pageSize: 5 } },
    { name: "get_insight_resources", args: { source: "aws-cost-optimization-hub", key: "delete-ebs-volumes" } },
    { name: "cost_breakdown", args: { groupBy: "service", months: 1, topN: 5 } },
    { name: "cost_trend", args: { months: 6 } },
    { name: "compare_spend", args: { period1Months: 1, period2: { from: "2026-03-01T00:00:00Z", to: "2026-03-31T23:59:59Z" }, groupBy: "service" } },
    { name: "list_commitments", args: {} },
    { name: "get_anomalies", args: {} },
    { name: "get_cloud_overview", args: {} },
];

const requested = process.argv.slice(2);
const tools = requested.length > 0
    ? DEFAULT_TOOLS.filter(t => requested.includes(t.name))
    : DEFAULT_TOOLS;

const transport = new StdioClientTransport({
    command: "node", args: ["dist/index.js"],
    env: { ...process.env, DOIT_API_KEY: token },
});
const client = new Client({ name: "preview", version: "1.0" }, { capabilities: {} });
await client.connect(transport);

const sections = [];
for (const { name, args } of tools) {
    console.log(`Calling ${name}...`);
    try {
        const result = await client.callTool({ name, arguments: args });
        if (result.isError) { console.log(`  SKIP: ${result.content?.[0]?.text?.slice(0, 80)}`); continue; }
        const adapted = adaptToolResponse(name, result);
        sections.push({ name, sc: adapted.structuredContent });
        console.log(`  OK`);
    } catch (e) { console.log(`  SKIP: ${e.message?.slice(0, 80)}`); }
}
await client.close();

// Render helpers
const esc = (s) => String(s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;");

function formatCell(value, col) {
    if (value == null || value === "") return "—";
    const fmt = col?.format;
    if (fmt === "currency") return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (fmt === "date") { try { return new Date(typeof value === "number" && value > 1e9 ? value * 1000 : value).toLocaleDateString(); } catch { return String(value); } }
    if (fmt === "boolean") return value ? "Yes" : "No";
    if (fmt === "severity") return `<span style="color:${value === "critical" || value === "high" ? "#dc2626" : value === "medium" ? "#d97706" : "#666"};font-weight:600">${esc(value)}</span>`;
    if (fmt === "status") return `<span style="color:${value === "active" || value === "actionable" ? "#16a34a" : value === "open" ? "#d97706" : "#666"}">${esc(value)}</span>`;
    if (fmt === "icon" && col?.formatOptions?.iconSet === "cloud-platform") {
        const p = String(value).toLowerCase();
        if (p.includes("aws") || p.includes("amazon")) return `<svg role="img" viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path fill="#FF9900" d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.272-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.383.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z"/></svg>`;
        if (p.includes("google") || p.includes("gcp")) return `<svg role="img" viewBox="0 0 48 48" width="22" height="22" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path fill="#1976d2" d="M38.193,18.359c-0.771-2.753-2.319-5.177-4.397-7.03l-4.598,4.598c1.677,1.365,2.808,3.374,3.014,5.648v1.508c0.026,0,0.05-0.008,0.076-0.008c2.322,0,4.212,1.89,4.212,4.212S34.61,31.5,32.288,31.5c-0.026,0-0.05-0.007-0.076-0.008V31.5h-6.666H24V38h8.212v-0.004c0.026,0,0.05,0.004,0.076,0.004C38.195,38,43,33.194,43,27.288C43,23.563,41.086,20.279,38.193,18.359z"/><path fill="#ff3d00" d="M24,7.576c-8.133,0-14.75,6.617-14.75,14.75c0,0.233,0.024,0.46,0.035,0.69h6.5c-0.019-0.228-0.035-0.457-0.035-0.69c0-4.549,3.701-8.25,8.25-8.25c1.969,0,3.778,0.696,5.198,1.851l4.598-4.598C31.188,9.003,27.761,7.576,24,7.576z"/><path fill="#4caf50" d="M15.712,31.5L15.712,31.5c-0.001,0-0.001,0-0.002,0c-0.611,0-1.188-0.137-1.712-0.373l-4.71,4.71C11.081,37.188,13.301,38,15.71,38c0.001,0,0.001,0,0.002,0v0H24v-6.5H15.712z"/><path fill="#ffc107" d="M11.5,27.29c0-2.32,1.89-4.21,4.21-4.21c1.703,0,3.178,1.023,3.841,2.494l4.717-4.717c-1.961-2.602-5.065-4.277-8.559-4.277C9.81,16.58,5,21.38,5,27.29c0,3.491,1.691,6.59,4.288,8.547l4.71-4.71C12.53,30.469,11.5,28.999,11.5,27.29z"/></svg>`;
        if (p.includes("azure") || p.includes("microsoft")) return `<svg role="img" viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path fill="#0078D4" d="M22.379 23.343a1.62 1.62 0 0 0 1.536-2.14v.002L17.35 1.76A1.62 1.62 0 0 0 15.816.657H8.184A1.62 1.62 0 0 0 6.65 1.76L.086 21.204a1.62 1.62 0 0 0 1.536 2.139h4.741a1.62 1.62 0 0 0 1.535-1.103l.977-2.892 4.947 3.675c.28.208.618.32.966.32m-3.084-12.531 3.624 10.739a.54.54 0 0 1-.51.713v-.001h-.03a.54.54 0 0 1-.322-.106l-9.287-6.9h4.853m6.313 7.006c.116-.326.13-.694.007-1.058L9.79 1.76a1.722 1.722 0 0 0-.007-.02h6.034a.54.54 0 0 1 .512.366l6.562 19.445a.54.54 0 0 1-.338.684"/></svg>`;
        if (p.includes("oracle") || p.includes("oci")) return `<svg role="img" viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path fill="#F80000" d="M16.412 4.412h-8.82a7.588 7.588 0 0 0-.008 15.176h8.828a7.588 7.588 0 0 0 0-15.176zm-.193 12.502H7.786a4.915 4.915 0 0 1 0-9.828h8.433a4.914 4.914 0 1 1 0 9.828z"/></svg>`;
        return esc(value);
    }
    if (Array.isArray(value)) return esc(value.join(", "));
    if (typeof value === "object") return `<code>${esc(JSON.stringify(value))}</code>`;
    return esc(value);
}

function renderTable(sc) {
    const columns = sc._columns;
    const items = sc.items;
    const results = sc.results;

    // List view (items or results array)
    const rows = items || results;
    if (Array.isArray(rows) && rows.length > 0 && columns) {
        let html = `<table><thead><tr>`;
        for (const col of columns) html += `<th>${esc(col.label)}</th>`;
        html += `</tr></thead><tbody>`;
        for (const row of rows.slice(0, 20)) {
            html += `<tr>`;
            for (const col of columns) html += `<td>${formatCell(row[col.key], col)}</td>`;
            html += `</tr>`;
        }
        html += `</tbody></table>`;
        if (rows.length > 20) html += `<p class="meta">Showing 20 of ${rows.length} rows</p>`;
        return html;
    }

    // Single object (detail view) with columns
    if (columns && !Array.isArray(rows)) {
        let html = `<table class="kv">`;
        for (const col of columns) {
            html += `<tr><th>${esc(col.label)}</th><td>${formatCell(sc[col.key], col)}</td></tr>`;
        }
        html += `</table>`;
        return html;
    }

    // Compare spend (two periods)
    if (sc.period1 && sc.period2) {
        let html = "";
        for (const key of ["period1", "period2"]) {
            const period = sc[key];
            html += `<h3>${esc(period.label)} (${period.rowCount} rows)</h3>`;
            if (period.rows?.length > 0 && period.columns) {
                html += `<table><thead><tr>`;
                for (const col of period.columns) html += `<th>${esc(col.name)}</th>`;
                html += `</tr></thead><tbody>`;
                for (const row of period.rows.slice(0, 10)) {
                    html += `<tr>`;
                    for (let i = 0; i < period.columns.length; i++) {
                        const val = row[i];
                        html += `<td>${typeof val === "number" && !Number.isInteger(val) ? `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : esc(val)}</td>`;
                    }
                    html += `</tr>`;
                }
                html += `</tbody></table>`;
            }
        }
        return html;
    }

    // Analytics query (rowCount, rows, columns)
    if (sc.rows && sc.columns) {
        let html = `<p class="meta">${sc.rowCount ?? sc.rows.length} rows</p><table><thead><tr>`;
        for (const col of sc.columns) html += `<th>${esc(col.name)}</th>`;
        html += `</tr></thead><tbody>`;
        for (const row of sc.rows.slice(0, 15)) {
            html += `<tr>`;
            for (let i = 0; i < sc.columns.length; i++) {
                const val = row[i];
                html += `<td>${typeof val === "number" && !Number.isInteger(val) ? `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : esc(val)}</td>`;
            }
            html += `</tr>`;
        }
        html += `</tbody></table>`;
        return html;
    }

    // Cloud overview
    if (sc.costByCloud || sc.anomalies) {
        return `<p class="meta">Cloud overview with ${sc.anomalies?.length ?? 0} anomalies, ${sc.incidents?.length ?? 0} incidents</p>`;
    }

    return `<pre>${esc(JSON.stringify(sc, null, 2).slice(0, 500))}</pre>`;
}

// Generate HTML
let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Widget Preview</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; background: #f9fafb; color: #1a1a1a; }
  h1 { font-size: 1.25rem; }
  h2 { font-size: 0.95rem; color: #555; margin-top: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 0.85rem; color: #777; margin: 12px 0 4px; }
  .card { border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; padding: 16px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th { text-align: left; padding: 6px 10px; border-bottom: 2px solid #e5e7eb; color: #666; font-weight: 600; white-space: nowrap; }
  td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  tr:hover td { background: #f9fafb; }
  table.kv th { width: 140px; color: #888; font-weight: 500; vertical-align: top; }
  table.kv td { white-space: normal; }
  .meta { font-size: 0.75rem; color: #999; margin: 4px 0; }
  details { margin-top: 8px; font-size: 0.7rem; }
  summary { cursor: pointer; color: #aaa; }
  pre { background: #f9f9f9; padding: 8px; border-radius: 6px; overflow-x: auto; font-size: 0.65rem; max-height: 200px; }
  code { font-size: 0.7rem; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<h1>Widget Preview — Real API Data</h1>
`;

for (const { name, sc } of sections) {
    html += `<h2>${esc(name)}</h2>\n<div class="card">${renderTable(sc)}</div>\n`;
    html += `<details><summary>raw structuredContent</summary><pre>${esc(JSON.stringify(sc, null, 2))}</pre></details>\n`;
}

html += `</body></html>`;
writeFileSync("/tmp/widget-preview.html", html);
console.log("\nPreview at /tmp/widget-preview.html");
try { execSync("open /tmp/widget-preview.html"); } catch {}
