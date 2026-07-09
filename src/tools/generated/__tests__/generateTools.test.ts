import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";
import { generateTools } from "../generateTools.js";

function buildDocument(overrides: Partial<OpenAPIV3.Document> = {}): OpenAPIV3.Document {
    return {
        openapi: "3.0.1",
        info: { title: "test", version: "1.0.0" },
        paths: {},
        ...overrides,
    } as unknown as OpenAPIV3.Document;
}

describe("generateTools", () => {
    it("skips operations already covered by a hand-written tool", () => {
        const document = buildDocument({
            paths: {
                "/analytics/v1/alerts": {
                    get: { operationId: "listAlerts" },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        expect(generateTools(document, new Set(["get:/analytics/v1/alerts"]))).toHaveLength(0);
    });

    it("generates a snake_case tool name from operationId with path/query params", () => {
        const document = buildDocument({
            tags: [{ name: "Widgets", description: "Widget operations." }],
            paths: {
                "/widgets/{id}": {
                    get: {
                        operationId: "getWidget",
                        summary: "Get a widget",
                        tags: ["Widgets"],
                        parameters: [
                            {
                                name: "id",
                                in: "path",
                                required: true,
                                schema: { type: "string" },
                            },
                            {
                                name: "pageToken",
                                in: "query",
                                required: false,
                                schema: { type: "string" },
                            },
                        ],
                    },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        const tools = generateTools(document, new Set());
        expect(tools).toHaveLength(1);
        const [tool] = tools;
        expect(tool.name).toBe("get_widget");
        expect(tool.description).toContain("Widget operations.");
        expect(tool.description).toContain("paginated");
        expect(tool.metadata.pathParams).toEqual(["id"]);
        expect(tool.metadata.queryParams).toEqual(["pageToken", "customerContext"]);
        expect(tool.annotations.readOnlyHint).toBe(true);
        expect(tool.annotations.destructiveHint).toBe(false);
        expect(tool.zodSchema.shape.id).toBeDefined();
        expect(tool.zodSchema.shape.pageToken).toBeDefined();
        expect(tool.zodSchema.shape.customerContext).toBeDefined();
    });

    it("derives a fallback name and marks non-GET methods as destructive", () => {
        const document = buildDocument({
            paths: {
                "/widgets": {
                    post: {
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: { name: { type: "string" } },
                                        required: ["name"],
                                    },
                                },
                            },
                        },
                    },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        const tools = generateTools(document, new Set());
        expect(tools).toHaveLength(1);
        const [tool] = tools;
        expect(tool.name).toBe("post_widgets");
        expect(tool.annotations.readOnlyHint).toBe(false);
        expect(tool.annotations.destructiveHint).toBe(true);
        expect(tool.securitySchemes[0].scopes).toEqual(["read_data", "write_data"]);
        expect(tool.zodSchema.shape.name).toBeDefined();
    });

    it("detects multipart binary fields", () => {
        const document = buildDocument({
            paths: {
                "/uploads": {
                    post: {
                        operationId: "uploadFile",
                        requestBody: {
                            content: {
                                "multipart/form-data": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            file: { type: "string", format: "binary" },
                                            name: { type: "string" },
                                        },
                                        required: ["file"],
                                    },
                                },
                            },
                        },
                    },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        const [tool] = generateTools(document, new Set());
        expect(tool.metadata.bodyEncoding).toBe("multipart");
        expect(tool.metadata.multipartFileFields).toEqual(["file"]);
    });
});
