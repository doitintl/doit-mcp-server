import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodToMcpInputSchema } from "../schemaHelpers.js";

/**
 * Helper that extracts the structural fields we care about from a JSON Schema
 * property entry: type, enum, description, and for nested objects: properties + required.
 */
function pickStructural(prop: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    if (prop.type !== undefined) out.type = prop.type;
    if (prop.enum !== undefined) out.enum = prop.enum;
    if (prop.description !== undefined) out.description = prop.description;
    if (prop.properties !== undefined) out.properties = prop.properties;
    if (prop.required !== undefined) out.required = prop.required;
    if (prop.items !== undefined) out.items = prop.items;
    return out;
}

/**
 * Asserts that the result of zodToMcpInputSchema structurally matches the
 * hand-written inputSchema: same type, same property keys with matching
 * type/enum/description, and same required array.
 */
function expectSchemaMatch(result: Record<string, unknown>, expected: Record<string, any>) {
    expect(result.type).toBe(expected.type);

    const resultProps = (result.properties ?? {}) as Record<string, any>;
    const expectedProps = (expected.properties ?? {}) as Record<string, any>;
    expect(Object.keys(resultProps).sort()).toEqual(Object.keys(expectedProps).sort());

    for (const key of Object.keys(expectedProps)) {
        const rp = pickStructural(resultProps[key]);
        const ep = pickStructural(expectedProps[key]);
        expect(rp).toEqual(ep);
    }

    if (expected.required) {
        expect((result.required as string[]).sort()).toEqual([...expected.required].sort());
    }
}

