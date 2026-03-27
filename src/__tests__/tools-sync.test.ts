import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Ensures the STDIO server (src/server.ts) and the SSE/web server
 * (doit-mcp-server/src/index.ts) register the same set of tools.
 *
 * Extracts tool names from source files via regex so we don't need to
 * instantiate the Cloudflare Worker agent in a unit test.
 */
describe("STDIO ↔ SSE tool registration sync", () => {
    function extractStdioToolNames(): string[] {
        const source = readFileSync(resolve(__dirname, "../server.ts"), "utf-8");
        // Match tool descriptors in the ListToolsRequestSchema tools array.
        // Pattern: lines like "    cloudIncidentsTool," inside the tools array.
        const toolsArrayMatch = source.match(/tools:\s*\[([\s\S]*?)\]/);
        if (!toolsArrayMatch) throw new Error("Could not find tools array in server.ts");
        const names: string[] = [];
        for (const m of toolsArrayMatch[1].matchAll(/(\w+Tool)\b/g)) {
            names.push(m[1]);
        }
        return names;
    }

    function extractSseToolNames(): string[] {
        const source = readFileSync(resolve(__dirname, "../../doit-mcp-server/src/index.ts"), "utf-8");
        const names: string[] = [];
        // Match: this.registerTool(someVariableTool, SomeSchema);
        for (const m of source.matchAll(/this\.registerTool\((\w+Tool)\b/g)) {
            names.push(m[1]);
        }
        return names;
    }

    it("STDIO and SSE servers register the same tools", () => {
        const stdioTools = extractStdioToolNames().sort();
        const sseTools = extractSseToolNames().sort();

        const missingFromSse = stdioTools.filter((t) => !sseTools.includes(t));
        const missingFromStdio = sseTools.filter((t) => !stdioTools.includes(t));

        expect(missingFromSse, `Tools in STDIO but missing from SSE: ${missingFromSse.join(", ")}`).toEqual([]);
        expect(missingFromStdio, `Tools in SSE but missing from STDIO: ${missingFromStdio.join(", ")}`).toEqual([]);
    });
});
