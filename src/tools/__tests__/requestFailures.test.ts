import { afterEach, describe, expect, it, vi } from "vitest";
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
