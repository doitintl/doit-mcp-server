import { afterEach, describe, expect, it, vi } from "vitest";
import { handleGeneralError, makeDoitRequest } from "../util.js";

const URL = "https://api.doit.com/test";
const TOKEN = "private-auth-token";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

function respond(body: string | null, status = 400) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));
}

describe("request failures", () => {
    it.each([
        [{ error: "Duplicate filter key: name" }, "Duplicate filter key: name"],
        [{ message: "config.filters[0].value must be >= 1" }, "config.filters[0].value must be >= 1"],
        [{ error: { message: "Unknown filter", code: "invalid_filter" } }, "Unknown filter; invalid_filter"],
        [{ message: ["name is required", "color is invalid"] }, "name is required; color is invalid"],
        [{ detail: "Supply a version", code: "precondition_required" }, "Supply a version; precondition_required"],
        [{ error: "Invalid request", fields: [{ field: "name", error: "is required" }] }, "name: is required"],
        [{ details: [{ field: "filter", issue: "must be unique" }] }, "filter: must be unique"],
    ])("preserves recognized API validation details: %j", async (body, expected) => {
        respond(JSON.stringify(body));
        await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow(`HTTP 400:`);
        respond(JSON.stringify(body));
        await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow(expected);
    });

    it("keeps a short non-JSON validation reason", async () => {
        respond("Invalid filter: repeated key name");
        await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow("HTTP 400: Invalid filter: repeated key name");
    });

    it.each([
        "<html>private diagnostics</html>",
        JSON.stringify({ data: "private diagnostics", headers: { secret: "private diagnostics" } }),
        JSON.stringify({ message: { private: "private diagnostics" } }),
        JSON.stringify({ message: "Traceback: private diagnostics\nat internal.ts:12" }),
        "private diagnostics ".repeat(100),
        "",
    ])("falls back safely for unrecognized/diagnostic content", async (body) => {
        respond(body);
        await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow(
            "HTTP 400: Bad request. Check the supplied parameters."
        );
    });

    it("suppresses server diagnostics even inside a message field", async () => {
        respond(JSON.stringify({ message: "database password is private" }), 500);
        await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow("HTTP 500: The API is temporarily unavailable");
    });

    it.each(["", "0", "3"])("logs only fixed failure metadata at debug level %j", async (debugLevel) => {
        vi.stubEnv("DOIT_DEBUG_LEVEL", debugLevel);
        vi.resetModules();
        const util = await import("../util.js");
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        respond(
            JSON.stringify({
                message: `Invalid filter; ${TOKEN}; header-value; Bearer other-token; api_key=other-key; user@example.com; https://private.example/secret`,
                data: { private: "customer-response" },
                headers: { Cookie: "response-cookie" },
            })
        );
        const error = await util
            .makeDoitRequest(`${URL}?private=query-data`, TOKEN, {
                method: "POST",
                body: { private: "request-data" },
                headers: { "X-Private": "header-value" },
            })
            .catch((error) => error);
        const result = util.handleGeneralError(error, "request");
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Invalid filter");
        const output = JSON.stringify([result, log.mock.calls, error]);
        for (const secret of [
            TOKEN,
            "header-value",
            "other-token",
            "other-key",
            "user@example.com",
            "private.example",
            "customer-response",
            "response-cookie",
            "query-data",
            "request-data",
        ]) {
            expect(output).not.toContain(secret);
        }
        expect(error.cause).toBeUndefined();
        expect(log).toHaveBeenCalledWith("DoiT API request failed", {
            method: "POST",
            status: 400,
            kind: "http",
        });
    });

    it("does not wait for a diagnostic stream's cancellation to settle", async () => {
        const cancel = vi.fn(() => new Promise<void>(() => {}));
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, body: { cancel } }));
        await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow("HTTP 502: The API is temporarily unavailable");
        expect(cancel).toHaveBeenCalledOnce();
    });

    it("preserves HTTP status if reading a successful body fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.reject(new Error(TOKEN)) })
        );
        await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow(
            "HTTP 200: The API reported success, but its response could not be read."
        );
    });

    it("preserves HTTP status if reading an error body fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, status: 403, text: () => Promise.reject(new Error(TOKEN)) })
        );
        await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow("HTTP 403: Forbidden");
    });

    it.each(["Invalid filter; token=private-token", "Invalid filter; Cookie: first=private-one; second=private-two"])(
        "redacts credential assignments in validation messages",
        async (message) => {
            respond(JSON.stringify({ message }));
            const result = await makeDoitRequest(URL, TOKEN).catch((error) => handleGeneralError(error, "request"));
            expect(JSON.stringify(result)).not.toContain("private-");
            expect(JSON.stringify(result)).toContain("Invalid filter");
        }
    );

    it("preserves the OAuth reauthentication metadata for 401", async () => {
        respond(JSON.stringify({ error: "Token expired" }), 401);
        const result = await makeDoitRequest(URL, TOKEN).catch((error) => handleGeneralError(error, "request"));
        expect(result).toMatchObject({
            isError: true,
            _meta: { "mcp/www_authenticate": expect.stringContaining("invalid_token") },
        });
    });

    it.each([new Error(`Failed fetching ${URL}?token=${TOKEN}`), new TypeError(TOKEN)])(
        "sanitizes transport failures",
        async (error) => {
            vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
            await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow("Check your connection. Try again later.");
        }
    );
});

