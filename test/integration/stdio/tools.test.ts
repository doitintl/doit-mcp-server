import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, getTextContent } from "../helpers.js";
import { mswServer } from "../setup.js";

describe("MCP Tools Integration", () => {
    let client: Client;
    let _server: Server;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        ({ client, _server, cleanup } = await createTestClient());
    });

    afterEach(async () => {
        await cleanup();
        vi.restoreAllMocks();
    });

    describe("tools/list", () => {
        it("returns all registered tools", async () => {
            const result = await client.listTools();
            const names = result.tools.map((t) => t.name).sort();

            expect(names).toEqual([
                "assign_objects_to_label",
                "create_alert",
                "create_allocation",
                "create_annotation",
                "create_budget",
                "create_datahub_dataset",
                "create_label",
                "create_report",
                "find_cloud_diagrams",
                "get_alert",
                "get_allocation",
                "get_annotation",
                "get_anomalies",
                "get_anomaly",
                "get_asset",
                "get_budget",
                "get_cloud_incident",
                "get_cloud_incidents",
                "get_cloud_overview",
                "get_commitment",
                "get_datahub_dataset",
                "get_dimension",
                "get_invoice",
                "get_label",
                "get_label_assignments",
                "get_report_config",
                "get_report_results",
                "get_ticket",
                "invite_user",
                "list_alerts",
                "list_allocations",
                "list_annotations",
                "list_assets",
                "list_budgets",
                "list_commitments",
                "list_datahub_datasets",
                "list_dimensions",
                "list_invoices",
                "list_labels",
                "list_organizations",
                "list_platforms",
                "list_products",
                "list_reports",
                "list_roles",
                "list_tickets",
                "list_users",
                "run_query",
                "send_datahub_events",
                "trigger_cloud_flow",
                "update_alert",
                "update_allocation",
                "update_annotation",
                "update_budget",
                "update_datahub_dataset",
                "update_label",
                "update_report",
                "update_user",
                "validate_user",
            ]);
        });

        it("each tool has a name, description, and inputSchema", async () => {
            const result = await client.listTools();
            for (const tool of result.tools) {
                expect(tool.name).toBeTruthy();
                expect(tool.description).toBeTruthy();
                expect(tool.inputSchema).toBeDefined();
                expect(tool.inputSchema.type).toBe("object");
            }
        });
    });

    describe("STDIO ↔ SSE tool registration sync", () => {
        function extractToolVarNames(source: string, pattern: RegExp): string[] {
            const names: string[] = [];
            for (const m of source.matchAll(pattern)) {
                names.push(m[1]);
            }
            return names;
        }

        it("STDIO and SSE servers register the same tools with no duplicates", async () => {
            const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

            // STDIO: extract tool variable names from the tools array in server.ts
            const stdioSource = readFileSync(resolve(rootDir, "src/server.ts"), "utf-8");
            const toolsArrayMatch = stdioSource.match(/tools:\s*\[([\s\S]*?)\]/);
            if (!toolsArrayMatch) throw new Error("Could not find tools array in server.ts");
            const stdioTools = extractToolVarNames(toolsArrayMatch[1], /(\w+Tool)\b/g);

            // SSE: extract tool variable names from registerTool() calls
            const sseSource = readFileSync(resolve(rootDir, "doit-mcp-server/src/index.ts"), "utf-8");
            const sseTools = extractToolVarNames(sseSource, /this\.registerTool\((\w+Tool)\b/g);

            // No duplicates
            const stdioDups = stdioTools.filter((t, i) => stdioTools.indexOf(t) !== i);
            const sseDups = sseTools.filter((t, i) => sseTools.indexOf(t) !== i);
            expect(stdioDups, `Duplicate tools in STDIO: ${stdioDups.join(", ")}`).toEqual([]);
            expect(sseDups, `Duplicate tools in SSE: ${sseDups.join(", ")}`).toEqual([]);

            // Same tools in both
            const missingFromSse = stdioTools.filter((t) => !sseTools.includes(t));
            const missingFromStdio = sseTools.filter((t) => !stdioTools.includes(t));
            expect(missingFromSse, `In STDIO but missing from SSE: ${missingFromSse.join(", ")}`).toEqual([]);
            expect(missingFromStdio, `In SSE but missing from STDIO: ${missingFromStdio.join(", ")}`).toEqual([]);

            // Cross-check: STDIO variable count matches MCP client tool count
            const result = await client.listTools();
            expect(result.tools).toHaveLength(stdioTools.length);
        });
    });

    describe("list_organizations", () => {
        it("returns organizations from mock API", async () => {
            const result = await client.callTool({ name: "list_organizations", arguments: {} });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.organizations).toHaveLength(2);
            expect(parsed.organizations[0].id).toBe("org-1");
            expect(parsed.organizations[0].name).toBe("Acme Corp");
            expect(parsed.organizations[1].id).toBe("org-2");
            expect(parsed.organizations[1].name).toBe("Globex Inc");
        });
    });

    describe("list_roles", () => {
        it("returns roles from mock API", async () => {
            const result = await client.callTool({ name: "list_roles", arguments: {} });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.roles).toHaveLength(2);
            expect(parsed.roles[0].id).toBe("role-1");
            expect(parsed.roles[0].name).toBe("Admin");
            expect(parsed.roles[0].type).toBe("preset");
            expect(parsed.roles[1].id).toBe("role-2");
            expect(parsed.roles[1].name).toBe("Viewer");
        });
    });

    describe("list_users", () => {
        it("returns users from mock API", async () => {
            const result = await client.callTool({ name: "list_users", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("alice@example.com");
            expect(text).toContain("bob@example.com");
            expect(text).toContain("Alice Smith");
            expect(text).toContain("Bob Jones");
        });
    });

    describe("update_user", () => {
        it("returns updated user from mock API", async () => {
            const result = await client.callTool({
                name: "update_user",
                arguments: { id: "user-1", lastName: "Johnson", jobFunction: "Management" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.message).toBe("User updated successfully");
            expect(parsed.user.id).toBe("user-1");
            expect(parsed.user.lastName).toBe("Johnson");
        });

        it("rejects missing id", async () => {
            const result = await client.callTool({
                name: "update_user",
                arguments: { firstName: "Alice" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });

        it("rejects id-only update (no fields to update)", async () => {
            const result = await client.callTool({
                name: "update_user",
                arguments: { id: "user-1" },
            });
            const text = getTextContent(result);
            expect(text).toContain("At least one field");
        });

        it("accepts language es", async () => {
            const result = await client.callTool({
                name: "update_user",
                arguments: { id: "user-1", language: "es" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.message).toBe("User updated successfully");
        });
    });

    describe("invite_user", () => {
        it("returns invite response from mock API", async () => {
            const result = await client.callTool({
                name: "invite_user",
                arguments: { email: "invited@example.com", roleId: "role-1", organizationId: "org-1" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.message).toBe("User invited successfully");
            expect(parsed.user.email).toBe("invited@example.com");
            expect(parsed.user.status).toBe("invited");
        });

        it("rejects missing email", async () => {
            const result = await client.callTool({
                name: "invite_user",
                arguments: { roleId: "role-1" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });

        it("rejects invalid email format", async () => {
            const result = await client.callTool({
                name: "invite_user",
                arguments: { email: "not-an-email" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("list_platforms", () => {
        it("returns platforms from mock API", async () => {
            const result = await client.callTool({ name: "list_platforms", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("Google Cloud Platform");
            expect(text).toContain("Amazon Web Services");
            expect(text).toContain("google_cloud_platform");
            expect(text).toContain("amazon_web_services");
        });
    });

    describe("list_products", () => {
        it("returns products from mock API", async () => {
            const result = await client.callTool({ name: "list_products", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("Compute Engine");
            expect(text).toContain("Cloud Storage");
            expect(text).toContain("compute-engine");
            expect(text).toContain("cloud-storage");
        });

        it("accepts platform filter parameter", async () => {
            const result = await client.callTool({
                name: "list_products",
                arguments: { platform: "google_cloud_platform" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Compute Engine");
        });
    });

    describe("validate_user", () => {
        it("returns user validation data", async () => {
            const result = await client.callTool({ name: "validate_user", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("example.com");
            expect(text).toContain("alice@example.com");
        });
    });

    describe("get_cloud_incidents", () => {
        it("returns cloud incidents", async () => {
            const result = await client.callTool({ name: "get_cloud_incidents", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("Elevated error rates");
            expect(text).toContain("Network latency");
            expect(text).toContain("inc-1");
            expect(text).toContain("inc-2");
            expect(text).toContain("google-cloud");
            expect(text).toContain("amazon-web-services");
            expect(text).toContain("Compute Engine");
            expect(text).toContain("active");
            expect(text).toContain("resolved");
        });
    });

    describe("get_cloud_incident", () => {
        it("returns a specific cloud incident", async () => {
            const result = await client.callTool({ name: "get_cloud_incident", arguments: { id: "inc-1" } });
            const text = getTextContent(result);
            expect(text).toContain("Elevated error rates");
            expect(text).toContain("Compute Engine");
            expect(text).toContain("inc-1");
            expect(text).toContain("google-cloud");
            expect(text).toContain("active");
            expect(text).toContain("Some VMs experiencing issues");
            expect(text).toContain("Increased latency");
            expect(text).toContain("Retry requests");
        });
    });

    describe("get_anomalies", () => {
        it("returns anomalies list", async () => {
            const result = await client.callTool({ name: "get_anomalies", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("anom-1");
            expect(text).toContain("Compute Engine");
            expect(text).toContain("gcp");
            expect(text).toContain("high");
            expect(text).toContain("open");
        });
    });

    describe("get_anomaly", () => {
        it("returns a specific anomaly", async () => {
            const result = await client.callTool({ name: "get_anomaly", arguments: { id: "anom-1" } });
            const text = getTextContent(result);
            expect(text).toContain("anom-1");
            expect(text).toContain("Compute Engine");
            expect(text).toContain("150.5");
            expect(text).toContain("gcp");
            expect(text).toContain("high");
        });
    });

    describe("list_reports", () => {
        it("returns reports list", async () => {
            const result = await client.callTool({ name: "list_reports", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("Monthly Cost Report");
            expect(text).toContain("report-1");
            expect(text).toContain("alice@example.com");
            expect(text).toContain("billing");
        });
    });

    describe("run_query", () => {
        it("runs a query and returns results", async () => {
            const result = await client.callTool({
                name: "run_query",
                arguments: {
                    config: {
                        dataSource: "billing",
                        metric: { type: "basic", value: "cost" },
                        timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: true },
                    },
                },
            });
            const text = getTextContent(result);
            expect(text).toContain("service_description");
            expect(text).toContain("Compute Engine");
            expect(text).toContain("Cloud Storage");
            expect(text).toContain("1234.56");
            expect(text).toContain("567.89");
        });
    });

    describe("get_report_results", () => {
        it("returns results for a specific report", async () => {
            const result = await client.callTool({ name: "get_report_results", arguments: { id: "report-1" } });
            const text = getTextContent(result);
            expect(text).toContain("Monthly Cost Report");
            expect(text).toContain("Compute Engine");
            expect(text).toContain("Cloud Storage");
            expect(text).toContain("alice@example.com");
            expect(text).toContain("1234.56");
            expect(text).toContain("567.89");
        });
    });

    describe("get_report_config", () => {
        it("returns the config for a specific report", async () => {
            const result = await client.callTool({ name: "get_report_config", arguments: { id: "report-1" } });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("report-1");
            expect(parsed.name).toBe("Monthly Cost Report");
            expect(parsed.config.dataSource).toBe("billing");
            expect(parsed.config.layout).toBe("table");
            expect(parsed.config.currency).toBe("USD");
        });
    });

    describe("create_report", () => {
        it("creates a new report and returns it", async () => {
            const result = await client.callTool({
                name: "create_report",
                arguments: {
                    name: "My New Report",
                    description: "A test report",
                    config: {
                        dataSource: "billing",
                        metric: { type: "basic", value: "cost" },
                        timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: true },
                    },
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("report-new-1");
            expect(parsed.name).toBe("My New Report"); // ExternalReport uses `name`, not `reportName`
        });

        it("passes labels through to the API in the request body", async () => {
            const result = await client.callTool({
                name: "create_report",
                arguments: {
                    name: "Labeled Report",
                    labels: ["label-1"],
                    config: { dataSource: "billing" },
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed._requestBody.labels).toEqual(["label-1"]);
        });

        it("returns an error mentioning 'name' when name is missing", async () => {
            const result = await client.callTool({
                name: "create_report",
                arguments: {
                    config: { dataSource: "billing" },
                },
            });
            const text = getTextContent(result);
            expect(text).toContain("name");
        });
    });

    describe("update_report", () => {
        it("updates a report via mock API", async () => {
            const result = await client.callTool({
                name: "update_report",
                arguments: { id: "report-1", name: "Updated Report" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("report-1");
            expect(parsed.name).toBe("Updated Report");
        });

        it("accepts partial update with only description", async () => {
            const result = await client.callTool({
                name: "update_report",
                arguments: { id: "report-1", description: "New desc" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("report-1");
        });

        it("rejects missing id", async () => {
            const result = await client.callTool({
                name: "update_report",
                arguments: { name: "No ID" },
            });
            const text = getTextContent(result);
            expect(text).toContain("id");
        });
    });

    describe("list_dimensions", () => {
        it("returns dimensions list", async () => {
            const result = await client.callTool({ name: "list_dimensions", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("service_description");
            expect(text).toContain("project_name");
            expect(text).toContain("Service");
            expect(text).toContain("Project");
        });
    });

    describe("get_dimension", () => {
        it("returns a specific dimension", async () => {
            const result = await client.callTool({
                name: "get_dimension",
                arguments: { type: "fixed", id: "service_description" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Service");
            expect(text).toContain("service_description");
            expect(text).toContain("fixed");
            expect(text).toContain("Compute Engine");
            expect(text).toContain("Cloud Storage");
        });
    });

    describe("list_tickets", () => {
        it("returns tickets list", async () => {
            const result = await client.callTool({ name: "list_tickets", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("VM not starting");
            expect(text).toContain("12345");
            expect(text).toContain("alice@example.com");
            expect(text).toContain("high");
            expect(text).toContain("open");
            expect(text).toContain("google_cloud_platform");
            expect(text).toContain("Compute Engine");
        });
    });

    describe("get_ticket", () => {
        it("returns a specific ticket by ID", async () => {
            const result = await client.callTool({ name: "get_ticket", arguments: { id: "12345" } });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe(12345);
            expect(parsed.subject).toBe("VM not starting");
            expect(parsed.description).toContain("VM fails to boot");
            expect(parsed.requester).toBe("alice@example.com");
        });

        it("rejects missing id", async () => {
            const result = await client.callTool({ name: "get_ticket", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("id");
        });

        it("rejects non-numeric id", async () => {
            const result = await client.callTool({ name: "get_ticket", arguments: { id: "ticket-abc" } });
            const text = getTextContent(result);
            expect(text).toContain("numeric");
        });
    });

    describe("list_invoices", () => {
        it("returns invoices list", async () => {
            const result = await client.callTool({ name: "list_invoices", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("inv-1");
            expect(text).toContain("gcp");
            expect(text).toContain("paid");
            expect(text).toContain("5000");
            expect(text).toContain("USD");
        });
    });

    describe("get_invoice", () => {
        it("returns a specific invoice", async () => {
            const result = await client.callTool({ name: "get_invoice", arguments: { id: "inv-1" } });
            const text = getTextContent(result);
            expect(text).toContain("inv-1");
            expect(text).toContain("gcp");
            expect(text).toContain("paid");
            expect(text).toContain("5000");
            expect(text).toContain("USD");
        });
    });

    describe("list_allocations", () => {
        it("returns allocations list", async () => {
            const result = await client.callTool({ name: "list_allocations", arguments: {} });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.allocations).toHaveLength(1);
            expect(parsed.allocations[0].id).toBe("alloc-1");
            expect(parsed.allocations[0].name).toBe("Engineering");
            expect(parsed.allocations[0].owner).toBe("alice@example.com");
            expect(parsed.allocations[0].type).toBe("custom");
            expect(parsed.allocations[0].allocationType).toBe("single");
        });
    });

    describe("get_allocation", () => {
        it("returns a specific allocation", async () => {
            const result = await client.callTool({ name: "get_allocation", arguments: { id: "alloc-1" } });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("alloc-1");
            expect(parsed.name).toBe("Engineering");
            expect(parsed.description).toBe("Engineering team costs");
            expect(parsed.type).toBe("custom");
            expect(parsed.anomalyDetection).toBe(true);
            expect(parsed.rule.formula).toBe("A");
            expect(parsed.rule.components).toHaveLength(1);
            expect(parsed.rule.components[0].key).toBe("project_name");
            expect(parsed.rule.components[0].values).toContain("my-project");
        });
    });

    describe("create_allocation", () => {
        it("creates a new allocation", async () => {
            const result = await client.callTool({
                name: "create_allocation",
                arguments: {
                    name: "New Allocation",
                    description: "Test allocation",
                    rule: {
                        components: [
                            {
                                key: "project_name",
                                type: "fixed",
                                values: ["test-project"],
                                mode: "is",
                            },
                        ],
                        formula: "A",
                    },
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("alloc-new");
            expect(parsed.type).toBe("custom");
        });
    });

    describe("update_allocation", () => {
        it("updates an existing allocation", async () => {
            const result = await client.callTool({
                name: "update_allocation",
                arguments: {
                    id: "alloc-1",
                    name: "Updated Allocation",
                    rule: {
                        components: [
                            {
                                key: "project_name",
                                type: "fixed",
                                values: ["updated-project"],
                                mode: "is",
                            },
                        ],
                        formula: "A",
                    },
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("alloc-1");
            expect(parsed.type).toBe("custom");
        });
    });

    describe("list_assets", () => {
        it("returns assets list", async () => {
            const result = await client.callTool({ name: "list_assets", arguments: {} });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.assets).toHaveLength(1);
            expect(parsed.assets[0].id).toBe("asset-1");
            expect(parsed.assets[0].name).toBe("My Billing Account");
            expect(parsed.assets[0].type).toBe("commitment");
        });
    });

    describe("get_asset", () => {
        it("returns a specific asset with properties", async () => {
            const result = await client.callTool({ name: "get_asset", arguments: { id: "asset-1" } });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("asset-1");
            expect(parsed.name).toBe("My Billing Account");
            expect(parsed.properties.customerDomain).toBe("example.com");
            expect(parsed.properties.customerID).toBe("cust-123");
            expect(parsed.properties.subscription.status).toBe("ACTIVE");
        });
    });

    describe("list_alerts", () => {
        it("returns alerts list", async () => {
            const result = await client.callTool({ name: "list_alerts", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("Cost Spike Alert");
            expect(text).toContain("alert-1");
            expect(text).toContain("alice@example.com");
        });
    });

    describe("get_alert", () => {
        it("returns a specific alert", async () => {
            const result = await client.callTool({ name: "get_alert", arguments: { id: "alert-1" } });
            const text = getTextContent(result);
            expect(text).toContain("Cost Spike Alert");
            expect(text).toContain("alert-1");
            expect(text).toContain("alice@example.com");
            expect(text).toContain("USD");
            expect(text).toContain("billing");
            expect(text).toContain("1000");
        });
    });

    describe("create_alert", () => {
        it("creates an alert via mock API", async () => {
            const result = await client.callTool({
                name: "create_alert",
                arguments: {
                    name: "New Alert",
                    recipients: ["user@example.com"],
                    config: {
                        condition: "value",
                        currency: "USD",
                        metric: { type: "basic", value: "cost" },
                        operator: "gt",
                        scopes: [{ id: "project_name", type: "fixed", mode: "is", values: ["my-project"] }],
                        timeInterval: "month",
                        dataSource: "billing",
                        value: 500,
                    },
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("alert-new-1");
            expect(parsed.name).toBe("New Alert");
            expect(parsed.config.currency).toBe("USD");
            expect(parsed.config.value).toBe(500);
            expect(parsed.recipients).toContain("user@example.com");
        });

        it("rejects invalid arguments before calling the API", async () => {
            const result = await client.callTool({
                name: "create_alert",
                arguments: { name: "" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("update_alert", () => {
        it("updates an alert via mock API", async () => {
            const result = await client.callTool({
                name: "update_alert",
                arguments: {
                    id: "alert-1",
                    config: {
                        metric: { type: "basic", value: "cost" },
                        timeInterval: "month",
                        value: 2000,
                    },
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("alert-1");
            expect(parsed.name).toBe("Updated Alert");
            expect(parsed.config.value).toBe(2000);
            expect(parsed.recipients).toContain("updated@example.com");
        });

        it("accepts optional name and recipients", async () => {
            const result = await client.callTool({
                name: "update_alert",
                arguments: {
                    id: "alert-1",
                    name: "Renamed Alert",
                    recipients: ["new@example.com"],
                    config: {
                        metric: { type: "basic", value: "cost" },
                        timeInterval: "month",
                        value: 2000,
                    },
                },
            });
            const text = getTextContent(result);
            expect(text).toContain("Updated Alert");
        });

        it("rejects invalid arguments before calling the API", async () => {
            const result = await client.callTool({
                name: "update_alert",
                arguments: { id: "alert-1" }, // missing config
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("list_datahub_datasets", () => {
        it("returns datasets from mock API", async () => {
            const result = await client.callTool({ name: "list_datahub_datasets", arguments: {} });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.datasets).toHaveLength(2);
            expect(parsed.datasets[0].name).toBe("My Custom Dataset");
            expect(parsed.datasets[1].name).toBe("Revenue Tracking");
        });
    });

    describe("get_datahub_dataset", () => {
        it("returns a specific dataset by name", async () => {
            const result = await client.callTool({
                name: "get_datahub_dataset",
                arguments: { name: "My Custom Dataset" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.name).toBe("My Custom Dataset");
            expect(parsed.records).toBe(1500);
            expect(parsed.updatedBy).toBe("user@example.com");
        });
    });

    describe("create_datahub_dataset", () => {
        it("returns created dataset from mock API", async () => {
            const result = await client.callTool({
                name: "create_datahub_dataset",
                arguments: { name: "New Dataset", description: "A new dataset for tracking metrics" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.name).toBe("New Dataset");
            expect(parsed.updatedBy).toBe("user@example.com");
        });

        it("rejects invalid arguments (missing name)", async () => {
            const result = await client.callTool({
                name: "create_datahub_dataset",
                arguments: {},
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("update_datahub_dataset", () => {
        it("returns updated dataset from mock API", async () => {
            const result = await client.callTool({
                name: "update_datahub_dataset",
                arguments: { name: "My Custom Dataset", description: "Updated description for the dataset" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.name).toBe("My Custom Dataset");
            expect(parsed.description).toBe("Updated description for the dataset");
        });
    });

    describe("send_datahub_events", () => {
        it("returns ingestion success from mock API", async () => {
            const result = await client.callTool({
                name: "send_datahub_events",
                arguments: {
                    events: [{ provider: "Datadog", time: "2024-03-10T23:00:00Z" }],
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.message).toBe("Ingestion success");
        });

        it("sends event with all optional fields", async () => {
            const result = await client.callTool({
                name: "send_datahub_events",
                arguments: {
                    events: [
                        {
                            provider: "Datadog",
                            id: "evt-001",
                            time: "2024-03-10T23:00:00Z",
                            dimensions: [{ key: "env", type: "label", value: "production" }],
                            metrics: [{ value: 10.5, type: "cost" }],
                        },
                    ],
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.message).toBe("Ingestion success");
        });

        it("rejects missing events array", async () => {
            const result = await client.callTool({
                name: "send_datahub_events",
                arguments: {},
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("list_labels", () => {
        it("returns labels from mock API", async () => {
            const result = await client.callTool({ name: "list_labels", arguments: {} });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.labels).toHaveLength(2);
            expect(parsed.labels[0].id).toBe("label-1");
            expect(parsed.labels[0].name).toBe("Engineering");
            expect(parsed.labels[0].color).toBe("blue");
            expect(parsed.labels[1].id).toBe("label-2");
            expect(parsed.labels[1].name).toBe("Finance");
            expect(parsed.labels[1].type).toBe("preset");
            expect(parsed.rowCount).toBe(2);
        });

        it("accepts filter and sort parameters", async () => {
            const result = await client.callTool({
                name: "list_labels",
                arguments: { sortBy: "name", sortOrder: "asc", filter: "type:custom" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.labels).toHaveLength(2);
        });
    });

    describe("get_label", () => {
        it("returns a specific label", async () => {
            const result = await client.callTool({ name: "get_label", arguments: { id: "label-1" } });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("label-1");
            expect(parsed.name).toBe("Engineering");
            expect(parsed.color).toBe("blue");
            expect(parsed.type).toBe("custom");
            expect(parsed.createTime).toBe("2026-01-01T00:00:00.000Z");
            expect(parsed.updateTime).toBe("2026-01-02T00:00:00.000Z");
        });
    });

    describe("create_label", () => {
        it("returns created label from mock API", async () => {
            const result = await client.callTool({
                name: "create_label",
                arguments: { name: "New Label", color: "teal" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("label-new");
            expect(parsed.name).toBe("New Label");
            expect(parsed.color).toBe("teal");
        });

        it("rejects invalid arguments", async () => {
            const result = await client.callTool({
                name: "create_label",
                arguments: { name: "Missing Color" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("update_label", () => {
        it("returns updated label from mock API", async () => {
            const result = await client.callTool({
                name: "update_label",
                arguments: { id: "label-1", name: "Updated Engineering" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("label-1");
        });

        it("rejects missing id", async () => {
            const result = await client.callTool({
                name: "update_label",
                arguments: { name: "No ID" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("get_label_assignments", () => {
        it("returns assignments from mock API", async () => {
            const result = await client.callTool({
                name: "get_label_assignments",
                arguments: { id: "label-1" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.assignments).toHaveLength(2);
            expect(parsed.assignments[0].objectId).toBe("report-1");
            expect(parsed.assignments[0].objectType).toBe("report");
            expect(parsed.assignments[1].objectId).toBe("budget-1");
            expect(parsed.assignments[1].objectType).toBe("budget");
        });
    });

    describe("assign_objects_to_label", () => {
        it("assigns objects to label successfully with empty response", async () => {
            const result = await client.callTool({
                name: "assign_objects_to_label",
                arguments: {
                    id: "label-1",
                    add: [{ objectId: "report-1", objectType: "report" }],
                },
            });
            const text = getTextContent(result);
            expect(text).toContain("Successfully");
        });

        it("rejects missing id", async () => {
            const result = await client.callTool({
                name: "assign_objects_to_label",
                arguments: { add: [{ objectId: "report-1", objectType: "report" }] },
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("list_annotations", () => {
        it("returns annotations from mock API", async () => {
            const result = await client.callTool({ name: "list_annotations", arguments: {} });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.annotations).toHaveLength(2);
            expect(parsed.annotations[0].id).toBe("annotation-1");
            expect(parsed.annotations[0].content).toBe("Budget threshold reached");
            expect(parsed.annotations[1].id).toBe("annotation-2");
            expect(parsed.annotations[1].content).toBe("Cost anomaly detected");
            expect(parsed.rowCount).toBe(2);
        });

        it("accepts filter and sort parameters", async () => {
            const result = await client.callTool({
                name: "list_annotations",
                arguments: { sortBy: "timestamp", sortOrder: "asc", filter: "content:budget" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.annotations).toHaveLength(2);
        });
    });

    describe("get_annotation", () => {
        it("returns a specific annotation", async () => {
            const result = await client.callTool({ name: "get_annotation", arguments: { id: "annotation-1" } });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("annotation-1");
            expect(parsed.content).toBe("Budget threshold reached");
            expect(parsed.timestamp).toBe("2026-01-15T00:00:00.000Z");
            expect(parsed.createTime).toBe("2026-01-01T00:00:00.000Z");
            expect(parsed.updateTime).toBe("2026-01-02T00:00:00.000Z");
        });
    });

    describe("create_annotation", () => {
        it("returns created annotation from mock API", async () => {
            const result = await client.callTool({
                name: "create_annotation",
                arguments: { content: "New annotation content", timestamp: "2026-03-01T00:00:00.000Z" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("annotation-new");
            expect(parsed.content).toBe("New annotation content");
        });

        it("rejects invalid arguments", async () => {
            const result = await client.callTool({
                name: "create_annotation",
                arguments: {},
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("update_annotation", () => {
        it("returns updated annotation from mock API", async () => {
            const result = await client.callTool({
                name: "update_annotation",
                arguments: { id: "annotation-1", content: "Updated annotation content" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("annotation-1");
            expect(parsed.content).toBe("Updated annotation content");
        });

        it("rejects missing id", async () => {
            const result = await client.callTool({
                name: "update_annotation",
                arguments: { content: "No id provided" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Required");
        });
    });

    describe("find_cloud_diagrams", () => {
        it("returns diagram URLs for given resource IDs", async () => {
            const result = await client.callTool({
                name: "find_cloud_diagrams",
                arguments: { resources: ["resource-1"] },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed).toHaveLength(2);
            expect(parsed[0].diagramUrl).toContain("scheme-1");
            expect(parsed[0].imageUrl).toContain("scheme-1");
            expect(parsed[1].diagramUrl).toContain("scheme-2");
            expect(parsed[1].imageUrl).toContain("scheme-2");
        });
    });

    describe("list_budgets", () => {
        it("returns budgets from mock API", async () => {
            const result = await client.callTool({ name: "list_budgets", arguments: {} });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.budgets).toHaveLength(1);
            expect(parsed.budgets[0].id).toBe("budget-1");
            expect(parsed.budgets[0].budgetName).toBe("Monthly Budget");
            expect(parsed.budgets[0].owner).toBe("alice@example.com");
            expect(parsed.budgets[0].currency).toBe("USD");
            expect(parsed.rowCount).toBe(1);
        });

        it("accepts filter and pagination parameters", async () => {
            const result = await client.callTool({
                name: "list_budgets",
                arguments: { filter: "owner:alice@example.com", maxResults: "10" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.budgets).toHaveLength(1);
        });
    });

    describe("get_budget", () => {
        it("returns a specific budget", async () => {
            const result = await client.callTool({ name: "get_budget", arguments: { id: "budget-1" } });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("budget-1");
            expect(parsed.name).toBe("Monthly Budget");
            expect(parsed.currency).toBe("USD");
            expect(parsed.currentUtilization).toBe(50);
            expect(parsed.type).toBe("recurring");
            expect(parsed.alerts).toHaveLength(1);
            expect(parsed.alerts[0].percentage).toBe(80);
            expect(parsed.alerts[0].triggered).toBe(true);
            expect(parsed.collaborators[0].email).toBe("alice@example.com");
        });
    });

    describe("create_budget", () => {
        it("creates a recurring budget via mock API", async () => {
            const result = await client.callTool({
                name: "create_budget",
                arguments: {
                    name: "Test Budget",
                    amount: 500,
                    currency: "USD",
                    type: "recurring",
                    timeInterval: "month",
                    startPeriod: 1704067200000,
                    scopes: [{ id: "cloud_provider", type: "fixed", mode: "is", values: ["amazon-web-services"] }],
                    collaborators: [{ role: "owner", email: "test@example.com" }],
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("budget-new-1");
            expect(parsed.name).toBe("Test Budget");
            expect(parsed.amount).toBe(500);
            expect(parsed.currency).toBe("USD");
            expect(parsed.type).toBe("recurring");
        });

        it("creates a fixed budget with endPeriod via mock API", async () => {
            const result = await client.callTool({
                name: "create_budget",
                arguments: {
                    name: "Fixed Budget",
                    amount: 1000,
                    currency: "USD",
                    type: "fixed",
                    startPeriod: 1704067200000,
                    endPeriod: 1706745600000,
                    scope: ["allocation-1"],
                    collaborators: [{ role: "owner", email: "test@example.com" }],
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("budget-new-1");
        });

        it("rejects invalid arguments before calling the API", async () => {
            const result = await client.callTool({
                name: "create_budget",
                arguments: { name: "Minimal Budget" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("update_budget", () => {
        it("updates a budget via mock API", async () => {
            const result = await client.callTool({
                name: "update_budget",
                arguments: {
                    id: "budget-1",
                    name: "Updated Budget",
                    amount: 2000,
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("budget-1");
            expect(parsed.name).toBe("Updated Budget");
            expect(parsed.amount).toBe(2000);
            expect(parsed.currency).toBe("USD");
            expect(parsed.type).toBe("recurring");
        });

        it("accepts partial update with only name", async () => {
            const result = await client.callTool({
                name: "update_budget",
                arguments: {
                    id: "budget-1",
                    name: "Renamed Budget",
                },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("budget-1");
        });

        it("rejects invalid arguments before calling the API", async () => {
            const result = await client.callTool({
                name: "update_budget",
                arguments: { name: "No ID Budget" },
            });
            const text = getTextContent(result);
            expect(text).toContain("Invalid arguments");
        });
    });

    describe("trigger_cloud_flow", () => {
        it("triggers a cloud flow", async () => {
            const result = await client.callTool({
                name: "trigger_cloud_flow",
                arguments: { flowID: "flow-123" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.status).toBe("triggered");
            expect(parsed.executionId).toBe("exec-123");
            expect(Object.keys(parsed)).toHaveLength(2);
        });
    });

    describe("list_commitments", () => {
        it("returns commitments from mock API", async () => {
            const result = await client.callTool({ name: "list_commitments", arguments: {} });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.commitments).toHaveLength(1);
            expect(parsed.commitments[0].id).toBe("commitment-1");
            expect(parsed.commitments[0].name).toBe("GCP 3-Year CUD");
            expect(parsed.commitments[0].cloudProvider).toBe("google-cloud");
            expect(parsed.rowCount).toBe(1);
        });

        it("accepts filter and sort parameters", async () => {
            const result = await client.callTool({
                name: "list_commitments",
                arguments: { sortBy: "name", sortOrder: "asc", filter: "provider:[google-cloud]" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.commitments).toHaveLength(1);
        });
    });

    describe("get_commitment", () => {
        it("returns a specific commitment by ID", async () => {
            const result = await client.callTool({ name: "get_commitment", arguments: { id: "commitment-1" } });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("commitment-1");
            expect(parsed.name).toBe("GCP 3-Year CUD");
            expect(parsed.cloudProvider).toBe("google-cloud");
            expect(parsed.totalCommitmentValue).toBe(100000);
            expect(parsed.periods).toHaveLength(1);
        });

        it("returns error for missing id", async () => {
            const result = await client.callTool({ name: "get_commitment", arguments: {} });
            const text = getTextContent(result);
            expect(text.toLowerCase()).toContain("required");
        });
    });

    describe("error handling", () => {
        it("returns error for unknown tool", async () => {
            const result = await client.callTool({ name: "nonexistent_tool", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("Unknown tool");
        });

        it("returns Unauthorized when DOIT_API_KEY is unset", async () => {
            const savedKey = process.env.DOIT_API_KEY;
            delete process.env.DOIT_API_KEY;
            try {
                const result = await client.callTool({ name: "list_organizations", arguments: {} });
                const text = getTextContent(result);
                expect(text).toContain("Unauthorized");
            } finally {
                process.env.DOIT_API_KEY = savedKey;
            }
        });

        it("returns error when API returns failure", async () => {
            mswServer.use(
                http.get("https://api.doit.com/iam/v1/organizations", () => {
                    return new HttpResponse(null, { status: 500 });
                })
            );

            const result = await client.callTool({ name: "list_organizations", arguments: {} });
            const text = getTextContent(result);
            expect(text).toContain("Failed to retrieve organizations");
        });

        it("returns error for missing required arguments", async () => {
            const result = await client.callTool({ name: "get_cloud_incident", arguments: {} });
            const text = getTextContent(result);
            expect(text.toLowerCase()).toContain("either id or title must be provided");
        });
    });
});
