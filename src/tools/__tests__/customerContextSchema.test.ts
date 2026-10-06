import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CUSTOMER_CONTEXT_DESCRIPTION, zodToMcpInputSchema } from "../../utils/schemaHelpers.js";
import { ChangeCustomerArgumentsSchema, changeCustomerTool } from "../changeCustomer.js";
import { HAND_WRITTEN_TOOLS } from "../handWrittenTools.js";

// Cover the current registry rather than the 36 tools present when this PR began.
const scopedTools = HAND_WRITTEN_TOOLS.filter((tool) => tool.name !== "change_customer");

describe("customerContext schema coverage", () => {
    it.each(scopedTools.map((tool) => ({ name: tool.name, tool })))(
        "$name exposes an optional transport-level customer context",
        ({ tool }) => {
            const schema = tool.inputSchema as any;
            expect(schema.properties.customerContext).toEqual({
                type: "string",
                description: CUSTOMER_CONTEXT_DESCRIPTION,
            });
            expect(schema.required ?? []).not.toContain("customerContext");
        }
    );

    it("preserves change_customer's own context description and requiredness", () => {
        const schema = changeCustomerTool.inputSchema as any;
        const declared = z.toJSONSchema(ChangeCustomerArgumentsSchema, { io: "input" }) as any;
        expect(schema.properties.customerContext).toEqual(declared.properties.customerContext);
        expect(schema.required).toEqual(declared.required);
    });

    it("does not add context to nested business objects or their parsed payloads", () => {
        const argumentsSchema = z.object({ config: z.object({ name: z.string() }) });
        const schema = zodToMcpInputSchema(argumentsSchema) as any;
        expect(schema.properties.config.properties).not.toHaveProperty("customerContext");
        expect(argumentsSchema.parse({ config: { name: "test" }, customerContext: "selected" })).toEqual({
            config: { name: "test" },
        });
    });
});