describe("zodToMcpInputSchema", () => {
    it("returns a JSON Schema object with type property", () => {
        const schema = z.object({});
        const result = zodToMcpInputSchema(schema);
        expect(result.type).toBe("object");
    });

    describe("empty z.object({})", () => {
        // Fixture from platforms.ts: ListPlatformsArgumentsSchema
        const zodSchema = z.object({});
        const expectedInputSchema = {
            type: "object",
            properties: {},
        };

        it("matches platforms listPlatformsTool inputSchema", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expectSchemaMatch(result, expectedInputSchema);
        });
    });

    describe("single optional string field with .describe()", () => {
        // Fixture from anomalies.ts: AnomaliesArgumentsSchema
        const zodSchema = z.object({
            pageToken: z
                .string()
                .optional()
                .describe("Token for pagination. Use this to get the next page of results."),
        });
        const expectedInputSchema = {
            type: "object",
            properties: {
                pageToken: {
                    type: "string",
                    description: "Token for pagination. Use this to get the next page of results.",
                },
            },
        };

        it("matches anomalies anomaliesTool inputSchema", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expectSchemaMatch(result, expectedInputSchema);
        });

        it("does not include pageToken in required", () => {
            const result = zodToMcpInputSchema(zodSchema);
            const required = result.required as string[] | undefined;
            expect(required ?? []).not.toContain("pageToken");
        });
    });

    describe("single required string field without .describe()", () => {
        // Fixture from anomalies.ts: AnomalyArgumentsSchema
        const zodSchema = z.object({
            id: z.string(),
        });
        const expectedInputSchema = {
            type: "object",
            properties: {
                id: {
                    type: "string",
                },
            },
            required: ["id"],
        };

        it("matches anomaly anomalyTool inputSchema structure", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expectSchemaMatch(result, expectedInputSchema);
        });
    });

    describe("single required string field with .describe()", () => {
        // Fixture from alerts.ts: GetAlertArgumentsSchema
        const zodSchema = z.object({
            id: z.string().describe("The ID of the alert to retrieve."),
        });
        const expectedInputSchema = {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "The ID of the alert to retrieve.",
                },
            },
            required: ["id"],
        };

        it("matches alerts getAlertTool inputSchema", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expectSchemaMatch(result, expectedInputSchema);
        });
    });

    describe("required string field with .describe() — changeCustomer", () => {
        // Fixture from changeCustomer.ts: ChangeCustomerArgumentsSchema
        const zodSchema = z.object({
            customerContext: z.string().describe("The new customer context to set"),
        });
        const expectedInputSchema = {
            type: "object",
            properties: {
                customerContext: {
                    type: "string",
                    description: "The new customer context to set",
                },
            },
            required: ["customerContext"],
        };

        it("matches changeCustomer changeCustomerTool inputSchema", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expectSchemaMatch(result, expectedInputSchema);
        });
    });

    describe("multiple optional fields with enums", () => {
        // Fixture from alerts.ts: ListAlertsArgumentsSchema
        const SORT_BY = ["name", "createTime", "updateTime", "lastAlerted"] as const;
        const SORT_ORDER = ["asc", "desc"] as const;

        const zodSchema = z.object({
            sortBy: z.enum(SORT_BY).optional().describe("A field by which the results will be sorted."),
            sortOrder: z.enum(SORT_ORDER).optional().describe("Sort order: ascending or descending."),
            maxResults: z.string().optional().describe("Maximum number of results to return in a single page."),
            pageToken: z
                .string()
                .optional()
                .describe("Page token returned by a previous call to request the next page of results."),
            filter: z
                .string()
                .optional()
                .describe(
                    "Expression for filtering results. Syntax: key:[<value>]. Multiple filters can be joined with |. Available filter keys: owner, name."
                ),
        });

        const expectedInputSchema = {
            type: "object",
            properties: {
                sortBy: {
                    type: "string",
                    enum: [...SORT_BY],
                    description: "A field by which the results will be sorted.",
                },
                sortOrder: {
                    type: "string",
                    enum: [...SORT_ORDER],
                    description: "Sort order: ascending or descending.",
                },
                maxResults: {
                    type: "string",
                    description: "Maximum number of results to return in a single page.",
                },
                pageToken: {
                    type: "string",
                    description: "Page token returned by a previous call to request the next page of results.",
                },
                filter: {
                    type: "string",
                    description:
                        "Expression for filtering results. Syntax: key:[<value>]. Multiple filters can be joined with |. Available filter keys: owner, name.",
                },
            },
        };

        it("matches alerts listAlertsTool inputSchema", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expectSchemaMatch(result, expectedInputSchema);
        });

        it("has no required fields", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expect(result.required).toBeUndefined();
        });
    });

    describe("enum + required fields", () => {
        // Fixture from dimension.ts: DimensionArgumentsSchema
        const DIMENSION_TYPES = [
            "datetime",
            "fixed",
            "optional",
            "label",
            "tag",
            "project_label",
            "system_label",
            "attribution",
            "attribution_group",
            "gke",
            "gke_label",
            "organization_tag",
        ] as const;

        const zodSchema = z.object({
            type: z.enum(DIMENSION_TYPES).describe("Dimension type"),
            id: z.string().describe("Dimension id"),
        });

        const expectedInputSchema = {
            type: "object",
            properties: {
                type: {
                    type: "string",
                    enum: [...DIMENSION_TYPES],
                    description: "Dimension type",
                },
                id: {
                    type: "string",
                    description: "Dimension id",
                },
            },
            required: ["type", "id"],
        };

        it("matches dimension dimensionTool inputSchema", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expectSchemaMatch(result, expectedInputSchema);
        });

        it("includes both type and id in required", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expect((result.required as string[]).sort()).toEqual(["id", "type"]);
        });
    });

    describe("nested z.record() object field", () => {
        // Fixture from cloudflow.ts: TriggerCloudFlowArgumentsSchema
        const zodSchema = z.object({
            flowID: z.string().describe("The ID of the CloudFlow flow to trigger"),
            requestBodyJson: z
                .record(z.unknown())
                .optional()
                .describe("Optional JSON object to pass as the request body to the flow if the flow requires it"),
        });

        it("produces an object type with flowID and requestBodyJson properties", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expect(result.type).toBe("object");
            const props = result.properties as Record<string, any>;
            expect(props.flowID.type).toBe("string");
            expect(props.flowID.description).toBe("The ID of the CloudFlow flow to trigger");
            expect(props.requestBodyJson.type).toBe("object");
            expect(props.requestBodyJson.description).toBe(
                "Optional JSON object to pass as the request body to the flow if the flow requires it"
            );
        });

        it("marks only flowID as required", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expect(result.required).toEqual(["flowID"]);
        });
    });

    describe("nested object with required array and enums", () => {
        // Fixture from tickets.ts: CreateTicketArgumentsSchema
        const zodSchema = z.object({
            ticket: z.object({
                body: z.string(),
                created: z.string(),
                platform: z.enum(["doit", "google_cloud_platform", "amazon_web_services", "microsoft_azure"]),
                product: z.string(),
                severity: z.enum(["low", "normal", "high", "urgent"]),
                subject: z.string(),
            }),
        });

        it("produces correct top-level structure", () => {
            const result = zodToMcpInputSchema(zodSchema);
            expect(result.type).toBe("object");
            expect(result.required).toEqual(["ticket"]);
        });

        it("produces correct nested ticket object properties", () => {
            const result = zodToMcpInputSchema(zodSchema);
            const ticketProp = (result.properties as Record<string, any>).ticket;
            expect(ticketProp.type).toBe("object");

            const nestedProps = ticketProp.properties;
            expect(nestedProps.body.type).toBe("string");
            expect(nestedProps.created.type).toBe("string");
            expect(nestedProps.platform.type).toBe("string");
            expect(nestedProps.platform.enum).toEqual([
                "doit",
                "google_cloud_platform",
                "amazon_web_services",
                "microsoft_azure",
            ]);
            expect(nestedProps.severity.type).toBe("string");
            expect(nestedProps.severity.enum).toEqual(["low", "normal", "high", "urgent"]);
            expect(nestedProps.subject.type).toBe("string");
            expect(nestedProps.product.type).toBe("string");
        });

        it("includes all nested fields in ticket required array", () => {
            const result = zodToMcpInputSchema(zodSchema);
            const ticketProp = (result.properties as Record<string, any>).ticket;
            expect((ticketProp.required as string[]).sort()).toEqual(
                ["body", "created", "platform", "product", "severity", "subject"].sort()
            );
        });
    });
});
