import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Canonical description for the customerContext parameter across all tools.
 */
export const CUSTOMER_CONTEXT_DESCRIPTION =
    "DoiT Console customer ID to scope API calls to a specific customer. Overrides the CUSTOMER_CONTEXT environment variable when provided.";

/**
 * Inline JSON schema property for tools using hand-written inputSchema objects.
 * Usage: spread into inputSchema.properties: { ...customerContextProperty }
 */
export const customerContextProperty = {
    customerContext: {
        type: "string" as const,
        description: CUSTOMER_CONTEXT_DESCRIPTION,
    },
};

/**
 * Converts a Zod schema into a JSON Schema object format used for tool definition's
 * inputSchema field, and injects customerContext as an optional string property.
 *
 * customerContext is added to the JSON Schema output only (not to the Zod parsing schema)
 * so it appears in the MCP tool schema for client discovery without contaminating
 * Zod-parsed objects that handlers may spread into API request bodies.
 */
export function zodToMcpInputSchema(schema: z.ZodType): Record<string, unknown> {
    const jsonSchema = zodToJsonSchema(schema, { strictUnions: true }) as Record<string, any>;
    if (jsonSchema.properties && typeof jsonSchema.properties === "object" && !jsonSchema.properties.customerContext) {
        jsonSchema.properties.customerContext = {
            type: "string",
            description: CUSTOMER_CONTEXT_DESCRIPTION,
        };
    }
    return jsonSchema;
}
