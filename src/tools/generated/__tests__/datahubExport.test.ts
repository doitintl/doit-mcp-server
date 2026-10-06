import { afterEach, describe, expect, it, vi } from "vitest";
import { executeToolHandler } from "../../../utils/toolsHandler.js";
import { COVERED_ENDPOINTS } from "../../handWrittenTools.js";
import { handleGeneratedOperationRequest } from "../callOperation.js";
import { generateTools } from "../generateTools.js";
import { loadGeneratedToolsSpec } from "../loadSpec.js";

const tools = generateTools(loadGeneratedToolsSpec(), COVERED_ENDPOINTS);
const registry = new Map(tools.map((tool) => [tool.name, tool]));
const exportTool = registry.get("export_datahub_dataset_records");
if (!exportTool) throw new Error("Missing export tool");
const args = { name: "A dataset", startTime: "2026-09-01T00:00:00Z", endTime: "2026-10-01T00:00:00Z", maxResults: 1 };

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("generated DataHub export response headers", () => {
    it.each([
        ["csv", "id,value\nfirst,1\n", "id,value\nsecond,2\n"],
        ["jsonl", '{"id":"first"}\n', '{"id":"second"}\n'],
    ])(
        "advances %s pages through the shared hosted dispatcher and preserves the raw body",
        async (format, first, last) => {
            vi.stubEnv("CUSTOMER_CONTEXT", "environment-customer");
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce(new Response(first, { headers: { "x-next-page-token": "cursor+/=&" } }))
                .mockResolvedValueOnce(new Response(last));
            vi.stubGlobal("fetch", fetchMock);
            const convertResponse = vi.fn((result) => result);
            const options = { generatedTools: registry, convertResponse };
            const result = await executeToolHandler(
                exportTool.name,
                { ...args, format, customerContext: "selected-customer" },
                "test-key",
                options
            );
            const page = JSON.parse(result.content[0].text);
            expect(page).toEqual({ data: first, pageToken: "cursor+/=&" });
            const final = await executeToolHandler(
                exportTool.name,
                { ...args, format, pageToken: page.pageToken, customerContext: "selected-customer" },
                "test-key",
                options
            );
            expect(JSON.parse(final.content[0].text)).toEqual({ data: last, pageToken: null });
            expect(convertResponse).toHaveBeenCalledTimes(2);
            const [url, init] = fetchMock.mock.calls[1];
            const params = new URL(url).searchParams;
            expect(params.get("pageToken")).toBe("cursor+/=&");
            expect(params.get("customerContext")).toBe("selected-customer");
            expect(init.headers["X-Tenant-Id"]).toBe("selected-customer");
            expect(params.get("maxResults")).toBe("1");
        }
    );

    it.each([undefined, ""])("returns a final-page null cursor for header %j and an empty body", async (token) => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(
                    new Response("", { headers: token === undefined ? {} : { "X-Next-Page-Token": token } })
                )
        );
        const result = await handleGeneratedOperationRequest(exportTool, args, "test-key");
        expect(JSON.parse(result.content[0].text)).toEqual({ data: "", pageToken: null });
    });

    it("uses environment customer context when no selected customer is supplied", async () => {
        vi.stubEnv("CUSTOMER_CONTEXT", "environment-customer");
        const fetchMock = vi.fn().mockResolvedValue(new Response("data"));
        vi.stubGlobal("fetch", fetchMock);
        await handleGeneratedOperationRequest(exportTool, args, "test-key");
        const [url, init] = fetchMock.mock.calls[0];
        expect(new URL(url).searchParams.get("customerContext")).toBe("environment-customer");
        expect(init.headers["X-Tenant-Id"]).toBe("environment-customer");
    });

    it("does not wrap unrelated generated tools even if the API returns the same header", async () => {
        const tool = registry.get("get_cloudflow_flow_run");
        if (!tool) throw new Error("Missing control tool");
        expect(tools.filter((item) => item.metadata.responsePageTokenHeader).map((item) => item.name)).toEqual([
            exportTool.name,
        ]);
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValue(
                    new Response('{"state":"completed"}', { headers: { "X-Next-Page-Token": "ignored" } })
                )
        );
        const result = await handleGeneratedOperationRequest(tool, { flowId: "flow", runId: "run" }, "test-key");
        expect(result.content[0].text).toBe('{"state":"completed"}');
        expect(exportTool.description).toContain("JSON envelope");
        expect(exportTool.description).not.toContain("This endpoint is paginated: a response");
    });
});