describe("successful response parsing", () => {
    it.each(["", "  ", "null"])("preserves empty/JSON-null success (%j)", async (body) => {
        respond(body, 200);
        expect(await makeDoitRequest(URL, TOKEN)).toBeNull();
    });
    it("preserves 204 success in all parsing modes", async () => {
        for (const [options, expected] of [
            [{}, null],
            [{ parseAs: "text" as const }, ""],
            [{ parseResponse: false }, {}],
        ] as const) {
            respond(null, 204);
            expect(await makeDoitRequest(URL, TOKEN, options)).toEqual(expected);
        }
    });
    it("does not reinterpret HTTP-200 error envelopes", async () => {
        respond('{"error":"application-level response"}', 200);
        expect(await makeDoitRequest(URL, TOKEN)).toEqual({ error: "application-level response" });
    });
    it("reports malformed successful JSON without exposing its body", async () => {
        respond("private malformed response", 200);
        await expect(makeDoitRequest(URL, TOKEN)).rejects.toThrow(
            "HTTP 200: The API reported success, but returned an invalid JSON response."
        );
    });
    it.each([{ parseAs: "text" as const }, { parseResponse: false }])(
        "does not bypass failures in mode %j",
        async (options) => {
            respond('{"error":"Invalid filter"}');
            await expect(makeDoitRequest(URL, TOKEN, options)).rejects.toThrow("HTTP 400: Invalid filter");
        }
    );
});

it("extracts bounded Reports validation entries without serializing unknown fields", async () => {
    respond(
        JSON.stringify({
            errors: [
                { field: "config.timeRange", message: `Invalid range for ${TOKEN}`, debug: "private-data" },
                { field: "config.metrics", message: "At least one metric is required", value: "private-value" },
                { field: "private-field", message: { diagnostic: "private-diagnostic" } },
                ...Array.from({ length: 8 }, (_, i) => ({ field: "extra", message: `Extra error ${i}` })),
            ],
            data: "private-payload",
        })
    );
    const result = await makeDoitRequest(URL, TOKEN).catch((error) => handleGeneralError(error, "request"));
    expect(result.content[0].text).toContain("config.timeRange: Invalid range for [redacted]");
    expect(result.content[0].text).toContain("config.metrics: At least one metric is required");
    expect(result.content[0].text).not.toMatch(/private-|Extra error 2/);
});

it("preserves media-type guidance and does not replace short header values inside words", async () => {
    respond(JSON.stringify({ error: "invalid Content-Type, expected application/json; customer a not found" }));
    await expect(makeDoitRequest(URL, TOKEN, { customerContext: "a" })).rejects.toThrow(
        "HTTP 400: invalid Content-Type, expected application/json; customer [redacted] not found"
    );
});

