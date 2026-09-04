import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { CLOUDFLOW_BUILDER_HINT, CLOUDFLOW_CODENODE_HINT } from "../../../docs/cloudflowGuidance.js";
import { COVERED_ENDPOINTS } from "../../handWrittenTools.js";
import { generateTools } from "../generateTools.js";
import { loadGeneratedToolsSpec } from "../loadSpec.js";
import { toolOverrides } from "../overrides.js";

describe("generated tool description overrides", () => {
    const tools = generateTools(loadGeneratedToolsSpec(), COVERED_ENDPOINTS);
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    it("every override key matches a real generated tool name (no stale entries)", () => {
        const stale = Object.keys(toolOverrides).filter((name) => !byName.has(name));
        expect(stale).toEqual([]);
    });

    it("appends the codeNode contract to the import and export tools", () => {
        for (const name of ["import_cloudflow_flow", "export_cloudflow_flow"]) {
            expect(byName.get(name)?.description).toContain(CLOUDFLOW_CODENODE_HINT);
        }
    });

    it("appends the builder warning to the test-run tool", () => {
        expect(byName.get("test_run_cloudflow_flow")?.description).toContain(CLOUDFLOW_BUILDER_HINT);
    });

    it("keeps the spec's own description ahead of the suffix", () => {
        const description = byName.get("export_cloudflow_flow")?.description ?? "";
        expect(description.indexOf(CLOUDFLOW_CODENODE_HINT)).toBeGreaterThan(0);
        expect(description.endsWith(CLOUDFLOW_CODENODE_HINT)).toBe(true);
    });

    it("leaves a non-overridden tool's description untouched", () => {
        const description = byName.get("get_cloudflow_flow_run")?.description ?? "";
        expect(description).not.toBe("");
        expect(description).not.toContain(CLOUDFLOW_CODENODE_HINT);
        expect(description).not.toContain(CLOUDFLOW_BUILDER_HINT);
    });

    it("appends nothing when a tool has no override", () => {
        const document = {
            openapi: "3.0.1",
            info: { title: "test", version: "1.0.0" },
            paths: {
                "/thing/v1/things": {
                    get: { operationId: "listThings", description: "Lists things." },
                },
            },
        } as unknown as OpenAPIV3.Document;

        expect(generateTools(document, new Set())[0].description).toBe("Lists things.");
    });
});
