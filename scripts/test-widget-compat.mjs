/**
 * Validates that all widget configs have matching fields in tool responses.
 *
 * For each tool in TOOL_VIEW_CONFIG:
 * - List tools (items array): checks that item objects have all column keys
 * - Detail tools (single object): checks that the object has all column keys
 * - Uses demo data fixtures to get realistic response shapes
 *
 * Run: DEMO_MODE_ENABLED=true npx tsx scripts/test-widget-compat.mjs
 */

// Import CF Worker modules via tsx which handles TS directly
const { TOOL_VIEW_CONFIG } = await import("../doit-mcp-server/src/widgetConfig.ts");
const { adaptToolResponse } = await import("../doit-mcp-server/src/responseAdapter.ts");
import { getDemoResponse } from "../src/utils/demoData.js";

// Map tool names to the demo API URLs they would call
const TOOL_TO_DEMO = {
    // List tools
    get_anomalies:        { url: "https://api.doit.com/anomalies/v1", method: "GET", listKey: "anomalies" },
    list_budgets:         { url: "https://api.doit.com/analytics/v1/budgets", method: "GET", listKey: "budgets" },
    list_invoices:        { url: "https://api.doit.com/billing/v1/invoices", method: "GET", listKey: "invoices" },
    list_tickets:         { url: "https://api.doit.com/support/v1/tickets", method: "GET", listKey: "tickets" },
    get_cloud_incidents:  { url: "https://api.doit.com/core/v1/cloudincidents", method: "GET", listKey: "incidents" },
    list_assets:          { url: "https://api.doit.com/billing/v1/assets", method: "GET", listKey: "assets" },
    list_allocations:     { url: "https://api.doit.com/analytics/v1/allocations", method: "GET", listKey: "allocations" },
    list_annotations:     { url: "https://api.doit.com/analytics/v1/annotations", method: "GET", listKey: "annotations" },
    list_users:           { url: "https://api.doit.com/iam/v1/users", method: "GET", listKey: "users" },
    list_roles:           { url: "https://api.doit.com/iam/v1/roles", method: "GET", listKey: "roles" },
    list_alerts:          { url: "https://api.doit.com/analytics/v1/alerts", method: "GET", listKey: "alerts" },
    list_labels:          { url: "https://api.doit.com/analytics/v1/labels", method: "GET", listKey: "labels" },
    // Detail tools
    get_anomaly:          { url: "https://api.doit.com/anomalies/v1/anom-001", method: "GET", single: true },
    get_budget:           { url: "https://api.doit.com/analytics/v1/budgets/budget-001", method: "GET", single: true },
    get_invoice:          { url: "https://api.doit.com/billing/v1/invoices/inv-2026-02", method: "GET", single: true },
    get_cloud_incident:   { url: "https://api.doit.com/core/v1/cloudincidents/inc-001", method: "GET", single: true },
    get_asset:            { url: "https://api.doit.com/billing/v1/assets/asset-001", method: "GET", single: true },
    get_allocation:       { url: "https://api.doit.com/analytics/v1/allocations/alloc-001", method: "GET", single: true },
    get_annotation:       { url: "https://api.doit.com/analytics/v1/annotations/annot-001", method: "GET", single: true },
    get_alert:            { url: "https://api.doit.com/analytics/v1/alerts/alert-001", method: "GET", single: true },
    get_label:            { url: "https://api.doit.com/analytics/v1/labels/label-001", method: "GET", single: true },
    // Special tools
    validate_user:        { url: "https://api.doit.com/auth/v1/validate", method: "GET", single: true },
};

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(label, condition, detail = "") {
    if (condition) {
        passed++;
    } else {
        console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
        failed++;
    }
}

for (const [toolName, config] of Object.entries(TOOL_VIEW_CONFIG)) {
    const demoInfo = TOOL_TO_DEMO[toolName];
    if (!demoInfo) {
        console.log(`⏭  ${toolName} — no demo data mapping, skipped`);
        skipped++;
        continue;
    }

    console.log(`\n🔍 ${toolName}`);

    // Get raw demo response
    const rawData = getDemoResponse(demoInfo.url, demoInfo.method);
    if (!rawData) {
        console.error(`  ✗ No demo response for ${demoInfo.url}`);
        failed++;
        continue;
    }

    // Wrap as MCP response (how handlers return it)
    const mcpResponse = {
        content: [{ type: "text", text: JSON.stringify(rawData) }],
    };

    // Run through adapter
    const adapted = adaptToolResponse(toolName, mcpResponse);
    const sc = adapted.structuredContent;

    // Check _meta
    assert(`${toolName}: has _meta.ui.resourceUri`, adapted._meta?.ui?.resourceUri != null);

    if (demoInfo.single) {
        // Detail view: structuredContent should have the column keys directly
        const columns = config.columns;
        for (const col of columns) {
            const value = sc[col.key];
            // Some fields are optional (e.g. anomalyChartUrl), so we just check they exist or are undefined
            // The key concern is that the data structure is right, not that every field has a value
            assert(
                `${toolName}: has field "${col.key}" (${col.label})`,
                col.key in sc || value !== undefined,
                `missing from response keys: [${Object.keys(sc).filter(k => !k.startsWith("_")).join(", ")}]`
            );
        }
    } else {
        // List view: structuredContent should have items array
        assert(`${toolName}: has items array`, Array.isArray(sc.items), `got: ${typeof sc.items}`);
        if (Array.isArray(sc.items) && sc.items.length > 0) {
            const firstItem = sc.items[0];
            const columns = config.columns;
            for (const col of columns) {
                assert(
                    `${toolName}: item has field "${col.key}" (${col.label})`,
                    col.key in firstItem,
                    `missing from item keys: [${Object.keys(firstItem).join(", ")}]`
                );
            }
        }

        // Check drilldown config
        if (config.drilldown) {
            const firstItem = sc.items?.[0];
            if (firstItem) {
                assert(
                    `${toolName}: drilldown idKey "${config.drilldown.idKey}" exists in items`,
                    config.drilldown.idKey in firstItem,
                    `missing from item keys: [${Object.keys(firstItem).join(", ")}]`
                );
            }
        }
    }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`${passed + failed + skipped} tools: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);