it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "requires state verification after uncertain %s outcomes",
    async (method) => {
        const responses = [
            () =>
                Promise.resolve({ ok: true, status: 201, text: () => Promise.reject(new Error("private-body-error")) }),
            () => Promise.resolve(new Response("private-invalid-json", { status: 201 })),
            () => Promise.resolve(new Response(null, { status: 502 })),
            () => Promise.reject(new Error("private-transport-error")),
            () => Promise.reject(new DOMException("private-timeout", "TimeoutError")),
        ];
        for (const response of responses) {
            const fetchMock = vi.fn(response);
            vi.stubGlobal("fetch", fetchMock);
            const error = await makeDoitRequest(URL, TOKEN, { method }).catch((error) => error);
            expect(error.message).toContain("may already have been applied");
            expect(error.message).toContain("Check its state before retrying");
            expect(error.message).not.toMatch(/Try again later|private-/);
            expect(fetchMock).toHaveBeenCalledOnce();
        }
    }
);

it.each(["Idempotency-Key", "x-IDEMPOTENCY-key"])(
    "redacts short %s values without damaging validation text",
    async (name) => {
        for (const value of ["a", "in"]) {
            respond(JSON.stringify({ message: `Invalid input: missing name; operation '${value}' rejected` }));
            await expect(makeDoitRequest(URL, TOKEN, { headers: { [name]: value } })).rejects.toThrow(
                "HTTP 400: Invalid input: missing name; operation '[redacted]' rejected"
            );
        }
    }
);

it("still removes short credentials even when embedded in validation text", async () => {
    respond(JSON.stringify({ message: "Invalid value prefix-xy-suffix" }));
    await expect(makeDoitRequest(URL, TOKEN, { headers: { "X-API-Key": "xy" } })).rejects.toThrow(
        "HTTP 400: Invalid value prefix-[redacted]-suffix"
    );
});

it.each(["GET", "POST", "PUT", "PATCH", "DELETE"])("advises retrying a rejected %s rate limit", async (method) => {
    respond(null, 429);
    await expect(makeDoitRequest(URL, TOKEN, { method })).rejects.toThrow(
        "HTTP 429: Rate limit exceeded. Try again later."
    );
    expect(fetch).toHaveBeenCalledOnce();
});

it("retains normal retry advice for read-only POSTs across uncertain outcomes", async () => {
    const responses = [
        () => Promise.resolve({ ok: true, status: 200, text: () => Promise.reject(new Error("private-body-error")) }),
        () => Promise.resolve(new Response("private-invalid-json", { status: 200 })),
        () => Promise.resolve(new Response(null, { status: 502 })),
        () => Promise.reject(new Error("private-transport-error")),
        () => Promise.reject(new DOMException("private-timeout", "TimeoutError")),
    ];
    for (const response of responses) {
        vi.stubGlobal("fetch", vi.fn(response));
        const error = await makeDoitRequest(URL, TOKEN, { method: "POST", readOnly: true }).catch((error) => error);
        expect(error.message).toContain("Try again later.");
        expect(error.message).not.toMatch(/may already have been applied|Check its state|private-/);
        expect(fetch).toHaveBeenCalledOnce();
    }
});

it("logs transport, timeout, and response failures without upstream diagnostics at the default debug level", async () => {
    vi.stubEnv("DOIT_DEBUG_LEVEL", "");
    vi.resetModules();
    const util = await import("../util.js");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [response, status, kind] of [
        [() => Promise.reject(new Error(TOKEN)), null, "transport"],
        [() => Promise.reject(new DOMException(TOKEN, "TimeoutError")), null, "timeout"],
        [() => Promise.resolve(new Response(TOKEN, { status: 200 })), 200, "response"],
    ] as const) {
        vi.stubGlobal("fetch", vi.fn(response));
        await expect(util.makeDoitRequest(URL, TOKEN)).rejects.toThrow();
        expect(log).toHaveBeenLastCalledWith("DoiT API request failed", { method: "GET", status, kind });
    }
    expect(log).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
});
