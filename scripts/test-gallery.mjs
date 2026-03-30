/**
 * Widget Gallery — calls all read-only tools with real data and opens a
 * single HTML page showing every widget rendered side by side.
 *
 * Usage: node scripts/test-gallery.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { exec } from "child_process";

// ── Load token ────────────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
}
const TOKEN = process.env.DOIT_TOKEN;
if (!TOKEN) { console.error("DOIT_TOKEN not found in .env.local"); process.exit(1); }

// ── Imports ───────────────────────────────────────────────────────────────────
import { executeToolHandler, adaptToolResponse } from "../dist/utils/toolsHandler.js";

// ── Tool catalogue ────────────────────────────────────────────────────────────
// Each entry: { name, args }
// For "detail" tools we first fetch a list to get a real ID.

async function call(toolName, args = {}) {
  const raw = await executeToolHandler(toolName, args, TOKEN, (r) => r);
  return adaptToolResponse(toolName, raw);
}

async function firstId(listTool, listArgs, idKey = "id") {
  const { structuredContent: sc } = await call(listTool, listArgs);
  const items = sc.items ?? sc.anomalies ?? sc.incidents ?? sc.reports ?? [];
  return items[0]?.[idKey] ?? null;
}

console.log("Fetching data for all tools...\n");

// ── Parallel fetch for list tools ─────────────────────────────────────────────
const [
  cloudOverview,
  runQuery,
  anomalies,
  cloudIncidents,
  budgets,
  invoices,
  tickets,
  reports,
  assets,
  allocations,
  alerts,
  labels,
  annotations,
  datahubDatasets,
  users,
  roles,
  organizations,
  platforms,
  products,
  dimensions,
] = await Promise.all([
  call("get_cloud_overview"),
  call("run_query", { config: {
    dataSource: "billing",
    metrics: [{ type: "basic", value: "cost" }],
    timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: true },
    group: [
      { id: "service_description", type: "fixed",
        limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 10 } },
    ],
  }}),
  call("get_anomalies"),
  call("get_cloud_incidents"),
  call("list_budgets"),
  call("list_invoices"),
  call("list_tickets"),
  call("list_reports"),
  call("list_assets"),
  call("list_allocations"),
  call("list_alerts"),
  call("list_labels"),
  call("list_annotations"),
  call("list_datahub_datasets"),
  call("list_users"),
  call("list_roles"),
  call("list_organizations"),
  call("list_platforms"),
  call("list_products"),
  call("list_dimensions"),
]);

// ── Fetch detail tools using IDs from list results ────────────────────────────
const anomalyId   = anomalies.structuredContent.items?.[0]?.id;
const incidentId  = cloudIncidents.structuredContent.items?.[0]?.id;
const budgetId    = budgets.structuredContent.items?.[0]?.id;
const invoiceId   = invoices.structuredContent.items?.[0]?.id;
const reportId    = reports.structuredContent.items?.[0]?.id;
const assetId     = assets.structuredContent.items?.[0]?.id;
const allocationId = allocations.structuredContent.items?.[0]?.id;
const alertId     = alerts.structuredContent.items?.[0]?.id;
const labelId     = labels.structuredContent.items?.[0]?.id;
const annotationId = annotations.structuredContent.items?.[0]?.id;
const datasetId   = datahubDatasets.structuredContent.items?.[0]?.id;

const [
  anomaly,
  cloudIncident,
  budget,
  invoice,
  reportResults,
  asset,
  allocation,
  alert,
  label,
  annotation,
  datahubDataset,
] = await Promise.all([
  anomalyId   ? call("get_anomaly",            { id: anomalyId })    : Promise.resolve(null),
  incidentId  ? call("get_cloud_incident",     { id: incidentId })   : Promise.resolve(null),
  budgetId    ? call("get_budget",             { id: budgetId })     : Promise.resolve(null),
  invoiceId   ? call("get_invoice",            { id: invoiceId })    : Promise.resolve(null),
  reportId    ? call("get_report_results",     { id: reportId })     : Promise.resolve(null),
  assetId     ? call("get_asset",              { id: assetId })      : Promise.resolve(null),
  allocationId ? call("get_allocation",        { id: allocationId }) : Promise.resolve(null),
  alertId     ? call("get_alert",              { id: alertId })      : Promise.resolve(null),
  labelId     ? call("get_label",              { id: labelId })      : Promise.resolve(null),
  annotationId ? call("get_annotation",        { id: annotationId }) : Promise.resolve(null),
  datasetId   ? call("get_datahub_dataset",    { id: datasetId })    : Promise.resolve(null),
]);

// ── Gallery entries ───────────────────────────────────────────────────────────
const entries = [
  { label: "get_cloud_overview",   result: cloudOverview },
  { label: "run_query",            result: runQuery },
  { label: "get_report_results",   result: reportResults },
  { label: "get_anomalies",        result: anomalies },
  { label: "get_anomaly",          result: anomaly },
  { label: "get_cloud_incidents",  result: cloudIncidents },
  { label: "get_cloud_incident",   result: cloudIncident },
  { label: "list_budgets",         result: budgets },
  { label: "get_budget",           result: budget },
  { label: "list_invoices",        result: invoices },
  { label: "get_invoice",          result: invoice },
  { label: "list_tickets",         result: tickets },
  { label: "list_assets",          result: assets },
  { label: "get_asset",            result: asset },
  { label: "list_allocations",     result: allocations },
  { label: "get_allocation",       result: allocation },
  { label: "list_alerts",          result: alerts },
  { label: "get_alert",            result: alert },
  { label: "list_labels",          result: labels },
  { label: "get_label",            result: label },
  { label: "list_annotations",     result: annotations },
  { label: "get_annotation",       result: annotation },
  { label: "list_datahub_datasets", result: datahubDatasets },
  { label: "get_datahub_dataset",  result: datahubDataset },
  { label: "list_users",           result: users },
  { label: "list_roles",           result: roles },
  { label: "list_organizations",   result: organizations },
  { label: "list_platforms",       result: platforms },
  { label: "list_products",        result: products },
  { label: "list_dimensions",      result: dimensions },
].filter(e => e.result !== null);

console.log(`Fetched ${entries.length} tool results. Building gallery...\n`);

// ── Widget HTML ───────────────────────────────────────────────────────────────
const widgetHtml = readFileSync(resolve(process.cwd(), "widget/dist/index.html"), "utf8");

function makeWidgetBlob(toolName, structuredContent) {
  const injection = `<script>
    window.__GALLERY_DATA__ = ${JSON.stringify({ toolName, structuredContent })};
    window.addEventListener("DOMContentLoaded", function() {
      window.openai = {
        toolOutput: window.__GALLERY_DATA__.structuredContent,
        toolResponseMetadata: { toolName: window.__GALLERY_DATA__.toolName },
        theme: { mode: document.documentElement.getAttribute("data-theme") || "light" },
        sendFollowUpMessage: function(p) { console.log("[gallery] sendFollowUpMessage:", p.prompt); },
        callTool: function(n,a) { console.log("[gallery] callTool:", n, a); return Promise.resolve({}); },
        notifyIntrinsicHeight: function() {},
        setWidgetState: function() {},
        requestDisplayMode: function() {},
        requestClose: function() {},
        openExternal: function(p) { window.open(p.href, "_blank"); },
        updateModelContext: function() {},
      };
      window.dispatchEvent(new Event("openai:set_globals"));
    });
  </script>`;
  return widgetHtml.replace("</head>", injection + "</head>");
}

// ── Gallery HTML ──────────────────────────────────────────────────────────────
function buildGallery(entries, darkMode = false) {
  const bg   = darkMode ? "#111" : "#f0f2f5";
  const card = darkMode ? "#1a1a1a" : "#fff";
  const text = darkMode ? "#e3e3e3" : "#333";
  const sub  = darkMode ? "#999" : "#666";
  const theme = darkMode ? "dark" : "light";

  const iframes = entries.map(({ label, result }) => {
    const sc = result.structuredContent;
    const html = makeWidgetBlob(label, sc);
    const blob = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    // Wide layout for overview and chart tools
    const isWide = ["get_cloud_overview", "run_query", "get_report_results"].includes(label);

    return `
    <div class="card ${isWide ? "wide" : ""}" style="background:${card}">
      <div class="card-header" style="color:${sub}">
        <span class="tool-name" style="color:${text}">${label}</span>
        <span class="item-count">${sc.totalCount ?? sc.rowCount ?? sc.items?.length ?? ""}</span>
      </div>
      <iframe
        src="${blob}"
        data-theme="${theme}"
        onload="this.contentWindow.document.documentElement.setAttribute('data-theme','${theme}')"
        frameborder="0"
        scrolling="auto"
        style="width:100%;height:420px;border:none;border-radius:0 0 8px 8px"
      ></iframe>
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DoiT Widget Gallery</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${bg}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 20px; }
    h1 { color: ${text}; font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
    .meta { color: ${sub}; font-size: 0.75rem; margin-bottom: 20px; }
    .toggle { float: right; font-size: 0.75rem; color: ${sub}; cursor: pointer; text-decoration: underline; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
    .card { border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.12); }
    .card.wide { grid-column: span 2; }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(0,0,0,0.08); }
    .tool-name { font-size: 0.72rem; font-weight: 600; font-family: monospace; }
    .item-count { font-size: 0.65rem; }
    @media (max-width: 700px) { .card.wide { grid-column: span 1; } }
  </style>
</head>
<body>
  <h1>DoiT Widget Gallery <span class="toggle" onclick="window.open(location.href.replace('light','dark').replace('?','')+'?theme=dark')">Toggle dark</span></h1>
  <p class="meta">Generated ${new Date().toLocaleString()} · ${entries.length} tools · real API data</p>
  <div class="grid">
    ${iframes}
  </div>
</body>
</html>`;
}

// ── Write and open ─────────────────────────────────────────────────────────────
const outPath = resolve(process.cwd(), "widget-gallery.html");
writeFileSync(outPath, buildGallery(entries));
console.log(`Gallery written to: ${outPath}`);
console.log("Opening in browser...");
exec(`open "${outPath}"`);
