import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { executeToolHandler } from "../../../src/utils/toolsHandler.js";
import { createTestClient, getTextContent } from "../helpers.js";
import { mswServer } from "../setup.js";

const API = "https://api.doit.com";

describe("insights and alert contracts over MCP", () => {
    it("continues an empty recommendation page using the API's nested cursor", async () => {
        const seen: URL[] = [];
        mswServer.use(
            http.get(`${API}/insights/v1/results`, ({ request }) => {
                const url = new URL(request.url);
                seen.push(url);
                return HttpResponse.json(
                    url.searchParams.has("pageToken")
                        ? {
                              results: [{ key: "second", cloudProvider: "aws", easyWinDescription: "" }],
                              pagination: { rowCount: 1 },
                          }
                        : { results: [], pagination: { rowCount: 0, pageToken: "opaque/+=" } }
                );
            })
        );
        const { rawClient, cleanup } = await createTestClient();
        try {
            const first = JSON.parse(
                getTextContent(
                    await rawClient.callTool({
                        name: "list_optimization_recommendations",
                        arguments: { provider: "aws", maxResults: 1 },
                    })
                )
            );
            expect(first).toEqual({ insights: [], rowCount: 0, pageToken: "opaque/+=" });
            const last = JSON.parse(
                getTextContent(
                    await rawClient.callTool({
                        name: "list_optimization_recommendations",
                        arguments: { provider: "aws", maxResults: 1, pageToken: first.pageToken },
                    })
                )
            );
            expect(last.insights[0]).toMatchObject({ key: "second", provider: "aws", easyWin: false });
            expect(last.pageToken).toBeNull();
            expect(seen[1].searchParams.get("pageToken")).toBe("opaque/+=");
            expect(
                seen.every(
                    (url) =>
                        url.searchParams.get("cloudProvider") === "aws" && url.searchParams.get("maxResults") === "1"
                )
            ).toBe(true);
        } finally {
            await cleanup();
        }
    });

    it("sends a name-only alert patch and preserves configuration and recipients on readback", async () => {
        let stored = {
            id: "fixture",
            name: "Before",
            recipients: ["test@example.com"],
            config: {
                value: 100,
                operator: "gt",
                currency: "EUR",
                scopes: [{ id: "project_id", type: "fixed", values: ["fixture"] }],
            },
        };
        const original = structuredClone(stored);
        mswServer.use(
            http.patch(`${API}/analytics/v1/alerts/fixture`, async ({ request }) => {
                const body = await request.json();
                expect(body).toEqual({ name: "After" });
                stored = { ...stored, ...(body as { name: string }) };
                return HttpResponse.json(stored);
            }),
            http.get(`${API}/analytics/v1/alerts/fixture`, () => HttpResponse.json(stored))
        );
        const { rawClient, cleanup } = await createTestClient();
        try {
            const updated = await rawClient.callTool({
                name: "update_alert",
                arguments: { id: "fixture", name: "After" },
            });
            expect(updated.isError).not.toBe(true);
            const result = JSON.parse(
                getTextContent(await rawClient.callTool({ name: "get_alert", arguments: { id: "fixture" } }))
            );
            expect(result).toEqual({ ...original, name: "After" });
        } finally {
            await cleanup();
        }
    });
});

describe("customer context through shared tool dispatch", () => {
    it.each([
        [
            "list_optimization_recommendations",
            { maxResults: 1 },
            "/insights/v1/results",
            { results: [], pagination: { rowCount: 0 } },
        ],
        [
            "get_insight_resources",
            { source: "test", key: "test", maxResults: 1 },
            "/insights/v1/results/source/test/insight/test/resource-results",
            { resourceResults: [], rowCount: 0 },
        ],
        ["get_anomaly", { id: "test" }, "/anomalies/v1/test", { actualCost: 10, resourceData: [] }],
        ["list_alerts", { maxResults: "1" }, "/analytics/v1/alerts", { alerts: [], rowCount: 0 }],
        ["list_budgets", { name: "test", maxResults: "1" }, "/analytics/v1/budgets", { budgets: [], rowCount: 0 }],
        [
            "get_cloud_incidents",
            { platform: "google-cloud" },
            "/core/v1/cloudincidents",
            { incidents: [], rowCount: 0 },
        ],
    ] as const)("%s sends the injected tenant in the header and query", async (name, args, path, response) => {
        let called = false;
        mswServer.use(
            http.get(`${API}${path}`, ({ request }) => {
                called = true;
                expect(request.headers.get("X-Tenant-Id")).toBe("switched-fixture");
                expect(new URL(request.url).searchParams.get("customerContext")).toBe("switched-fixture");
                return HttpResponse.json(response);
            })
        );
        const result = await executeToolHandler(
            name,
            { ...args, customerContext: "switched-fixture" },
            "fixture-token"
        );
        expect(called).toBe(true);
        expect(result.isError).not.toBe(true);
    });
});
