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
                "create_allocation",
                "create_budget",
                "find_cloud_diagrams",
                "get_alert",
                "get_allocation",
                "get_anomalies",
                "get_anomaly",
                "get_cloud_incident",
                "get_cloud_incidents",
                "get_dimension",
                "get_invoice",
                "get_label",
                "get_report_results",
                "list_alerts",
                "list_allocations",
                "list_assets",
                "list_budgets",
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
                "trigger_cloud_flow",
                "update_allocation",
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
            expect(text).toContain("$150.50");
            expect(text).toContain("gcp");
            expect(text).toContain("high");
            expect(text).toContain("SKU A");
            expect(text).toContain("SKU B");
            expect(text).toContain("SKU C");
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
            expect(text).toContain("Query Results");
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
            expect(text).toContain("asset-1");
            expect(text).toContain("My Billing Account");
            expect(text).toContain("commitment");
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

    describe("create_budget", () => {
        it("creates a budget via mock API", async () => {
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

        it("creates a budget with minimal fields", async () => {
            const result = await client.callTool({
                name: "create_budget",
                arguments: { name: "Minimal Budget" },
            });
            const text = getTextContent(result);
            const parsed = JSON.parse(text);
            expect(parsed.id).toBe("budget-new-1");
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
            expect(text.toLowerCase()).toContain("required");
        });
    });
});
