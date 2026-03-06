import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Converts a Zod schema into a JSON Schema object format used for tool definition's
 * inputSchema field.
 * Mirrors the conversion the SDK's `McpServer` performs internally.
 */
export function zodToMcpInputSchema(schema: z.ZodType): Record<string, unknown> {
    return zodToJsonSchema(schema, { strictUnions: true });
}
