import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryApprovalStore } from "../../utils/approval.js";
import { executeToolHandler } from "../../utils/toolsHandler.js";
import { handleGeneratedOperationRequest } from "../generated/callOperation.js";
import { generatedTools } from "../generated/registry.js";
import { handleUpdateInsightStatusRequest } from "../insights.js";

// Exercise the real request helper, rather than mocking its former null-on-error contract.
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

it("preserves an HTTP error and OAuth metadata before a hosted success adapter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"Token expired"}', { status: 401 })));
    const convertResponse = vi.fn(() => ({ content: [] }));
    const result = await executeToolHandler("list_organizations", {}, "secret", { convertResponse });
    expect(result).toMatchObject({
        isError: true,
        content: [{ type: "text", text: "HTTP 401: Token expired" }],
        _meta: { "mcp/www_authenticate": expect.stringContaining("invalid_token") },
    });
    expect(convertResponse).not.toHaveBeenCalled();
});

it("still adapts successful reads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ organizations: [] })));
    const converted = { content: [{ type: "text", text: "adapted success" }] };
    const convertResponse = vi.fn(() => converted);
    expect(await executeToolHandler("list_organizations", {}, "secret", { convertResponse })).toBe(converted);
    expect(convertResponse).toHaveBeenCalledOnce();
});

it("keeps concurrent hosted customer contexts and tracking separate through success and failure", async () => {
    vi.stubEnv("CUSTOMER_CONTEXT", "fallback-customer");
    const seen: Array<{ context: string | null; tenant: string | null; tool: string | null }> = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init: RequestInit) => {
            const params = new URL(url).searchParams;
            const headers = new Headers(init.headers);
            seen.push({
                context: params.get("customerContext"),
                tenant: headers.get("X-Tenant-Id"),
                tool: params.get("mcpTool"),
            });
            await Promise.resolve();
            return params.get("customerContext") === "customer-a"
                ? Response.json({ error: "Filter is invalid" }, { status: 400 })
                : Response.json({ organizations: [] });
        })
    );
    const [failed, succeeded] = await Promise.all([
        executeToolHandler("list_organizations", { customerContext: "customer-a" }, "token-a"),
        executeToolHandler("list_organizations", { customerContext: "customer-b" }, "token-b"),
    ]);
    expect(failed.isError).toBe(true);
    expect(succeeded.isError).not.toBe(true);
    expect(seen).toEqual([
        { context: "customer-a", tenant: "customer-a", tool: "list_organizations" },
        { context: "customer-b", tenant: "customer-b", tool: "list_organizations" },
    ]);
});

describe("empty successful caller responses", () => {
    it("preserves a no-parse status update success", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
        const result = await handleUpdateInsightStatusRequest({ key: "test", status: "acknowledged" }, "secret");
        expect(result).not.toHaveProperty("isError", true);
        expect(JSON.parse(result.content[0].text)).toMatchObject({ success: true, key: "test" });
    });
    it("preserves an empty generated operation response", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
        const tool = generatedTools.find((tool) => tool.name === "get_widget");
        if (!tool) throw new Error("get_widget must be registered");
        const result = await handleGeneratedOperationRequest(tool, { widgetId: "test" }, "secret");
        expect(result).toEqual({ content: [{ type: "text", text: "" }] });
    });
});

it.each([
    ["run_query", { config: {} }],
    ["create_report", { name: "test-report", config: {} }],
    ["update_report", { id: "test-report", config: {} }],
])("preserves Reports API field errors for %s", async (name, args) => {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() =>
            Response.json(
                {
                    errors: [{ field: "config.metric", message: "Unsupported metric", debug: "private-diagnostic" }],
                },
                { status: 400 }
            )
        )
    );
    const result = await executeToolHandler(name as string, args, "secret");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HTTP 400: config.metric: Unsupported metric");
    expect(result.content[0].text).not.toContain("private-diagnostic");
});

it.each([
    ["list_reports", {}, "filter parameter"],
    ["run_query", { config: {} }, "list_allocations"],
    [
        "run_query",
        {
            config: {
                timeRange: {
                    mode: "custom",
                    customTimeRange: { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" },
                },
            },
        },
        "ISO 8601",
    ],
    ["cost_breakdown", { groupBy: "service" }, "list_dimensions"],
    ["cost_trend", {}, "list_dimensions"],
    ["compare_spend", { period2: { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" } }, "run_query"],
])("preserves validation guidance for %s", async (name, args, guidance) => {
    for (const status of [400, 422, 401, 503]) {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockImplementation(() => Response.json({ error: "Invalid query" }, { status }))
        );
        const result = await executeToolHandler(name as string, args, "secret");
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain(`HTTP ${status}:`);
        if (status === 400 || status === 422) {
            expect(result.content[0].text).toContain("Invalid query");
            expect(result.content[0].text).toContain(guidance);
        } else {
            expect(result.content[0].text).not.toContain(guidance);
        }
    }
});

it.each([{}, { targetCustomerId: "T", userId: ".." }])(
    "does not adapt errors from generated DELETE approval validation (%j)",
    async (args) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const approvalStore = new MemoryApprovalStore();
        const convertResponse = vi.fn(() => ({ content: [] }));
        const result = await executeToolHandler("delete_user_geographic_access_scope", args, "secret", {
            approvalStore,
            userKey: "test-user",
            convertResponse,
            generatedTools: new Map(generatedTools.map((tool) => [tool.name, tool])),
        });
        expect(result.isError).toBe(true);
        expect(convertResponse).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(approvalStore.size()).toBe(0);
    }
);

it("preserves outer-catch OAuth metadata if storing an approval fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const convertResponse = vi.fn(() => ({ content: [] }));
    const stash = vi.fn().mockRejectedValue(new Error("HTTP 401: Token expired"));
    const result = await executeToolHandler(
        "delete_user_geographic_access_scope",
        { targetCustomerId: "T", userId: "user-1" },
        "secret",
        {
            approvalStore: { stash, consume: vi.fn() },
            userKey: "test-user",
            convertResponse,
            generatedTools: new Map(generatedTools.map((tool) => [tool.name, tool])),
        }
    );
    expect(stash).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
        isError: true,
        _meta: { "mcp/www_authenticate": expect.stringContaining("invalid_token") },
    });
    expect(convertResponse).not.toHaveBeenCalled();
});

it.each([
    ["run_query", { config: {} }],
    ["cost_breakdown", { groupBy: "service" }],
    ["cost_trend", {}],
    ["compare_spend", { period2: { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" } }],
    ["search_cloud_diagrams", { query: "test" }],
    ["get_cloud_diagram_components", {}],
    ["get_statussheet_components", { id: "test-layer" }],
])("retains read retry advice for POST caller %s", async (name, args) => {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => new Response(null, { status: 503 }))
    );
    const result = await executeToolHandler(name as string, args, "secret", {
        generatedTools: new Map(generatedTools.map((tool) => [tool.name, tool])),
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HTTP 503: The API is temporarily unavailable. Try again later.");
    expect(result.content[0].text).not.toContain("may already have been applied");
    expect(fetch).toHaveBeenCalled();
});

it.each([
    ["create_report", { name: "test-report", config: {} }],
    ["find_cloud_diagrams", { resources: ["test-resource"] }],
])("keeps mutation warnings for %s after an uncertain failure", async (name, args) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const result = await executeToolHandler(name as string, args, "secret");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Check its state before retrying");
    expect(fetch).toHaveBeenCalledOnce();
});
