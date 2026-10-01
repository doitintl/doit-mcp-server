import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generatedTools } from "../../tools/generated/registry.js";
import { HAND_WRITTEN_TOOLS } from "../../tools/handWrittenTools.js";
import { zodToMcpInputSchema } from "../schemaHelpers.js";

/**
 * Conversion of every generated tool's schema happens once, at module load, when
 * src/server.ts builds its tool table. A schema zod cannot express in JSON Schema makes
 * z.toJSONSchema throw, which would take down the entire `tools/list` response rather
 * than degrading one field — so a single bad operation in a refreshed OpenAPI spec would
 * break all ~230 tools at once. These tests are the cheap guard against that.
 */
describe("zodToMcpInputSchema over the real tool set", () => {
    it("converts every generated tool schema without throwing", () => {
        const failures: string[] = [];
        for (const tool of generatedTools) {
            try {
                zodToMcpInputSchema(tool.zodSchema);
            } catch (error) {
                failures.push(`${tool.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        expect(failures).toEqual([]);
    });

    it("produces a usable object schema for every generated tool", () => {
        for (const tool of generatedTools) {
            const schema = zodToMcpInputSchema(tool.zodSchema);
            expect(schema.type, `${tool.name} must advertise an object schema`).toBe("object");
        }
    });

    it("every advertised hand-written tool schema is an object schema", () => {
        for (const tool of HAND_WRITTEN_TOOLS as Array<{ name: string; inputSchema?: Record<string, unknown> }>) {
            expect(tool.inputSchema, `${tool.name} must have an inputSchema`).toBeDefined();
            expect(tool.inputSchema?.type, `${tool.name} must advertise an object schema`).toBe("object");
        }
    });
});

describe("zodToMcpInputSchema output shape", () => {
    it("closes plain objects so clients cannot invent arguments", () => {
        const schema = zodToMcpInputSchema(z.object({ id: z.string() }));

        expect(schema.additionalProperties).toBe(false);
    });

    it("leaves records open — their additionalProperties is a value schema, not false", () => {
        const schema = zodToMcpInputSchema(z.object({ tags: z.record(z.string(), z.string()) })) as any;

        // The wrapper object is closed, but the record inside keeps zod's value schema.
        expect(schema.additionalProperties).toBe(false);
        expect(schema.properties.tags.additionalProperties).toEqual({ type: "string" });
    });

    it("closes nested objects too", () => {
        const schema = zodToMcpInputSchema(z.object({ nested: z.object({ a: z.string() }) })) as any;

        expect(schema.properties.nested.additionalProperties).toBe(false);
    });

    it("advertises the draft the MCP spec expects", () => {
        const schema = zodToMcpInputSchema(z.object({ id: z.string() }));

        expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    });

    it("describes the input side of a transform, not the transformed output", () => {
        // Tool arguments are parsed, so the client must be shown what it may send.
        const schema = zodToMcpInputSchema(z.object({ n: z.string().transform((v) => v.length) })) as any;

        expect(schema.properties.n.type).toBe("string");
    });
});
