import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport as LegacyStdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
const entry = join(packageRoot, "dist/index.js");
const skillCapability = { extensions: { "io.modelcontextprotocol/skills": {} } };
const temporary: string[] = [];
const fixtureSource = (name: string) => ({
    name,
    frontmatter:
        name === "alpha-workflow"
            ? {
                  name,
                  description: "A minimal workflow fixture for skill delivery tests.",
                  license: "MIT",
                  metadata: { version: "1", labels: "fixture" },
                  "x-fixture": { labels: ["fixture"] },
              }
            : {
                  name,
                  description: "A second independent workflow fixture.",
                  compatibility: "No external services required.",
              },
    files: [
        { path: "SKILL.md", text: readFileSync(join(packageRoot, "test/fixtures/skills", name, "SKILL.md"), "utf8") },
        { path: "assets/blob.bin", blob: "AP+A" },
        { path: "references/check.md", text: "Read only when needed.\n" },
    ],
});
const params = (path: string) => ({
    command: process.execPath,
    args: [path],
    cwd: tmpdir(),
    stderr: "ignore" as const,
});
const modernClient = (supportsSkills = true) =>
    new Client(
        { name: "skills-process-test", version: "1.0.0" },
        { capabilities: supportsSkills ? skillCapability : {}, versionNegotiation: { mode: { pin: "2026-07-28" } } }
    );
function recordResults(transport: StdioClientTransport) {
    const results: Record<string, unknown>[] = [];
    const receive = transport.onmessage;
    transport.onmessage = (message, extra) => {
        if ("result" in message) results.push(structuredClone(message.result));
        receive?.(message, extra);
    };
    return results;
}

