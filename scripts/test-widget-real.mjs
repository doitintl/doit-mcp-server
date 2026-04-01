/**
 * Validates widget configs against REAL API responses via the STDIO MCP server.
 *
 * Spins up the MCP server as a child process, calls each tool, and checks
 * that the response fields match the widgetConfig column definitions.
 *
 * Requires DOIT_API_KEY or DOIT_TOKEN env var.
 *
 * Run: npx tsx scripts/test-widget-real.mjs
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const { TOOL_VIEW_CONFIG } = await import("../doit-mcp-server/src/widgetConfig.ts");
const { adaptToolResponse } = await import("../doit-mcp-server/src/responseAdapter.ts");

const token = process.env.DOIT_API_KEY || process.env.DOIT_TOKEN;
if (!token) {
    console.error("Set DOIT_API_KEY or DOIT_TOKEN env var");
    process.exit(1);
}

// Tool → arguments mapping for calling each tool
const TOOL_ARGS = {
    // List tools (no args needed)
    get_anomalies: {},
    list_budgets: {},
    list_invoices: {},
    list_tickets: {},
    get_cloud_incidents: {},
    list_assets: { maxResults: "5" },
    list_allocations: {},
    list_annotations: {},
    list_users: {},
    list_roles: {},
    list_alerts: {},
    list_labels: {},
    // Detail tools — we'll get the ID from the list response
    // Handled dynamically below
};

// List tool → detail tool mapping
const LIST_TO_DETAIL = {
    get_anomalies:       { detailTool: "get_anomaly", idKey: "id" },
    list_budgets:        { detailTool: "get_budget", idKey: "id" },
    list_invoices:       { detailTool: "get_invoice", idKey: "id" },
    get_cloud_incidents: { detailTool: "get_cloud_incident", idKey: "id" },
    list_assets:         { detailTool: "get_asset", idKey: "id" },
    list_allocations:    { detailTool: "get_allocation", idKey: "id" },
    list_annotations:    { detailTool: "get_annotation", idKey: "id" },
    list_alerts:         { detailTool: "get_alert", idKey: "id" },
    list_labels:         { detailTool: "get_label", idKey: "id" },
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

// Start MCP server
const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: { ...process.env, DOIT_API_KEY: token },
});

const client = new Client({ name: "widget-test", version: "1.0" }, { capabilities: {} });
await client.connect(transport);

// Collect first item IDs from list tools for detail lookups
const firstItemIds = {};

// Test list tools
for (const [toolName, args] of Object.entries(TOOL_ARGS)) {
    const config = TOOL_VIEW_CONFIG[toolName];
    if (!config) {
        console.log(`⏭  ${toolName} — no widget config`);
        skipped++;
        continue;
    }

    console.log(`\n🔍 ${toolName} (live)`);

    try {
        const result = await client.callTool({ name: toolName, arguments: args });
        const text = result.content?.[0]?.text;
        if (!text) {
            console.error(`  ✗ Empty response`);
            failed++;
            continue;
        }

        // Check if it's an error
        if (result.isError) {
            console.error(`  ✗ Tool returned error: ${text.slice(0, 100)}`);
            failed++;
            continue;
        }

        // Run through adapter (same as CF Worker does)
        const adapted = adaptToolResponse(toolName, result);
        const sc = adapted.structuredContent;

        // Validate _meta
        assert(`${toolName}: has _meta`, adapted._meta?.ui?.resourceUri != null);

        // List view: check items
        if (Array.isArray(sc.items) && sc.items.length > 0) {
            const firstItem = sc.items[0];
            console.log(`  📦 ${sc.items.length} items, first keys: [${Object.keys(firstItem).slice(0, 8).join(", ")}...]`);

            for (const col of config.columns) {
                assert(
                    `${toolName}: item has "${col.key}" (${col.label})`,
                    col.key in firstItem,
                    `missing from: [${Object.keys(firstItem).join(", ")}]`
                );
            }

            // Save first ID for detail tool testing
            const mapping = LIST_TO_DETAIL[toolName];
            if (mapping && firstItem[mapping.idKey]) {
                firstItemIds[mapping.detailTool] = String(firstItem[mapping.idKey]);
            }
        } else {
            console.log(`  ⚠️  No items returned (empty dataset for this account)`);
            skipped++;
        }
    } catch (err) {
        console.error(`  ✗ Error calling tool: ${err.message}`);
        failed++;
    }
}

// Test detail tools using IDs from list responses
for (const [detailTool, id] of Object.entries(firstItemIds)) {
    const config = TOOL_VIEW_CONFIG[detailTool];
    if (!config) continue;

    console.log(`\n🔍 ${detailTool} (live, id: ${id.slice(0, 20)}${id.length > 20 ? "..." : ""})`);

    try {
        const result = await client.callTool({ name: detailTool, arguments: { id } });
        const text = result.content?.[0]?.text;

        if (result.isError || !text) {
            console.error(`  ✗ Tool error: ${text?.slice(0, 100) || "empty"}`);
            failed++;
            continue;
        }

        const adapted = adaptToolResponse(detailTool, result);
        const sc = adapted.structuredContent;

        // Detail view: check if it's a single object (not wrapped as items)
        if (Array.isArray(sc.items)) {
            console.error(`  ⚠️  Response was treated as list (${sc.items.length} items) — may be a summarize bug`);
            // Still check the first item
            const item = sc.items[0] || {};
            for (const col of config.columns) {
                assert(`${detailTool}: has "${col.key}" (${col.label})`, col.key in item,
                    `missing from: [${Object.keys(item).join(", ")}]`);
            }
        } else {
            // Single object — keys should be on structuredContent directly
            const dataKeys = Object.keys(sc).filter(k => !k.startsWith("_"));
            console.log(`  📦 Detail keys: [${dataKeys.slice(0, 10).join(", ")}${dataKeys.length > 10 ? "..." : ""}]`);

            for (const col of config.columns) {
                assert(`${detailTool}: has "${col.key}" (${col.label})`, col.key in sc,
                    `missing from: [${dataKeys.join(", ")}]`);
            }
        }
    } catch (err) {
        console.error(`  ✗ Error: ${err.message}`);
        failed++;
    }
}

// Special: validate_user
const vuConfig = TOOL_VIEW_CONFIG["validate_user"];
if (vuConfig) {
    console.log(`\n🔍 validate_user (live)`);
    try {
        const result = await client.callTool({ name: "validate_user", arguments: {} });
        if (!result.isError) {
            const adapted = adaptToolResponse("validate_user", result);
            for (const col of vuConfig.columns) {
                assert(`validate_user: has "${col.key}"`, col.key in adapted.structuredContent);
            }
        }
    } catch (err) {
        console.error(`  ✗ Error: ${err.message}`);
        failed++;
    }
}

await client.close();

console.log(`\n${"─".repeat(50)}`);
console.log(`${passed + failed} checks: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);
