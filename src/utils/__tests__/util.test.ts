import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    appendUrlParameters,
    applyTenantIdHeader,
    DebugLevel,
    debugLog,
    formatEnumValues,
    getTrackingContext,
    makeDoitRequest,
    makeDoitSSERequest,
    runWithTracking,
} from "../util.js";

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("DebugLevel enum", () => {
    it("should have correct debug level values", () => {
        expect(DebugLevel.OFF).toBe(0);
        expect(DebugLevel.INFO).toBe(1);
        expect(DebugLevel.VERBOSE).toBe(2);
        expect(DebugLevel.TRACE).toBe(3);
    });
});

describe("debugLog function", () => {
    it("should accept message with default INFO level", () => {
        expect(() => debugLog("test message")).not.toThrow();
    });

    it("should accept message with explicit level", () => {
        expect(() => debugLog("test message", DebugLevel.VERBOSE)).not.toThrow();
    });

    it("should accept message with level and optional arguments", () => {
        expect(() => debugLog("test message", DebugLevel.INFO, "arg1", "arg2")).not.toThrow();
    });

    it("should accept non-string messages", () => {
        const obj = { key: "value", nested: { data: 123 } };
        expect(() => debugLog(obj)).not.toThrow();
        expect(() => debugLog(obj, DebugLevel.VERBOSE)).not.toThrow();
    });

    it("should accept all debug levels", () => {
        expect(() => debugLog("test", DebugLevel.OFF)).not.toThrow();
        expect(() => debugLog("test", DebugLevel.INFO)).not.toThrow();
        expect(() => debugLog("test", DebugLevel.VERBOSE)).not.toThrow();
        expect(() => debugLog("test", DebugLevel.TRACE)).not.toThrow();
    });

    it("should accept multiple optional arguments", () => {
        expect(() => debugLog("test", DebugLevel.INFO, "a", "b", "c", { d: 1 })).not.toThrow();
    });
});

describe("formatEnumValues", () => {
    const SORT_ORDER_VALUES = ["asc", "desc"] as const;
    const SORT_BY_VALUES = ["id", "name", "type", "createTime", "updateTime"] as const;
    const COLOR_VALUES = ["blue", "teal", "mint"] as const;

    it("joins enum values with default separator", () => {
        expect(formatEnumValues(SORT_ORDER_VALUES)).toBe("asc, desc");
    });

    it("joins enum values with custom separator", () => {
        expect(formatEnumValues(SORT_BY_VALUES, " | ")).toBe("id | name | type | createTime | updateTime");
    });

    it("joins enum values with dash separator", () => {
        expect(formatEnumValues(COLOR_VALUES, " - ")).toBe("blue - teal - mint");
    });

    it("returns single enum value as-is", () => {
        const SINGLE = ["only"] as const;
        expect(formatEnumValues(SINGLE)).toBe("only");
    });

    it("returns empty string for empty array", () => {
        expect(formatEnumValues([])).toBe("");
    });

    it("works with plain arrays", () => {
        expect(formatEnumValues(["a", "b", "c"])).toBe("a, b, c");
    });
});

describe("runWithTracking / AsyncLocalStorage propagation", () => {
    it("getTrackingContext() returns undefined outside a runWithTracking call", () => {
        expect(getTrackingContext()).toBeUndefined();
    });

    it("getTrackingContext() returns the context set by runWithTracking", () => {
        const ctx = {
            mcpTool: "list_reports",
            mcpClient: "cursor-vscode",
            mcpClientVersion: "1.0.0",
        };
        runWithTracking(ctx, () => {
            expect(getTrackingContext()).toEqual(ctx);
        });
    });

    it("context is visible inside nested async calls", async () => {
        const ctx = { mcpTool: "run_query", mcpClient: "claude-desktop" };
        await runWithTracking(ctx, async () => {
            await Promise.resolve(); // simulate await boundary
            expect(getTrackingContext()).toEqual(ctx);
        });
    });

    it("context propagates through Promise.all (parallel fan-out)", async () => {
        const ctx = { mcpTool: "get_cloud_overview" };
        await runWithTracking(ctx, async () => {
            const [a, b] = await Promise.all([
                Promise.resolve(getTrackingContext()),
                Promise.resolve(getTrackingContext()),
            ]);
            expect(a).toEqual(ctx);
            expect(b).toEqual(ctx);
        });
    });

    it("outer context is not polluted by an inner runWithTracking call", async () => {
        const outer = { mcpTool: "list_budgets" };
        const inner = { mcpTool: "get_budget" };

        await runWithTracking(outer, async () => {
            // Nested call creates its own scope — must not affect the outer scope after it returns
            await runWithTracking(inner, async () => {
                expect(getTrackingContext()).toEqual(inner);
            });
            expect(getTrackingContext()).toEqual(outer);
        });
    });

    it("context is undefined outside runWithTracking after it completes", async () => {
        const ctx = { mcpTool: "list_tickets" };
        await runWithTracking(ctx, async () => {
            expect(getTrackingContext()).toEqual(ctx);
        });
        // After the call completes, we are back outside any ALS scope
        expect(getTrackingContext()).toBeUndefined();
    });
});

