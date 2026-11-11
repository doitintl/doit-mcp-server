import { describe, expect, it } from "vitest";
import { RESULT_PAGE_TOKEN_DESCRIPTION } from "../../utils/resultPaging.js";
import { generatedTools } from "../generated/registry.js";
import { HAND_WRITTEN_TOOLS, RAW_HAND_WRITTEN_TOOLS, RESULT_PAGED_TOOLS } from "../handWrittenTools.js";

const properties = (tool: { inputSchema?: Record<string, unknown> } | undefined) =>
    (tool?.inputSchema as { properties?: Record<string, { description?: string }> } | undefined)?.properties;
const handWritten = (name: string) => {
    const tool = HAND_WRITTEN_TOOLS.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`missing hand-written tool ${name}`);
    return tool;
};

describe("result-paged tools", () => {
    it("adds the continuation pageToken only to tools that opted in", () => {
        for (const tool of HAND_WRITTEN_TOOLS) {
            const optedIn = RESULT_PAGED_TOOLS.has(tool.name);
            expect(properties(tool)?.pageToken?.description === RESULT_PAGE_TOKEN_DESCRIPTION, tool.name).toBe(optedIn);
        }
        for (const tool of generatedTools) {
            const optedIn = Boolean(tool.metadata.resultPaged);
            const description = tool.zodSchema.shape.pageToken?.description;
            expect(description === RESULT_PAGE_TOKEN_DESCRIPTION, tool.name).toBe(optedIn);
        }
    });

    it("opts in list tools without upstream paging and leaves single-resource and non-idempotent reads out", () => {
        for (const name of [
            "list_users",
            "list_products",
            "get_cloud_diagrams_stats",
            "get_cloud_diagram_components",
        ]) {
            expect(RESULT_PAGED_TOOLS.has(name), name).toBe(true);
        }
        for (const name of [
            "list_tickets",
            "list_reports",
            "get_ticket",
            "get_theme",
            "validate_user",
            "ask_ava_sync",
        ]) {
            expect(RESULT_PAGED_TOOLS.has(name), name).toBe(false);
            expect(properties(handWritten(name))?.pageToken?.description).not.toBe(RESULT_PAGE_TOKEN_DESCRIPTION);
        }
        expect(properties(handWritten("get_ticket"))).not.toHaveProperty("pageToken");
        expect(properties(handWritten("create_ticket"))).not.toHaveProperty("pageToken");
    });

    it("only read-only tools without a pageToken of their own are opted in", () => {
        for (const tool of RAW_HAND_WRITTEN_TOOLS) {
            if (!tool.resultPaged) continue;
            expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
            expect(properties(tool), tool.name).not.toHaveProperty("pageToken");
        }
        for (const tool of generatedTools) {
            if (!tool.metadata.resultPaged) continue;
            expect(tool.annotations.readOnlyHint, tool.name).toBe(true);
            expect(tool.metadata.queryParams, tool.name).not.toContain("pageToken");
        }
    });

    // Guards against a refreshed spec or a new hand-written tool adding an unpaginated list
    // that nobody opted in: every list_* read without upstream paging must decide explicitly.
    it("every list_* read without upstream paging has opted in", () => {
        const missing: string[] = [];
        for (const tool of RAW_HAND_WRITTEN_TOOLS) {
            const props = properties(tool);
            if (!tool.name.startsWith("list_") || tool.annotations?.readOnlyHint !== true || !props) continue;
            if (!("pageToken" in props) && !tool.resultPaged) missing.push(tool.name);
        }
        for (const tool of generatedTools) {
            if (!tool.name.startsWith("list_") || !tool.annotations.readOnlyHint) continue;
            if (!tool.metadata.queryParams.includes("pageToken") && !tool.metadata.resultPaged) missing.push(tool.name);
        }
        expect(missing).toEqual([]);
    });
});
