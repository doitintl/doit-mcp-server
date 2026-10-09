import { z } from "zod";

/** Description of the transport-level override; it is not part of API business payloads. */
export const CUSTOMER_CONTEXT_DESCRIPTION =
    "DoiT Console customer ID to scope API calls to a specific customer. Overrides the CUSTOMER_CONTEXT environment variable when provided.";

/**
 * Converts a Zod schema into a JSON Schema object format used for tool definition's
 * inputSchema field.
 *
 * Uses zod 4's native conversion. The predecessor, the `zod-to-json-schema` package, is
 * zod-3 only and has no v4 successor; zod 4 absorbed the capability as `z.toJSONSchema`.
 *
 * - `io: "input"` — tool arguments are parsed, so clients must be shown the pre-transform
 *   shape, not the post-transform one.
 * - `target: "draft-2020-12"` — the dialect MCP advertises.
 * - `unrepresentable: "any"` — zod 4 *throws* by default on types it cannot express in
 *   JSON Schema. A single unrepresentable field would otherwise take down the whole
 *   `tools/list` response rather than degrading that one field to `{}`.
 */
export function zodToMcpInputSchema(schema: z.ZodType): Record<string, unknown> {
    const jsonSchema = z.toJSONSchema(schema, {
        io: "input",
        target: "draft-2020-12",
        unrepresentable: "any",
    });
    // Context is consumed outside the business-argument parser. Add it only at the
    // root so handlers that spread parsed arguments cannot leak it into API bodies.
    // Preserve tools such as change_customer that define their own context semantics.
    if (jsonSchema.properties && !("customerContext" in jsonSchema.properties)) {
        jsonSchema.properties.customerContext = {
            type: "string",
            description: CUSTOMER_CONTEXT_DESCRIPTION,
        };
    }
    return closeOpenObjects(jsonSchema) as Record<string, unknown>;
}

/**
 * Restores `additionalProperties: false` on object subschemas that declare `properties`.
 *
 * `zod-to-json-schema` stamped this on every `z.object()`; zod 4 omits it, on the
 * reasoning that `z.object()` *strips* unknown keys rather than rejecting them, so
 * nothing is actually forbidden. That reasoning is sound but the omission is
 * wire-visible: it loosens the contract ~200 tools have always advertised, and strict
 * function-calling modes (notably OpenAI's, which this repo targets via the
 * `openai/toolInvocation/*` tool `_meta`) require `additionalProperties: false` to
 * keep models from inventing arguments.
 *
 * Records are left alone: `z.record()` emits `additionalProperties` as a *schema
 * object*, so the "key is absent" test never matches one.
 */
function closeOpenObjects(node: unknown): unknown {
    if (Array.isArray(node)) {
        return node.map(closeOpenObjects);
    }
    if (node === null || typeof node !== "object") {
        return node;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        result[key] = closeOpenObjects(value);
    }

    if (result.type === "object" && "properties" in result && !("additionalProperties" in result)) {
        result.additionalProperties = false;
    }
    return result;
}
