import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { DOIT_API_BASE } from "../../../src/utils/util.js";
import { createTestClient, getTextContent } from "../helpers.js";
import { mswServer } from "../setup.js";
import { createModernTestClient } from "./modern/helpers.js";

describe.each([
    ["legacy", createTestClient],
    ["modern", createModernTestClient],
] as const)("DataHub export over %s MCP tools/call", (_era, connect) => {
    it("returns the HTTP cursor and uses it for the next page", async () => {
        const received: Array<string | null> = [];
        mswServer.use(
            http.get(`${DOIT_API_BASE}/datahub/v1/datasets/:name/records`, ({ request, params }) => {
                expect(params.name).toBe("Test dataset");
                const url = new URL(request.url);
                expect(url.searchParams.get("maxResults")).toBe("1");
                const token = url.searchParams.get("pageToken");
                received.push(token);
                return token === null
                    ? HttpResponse.text("id\nfirst\n", { headers: { "X-Next-Page-Token": "opaque+/=" } })
                    : HttpResponse.text("id\nlast\n");
            })
        );
        const { rawClient, cleanup } = await connect();
        try {
            const argumentsBase = {
                name: "Test dataset",
                startTime: "2026-09-01T00:00:00Z",
                endTime: "2026-10-01T00:00:00Z",
                maxResults: 1,
            };
            const first = await rawClient.callTool({
                name: "export_datahub_dataset_records",
                arguments: argumentsBase,
            });
            expect(first.isError).not.toBe(true);
            const page = JSON.parse(getTextContent(first));
            expect(page).toEqual({ data: "id\nfirst\n", pageToken: "opaque+/=" });
            const last = await rawClient.callTool({
                name: "export_datahub_dataset_records",
                arguments: { ...argumentsBase, pageToken: page.pageToken },
            });
            expect(JSON.parse(getTextContent(last))).toEqual({ data: "id\nlast\n", pageToken: null });
            expect(received).toEqual([null, "opaque+/="]);
        } finally {
            await cleanup();
        }
    });
});
