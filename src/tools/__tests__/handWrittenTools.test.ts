import { describe, expect, it } from "vitest";
import { COVERED_ENDPOINTS, HAND_WRITTEN_TOOLS } from "../handWrittenTools.js";

describe("COVERED_ENDPOINTS", () => {
    const declaredEndpoints = HAND_WRITTEN_TOOLS.flatMap((tool) => {
        if (!tool.coversEndpoint) return [];
        const entries = Array.isArray(tool.coversEndpoint) ? tool.coversEndpoint : [tool.coversEndpoint];
        return entries.map((entry) => entry.toLowerCase());
    });

    it("derives one entry per endpoint declared in coversEndpoint", () => {
        expect(COVERED_ENDPOINTS.size).toBe(declaredEndpoints.length);
    });

    it("lowercases the method and includes a known entry", () => {
        expect(COVERED_ENDPOINTS.has("get:/analytics/v1/alerts")).toBe(true);
    });

    it("has no duplicate method+path pairs across hand-written tools", () => {
        expect(new Set(declaredEndpoints).size).toBe(declaredEndpoints.length);
    });
});
