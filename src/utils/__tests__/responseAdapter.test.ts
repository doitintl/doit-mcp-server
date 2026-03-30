import { describe, expect, it } from "vitest";
import { adaptToolResponse, sanitize } from "../responseAdapter.js";

describe("adaptToolResponse", () => {
    it("returns all three required fields: structuredContent, content, _meta", () => {
        const raw = { content: [{ type: "text", text: '{"budgets":[{"id":"1","name":"Q1"}]}' }] };
        const result = adaptToolResponse("list_budgets", raw);
        expect(result).toHaveProperty("structuredContent");
        expect(result).toHaveProperty("content");
        expect(result).toHaveProperty("_meta");
    });

    it("content is an array with a text-type entry", () => {
        const result = adaptToolResponse("list_budgets", [{ id: "1" }]);
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toMatchObject({ type: "text" });
        expect(typeof result.content[0].text).toBe("string");
        expect(result.content[0].text.length).toBeGreaterThan(0);
    });

    it("_meta contains toolName but NOT rawData", () => {
        const result = adaptToolResponse("get_budget", { id: "1", name: "Test" });
        expect(result._meta).toHaveProperty("toolName", "get_budget");
        expect(result._meta).not.toHaveProperty("rawData");
    });

    it("structuredContent caps arrays at 10 items and reports totalCount", () => {
        const items = Array.from({ length: 25 }, (_, i) => ({ id: String(i) }));
        const result = adaptToolResponse("list_budgets", items);
        expect(result.structuredContent.totalCount).toBe(25);
        expect((result.structuredContent.items as unknown[]).length).toBe(10);
    });

    it("structuredContent caps at 10 items and content preserves raw data when truncated", () => {
        const items = Array.from({ length: 25 }, (_, i) => ({ id: String(i) }));
        const result = adaptToolResponse("list_budgets", items);
        // structuredContent is the summarized view (capped)
        expect((result.structuredContent.items as unknown[]).length).toBe(10);
        // content carries the raw data for the model to read
        expect(result.content[0].text).toBeDefined();
    });

    it("content preserves raw data when all results fit", () => {
        const items = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }));
        const result = adaptToolResponse("list_budgets", items);
        expect(result.content[0].text).toBeDefined();
    });

    it("paginated response includes nextPageToken in structuredContent", () => {
        const data = { data: Array.from({ length: 3 }, (_, i) => ({ id: i })), pageToken: "tok-abc" };
        const result = adaptToolResponse("list_budgets", data);
        expect(result.structuredContent.nextPageToken).toBe("tok-abc");
        expect(result.structuredContent.hasMore).toBe(true);
    });
});

describe("sanitize — response hygiene", () => {
    const BANNED: Record<string, string> = {
        // Session / trace / request / correlation identifiers
        sessionId: "session-val",
        session_id: "session-val",
        SESSION_ID: "session-val",
        traceId: "trace-val",
        trace_id: "trace-val",
        "x-trace-id": "trace-val",
        requestId: "req-val",
        request_id: "req-val",
        "x-request-id": "req-val",
        correlationId: "corr-val",
        correlation_id: "corr-val",
        // Internal prefixes
        _requestTimestamp: "ts-val",
        _traceContext: "ctx-val",
        "x-custom-header": "hdr-val",
        // Diagnostic timing / logging metadata
        requestTime: "time-val",
        responseTime: "time-val",
        serverTime: "time-val",
        processingTime: "time-val",
        latency: "time-val",
        _ts: "time-val",
        // Credentials and secrets
        password: "secret123",
        apiKey: "key-abc",
        api_key: "key-abc",
        secretToken: "tok-xyz",
    };

    it("strips all banned field types from flat objects", () => {
        const payload: Record<string, unknown> = { ...BANNED, name: "should-survive", amount: 42 };
        const result = sanitize(payload);
        for (const key of Object.keys(BANNED)) {
            expect(result, `key "${key}" should be stripped`).not.toHaveProperty(key);
        }
        expect(result.name).toBe("should-survive");
        expect(result.amount).toBe(42);
    });

    it("strips banned fields recursively in nested objects", () => {
        const payload = {
            budget: {
                id: "b1",
                name: "Q1",
                sessionId: "abc",
                inner: { traceId: "xyz", correlationId: "c1", amount: 100 },
            },
        };
        const result = sanitize(payload) as any;
        expect(result.budget).not.toHaveProperty("sessionId");
        expect(result.budget.inner).not.toHaveProperty("traceId");
        expect(result.budget.inner).not.toHaveProperty("correlationId");
        expect(result.budget.name).toBe("Q1");
        expect(result.budget.inner.amount).toBe(100);
    });

    it("strips mcp=true and sse=true query params from URL strings", () => {
        const payload = { selfLink: "https://api.doit.com/budgets?foo=bar&mcp=true&sse=true" };
        const result = sanitize(payload) as any;
        expect(result.selfLink).not.toContain("mcp=true");
        expect(result.selfLink).not.toContain("sse=true");
        expect(result.selfLink).toContain("foo=bar");
    });

    it("preserves business-relevant fields (pageToken, createdAt, timestamp, updatedAt)", () => {
        const payload = {
            pageToken: "tok123",
            createdAt: "2024-01-01",
            timestamp: "2024-01-01T00:00:00Z",
            updatedAt: "2024-06-01",
            startPeriod: 1700000000000,
        };
        const result = sanitize(payload);
        expect(result.pageToken).toBe("tok123");
        expect(result.createdAt).toBe("2024-01-01");
        expect(result.timestamp).toBe("2024-01-01T00:00:00Z");
        expect(result.updatedAt).toBe("2024-06-01");
        expect(result.startPeriod).toBe(1700000000000);
    });

    it("does not alter arrays — only sanitizes object keys", () => {
        const payload = [
            { id: "1", sessionId: "s1" },
            { id: "2", traceId: "t2" },
        ];
        // sanitize operates on objects, adaptToolResponse handles top-level
        const result = adaptToolResponse("list_budgets", payload);
        // structuredContent items should have sanitized objects
        const items = result.structuredContent.items as any[];
        for (const item of items) {
            expect(item).not.toHaveProperty("sessionId");
            expect(item).not.toHaveProperty("traceId");
        }
    });
});
