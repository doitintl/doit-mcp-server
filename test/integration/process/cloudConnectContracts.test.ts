import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

const SERVER_ENTRY = fileURLToPath(new URL("../../../dist/index.js", import.meta.url));
const text = (result: any) => result.content.find((part: any) => part.type === "text")?.text ?? "";
const scope = { provider: "aws", kind: "aws_account", accountId: "123456789012" };
const identity = { kind: "aws_iam_role", roleArn: "arn:aws:iam::123456789012:role/fixture" };

// Real stdio + disposable local API exercise the packaged tool/skill contract.
// These fixtures do not qualify a real cloud deployment or the hosted Worker.
describe.skipIf(!existsSync(SERVER_ENTRY) && !process.env.CI)("built Cloud Connect lifecycle", () => {
    let api: Server;
    let client: Client;
    let records: Map<string, any>;
    let requestCount: number;
    let encoding: "identity" | "gzip" | "br";
    beforeEach(async () => {
        encoding = "identity";
        records = new Map();
        requestCount = 0;
        api = createServer(async (req, res) => {
            const requestId = `fixture-${++requestCount}`;
            let raw = "";
            for await (const chunk of req) raw += chunk;
            const body = raw ? JSON.parse(raw) : {};
            const url = new URL(req.url ?? "/", "http://localhost");
            const reply = (status: number, data: any, etag?: string) => {
                res.writeHead(status, {
                    "Content-Type": status >= 400 ? "application/problem+json" : "application/json",
                    "Request-Id": requestId,
                    ...(etag ? { ETag: encoding === "identity" ? etag : `W/${etag}` } : {}),
                    ...(status !== 204 && encoding !== "identity" ? { "Content-Encoding": encoding } : {}),
                });
                if (status === 204) return res.end();
                const payload = Buffer.from(JSON.stringify(data));
                res.end(
                    encoding === "gzip" ? gzipSync(payload) : encoding === "br" ? brotliCompressSync(payload) : payload
                );
            };
            const problem = (status: number, code: string) =>
                reply(status, {
                    type: `https://developer.doit.com/errors/${code}`,
                    title: code,
                    status,
                    detail: code,
                    instance: `https://api.doit.com/requests/${requestId}`,
                    code,
                    retryable: false,
                });
            if (
                req.headers.authorization !== "Bearer disposable-fixture-key" ||
                req.headers["x-tenant-id"] !== "fixture-customer"
            )
                return problem(401, "unauthorized");
            if (!url.pathname.startsWith("/onboarding/v2/")) return problem(404, "wrong_route");
            const parts = url.pathname.split("/").slice(3);
            const family = parts[0];
            const id = decodeURIComponent(parts[1] ?? "");
            if (family === "requirements")
                return reply(200, {
                    catalogVersion: "fixture-current",
                    scope: body.scope,
                    features: (body.featureIds ?? ["core"]).map((id: string) => ({
                        id,
                        status: "available",
                        requirementsSatisfied: !!body.featureIds,
                    })),
                    artifacts:
                        body.scope?.kind === "aws_organization"
                            ? [
                                  {
                                      artifactId: "aws-cloudformation-organization",
                                      registration: "callback",
                                      requirementsSatisfied: !!body.featureIds,
                                      templateUrl: "https://example.com/management.yml",
                                      version: "sha256-parent",
                                      parameters: body.featureIds
                                          ? {
                                                DeploymentTargetID: body.scope.targetId,
                                                SourceTemplateURL: "https://example.com/member.yml",
                                            }
                                          : {},
                                      dependencies: [
                                          {
                                              artifactId: "aws-cloudformation-member",
                                              templateUrl: "https://example.com/member.yml",
                                              version: "sha256-member",
                                          },
                                      ],
                                  },
                              ]
                            : [
                                  {
                                      artifactId: "fixture-controller",
                                      registration: "manual",
                                      requirementsSatisfied: !!body.featureIds,
                                  },
                              ],
                });
            if (parts[2] === "actions" && parts[3] === "verify")
                return reply(200, {
                    catalogVersion: "fixture-current",
                    connectionRevision: records.get(id)?.revision,
                    authentication: { status: "passed" },
                    checks: [
                        {
                            bindingId: "fixture-binding",
                            featureId: "core",
                            kind: "feature_health_check",
                            status: "passed",
                            coverage: { complete: true, truncated: false, sampledResources: [] },
                        },
                    ],
                    recorded: true,
                });
            if (req.method === "GET") {
                if (!id) return reply(200, { items: [...records.values()], pageToken: null });
                const record = records.get(id);
                return record ? reply(200, record, record.etag) : problem(404, "not_found");
            }
            if (!req.headers["idempotency-key"]) return problem(400, "idempotency_key_required");
            if (body.catalogVersion && body.catalogVersion !== "fixture-current")
                return problem(409, "onboarding.catalog_version_stale");
            if (req.method !== "POST") {
                if (!records.has(id)) return problem(404, "not_found");
                if (!req.headers["if-match"]) return problem(428, "precondition_required");
                if (req.headers["if-match"] !== records.get(id).etag) return problem(412, "precondition_failed");
            }
            if (req.method === "PATCH" && req.headers["content-type"] !== "application/merge-patch+json")
                return problem(415, "unsupported_media_type");
            if (url.searchParams.get("dryRun") === "true")
                return reply(200, {
                    dryRun: true,
                    wouldApply: true,
                    doitSideEffects:
                        req.method === "DELETE" ? [{ kind: "deconfigure_cloudtrail_bucket", destructive: false }] : [],
                    resultingBindings: body.bindings,
                });
            if (req.method === "POST") {
                const connectionId = "amazon-web-services-fixture";
                if (records.has(connectionId)) return problem(409, "onboarding.connection_exists");
                const record = {
                    id: connectionId,
                    etag: '"1.fixture"',
                    revision: "1",
                    identity: body.identity,
                    bindings: body.bindings.map((binding: any) => ({ ...binding, bindingId: "fixture-binding" })),
                    followUps: [
                        { bindingId: "fixture-binding", featureId: "core", kind: "fixture", status: "succeeded" },
                    ],
                };
                records.set(connectionId, record);
                return reply(201, record, record.etag);
            }
            if (req.method === "PATCH") {
                const record = { ...records.get(id), revision: "2", etag: '"2.fixture"', bindings: body.bindings };
                records.set(id, record);
                return reply(200, record, record.etag);
            }
            if (req.method === "DELETE") {
                if (url.searchParams.get("cleanupScope") !== "doit_only") return problem(400, "cleanup_scope_required");
                records.delete(id);
                return reply(204, undefined);
            }
            return problem(405, "unsupported");
        });
        await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
        const address = api.address();
        if (!address || typeof address === "string") throw new Error("Fixture did not start");
        client = new Client(
            { name: "cloud-connect-fixture", version: "1" },
            {
                capabilities: { extensions: { "io.modelcontextprotocol/skills": {} } },
                versionNegotiation: { mode: { pin: "2026-07-28" } },
            }
        );
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

    it("hands organization artifacts and nested source versions through the packaged MCP server", async () => {
        const scope = {
            provider: "aws",
            kind: "aws_organization",
            managementAccountId: "123456789012",
            targetId: "ou-ab12-cdef3456",
        };
        const discovery = await client.callTool({ name: "get_cloud_connect_requirements", arguments: { scope } });
        expect(discovery.isError, text(discovery)).not.toBe(true);
        expect(JSON.parse(text(discovery)).artifacts[0]).toMatchObject({
            requirementsSatisfied: false,
            parameters: {},
        });
        const result = await client.callTool({
            name: "get_cloud_connect_requirements",
            arguments: { scope, featureIds: ["core", "quotas"] },
        });
        expect(result.isError, text(result)).not.toBe(true);
        const artifact = JSON.parse(text(result)).artifacts[0];
        expect(artifact).toMatchObject({
            artifactId: "aws-cloudformation-organization",
            registration: "callback",
            requirementsSatisfied: true,
        });
        expect(artifact.parameters.DeploymentTargetID).toBe(scope.targetId);
        expect(artifact.parameters.SourceTemplateURL).toBe(artifact.dependencies[0].templateUrl);
        expect(artifact.dependencies[0].version).toBe("sha256-member");
        const calls = requestCount;
        const rejected = await client.callTool({
            name: "register_cloud_connection",
            arguments: { identity, bindings: [{ scope, featureIds: ["core"] }] },
        });
        expect(rejected.isError).toBe(true);
        expect(requestCount).toBe(calls);
        expect(records.size).toBe(0);
    });

    it.each(["identity", "gzip", "br"] as const)("round-trips connection etags with %s responses", async (value) => {
        encoding = value;
        const call = async (name: string, args: any) => {
            const result = await client.callTool({ name, arguments: args });
            expect(result.isError, text(result)).not.toBe(true);
            return JSON.parse(text(result));
        };
        const failure = async (name: string, args: any) => {
            const result = await client.callTool({ name, arguments: args });
            expect(result.isError).toBe(true);
            return JSON.parse(text(result));
        };
        const discovery = await call("get_cloud_connect_requirements", { scope });
        expect(discovery.artifacts[0].requirementsSatisfied).toBe(false);
        const requirements = await call("get_cloud_connect_requirements", { scope, featureIds: ["core"] });
        expect(requirements.artifacts[0]).toMatchObject({ registration: "manual", requirementsSatisfied: true });
        const registration = {
            identity,
            bindings: [{ scope, featureIds: ["core"] }],
            catalogVersion: requirements.catalogVersion,
        };
        await call("dry_run_cloud_connection_change", { operation: "register", ...registration });
        expect(records.size).toBe(0);
        const connection = await call("register_cloud_connection", registration);
        expect(connection.idempotencyKey).toBeTruthy();
        const duplicate = await failure("register_cloud_connection", registration);
        expect(duplicate).toMatchObject({ status: 409, code: "onboarding.connection_exists" });
        expect(records.size).toBe(1);
        const read = await call("get_cloud_connection", { connectionId: connection.id });
        expect(read.etag).toBe('"1.fixture"');
        expect(read.etag).toBe(connection.etag);
        const listed = await call("list_cloud_connections", { scope, featureId: "core" });
        expect(listed.items).toHaveLength(1);
        const patch = {
            connectionId: connection.id,
            expectedEtag: read.etag,
            catalogVersion: requirements.catalogVersion,
            bindings: [{ bindingId: "fixture-binding", featureIds: ["core", "quotas"] }],
        };
        await call("dry_run_cloud_connection_change", { operation: "update", ...patch });
        const changed = await call("update_cloud_connection", patch);
        expect(changed.etag).toBe('"2.fixture"');
        const stale = await failure("update_cloud_connection", patch);
        expect(stale).toMatchObject({ status: 412, code: "precondition_failed", requestId: expect.any(String) });
        const verified = await call("verify_cloud_connect", { connectionId: connection.id });
        expect(verified.checks[0].coverage.complete).toBe(true);
        const remove = { connectionId: connection.id, expectedEtag: changed.etag, cleanupScope: "doit_only" };
        const preview = await call("dry_run_cloud_connection_change", { operation: "remove", ...remove });
        expect(preview.doitSideEffects).toHaveLength(1);
        expect(records.size).toBe(1);
        expect(await call("remove_cloud_connection", remove)).toMatchObject({ deleted: true });
        expect((await call("list_cloud_connections", { scope })).items).toEqual([]);
    });
    it("serves the Skills extension manifest and prompt with digest-verifiable resources", async () => {
        const listed = await client.request({ method: "skills/list", params: {} }, z.any());
        const skill = listed.skills.find(
            (entry: { uri: string }) => entry.uri === "skill://doit-cloud-connect/SKILL.md"
        );
        expect(skill).toBeDefined();
        const fetched = await client.request({ method: "skills/get", params: { uri: skill.uri } }, z.any());
        expect((fetched as any).skill).toEqual(skill);
        for (const resource of skill.resources) {
            const response = await client.readResource({ uri: resource.uri });
            const raw = Buffer.from((response.contents[0] as any).text);
            expect(`sha256:${createHash("sha256").update(raw).digest("hex")}`).toBe(resource.digest);
            expect(raw.length).toBe(resource.size);
        }
        const prompt = await client.getPrompt({ name: "connect_cloud" });
        expect(JSON.stringify(prompt)).toContain("skill://doit-cloud-connect/references/aws.md");
        expect(requestCount).toBe(0);
    });
});