describe("appendUrlParameters", () => {
    const originalCustomerContext = process.env.CUSTOMER_CONTEXT;

    afterEach(() => {
        if (originalCustomerContext === undefined) delete process.env.CUSTOMER_CONTEXT;
        else process.env.CUSTOMER_CONTEXT = originalCustomerContext;
    });

    it("appends maxResults and an encoded customerContext", () => {
        delete process.env.CUSTOMER_CONTEXT;
        expect(appendUrlParameters("https://api.doit.com/x", "cust-1")).toBe(
            "https://api.doit.com/x?maxResults=40&customerContext=cust-1"
        );
    });

    it("encodes reserved characters so customerContext cannot inject extra query parameters", () => {
        delete process.env.CUSTOMER_CONTEXT;
        const url = appendUrlParameters("https://api.doit.com/x", "abc&maxResults=1000&other=1");
        expect(url).toBe("https://api.doit.com/x?maxResults=40&customerContext=abc%26maxResults%3D1000%26other%3D1");
        expect(new URL(url).searchParams.get("customerContext")).toBe("abc&maxResults=1000&other=1");
        expect(new URL(url).searchParams.get("other")).toBeNull();
    });

    it("encodes the CUSTOMER_CONTEXT env fallback the same way", () => {
        process.env.CUSTOMER_CONTEXT = "a/b?c=d";
        expect(appendUrlParameters("https://api.doit.com/x?maxResults=5")).toBe(
            "https://api.doit.com/x?maxResults=5&customerContext=a%2Fb%3Fc%3Dd"
        );
    });
});

describe("makeDoitRequest timeout", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should throw TimeoutError when fetch does not respond within timeoutMs", async () => {
        // Simulate a fetch that hangs but correctly aborts when the signal fires
        vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
            return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener("abort", () => {
                    reject(new DOMException("signal timed out", "TimeoutError"));
                });
            });
        });

        await expect(
            makeDoitRequest("https://api.doit.com/test", "test-token", {
                timeoutMs: 50,
            })
        ).rejects.toMatchObject({ name: "TimeoutError" });
    });

    it("should return null and not throw when fetch rejects with a non-timeout error", async () => {
        vi.stubGlobal("fetch", () => Promise.reject(new Error("Network error")));

        const result = await makeDoitRequest("https://api.doit.com/test", "test-token");

        expect(result).toBeNull();
    });
});

describe("applyTenantIdHeader", () => {
    const originalCustomerContext = process.env.CUSTOMER_CONTEXT;

    afterEach(() => {
        if (originalCustomerContext === undefined) delete process.env.CUSTOMER_CONTEXT;
        else process.env.CUSTOMER_CONTEXT = originalCustomerContext;
    });

    it("sets X-Tenant-Id from the explicit customer context", () => {
        delete process.env.CUSTOMER_CONTEXT;
        expect(applyTenantIdHeader({}, "cust-1")).toEqual({ "X-Tenant-Id": "cust-1" });
    });

    it("falls back to the CUSTOMER_CONTEXT env var", () => {
        process.env.CUSTOMER_CONTEXT = "env-cust";
        expect(applyTenantIdHeader({})).toEqual({ "X-Tenant-Id": "env-cust" });
    });

    it("prefers the explicit customer context over the env var", () => {
        process.env.CUSTOMER_CONTEXT = "env-cust";
        expect(applyTenantIdHeader({}, "cust-1")).toEqual({ "X-Tenant-Id": "cust-1" });
    });

    it("adds no header when there is no customer context", () => {
        delete process.env.CUSTOMER_CONTEXT;
        expect(applyTenantIdHeader({ Accept: "application/json" })).toEqual({ Accept: "application/json" });
    });

    it("keeps an already-set tenant header regardless of casing, so it is never sent twice", () => {
        delete process.env.CUSTOMER_CONTEXT;
        const headers = applyTenantIdHeader({ "x-tenant-id": "explicit" }, "cust-1");

        expect(headers).toEqual({ "x-tenant-id": "explicit" });
        expect(Object.keys(headers).filter((key) => key.toLowerCase() === "x-tenant-id")).toHaveLength(1);
    });
});

