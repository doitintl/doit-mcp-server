import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { CLOUDFLOW_BUILDER_HINT, CLOUDFLOW_CODENODE_HINT } from "../../../docs/cloudflowGuidance.js";
import { COVERED_ENDPOINTS } from "../../handWrittenTools.js";
import { generateTools } from "../generateTools.js";
import { loadGeneratedToolsSpec } from "../loadSpec.js";
import { toolOverrides } from "../overrides.js";

describe("generated tool overrides", () => {
    const tools = generateTools(loadGeneratedToolsSpec(), COVERED_ENDPOINTS);
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    it("every override key matches a real generated tool name (no stale entries)", () => {
        const stale = Object.keys(toolOverrides).filter((name) => !byName.has(name));
        expect(stale).toEqual([]);
    });

    it("marks the POST layer-components lookup as read-only with read-only scopes", () => {
        expect(byName.get("get_statussheet_components")).toMatchObject({
            metadata: { method: "post", pathTemplate: "/clouddiagrams/v1/statussheet/{id}/get" },
            annotations: { readOnlyHint: true, destructiveHint: false },
            securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
        });
    });

    it.each(["async_run_inline", "async_run_report_by_id"])("keeps %s as a write because it creates a job", (name) => {
        expect(byName.get(name)).toMatchObject({
            metadata: { method: "post" },
            annotations: { readOnlyHint: false, destructiveHint: true },
            securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
        });
    });

    it("appends the codeNode contract to the import and export tools", () => {
        for (const name of ["import_cloudflow_flow", "export_cloudflow_flow"]) {
            expect(byName.get(name)?.description).toContain(CLOUDFLOW_CODENODE_HINT);
        }
    });

    // The builder hint talks about a build; a test run builds nothing, so it gets its own text.
    it("appends a test-run warning to the test-run tool", () => {
        const description = byName.get("test_run_cloudflow_flow")?.description ?? "";
        expect(description).toContain("fail silently");
        expect(description).toContain("get_cloudflow_flow_run");
        expect(description).toContain("without dryRun it executes real actions even on drafts");
        expect(description).not.toContain(CLOUDFLOW_BUILDER_HINT);
    });

    it("states the current generated trigger-payload limitation without adding a fictitious body schema", () => {
        for (const name of ["trigger_cloudflow_flow", "test_run_cloudflow_flow"]) {
            const tool = byName.get(name);
            expect(tool?.description).toContain("no arbitrary trigger payload field");
            expect(tool?.zodSchema.shape).not.toHaveProperty("body");
        }
    });

    it("keeps the spec's own description ahead of the suffix", () => {
        const description = byName.get("export_cloudflow_flow")?.description ?? "";
        expect(description.indexOf(CLOUDFLOW_CODENODE_HINT)).toBeGreaterThan(0);
        expect(description.endsWith(CLOUDFLOW_CODENODE_HINT)).toBe(true);
    });

    it("preserves the run read contract from the spec", () => {
        const description = byName.get("get_cloudflow_flow_run")?.description ?? "";
        expect(description).toContain("Only action nodes");
        expect(description).toContain("always null");
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

describe("query defaults", () => {
    const tools = generateTools(loadGeneratedToolsSpec(), COVERED_ENDPOINTS);
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    it("requests 20 composer recipes per page unless maxResults is given, and says so", () => {
        const tool = byName.get("list_composer_recipes");
        expect(tool?.metadata.queryDefaults).toEqual({ maxResults: 20 });
        expect(tool?.metadata.queryParams).toContain("maxResults");
        expect(tool?.description).toContain("requests 20 recipes per page unless maxResults is set");
    });

    it("every query default names a real query parameter of its tool", () => {
        for (const [name, override] of Object.entries(toolOverrides)) {
            for (const param of Object.keys(override.queryDefaults ?? {})) {
                expect(byName.get(name)?.metadata.queryParams, `${name}.${param}`).toContain(param);
            }
        }
    });
});
