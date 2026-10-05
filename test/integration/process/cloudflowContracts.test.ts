import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SERVER_ENTRY = fileURLToPath(new URL("../../../dist/index.js", import.meta.url));
type Result = { content: Array<{ type: string; text?: string }>; isError?: boolean };
const textOf = (result: Result) => result.content.find((c) => c.type === "text")?.text ?? "";

// Disposable local HTTP fixtures exercise the built binary through actual tools/call.
// No cloud credentials, customer resources, or automatic confirmation are involved.
describe.skipIf(!existsSync(SERVER_ENTRY) && !process.env.CI)("built CloudFlow/Ava contracts", () => {
    let api: Server;
    let client: Client;
    let connection: Record<string, unknown> | undefined;
    let version: number;
    let creates: number;
    let statuses: number[];
    let seen: Array<{
        method: string;
        body: Record<string, unknown>;
        key?: string;
        ifMatch?: string;
        tenant?: string;
        context: string | null;
    }>;
    let inProgress: boolean;
    let avaError: unknown;

    beforeEach(async () => {
        version = 1;
        creates = 0;
        connection = undefined;
        statuses = [];
        seen = [];
        inProgress = false;
        avaError = "Backend temporarily unavailable";
        const keys = new Map<string, { body: string; response: Record<string, unknown> }>();
        api = createServer(async (req, res) => {
            let raw = "";
            for await (const chunk of req) raw += chunk;
            const body = raw ? JSON.parse(raw) : {};
            const url = new URL(req.url ?? "/", "http://localhost");
            const key = req.headers["idempotency-key"] as string | undefined;
            const ifMatch = req.headers["if-match"] as string | undefined;
            seen.push({
                method: req.method ?? "",
                body,
                key,
                ifMatch,
                tenant: req.headers["x-tenant-id"] as string | undefined,
                context: url.searchParams.get("customerContext"),
            });
            const reply = (status: number, data: unknown) => {
                statuses.push(status);
                res.writeHead(status, { "Content-Type": "application/json" });
                res.end(JSON.stringify(data));
            };
            if (url.pathname === "/ava/v1/askSync") {
                // The production keep-alive handler commits HTTP 200 before generation fails.
                reply(200, { error: avaError });
            } else if (req.method === "POST") {
                if (!key) return reply(400, { code: "idempotency_key_required" });
                const prior = keys.get(key);
                if (prior && prior.body !== raw) return reply(422, { code: "idempotency_key_reused" });
                if (url.searchParams.get("dryRun") === "true") return reply(200, { valid: true });
                if (inProgress) return reply(409, { code: "idempotency_request_in_progress" });
                if (prior) return reply(201, prior.response);
                creates++;
                if (url.pathname.endsWith("/actions/test-run")) {
                    const run = { runId: `fixture-run-${creates}`, status: "pending" };
                    keys.set(key, { body: raw, response: run });
                    return reply(201, run);
                }
                connection = { ...body, connectionId: `fixture-${creates}`, etag: `"v${version}"` };
                keys.set(key, { body: raw, response: connection });
                reply(201, connection);
            } else if (req.method === "PATCH") {
                if (!ifMatch) return reply(428, { code: "precondition_required" });
                if (ifMatch !== `"v${version}"` && ifMatch !== `W/"v${version}"`)
                    return reply(412, { code: "precondition_failed" });
                connection = { ...connection, ...body, etag: `"v${++version}"` };
                reply(200, connection);
            } else {
                reply(200, connection);
            }
        });
        await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
        const address = api.address();
        if (!address || typeof address === "string") throw new Error("Fixture did not start");
        client = new Client({ name: "cloudflow-contracts", version: "1.0.0" });
        await client.connect(
            new StdioClientTransport({
                command: process.execPath,
                args: [SERVER_ENTRY],
                cwd: tmpdir(),
                stderr: "ignore",
                env: {
                    DOIT_API_KEY: "disposable-fixture-key",
                    DOIT_API_BASE: `http://127.0.0.1:${address.port}`,
                    CUSTOMER_CONTEXT: "fixture-customer",
                },
            })
        );
    });

    afterEach(async () => {
        await client?.close();
        await new Promise<void>((resolve, reject) => api.close((error) => (error ? reject(error) : resolve())));
    });

    it("retains the create key for replay, conflicts and in-progress retries", async () => {
        const args = {
            idempotencyKey: "fixture-create-1",
            name: "Disposable connection",
            gcpConfig: {},
            enabled: false,
        };
        const call = (arguments_: Record<string, unknown>) =>
            client.callTool({ name: "create_cloudflow_connection", arguments: arguments_ }) as Promise<Result>;
        const first = await call(args);
        const replay = await call(args);
        expect(first.isError).not.toBe(true);
        expect(textOf(replay)).toBe(textOf(first));
        expect(creates).toBe(1);
        expect((await call({ ...args, name: "different body" })).isError).toBe(true);
        expect(statuses.at(-1)).toBe(422);
        expect(creates).toBe(1);
        inProgress = true;
        expect((await call(args)).isError).toBe(true);
        expect(statuses.at(-1)).toBe(409);
        inProgress = false;
        expect(textOf(await call(args))).toBe(textOf(first));
        expect(seen.every((r) => r.key === args.idempotencyKey && !("idempotencyKey" in r.body))).toBe(true);
        expect(seen.every((r) => r.tenant === "fixture-customer" && r.context === "fixture-customer")).toBe(true);
        const before = seen.length;
        const { idempotencyKey: _key, ...missingKey } = args;
        expect((await call(missingKey)).isError).toBe(true);
        expect(seen).toHaveLength(before);
    });

    it("uses the observed ETag, preserves replacement values, and refuses stale/wildcard updates", async () => {
        await client.callTool({
            name: "create_cloudflow_connection",
            arguments: {
                idempotencyKey: "fixture-create-2",
                name: "Disposable",
                awsConfig: { roleName: "old-role" },
                collaborators: [{ email: "fixture@example.com", role: "owner" }],
            },
        });
        const read = (await client.callTool({
            name: "get_cloudflow_connection",
            arguments: { connectionId: "fixture-1" },
        })) as Result;
        const args = {
            connectionId: "fixture-1",
            ifMatch: JSON.parse(textOf(read)).etag,
            awsConfig: { roleName: "new-role" },
            collaborators: [],
        };
        const call = (arguments_: Record<string, unknown>) =>
            client.callTool({ name: "update_cloudflow_connection", arguments: arguments_ }) as Promise<Result>;
        const updated = await call(args);
        expect(updated.isError).not.toBe(true);
        expect(connection).toMatchObject({ etag: '"v2"', awsConfig: { roleName: "new-role" }, collaborators: [] });
        expect(seen.at(-1)).toMatchObject({ ifMatch: '"v1"', tenant: "fixture-customer", context: "fixture-customer" });
        expect(seen.at(-1)?.body).not.toHaveProperty("ifMatch");
        expect(seen.at(-1)?.body).not.toHaveProperty("connectionId");
        expect((await call(args)).isError).toBe(true);
        expect(statuses.at(-1)).toBe(412);
        expect(connection?.etag).toBe('"v2"');
        const before = seen.length;
        for (const ifMatch of [undefined, "*", "", "v2", '"v2"\r\nInjected: true']) {
            expect((await call({ ...args, ifMatch })).isError).toBe(true);
        }
        expect(seen).toHaveLength(before);
        expect((await call({ ...args, ifMatch: 'W/"v2"', name: "renamed" })).isError).not.toBe(true);
    });

    it("sends generated dry-run keys without reserving them and validates a prior matching request", async () => {
        const args = { flowId: "fixture-flow", "Idempotency-Key": "fixture-dry-run", dryRun: true };
        const call = (arguments_: Record<string, unknown>) =>
            client.callTool({ name: "test_run_cloudflow_flow", arguments: arguments_ }) as Promise<Result>;
        expect(JSON.parse(textOf(await call(args)))).toEqual({ valid: true });
        expect(JSON.parse(textOf(await call(args)))).toEqual({ valid: true });
        expect(creates).toBe(0);
        const real = await call({ ...args, dryRun: false });
        expect(JSON.parse(textOf(real)).runId).toBe("fixture-run-1");
        expect(textOf(await call({ ...args, dryRun: false }))).toBe(textOf(real));
        expect(creates).toBe(1);
        // A matching dry-run validates rather than replaying the real run response.
        expect(JSON.parse(textOf(await call(args)))).toEqual({ valid: true });
        expect(creates).toBe(1);
        expect(seen.every((r) => r.key === args["Idempotency-Key"])).toBe(true);
        const before = seen.length;
        const { "Idempotency-Key": _key, ...missingKey } = args;
        expect((await call(missingKey)).isError).toBe(true);
        expect(seen).toHaveLength(before);
    });

    it("propagates an explicit customer ID ahead of the environment context", async () => {
        await client.callTool({
            name: "create_cloudflow_connection",
            arguments: {
                idempotencyKey: "fixture-context",
                name: "Disposable",
                gcpConfig: {},
                customerContext: "other-fixture-customer",
            },
        });
        expect(seen.at(-1)).toMatchObject({ tenant: "other-fixture-customer", context: "other-fixture-customer" });
        await client.callTool({
            name: "update_cloudflow_connection",
            arguments: {
                connectionId: "fixture-1",
                ifMatch: '"v1"',
                name: "renamed",
                customerContext: "other-fixture-customer",
            },
        });
        expect(seen.at(-1)).toMatchObject({
            tenant: "other-fixture-customer",
            context: "other-fixture-customer",
            ifMatch: '"v1"',
        });
    });

    it("turns HTTP-200 Ava application errors into sanitized MCP errors", async () => {
        avaError = { code: "generation_failed", message: "Unavailable Bearer fixture-secret", stack: "private stack" };
        const result = (await client.callTool({
            name: "ask_ava_sync",
            arguments: { question: "fixture question" },
        })) as Result;
        expect(statuses).toEqual([200]);
        expect(result.isError).toBe(true);
        expect(textOf(result)).toContain("generation_failed");
        expect(textOf(result)).not.toContain("fixture-secret");
        expect(textOf(result)).not.toContain("private stack");
        expect(seen[0]).toMatchObject({
            body: { question: "fixture question", ephemeral: true },
            tenant: "fixture-customer",
            context: "fixture-customer",
        });
    });
});