describe("makeDoitRequest customer context header", () => {
    const originalCustomerContext = process.env.CUSTOMER_CONTEXT;

    // Captures the headers of the last stubbed fetch call.
    function stubFetchOk() {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
            text: async () => "{}",
        });
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    function headersOf(fetchMock: ReturnType<typeof stubFetchOk>): Record<string, string> {
        return fetchMock.mock.calls[0][1].headers as Record<string, string>;
    }

    afterEach(() => {
        vi.unstubAllGlobals();
        if (originalCustomerContext === undefined) delete process.env.CUSTOMER_CONTEXT;
        else process.env.CUSTOMER_CONTEXT = originalCustomerContext;
    });

    it("sends the customer context as the X-Tenant-Id header in addition to the query param", async () => {
        delete process.env.CUSTOMER_CONTEXT;
        const fetchMock = stubFetchOk();

        await makeDoitRequest("https://api.doit.com/test", "test-token", { customerContext: "cust-1" });

        expect(headersOf(fetchMock)["X-Tenant-Id"]).toBe("cust-1");
        expect(fetchMock.mock.calls[0][0]).toContain("customerContext=cust-1");
    });

    it("sends the X-Tenant-Id header from the CUSTOMER_CONTEXT env var", async () => {
        process.env.CUSTOMER_CONTEXT = "env-cust";
        const fetchMock = stubFetchOk();

        await makeDoitRequest("https://api.doit.com/test", "test-token");

        expect(headersOf(fetchMock)["X-Tenant-Id"]).toBe("env-cust");
    });

    it("sends the X-Tenant-Id header even when URL params are not appended", async () => {
        delete process.env.CUSTOMER_CONTEXT;
        const fetchMock = stubFetchOk();

        await makeDoitRequest("https://api.doit.com/test", "test-token", {
            appendParams: false,
            customerContext: "cust-1",
        });

        expect(headersOf(fetchMock)["X-Tenant-Id"]).toBe("cust-1");
    });

    it("omits the X-Tenant-Id header when there is no customer context", async () => {
        delete process.env.CUSTOMER_CONTEXT;
        const fetchMock = stubFetchOk();

        await makeDoitRequest("https://api.doit.com/test", "test-token");

        const headers = headersOf(fetchMock);
        expect(Object.keys(headers).some((key) => key.toLowerCase() === "x-tenant-id")).toBe(false);
    });

    it("does not override an explicit tenant header passed by the caller", async () => {
        delete process.env.CUSTOMER_CONTEXT;
        const fetchMock = stubFetchOk();

        await makeDoitRequest("https://api.doit.com/test", "test-token", {
            customerContext: "cust-1",
            headers: { "X-Tenant-Id": "explicit" },
        });

        const headers = headersOf(fetchMock);
        expect(headers["X-Tenant-Id"]).toBe("explicit");
        expect(Object.keys(headers).filter((key) => key.toLowerCase() === "x-tenant-id")).toHaveLength(1);
    });
});

describe("makeDoitSSERequest customer context header", () => {
    const originalCustomerContext = process.env.CUSTOMER_CONTEXT;
    const originalTenantId = process.env.TENANT_ID;

    function stubSSEFetch() {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            body: new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('data: {"answer":"hi"}\n\n'));
                    controller.close();
                },
            }),
        });
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    async function drain(generator: AsyncGenerator<{ data: string }>) {
        for await (const _event of generator) {
            // consume the stream so the request completes
        }
    }

    afterEach(() => {
        vi.unstubAllGlobals();
        if (originalCustomerContext === undefined) delete process.env.CUSTOMER_CONTEXT;
        else process.env.CUSTOMER_CONTEXT = originalCustomerContext;
        if (originalTenantId === undefined) delete process.env.TENANT_ID;
        else process.env.TENANT_ID = originalTenantId;
    });

    it("sends the customer context as the X-Tenant-Id header", async () => {
        delete process.env.CUSTOMER_CONTEXT;
        delete process.env.TENANT_ID;
        const fetchMock = stubSSEFetch();

        await drain(makeDoitSSERequest("https://api.doit.com/stream", { question: "q" }, "test-token", "cust-1"));

        expect(fetchMock.mock.calls[0][1].headers["X-Tenant-Id"]).toBe("cust-1");
    });

    it("prefers the customer context over the TENANT_ID env var and sends a single tenant header", async () => {
        delete process.env.CUSTOMER_CONTEXT;
        process.env.TENANT_ID = "env-tenant";
        const fetchMock = stubSSEFetch();

        await drain(makeDoitSSERequest("https://api.doit.com/stream", { question: "q" }, "test-token", "cust-1"));

        const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
        expect(headers["X-Tenant-Id"]).toBe("cust-1");
        expect(Object.keys(headers).filter((key) => key.toLowerCase() === "x-tenant-id")).toHaveLength(1);
    });

    it("falls back to the TENANT_ID env var when there is no customer context", async () => {
        delete process.env.CUSTOMER_CONTEXT;
        process.env.TENANT_ID = "env-tenant";
        const fetchMock = stubSSEFetch();

        await drain(makeDoitSSERequest("https://api.doit.com/stream", { question: "q" }, "test-token"));

        expect(fetchMock.mock.calls[0][1].headers["X-Tenant-Id"]).toBe("env-tenant");
    });

    it("omits the tenant header when neither a customer context nor TENANT_ID is set", async () => {
        delete process.env.CUSTOMER_CONTEXT;
        delete process.env.TENANT_ID;
        const fetchMock = stubSSEFetch();

        await drain(makeDoitSSERequest("https://api.doit.com/stream", { question: "q" }, "test-token"));

        const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
        expect(Object.keys(headers).some((key) => key.toLowerCase() === "x-tenant-id")).toBe(false);
    });
});
