import { describe, expect, it } from "vitest";
import { RESULT_PAGE_TOKEN_DESCRIPTION } from "../../utils/resultPaging.js";
import { generatedTools } from "../generated/registry.js";
import { HAND_WRITTEN_TOOLS, RESULT_PAGED_TOOLS } from "../handWrittenTools.js";

const properties = (tool: { inputSchema?: Record<string, unknown> } | undefined) =>
    (tool?.inputSchema as { properties?: Record<string, { description?: string }> } | undefined)?.properties;
const handWritten = (name: string) => {
    const tool = HAND_WRITTEN_TOOLS.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`missing hand-written tool ${name}`);
    return tool;
};

describe("result-paged tools", () => {
    it("every read-only hand-written tool with an object schema accepts pageToken", () => {
        for (const tool of HAND_WRITTEN_TOOLS) {
            const props = properties(tool);
            if (tool.annotations?.readOnlyHint !== true || !props) continue;
            expect(props.pageToken, tool.name).toBeDefined();
        }
    });

    it("marks only the tools whose pageToken is the server's, not the API's", () => {
        expect(RESULT_PAGED_TOOLS.has("list_users")).toBe(true);
        expect(RESULT_PAGED_TOOLS.has("get_cloud_diagrams_stats")).toBe(true);
        expect(RESULT_PAGED_TOOLS.has("get_cloud_diagram_components")).toBe(true);
        expect(RESULT_PAGED_TOOLS.has("list_tickets")).toBe(false);
        expect(RESULT_PAGED_TOOLS.has("list_reports")).toBe(false);
        expect(RESULT_PAGED_TOOLS.has("create_ticket")).toBe(false);
        for (const name of RESULT_PAGED_TOOLS) {
            expect(properties(handWritten(name))?.pageToken?.description, name).toBe(RESULT_PAGE_TOKEN_DESCRIPTION);
        }
    });

    it("leaves write tools and the API's own pageToken descriptions untouched", () => {
        expect(properties(handWritten("create_ticket"))).not.toHaveProperty("pageToken");
        expect(properties(handWritten("list_tickets"))?.pageToken?.description).not.toBe(RESULT_PAGE_TOKEN_DESCRIPTION);
    });

    it("every read-only generated tool accepts pageToken, flagged when the endpoint has none", () => {
        for (const tool of generatedTools) {
            if (!tool.annotations.readOnlyHint) {
                expect(tool.metadata.resultPaged, tool.name).toBeUndefined();
                continue;
            }
            expect(tool.zodSchema.shape.pageToken, tool.name).toBeDefined();
            const upstream = tool.metadata.queryParams.includes("pageToken");
            expect(Boolean(tool.metadata.resultPaged), tool.name).toBe(!upstream);
        }
    });
});