describe.skipIf(!existsSync(entry) && !process.env.CI)("packaged Skills extension over real stdio", () => {
    let fixtureEntry: string;
    beforeAll(() => {
        const directory = mkdtempSync(join(tmpdir(), "mcp-skills-process-"));
        temporary.push(directory);
        fixtureEntry = join(directory, "server.mjs");
        // Use the actual built server and its SDK transport; inject fixtures without
        // including test-only skills in a production release or reading runtime files.
        const url = (path: string) => JSON.stringify(pathToFileURL(join(packageRoot, path)).href);
        writeFileSync(
            fixtureEntry,
            `
import { createServer } from ${url("dist/server.js")};
import { createSkillRegistry } from ${url("dist/skills/registry.js")};
import { serveStdio } from ${url("node_modules/@modelcontextprotocol/server/dist/stdio.mjs")};
const skillRegistry = createSkillRegistry(${JSON.stringify([fixtureSource("beta-workflow"), fixtureSource("alpha-workflow")])}, {pageSize: 1});
serveStdio(() => createServer({skillRegistry}), {legacy: "serve"});
`
        );
    });
    afterAll(() => {
        for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
    });
    it("discovers both bundled skills and delivers the complete CloudFlow authoring files", async () => {
        const client = modernClient();
        const transport = new StdioClientTransport(params(entry));
        await client.connect(transport);
        const wire = recordResults(transport);
        try {
            expect(client.getServerCapabilities()).toMatchObject({
                resources: {},
                extensions: skillCapability.extensions,
            });
            const response = await client.request({ method: "skills/list", params: {} }, z.any());
            expect(response).toMatchObject({
                ttlMs: 300000,
                cacheScope: "public",
                skills: [
                    expect.objectContaining({ uri: "skill://doit-cloud-connect/SKILL.md" }),
                    expect.objectContaining({ uri: "skill://doit-cloudflow-authoring/SKILL.md" }),
                ],
            });
            expect(wire[0]).toMatchObject({
                resultType: "complete",
                ttlMs: 300000,
                cacheScope: "public",
                skills: response.skills,
            });
            const uri = "skill://doit-cloudflow-authoring/SKILL.md";
            const { skill } = await client.request({ method: "skills/get", params: { uri } }, z.any());
            expect(skill).toEqual(response.skills.find((entry: { uri: string }) => entry.uri === uri));
            expect(skill.resources.map((resource: { uri: string }) => resource.uri)).toEqual([
                uri,
                "skill://doit-cloudflow-authoring/references/authoring-guide.md",
            ]);
            for (const resource of skill.resources) {
                const file = (await client.readResource({ uri: resource.uri })).contents[0];
                expect(file.mimeType).toBe("text/markdown");
                const bytes = Buffer.from(file.text as string);
                expect(bytes.length).toBe(resource.size);
                expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(resource.digest);
            }
            const guide = await client.readResource({ uri: "doit://docs/cloudflow-authoring" });
            const reference = await client.readResource({
                uri: "skill://doit-cloudflow-authoring/references/authoring-guide.md",
            });
            expect(guide.contents[0]).toMatchObject({ text: reference.contents[0].text });
            await expect(
                client.request({ method: "skills/get", params: { uri: "skill://unknown/SKILL.md" } }, z.any())
            ).rejects.toMatchObject({ code: -32602 });
        } finally {
            await client.close();
        }
    });
    it("keeps the original CloudFlow guide and skill files available to legacy clients", async () => {
        const client = new LegacyClient({ name: "legacy-cloudflow-test", version: "1.0.0" });
        await client.connect(new LegacyStdioClientTransport(params(entry)));
        try {
            const resources = (await client.listResources()).resources.map((resource) => resource.uri);
            for (const uri of [
                "doit://docs/cloudflow-authoring",
                "skill://doit-cloudflow-authoring/SKILL.md",
                "skill://doit-cloudflow-authoring/references/authoring-guide.md",
            ])
                expect(resources).toContain(uri);
            const skill = await client.readResource({ uri: "skill://doit-cloudflow-authoring/SKILL.md" });
            expect(skill.contents[0]).toMatchObject({ text: expect.stringContaining("# DoiT CloudFlow authoring") });
            const guide = await client.readResource({ uri: "doit://docs/cloudflow-authoring" });
            const reference = await client.readResource({
                uri: "skill://doit-cloudflow-authoring/references/authoring-guide.md",
            });
            expect(guide.contents[0]).toMatchObject({ text: reference.contents[0].text });
            expect(guide.contents[0].text).toContain("# CloudFlow authoring over MCP");
            expect(guide.contents[0].text).toContain("even for drafts");
        } finally {
            await client.close();
        }
    });
    it("names the skill guides in tool descriptions only for clients without native Skills support", async () => {
        const guides = {
            build_cloud_flow: "doit://docs/cloudflow-authoring",
            verify_cloud_connect: "skill://doit-cloud-connect/SKILL.md",
        };
        const description = (tools: { name: string; description?: string }[], name: string) =>
            tools.find((tool) => tool.name === name)?.description ?? "";
        const legacy = new LegacyClient({ name: "legacy-guide-test", version: "1.0.0" });
        await legacy.connect(new LegacyStdioClientTransport(params(entry)));
        try {
            const { tools } = await legacy.listTools();
            for (const [name, uri] of Object.entries(guides)) expect(description(tools, name)).toContain(uri);
        } finally {
            await legacy.close();
        }
        for (const supportsSkills of [false, true]) {
            const client = modernClient(supportsSkills);
            await client.connect(new StdioClientTransport(params(entry)));
            try {
                const { tools } = await client.listTools();
                for (const [name, uri] of Object.entries(guides))
                    expect(description(tools, name).includes(uri), `${name} supportsSkills=${supportsSkills}`).toBe(
                        !supportsSkills
                    );
            } finally {
                await client.close();
            }
        }
    });
    it("serves multiple complete skills, pagination, text and blobs with exact manifest integrity", async () => {
        const client = modernClient();
        const transport = new StdioClientTransport(params(fixtureEntry));
        await client.connect(transport);
        const wire = recordResults(transport);
        try {
            const first = await client.request({ method: "skills/list", params: {} }, z.any());
            expect(first.skills).toHaveLength(1);
            const next = await client.request({ method: "skills/list", params: { cursor: first.nextCursor } }, z.any());
            expect(next.skills).toHaveLength(1);
            expect(next.nextCursor).toBeUndefined();
            for (const skill of [...first.skills, ...next.skills]) {
                const get = await client.request({ method: "skills/get", params: { uri: skill.uri } }, z.any());
                expect(get).toMatchObject({ ttlMs: 300000, cacheScope: "public", skill });
                for (const resource of skill.resources) {
                    const result = await client.readResource({ uri: resource.uri });
                    expect(result).toMatchObject({ ttlMs: 300000, cacheScope: "public" });
                    const file = result.contents[0];
                    const raw = "text" in file ? Buffer.from(file.text) : Buffer.from(file.blob, "base64");
                    expect(raw.length).toBe(resource.size);
                    expect(`sha256:${createHash("sha256").update(raw).digest("hex")}`).toBe(resource.digest);
                }
            }
            expect(wire).toHaveLength(10);
            for (const result of wire)
                expect(result).toMatchObject({ resultType: "complete", ttlMs: 300000, cacheScope: "public" });
            const resources = await client.listResources();
            expect(resources.resources).toHaveLength(7);
            await expect(client.readResource({ uri: "skill://alpha-workflow/../private" })).rejects.toMatchObject({
                code: -32602,
            });
            await expect(
                client.request({ method: "skills/list", params: { cursor: "invented" } }, z.any())
            ).rejects.toMatchObject({ code: -32602 });
        } finally {
            await client.close();
        }
    });
    it("requires client extension opt-in while retaining core resources", async () => {
        const client = modernClient(false);
        await client.connect(new StdioClientTransport(params(fixtureEntry)));
        try {
            await expect(client.request({ method: "skills/list", params: {} }, z.any())).rejects.toMatchObject({
                code: -32601,
            });
            await expect(
                client.request({ method: "skills/get", params: { uri: "skill://alpha-workflow/SKILL.md" } }, z.any())
            ).rejects.toMatchObject({ code: -32601 });
            expect((await client.readResource({ uri: "skill://alpha-workflow/SKILL.md" })).contents[0]).toHaveProperty(
                "text"
            );
        } finally {
            await client.close();
        }
    });
    it("preserves legacy clients and serves skill files through core Resources", async () => {
        const client = new LegacyClient({ name: "legacy-skills-test", version: "1.0.0" });
        await client.connect(new LegacyStdioClientTransport(params(fixtureEntry)));
        try {
            expect((await client.listTools()).tools.length).toBeGreaterThan(0);
            expect((await client.listResources()).resources).toHaveLength(7);
            const result = await client.readResource({ uri: "skill://beta-workflow/assets/blob.bin" });
            expect(result.contents[0]).toMatchObject({ blob: "AP+A", mimeType: "application/octet-stream" });
            await expect(client.request({ method: "skills/list", params: {} }, z.any())).rejects.toMatchObject({
                code: -32601,
            });
        } finally {
            await client.close();
        }
    });
});
