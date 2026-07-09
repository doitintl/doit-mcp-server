import { describe, expect, it } from "vitest";
import { COVERED_ENDPOINTS, HAND_WRITTEN_TOOLS } from "../handWrittenTools.js";

describe("COVERED_ENDPOINTS", () => {
    it("derives one entry per hand-written tool that declares coversEndpoint", () => {
        const expectedCount = HAND_WRITTEN_TOOLS.filter((tool) => tool.coversEndpoint).length;
        expect(COVERED_ENDPOINTS.size).toBe(expectedCount);
    });

    it("lowercases the method and includes a known entry", () => {
        expect(COVERED_ENDPOINTS.has("get:/analytics/v1/alerts")).toBe(true);
    });

    it("has no duplicate method+path pairs across hand-written tools", () => {
        const keys = HAND_WRITTEN_TOOLS.filter((tool) => tool.coversEndpoint).map(
            (tool) => `${tool.coversEndpoint?.method.toLowerCase()}:${tool.coversEndpoint?.path}`
        );
        expect(new Set(keys).size).toBe(keys.length);
    });
});
