import { afterEach, describe, expect, it, vi } from "vitest";
import { generateTools } from "../../tools/generated/generateTools.js";
import { loadGeneratedToolsSpec } from "../../tools/generated/loadSpec.js";
import { COVERED_ENDPOINTS } from "../../tools/handWrittenTools.js";
import { MemoryApprovalStore } from "../approval.js";
import { executeToolHandler } from "../toolsHandler.js";

// Outbound-request contract for customer selection, exercised through the shared dispatcher
// with only fetch stubbed: the selected customer (customerContext argument, else the
// CUSTOMER_CONTEXT env var) is sent solely as X-Tenant-Id — never as a query parameter or
// body field — while pagination and MCP tracking parameters are preserved.

const generatedTools = new Map(generateTools(loadGeneratedToolsSpec(), COVERED_ENDPOINTS).map((t) => [t.name, t]));

type SeenRequest = { url: URL; method: string; tenant: string | null; tenantHeaders: number; body: unknown };

function recordRequests(respond: (request: SeenRequest) => Response | Promise<Response>) {
    const seen: SeenRequest[] = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string, init: RequestInit = {}) => {
            const headers = (init.headers ?? {}) as Record<string, string>;
            const tenantKeys = Object.keys(headers).filter((key) => key.toLowerCase() === "x-tenant-id");
            const request: SeenRequest = {
                url: new URL(input),
                method: init.method ?? "GET",
                tenant: new Headers(headers).get("X-Tenant-Id"),
                tenantHeaders: tenantKeys.length,
                body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
            };
            seen.push(request);
            // Yield so concurrent calls interleave before either completes.
            await Promise.resolve();
            return respond(request);
        })
    );
    return seen;
}

