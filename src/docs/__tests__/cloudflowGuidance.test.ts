import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
    CLOUDFLOW_AUTHORING_GUIDE,
    CLOUDFLOW_BUILDER_HINT,
    CLOUDFLOW_CODENODE_HINT,
    CLOUDFLOW_INSTRUCTIONS,
} from "../cloudflowGuidance.js";
import { SERVER_INSTRUCTIONS } from "../serverInstructions.js";

describe("CloudFlow guidance", () => {
    it("states both language runtimes in every tier", () => {
        for (const tier of [CLOUDFLOW_CODENODE_HINT, CLOUDFLOW_INSTRUCTIONS, CLOUDFLOW_AUTHORING_GUIDE]) {
            expect(tier).toContain("nodes[");
            expect(tier).toContain("JavaScript");
            expect(tier).toContain("Python");
            expect(tier).toContain("$variables");
            expect(tier).toContain("{}");
            expect(tier).toContain("fails the node");
            expect(tier).toContain("{message: null}");
        }
    });

    it("keeps the per-tool tiers short enough to ride every tools/list response", () => {
        expect(CLOUDFLOW_CODENODE_HINT.length).toBeLessThan(400);
        expect(CLOUDFLOW_BUILDER_HINT.length).toBeLessThan(400);
    });

    it("keeps the instructions tier to roughly a dozen lines (a shared budget)", () => {
        expect(CLOUDFLOW_INSTRUCTIONS.split("\n").length).toBeLessThanOrEqual(16);
    });

    it("serves the instructions as the server instructions", () => {
        expect(SERVER_INSTRUCTIONS).toBe(CLOUDFLOW_INSTRUCTIONS);
    });

    it("distinguishes structural validation from draft execution in all execution guidance", () => {
        for (const tier of [CLOUDFLOW_BUILDER_HINT, CLOUDFLOW_INSTRUCTIONS, CLOUDFLOW_AUTHORING_GUIDE]) {
            expect(tier).toMatch(/real\s+(?:cloud\s+)?actions/);
            expect(tier).toContain("draft");
        }
        expect(CLOUDFLOW_INSTRUCTIONS).toContain("dryRun validates without dispatching");
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("Only action nodes record `input`");
    });

    it("states dry-run fingerprint, replay, conflict, and tenant scoping semantics", () => {
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("including dry-runs");
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("24-hour");
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("fails with 422");
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("fails with 409");
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("do not reserve a key");
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("targets that customer's tenant");
        expect(CLOUDFLOW_AUTHORING_GUIDE).not.toContain("flows land in the token's own tenant");
    });

    it("carries the whole guide, backticks and code fences intact", () => {
        expect(CLOUDFLOW_AUTHORING_GUIDE.startsWith("# CloudFlow authoring over MCP")).toBe(true);
        // The template literal is escaped by hand; a botched escape truncates the tail.
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("## Tenant scoping caveat");
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("`customerContext`");
        expect(CLOUDFLOW_AUTHORING_GUIDE).not.toContain("\\`");
    });

    it("covers every section a caller needs before claiming a flow works", () => {
        for (const heading of [
            "## The authoring loop",
            "## Idempotency-key retry semantics",
            "## The `codeNode` runtime contract",
            "## Things a bundle cannot carry",
        ]) {
            expect(CLOUDFLOW_AUTHORING_GUIDE).toContain(heading);
        }
    });

    it("leaves docs/cloudflow-authoring.md as a pointer, not a second copy that can drift", () => {
        const doc = readFileSync(new URL("../../../docs/cloudflow-authoring.md", import.meta.url), "utf8");

        expect(doc).toContain("src/docs/cloudflowGuidance.ts");
        expect(doc.length).toBeLessThan(CLOUDFLOW_AUTHORING_GUIDE.length);
    });
});
