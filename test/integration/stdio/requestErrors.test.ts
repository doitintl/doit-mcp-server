import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, getTextContent } from "../helpers.js";
import { mswServer } from "../setup.js";
import { createModernTestClient } from "./modern/helpers.js";

// Use the real request helper and MCP tools/call in both supported protocol eras.
// All API traffic is mocked; no automatically confirmed writes are used.
describe.each([
    ["legacy", createTestClient],
    ["modern", createModernTestClient],
] as const)("API errors through %s tools/call", (_era, connect) => {
    let session: Awaited<ReturnType<typeof createTestClient>> | Awaited<ReturnType<typeof createModernTestClient>>;
    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        session = await connect();
    });
    afterEach(async () => {
        await session.cleanup();
        vi.restoreAllMocks();
    });

    it.each([
        ["list_labels", {}, "/analytics/v1/labels"],
        ["list_cloudflow_connections", {}, "/cloudflow/v1/connections"],
        ["get_widget", { widgetId: "missing-widget" }, "/analytics/v1/widgets/missing-widget"],
    ])("preserves the API reason for %s", async (name, args, path) => {
        mswServer.use(
            http.get(`https://api.doit.com${path}`, () =>
                HttpResponse.json(
                    {
                        error: "Invalid filter: repeated key name",
                        data: "private-customer-data",
                        headers: { Authorization: "private-authorization" },
                    },
                    { status: 400 }
                )
            )
        );
        const result = await session.rawClient.callTool({ name, arguments: args });
        expect(result.isError).toBe(true);
        expect(getTextContent(result)).toBe("HTTP 400: Invalid filter: repeated key name");
        expect(JSON.stringify([result, vi.mocked(console.error).mock.calls])).not.toContain("private-");
    });

    it.each([
        [
            "plain text",
            () => new HttpResponse("Invalid filter: unknown key", { status: 400 }),
            "HTTP 400: Invalid filter: unknown key",
        ],
        [
            "HTML",
            () => new HttpResponse("<html>private diagnostics</html>", { status: 502 }),
            "HTTP 502: The API is temporarily unavailable",
        ],
        ["transport", () => HttpResponse.error(), "Unable to reach the DoiT API"],
    ])("reports %s failures as MCP tool errors", async (_kind, response, expected) => {
        mswServer.use(http.get("https://api.doit.com/iam/v1/organizations", response));
        const result = await session.rawClient.callTool({ name: "list_organizations", arguments: {} });
        expect(result.isError).toBe(true);
        expect(getTextContent(result)).toContain(expected);
    });

    it("preserves deliberately partial overview results", async () => {
        mswServer.use(
            http.post("https://api.doit.com/analytics/v1/reports/query", async ({ request }) => {
                const body = (await request.json()) as { config: { group: unknown[] } };
                if (body.config.group.length > 1)
                    return HttpResponse.json({ error: "Query unavailable" }, { status: 403 });
                return HttpResponse.json({ result: { schema: ["cloud", "cost"], rows: [["test-cloud", 42]] } });
            }),
            http.get("https://api.doit.com/anomalies/v1", () => HttpResponse.error()),
            http.get("https://api.doit.com/core/v1/cloudincidents", () =>
                HttpResponse.json({ incidents: [{ id: "incident-1" }] })
            )
        );
        const result = await session.rawClient.callTool({ name: "get_cloud_overview", arguments: {} });
        expect(result.isError).not.toBe(true);
        expect(JSON.parse(getTextContent(result))).toEqual({
            costByCloud: { columns: ["cloud", "cost"], rows: [["test-cloud", 42]] },
            topServices: { columns: [], rows: [] },
            topProjects: { columns: [], rows: [] },
            anomalies: [],
            incidents: [{ id: "incident-1" }],
        });
    });

    it("preserves Reports field validation and remediation through tools/call", async () => {
        mswServer.use(
            http.post("https://api.doit.com/analytics/v1/reports/query", () =>
                HttpResponse.json(
                    {
                        errors: [
                            { field: "config.metric", message: "Unsupported metric", diagnostics: "private-data" },
                        ],
                    },
                    { status: 400 }
                )
            )
        );
        const result = await session.rawClient.callTool({ name: "run_query", arguments: { config: {} } });
        expect(result.isError).toBe(true);
        expect(getTextContent(result)).toContain("HTTP 400: config.metric: Unsupported metric");
        expect(getTextContent(result)).toContain("list_dimensions");
        expect(getTextContent(result)).not.toContain("private-data");
    });

    it("still returns successful reads", async () => {
        const result = await session.rawClient.callTool({ name: "list_organizations", arguments: {} });
        expect(result.isError).not.toBe(true);
        expect(JSON.parse(getTextContent(result)).organizations).toHaveLength(2);
    });
});