function sseResponse(events: object[]): Response {
    const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
    return new Response(payload, { headers: { "Content-Type": "text/event-stream" } });
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("customer selection is sent only as X-Tenant-Id", () => {
    it("sends list_service_quotas with only its declared query parameters plus tracking", async () => {
        vi.stubEnv("CUSTOMER_CONTEXT", "");
        const seen = recordRequests(() => Response.json({ quotas: [], pageToken: "next" }));

        const result = await executeToolHandler(
            "list_service_quotas",
            { cloudProvider: "aws", maxResults: 3, pageToken: "p1", customerContext: "customer-a" },
            "token",
            { generatedTools, trackingContext: { mcpClient: "test-client" } }
        );

        expect(result.isError).not.toBe(true);
        expect(seen).toHaveLength(1);
        const [request] = seen;
        expect(request.url.pathname).toBe("/core/v1/service-quotas");
        expect(request.tenant).toBe("customer-a");
        expect(request.tenantHeaders).toBe(1);
        const businessKeys = [...request.url.searchParams.keys()].filter(
            (key) => !["mcp", "mcpVersion", "mcpTool", "mcpClient", "sse"].includes(key)
        );
        expect(businessKeys.sort()).toEqual(["cloudProvider", "maxResults", "pageToken"]);
        expect(request.url.searchParams.get("pageToken")).toBe("p1");
        expect(request.url.searchParams.get("mcpTool")).toBe("list_service_quotas");
        expect(request.url.searchParams.get("mcpClient")).toBe("test-client");
        expect(request.url.searchParams.get("mcp")).toBe("true");
    });

    it("falls back to CUSTOMER_CONTEXT, and an explicit argument overrides it", async () => {
        vi.stubEnv("CUSTOMER_CONTEXT", "env-customer");
        const seen = recordRequests(() => Response.json({ quotas: [] }));

        await executeToolHandler("list_service_quotas", { maxResults: 3 }, "token", { generatedTools });
        await executeToolHandler("list_service_quotas", { maxResults: 3, customerContext: "arg-customer" }, "token", {
            generatedTools,
        });
        await executeToolHandler("list_organizations", {}, "token");

        expect(seen.map((request) => request.tenant)).toEqual(["env-customer", "arg-customer", "env-customer"]);
        for (const request of seen) {
            expect(request.url.searchParams.has("customerContext")).toBe(false);
        }
    });

    it("sends no tenant header when no customer is selected", async () => {
        vi.stubEnv("CUSTOMER_CONTEXT", "");
        vi.stubEnv("TENANT_ID", "");
        const seen = recordRequests((request) =>
            request.url.pathname.endsWith("/actions/build")
                ? sseResponse([{ answer: "done", conversationId: "c-1" }])
                : Response.json({ quotas: [] })
        );

        await executeToolHandler("list_service_quotas", {}, "token", { generatedTools });
        await executeToolHandler("build_cloud_flow", { question: "q" }, "token");

        expect(seen).toHaveLength(2);
        for (const request of seen) {
            expect(request.tenantHeaders).toBe(0);
            expect(request.url.searchParams.has("customerContext")).toBe(false);
        }
    });

    it("keeps concurrent hand-written, generated and streaming calls scoped to their own customers", async () => {
        vi.stubEnv("CUSTOMER_CONTEXT", "fallback-customer");
        const seen = recordRequests((request) =>
            request.url.pathname.includes("/actions/")
                ? sseResponse([{ answer: `answer for ${request.tenant}`, conversationId: `c-${request.tenant}` }])
                : request.tenant === "customer-a"
                  ? Response.json({ error: "Filter is invalid" }, { status: 400 })
                  : Response.json({ organizations: [], quotas: [] })
        );

        const calls = (["customer-a", "customer-b"] as const).flatMap((customerContext) => [
            executeToolHandler("list_organizations", { customerContext }, "token"),
            executeToolHandler("list_service_quotas", { maxResults: 3, customerContext }, "token", { generatedTools }),
            executeToolHandler("build_cloud_flow", { question: "q", customerContext }, "token"),
            executeToolHandler("refine_cloudflow", { flowId: "flow-1", question: "q", customerContext }, "token"),
        ]);
        const results = await Promise.all(calls);

        expect(seen).toHaveLength(8);
        for (const request of seen) {
            expect(["customer-a", "customer-b"]).toContain(request.tenant);
            expect(request.tenantHeaders).toBe(1);
            expect(request.url.searchParams.has("customerContext")).toBe(false);
            expect(request.url.searchParams.get("mcp")).toBe("true");
        }
        const tenantsByPath = (customer: string) =>
            seen
                .filter((request) => request.tenant === customer)
                .map((request) => request.url.pathname)
                .sort();
        expect(tenantsByPath("customer-a")).toEqual(tenantsByPath("customer-b"));
        // Customer A's REST calls failed, customer B's succeeded; streams answered per customer.
        expect(results.slice(0, 2).every((result) => result.isError)).toBe(true);
        expect(results.slice(4, 6).every((result) => !result.isError)).toBe(true);
        expect(results[2].content[0].text).toContain("answer for customer-a");
        expect(results[6].content[0].text).toContain("answer for customer-b");
        expect(results[7].content[0].text).toContain("c-customer-b");
    });

    it("streams CloudFlow build and refine with the tenant header and an unchanged body", async () => {
        vi.stubEnv("CUSTOMER_CONTEXT", "env-customer");
        const seen = recordRequests(() => sseResponse([{ answer: "ok" }]));

        await executeToolHandler("build_cloud_flow", { question: "q", customerContext: "customer-a" }, "token");
        await executeToolHandler("refine_cloudflow", { flowId: "f/1", question: "q" }, "token");

        expect(seen.map((request) => [request.url.pathname, request.tenant])).toEqual([
            ["/cloudflow/v1/flows/actions/build", "customer-a"],
            ["/cloudflow/v1/flows/f%2F1/actions/refine", "env-customer"],
        ]);
        for (const request of seen) {
            expect(request.method).toBe("POST");
            expect(request.body).toEqual({ question: "q" });
            expect(request.url.searchParams.has("customerContext")).toBe(false);
            expect(request.url.searchParams.get("mcpTool")).toMatch(/cloud_?flow/);
        }
    });

    it("keeps customerContext out of a confirmed generated DELETE body and URL", async () => {
        vi.stubEnv("CUSTOMER_CONTEXT", "");
        const seen = recordRequests(() => new Response(null, { status: 204 }));
        const approvalStore = new MemoryApprovalStore();
        const options = { generatedTools, approvalStore, userKey: "user-1" };

        const staged = await executeToolHandler(
            "delete_datahub_datasets",
            { datasets: ["old"], customerContext: "customer-a" },
            "token",
            options
        );
        const envelope = JSON.parse(staged.content[0].text);
        expect(envelope.status).toBe("approval_required");
        expect(envelope.summary).toContain("for customer customer-a");
        expect(seen).toHaveLength(0);

        const confirmed = await executeToolHandler(
            "confirm_action",
            { token: envelope.approvalToken },
            "token",
            options
        );

        expect(confirmed.isError).not.toBe(true);
        expect(seen).toHaveLength(1);
        const [request] = seen;
        expect(request.method).toBe("DELETE");
        expect(request.url.pathname).toBe("/datahub/v1/datasets");
        expect(request.tenant).toBe("customer-a");
        expect(request.body).toEqual({ datasets: ["old"] });
        expect(request.url.searchParams.has("customerContext")).toBe(false);
    });
});
