import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it, vi } from "vitest";
import { COVERED_ENDPOINTS } from "../../handWrittenTools.js";
import { generateTools } from "../generateTools.js";
import { loadGeneratedToolsSpec } from "../loadSpec.js";

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

    it("skips operations covered by a hand-written tool even when path param casing differs", () => {
        const document = buildDocument({
            paths: {
                "/core/v1/cloudconnect/aws/accounts/{accountID}": {
                    get: { operationId: "getAwsAccount" },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        expect(generateTools(document, new Set(["get:/core/v1/cloudconnect/aws/accounts/{accountid}"]))).toHaveLength(
            0
        );
    });

    it("collects header parameters into the schema and metadata", () => {
        const document = buildDocument({
            paths: {
                "/iam/v1/users/{id}/actions/resend": {
                    post: {
                        operationId: "resendUserInvite",
                        parameters: [
                            {
                                name: "id",
                                in: "path",
                                required: true,
                                schema: { type: "string" },
                            },
                            {
                                name: "Idempotency-Key",
                                in: "header",
                                required: true,
                                schema: { type: "string" },
                            },
                        ],
                    },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        const [tool] = generateTools(document, new Set());
        expect(tool.metadata.headerParams).toEqual(["Idempotency-Key"]);
        expect(tool.zodSchema.shape["Idempotency-Key"]).toBeDefined();
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
        expect(tool.metadata.contentType).toBeUndefined();
        expect(tool.metadata.multipartFileFields).toEqual(["file"]);
    });

    it("picks up path-level parameters shared by every operation under the path", () => {
        const document = buildDocument({
            paths: {
                "/core/v1/cloudconnect/aws/accounts/{accountID}": {
                    parameters: [
                        {
                            name: "accountID",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    delete: { operationId: "deleteAccountRole" },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        const [tool] = generateTools(document, new Set());
        expect(tool.metadata.pathParams).toEqual(["accountID"]);
        expect(tool.zodSchema.shape.accountID).toBeDefined();
    });

    it("lets an operation-level parameter override a path-level one with the same name and location", () => {
        const document = buildDocument({
            paths: {
                "/widgets/{id}": {
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    get: {
                        operationId: "getWidget",
                        parameters: [
                            {
                                name: "id",
                                in: "path",
                                required: true,
                                schema: { type: "number" },
                            },
                        ],
                    },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        const [tool] = generateTools(document, new Set());
        expect(tool.metadata.pathParams).toEqual(["id"]);
        expect(tool.zodSchema.shape.id.safeParse(1).success).toBe(true);
        expect(tool.zodSchema.shape.id.safeParse("one").success).toBe(false);
    });

    it("skips the operation when a URL placeholder has no declared path parameter, leaving other tools intact", () => {
        const warn = vi.spyOn(console, "error").mockImplementation(() => {});
        const document = buildDocument({
            paths: {
                "/widgets/{id}": {
                    get: { operationId: "getWidget" },
                },
                "/gadgets": {
                    get: { operationId: "listGadgets" },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        const tools = generateTools(document, new Set());
        expect(tools.map((tool) => tool.name)).toEqual(["list_gadgets"]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("no declared path parameter: id"));
        warn.mockRestore();
    });

    it("treats application/*+json request bodies as JSON and preserves the declared content type", () => {
        const document = buildDocument({
            paths: {
                "/customers/v1/customers": {
                    patch: {
                        operationId: "updateCustomer",
                        requestBody: {
                            content: {
                                "application/merge-patch+json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            currency: { type: "string" },
                                            urlSlug: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            } as unknown as OpenAPIV3.Document["paths"],
        });

        const [tool] = generateTools(document, new Set());
        expect(tool.metadata.bodyEncoding).toBe("json");
        expect(tool.metadata.contentType).toBe("application/merge-patch+json");
        expect(tool.zodSchema.shape.currency).toBeDefined();
        expect(tool.zodSchema.shape.urlSlug).toBeDefined();
    });

    it("skips nothing in the bundled spec — every templated path declares its placeholders", () => {
        const warn = vi.spyOn(console, "error").mockImplementation(() => {});

        generateTools(loadGeneratedToolsSpec(), COVERED_ENDPOINTS);

        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
