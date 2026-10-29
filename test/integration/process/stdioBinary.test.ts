import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client as ModernClient, type VersionNegotiationMode } from "@modelcontextprotocol/client";
import { StdioClientTransport as ModernStdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport as LegacyStdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";
import { SERVER_INSTRUCTIONS } from "../../../src/docs/serverInstructions.js";
import { generatedTools } from "../../../src/tools/generated/registry.js";
import { HAND_WRITTEN_TOOLS } from "../../../src/tools/handWrittenTools.js";
import { EMPLOYEE_ONLY_TOOLS } from "../../../src/utils/employeeAccess.js";

// Spawns the *built* CLI (`node dist/index.js`) exactly as an MCP host would and talks to it
// over real stdio pipes — the closest check to production that this repo can run: real
// process, real newline-delimited JSON-RPC framing, real `main()` → `serveDoitStdio()`.
//
// Requires `yarn build` at the repo root first (CI's integration job runs it). Skipped
// locally when dist/ is missing so `yarn test` without a build still passes — but never in
// CI, where a missing build must fail rather than silently skip the check.
//
// msw cannot intercept a child process's network traffic, so these tests make no DoiT API
// calls: the child runs without DOIT_API_KEY, and `tools/call` must answer Unauthorized.
const SERVER_ENTRY = fileURLToPath(new URL("../../../dist/index.js", import.meta.url));

// Without DOIT_API_KEY the caller is not a DoiT employee, so employee-only tools are hidden.
const EXPECTED_TOOL_NAMES = [
    ...HAND_WRITTEN_TOOLS.filter((tool) => !EMPLOYEE_ONLY_TOOLS.has(tool.name)).map((tool) => tool.name),
    ...generatedTools.map((tool) => tool.name),
].sort();

// Only the SDKs' default inherited env (PATH, HOME, …) reaches the child — no DOIT_API_KEY,
// and no NODE_ENV/VITEST_* (which would stop index.ts from calling main()). A temp cwd keeps
// dotenv from loading a developer's .env.
const serverParams = { command: process.execPath, args: [SERVER_ENTRY], cwd: tmpdir(), stderr: "ignore" as const };

type TextResult = { content: Array<{ type: string; text?: string }> };
const textOf = (result: unknown) => (result as TextResult).content.find((c) => c.type === "text")?.text ?? "";

function expectCloudflowToolCaveats(tools: Array<{ name: string; description?: string }>) {
    const description = (name: string) => tools.find((tool) => tool.name === name)?.description;
    for (const name of ["import_cloudflow_flow", "export_cloudflow_flow"]) {
        expect(description(name)).toContain('JavaScript (default) uses $nodes["<node name>"]');
        expect(description(name)).toContain("Python uses nodes and variables");
        expect(description(name)).toContain("top-level return");
        expect(description(name)).toContain("{message: null}");
        expect(description(name)).toContain("Bare input is not injected");
        expect(description(name)).toContain("schema (JSON Schema string) is required");
    }
    expect(description("test_run_cloudflow_flow")).toContain("executes real actions even on drafts");
    for (const name of ["build_cloud_flow", "refine_cloudflow"])
        expect(description(name)).toContain("Test runs execute real actions, including on drafts");
}

describe.skipIf(!existsSync(SERVER_ENTRY) && !process.env.CI)("built stdio binary (dist/index.js)", () => {
    it("serves a 2025-era v1 SDK client over initialize", async () => {
        const client = new LegacyClient({ name: "process-legacy-client", version: "1.0.0" });
        await client.connect(new LegacyStdioClientTransport(serverParams));
        try {
            const { tools } = await client.listTools();
            const result = await client.callTool({ name: "list_organizations", arguments: {} });

            expect(client.getServerVersion()?.name).toBe("doit-mcp-server");
            expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
            expect(client.getInstructions()).not.toMatch(/CloudFlow|codeNode|test-run|\$nodes/);
            expect(tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOL_NAMES);
            expectCloudflowToolCaveats(tools);
            expect(textOf(result)).toContain("Unauthorized");
        } finally {
            await client.close();
        }
    });

    it.each<[string, VersionNegotiationMode]>([
        ["pinned to 2026-07-28", { pin: "2026-07-28" }],
        ["in 'auto' mode", "auto"],
    ])("serves a v2 SDK client %s in the modern era", async (_label, mode) => {
        const client = new ModernClient(
            { name: "process-modern-client", version: "2.0.0" },
            { versionNegotiation: { mode } }
        );
        await client.connect(new ModernStdioClientTransport(serverParams));
        try {
            const { tools } = await client.listTools();
            const result = await client.callTool({ name: "list_organizations", arguments: {} });

            expect(client.getNegotiatedProtocolVersion()).toBe("2026-07-28");
            expect(client.getProtocolEra()).toBe("modern");
            expect(client.getDiscoverResult()?.instructions).toBe(SERVER_INSTRUCTIONS);
            expect(client.getDiscoverResult()?.instructions).not.toMatch(/CloudFlow|codeNode|test-run|\$nodes/);
            expect(tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOL_NAMES);
            expectCloudflowToolCaveats(tools);
            expect(textOf(result)).toContain("Unauthorized");
        } finally {
            await client.close();
        }
    });
});
