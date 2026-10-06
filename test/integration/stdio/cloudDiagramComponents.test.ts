import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOIT_API_BASE } from "../../../src/utils/util.js";
import { createTestClient, getTextContent } from "../helpers.js";
import { mswServer } from "../setup.js";
import { createModernTestClient } from "./modern/helpers.js";

afterEach(() => vi.unstubAllEnvs());

describe.each([
    ["legacy", createTestClient],
    ["modern", createModernTestClient],
] as const)("Diagram component access over %s MCP tools/call", (_era, connect) => {
    it.each([
        { scheme_ids: ["foreign-diagram"] },
        { layer_ids: ["foreign-layer"], include_components: true },
        { scheme_ids: ["owned-diagram", "foreign-diagram"], layer_ids: ["owned-layer"] },
        { layer_ids: ["owned-layer", "foreign-layer"], include_components: true },
    ])("rejects inaccessible selectors before targeted reads: %j", async (selectors) => {
        vi.stubEnv("CUSTOMER_CONTEXT", "authenticated-customer");
        const bodies: unknown[] = [];
        mswServer.use(
            http.post(`${DOIT_API_BASE}/clouddiagrams/v1/scheme/get`, async ({ request }) => {
                expect(request.headers.get("X-Tenant-Id")).toBe("authenticated-customer");
                expect(new URL(request.url).searchParams.get("customerContext")).toBe("authenticated-customer");
                const body = await request.json();
                bodies.push(body);
                // A vulnerable targeted read would return foreign data. Discovery is scoped.
                return HttpResponse.json(
                    Object.keys(body as object).length
                        ? { scheme: { "foreign-diagram": { _id: "foreign-diagram", name: "Foreign metadata" } } }
                        : {
                              scheme: {
                                  "owned-diagram": { _id: "owned-diagram", statussheet: [{ _id: "owned-layer" }] },
                              },
                          }
                );
            })
        );
        const { rawClient, cleanup } = await connect();
        try {
            const result = await rawClient.callTool({ name: "get_cloud_diagram_components", arguments: selectors });
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("not accessible");
            expect(getTextContent(result)).not.toContain("Foreign metadata");
            expect(bodies).toEqual([{}]);
        } finally {
            await cleanup();
        }
    });

    it("loads an owned layer after scoped discovery using the same customer context", async () => {
        vi.stubEnv("CUSTOMER_CONTEXT", "authenticated-customer");
        const calls: Array<{ body: unknown; components: string | null }> = [];
        const components = {
            statussheet: { "owned-layer": { statussheet: { _id: "owned-layer" }, node: { n: { _id: "n" } } } },
        };
        mswServer.use(
            http.post(`${DOIT_API_BASE}/clouddiagrams/v1/scheme/get`, async ({ request }) => {
                expect(request.headers.get("X-Tenant-Id")).toBe("authenticated-customer");
                const url = new URL(request.url);
                expect(url.searchParams.get("customerContext")).toBe("authenticated-customer");
                const body = await request.json();
                calls.push({ body, components: url.searchParams.get("components") });
                return HttpResponse.json(
                    Object.keys(body as object).length
                        ? components
                        : {
                              scheme: {
                                  "owned-diagram": { _id: "owned-diagram", statussheet: [{ _id: "owned-layer" }] },
                              },
                          }
                );
            })
        );
        const { rawClient, cleanup } = await connect();
        try {
            const result = await rawClient.callTool({
                name: "get_cloud_diagram_components",
                arguments: { layer_ids: ["owned-layer"], include_components: true },
            });
            expect(result.isError).not.toBe(true);
            expect(JSON.parse(getTextContent(result))).toEqual(components);
            expect(calls).toEqual([
                { body: {}, components: "false" },
                { body: { statussheet: ["owned-layer"] }, components: "true" },
            ]);
        } finally {
            await cleanup();
        }
    });

    it("refuses automatic expansion beyond five layers without reading components", async () => {
        const componentFlags: Array<string | null> = [];
        mswServer.use(
            http.post(`${DOIT_API_BASE}/clouddiagrams/v1/scheme/get`, ({ request }) => {
                componentFlags.push(new URL(request.url).searchParams.get("components"));
                return HttpResponse.json({
                    scheme: {
                        a: { _id: "a", statussheet: Array.from({ length: 6 }, (_, i) => ({ _id: `layer-${i}` })) },
                    },
                });
            })
        );
        const { rawClient, cleanup } = await connect();
        try {
            const result = await rawClient.callTool({
                name: "get_cloud_diagram_components",
                arguments: { include_components: true },
            });
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("at most 5 layer_ids");
            expect(componentFlags).toEqual(["false"]);
        } finally {
            await cleanup();
        }
    });
});
