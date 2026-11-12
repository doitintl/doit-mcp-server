import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spawns the built CLI in channel mode and speaks raw newline-delimited JSON-RPC to it, the way
// Claude Code does: a 2026-07-28 `server/discover` probe first, then the `initialize` fallback.
// Requires `yarn build`; skipped locally when dist/ is missing, never in CI (see stdioBinary.test.ts).
const SERVER_ENTRY = fileURLToPath(new URL("../../../dist/index.js", import.meta.url));

const PROBE = {
    jsonrpc: "2.0",
    id: "server-discover-probe-1",
    method: "server/discover",
    params: {
        _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientInfo": { name: "probe", version: "1.0.0" },
            "io.modelcontextprotocol/clientCapabilities": {},
        },
    },
};
const INITIALIZE = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "probe", version: "1.0.0" } },
};

function startChannelProcess(extraEnv: Record<string, string> = {}) {
    const child = spawn(process.execPath, [SERVER_ENTRY], {
        cwd: tmpdir(),
        // Only what the child needs: no NODE_ENV/VITEST_* (they stop index.ts calling main()).
        env: {
            PATH: process.env.PATH,
            DOIT_CHANNEL_EVENTS: "anomalies,incidents",
            DOIT_API_KEY: "test-api-key",
            // Nothing listens here, so polls fail fast; the server must keep running regardless.
            DOIT_API_BASE: "http://127.0.0.1:9",
            ...extraEnv,
        },
        stdio: ["pipe", "pipe", "pipe"],
    });
    const messages: any[] = [];
    let buffer = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
        buffer += chunk;
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line) messages.push(JSON.parse(line));
            newline = buffer.indexOf("\n");
        }
    });
    child.stderr.on("data", (chunk) => {
        stderr += chunk;
    });
    const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
    const send = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`);
    const response = async (id: unknown) => {
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
            const found = messages.find((message) => message.id === id);
            if (found) return found;
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error(`no response for id ${String(id)}; stderr: ${stderr}`);
    };
    return { child, send, response, exited, stderr: () => stderr };
}

describe.skipIf(!existsSync(SERVER_ENTRY) && !process.env.CI)("built stdio binary in channel mode", () => {
    it("refuses the 2026-07-28 probe, serves initialize with the channel capability, and exits on stdin EOF", async () => {
        const server = startChannelProcess();
        try {
            server.send(PROBE);
            expect((await server.response(PROBE.id)).error?.code).toBe(-32601);

            server.send(INITIALIZE);
            const { result } = await server.response(INITIALIZE.id);
            expect(result.protocolVersion).toBe("2025-11-25");
            expect(result.capabilities.experimental).toEqual({ "claude/channel": {} });
            expect(result.capabilities.tools).toEqual({});

            server.send({ jsonrpc: "2.0", method: "notifications/initialized" });
            server.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
            expect((await server.response(2)).result.tools.length).toBeGreaterThan(0);

            // The poller is running by now (and failing against the dead API base). Closing
            // stdin must still end the process promptly and cleanly.
            server.child.stdin.end();
            const code = await Promise.race([
                server.exited,
                new Promise<string>((resolve) => setTimeout(() => resolve("still running"), 8000)),
            ]);
            expect(code).toBe(0);
            expect(server.stderr()).toContain("DoiT channel: enabled for anomalies, incidents");
        } finally {
            server.child.kill();
        }
    }, 20_000);

    it("serves no tools in channel-only mode, with or without event kinds", async () => {
        for (const extraEnv of [
            { DOIT_CHANNEL_ONLY: "true" },
            { DOIT_CHANNEL_ONLY: "true", DOIT_CHANNEL_EVENTS: "" },
        ]) {
            const server = startChannelProcess(extraEnv);
            try {
                server.send(INITIALIZE);
                const { result } = await server.response(INITIALIZE.id);
                expect(result.capabilities).toEqual({ experimental: { "claude/channel": {} } });

                server.send({ jsonrpc: "2.0", method: "notifications/initialized" });
                server.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
                expect((await server.response(2)).error?.code).toBe(-32601);

                server.child.stdin.end();
                const code = await Promise.race([
                    server.exited,
                    new Promise<string>((resolve) => setTimeout(() => resolve("still running"), 8000)),
                ]);
                expect(code).toBe(0);
            } finally {
                server.child.kill();
            }
        }
    }, 30_000);
});
