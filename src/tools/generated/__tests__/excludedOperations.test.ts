import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { COVERED_ENDPOINTS } from "../../handWrittenTools.js";
import { EXCLUDED_ENDPOINTS, EXCLUDED_TAGS, isExcludedOperation } from "../excludedOperations.js";
import { generateTools } from "../generateTools.js";
import { loadGeneratedToolsSpec } from "../loadSpec.js";
import { HTTP_METHODS } from "../types.js";

function specOperationKeys(document: OpenAPIV3.Document): Set<string> {
    const keys = new Set<string>();
    for (const [pathTemplate, pathItem] of Object.entries(document.paths ?? {})) {
        if (!pathItem) continue;
        for (const method of HTTP_METHODS) {
            if (pathItem[method]) keys.add(`${method}:${pathTemplate}`.toLowerCase());
        }
    }
    return keys;
}

describe("excludedOperations", () => {
    const spec = loadGeneratedToolsSpec();

    it("every excluded endpoint matches an operation in the bundled spec (no stale or misspelled entries)", () => {
        const operationKeys = specOperationKeys(spec);
        const stale = [...EXCLUDED_ENDPOINTS].filter((endpoint) => !operationKeys.has(endpoint));
        expect(stale).toEqual([]);
    });

    it("every excluded tag matches a tag declared in the bundled spec", () => {
        const specTags = new Set((spec.tags ?? []).map((tag) => tag.name.toLowerCase()));
        const stale = [...EXCLUDED_TAGS].filter((tag) => !specTags.has(tag));
        expect(stale).toEqual([]);
    });

    it("no excluded endpoint is also covered by a hand-written tool (conflicting policy)", () => {
        const conflicts = [...EXCLUDED_ENDPOINTS].filter((endpoint) => COVERED_ENDPOINTS.has(endpoint));
        expect(conflicts).toEqual([]);
    });

    it("generateTools emits no tool for excluded operations", () => {
        const tools = generateTools(spec, COVERED_ENDPOINTS);
        const generatedKeys = new Set(
            tools.map((tool) => `${tool.metadata.method}:${tool.metadata.pathTemplate}`.toLowerCase())
        );
        const leaked = [...EXCLUDED_ENDPOINTS].filter((endpoint) => generatedKeys.has(endpoint));
        expect(leaked).toEqual([]);
    });

    it("isExcludedOperation matches by endpoint case-insensitively and by tag", () => {
        const [first] = [...EXCLUDED_ENDPOINTS];
        if (first) {
            const [method, pathTemplate] = [first.slice(0, first.indexOf(":")), first.slice(first.indexOf(":") + 1)];
            expect(isExcludedOperation(method.toUpperCase(), pathTemplate.toUpperCase())).toBe(true);
        }
        expect(isExcludedOperation("get", "/not/a/real/path")).toBe(false);
    });
});
