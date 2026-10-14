import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

const SERVER_ENTRY = fileURLToPath(new URL("../../../dist/index.js", import.meta.url));
const text = (result: any) => result.content.find((part: any) => part.type === "text")?.text ?? "";
const fixtures = [
    {
        scope: { provider: "aws", kind: "aws_account", accountId: "123456789012" },
        identity: { kind: "aws_iam_role", roleArn: "arn:aws:iam::123456789012:role/fixture" },
    },
    {
        scope: { provider: "gcp", kind: "gcp_project", projectId: "target-project" },
        identity: {
            kind: "gcp_service_account",
            email: "fixture@identity-project.iam.gserviceaccount.com",
            uniqueId: "123456789012345678901",
            projectId: "identity-project",
        },
        credentialMode: "workload_identity_federation",
    },
    {
        scope: {
            provider: "azure",
            kind: "azure_management_group",
            tenantId: "11111111-1111-4111-8111-111111111111",
            managementGroupId: "fixture-group",
        },
        identity: {
            kind: "azure_enterprise_application",
            tenantId: "11111111-1111-4111-8111-111111111111",
            principalId: "22222222-2222-4222-8222-222222222222",
        },
    },
];

// Real stdio + disposable local API exercise the packaged tool/skill contract.
// These fixtures do not qualify a real cloud deployment or the hosted Worker.
describe.skipIf(!existsSync(SERVER_ENTRY) && !process.env.CI)("built Cloud Connect lifecycle", () => {
    let api: Server;
    let client: Client;
    let records: Map<string, any>;
    let requestCount: number;
    beforeEach(async () => {
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
                    "Content-Type": "application/json",
                    "X-Request-Id": requestId,
                    ...(etag ? { ETag: etag } : {}),
                });
                res.end(JSON.stringify(data));
            };
            if (
                req.headers.authorization !== "Bearer disposable-fixture-key" ||
                req.headers["x-tenant-id"] !== "fixture-customer"
            )
                return reply(401, { code: "unauthorized", requestId });
            if (!url.pathname.startsWith("/onboarding/v2/")) return reply(404, { code: "wrong_route", requestId });
            const family = url.pathname.split("/")[3];
            const id = decodeURIComponent(url.pathname.split("/")[4] ?? "");
            if (family === "requirements")
                return reply(200, {
                    catalogVersion: "fixture-current",
                    scope: body.scope,
                    features: (body.featureIds ?? ["core"]).map((id: string) => ({
                        id,
                        status: "available",
                        permissionSet: {
                            scopeKind: body.scope.kind,
                            permissions: ["fixture.permission"],
                            healthChecks: ["fixture_probe"],
                        },
                    })),
                    artifacts: [
                        { artifactId: "fixture-controller", registersConnection: false, deployable: !!body.featureIds },
                    ],
                    preconditions: { status: "satisfied" },
                    identity: { status: "resolved" },
                });
            if (family === "events") {
                return reply(202, { schemaVersion: "1", accepted: [{ index: 0, eventId: "fixture-event" }] });
            }
            if (family === "diagnostics") {
                const sources = [
                    { source: "doit_logs", status: "available" },
                    { source: "customer_reports", status: "available" },
                ];
                const historyRequest = url.searchParams.get("requestId");
                if (historyRequest === "hybrid-unavailable")
                    return reply(503, { code: "diagnostics_unavailable", requestId: "history-request" });
                if (url.searchParams.get("pageToken") === "partial-next")
                    return reply(409, { code: "diagnostics_cursor_invalidated", requestId: "history-request" });
                if (historyRequest === "hybrid-history" && !url.searchParams.has("pageToken"))
                    return reply(200, {
                        events: sources.map(({ source }) => ({
                            schemaVersion: "1",
                            eventId: "shared-event-id",
                            source,
                            evidenceSource: source === "doit_logs" ? "doit_backend" : "client_reported",
                            provider: "aws",
                            stage: "registration",
                            recordedAt: "2026-10-14T12:00:00Z",
                        })),
                        partial: false,
                        sources,
                        nextPageToken: "hybrid-next",
                    });
                if (historyRequest === "hybrid-partial")
                    return reply(200, {
                        events: [],
                        partial: true,
                        sources: [
                            {
                                source: "doit_logs",
                                status: "unavailable",
                                error: {
                                    code: "diagnostics_source_unavailable",
                                    message: "Diagnostic source is temporarily unavailable",
                                },
                            },
                            sources[1],
                        ],
                        nextPageToken: "partial-next",
                    });
                return reply(200, { events: [], partial: false, sources });
            }
            if (family === "verifications")
                return reply(200, {
                    requestId,
                    catalogVersion: "fixture-current",
                    connectionRevision: records.get(body.connectionId)?.revision,
                    authentication: { status: "passed" },
                    checks: [
                        {
                            bindingId: "fixture-binding",
                            featureId: "core",
                            status: "passed",
                            coverage: { complete: true, truncated: false, sampledResources: [] },
                        },
                    ],
                });
            if (req.method === "GET") {
                if (!id) return reply(200, { items: [...records.values()], nextPageToken: null });
                const record = records.get(id);
                return record
                    ? reply(200, record, `"${record.revision}"`)
                    : reply(404, { code: "not_found", requestId });
            }
            if (body.catalogVersion && body.catalogVersion !== "fixture-current")
                return reply(409, { code: "catalog_version_stale", requestId });
            if (req.method !== "POST" && req.headers["if-match"] !== `"${records.get(id)?.revision}"`)
                return reply(412, {
                    code: "revision_mismatch",
                    requestId,
                    findings: [{ code: "revision_mismatch", message: "Read the current connection" }],
                });
            if (url.searchParams.get("dryRun") === "true")
                return reply(200, {
                    dryRun: true,
                    wouldApply: true,
                    doitSideEffects:
                        req.method === "DELETE"
                            ? [{ kind: "delete_bigquery_dataset", destructive: true, dataLoss: true }]
                            : [],
                    resultingBindings: body.bindings,
                });
            if (req.method === "POST") {
                const connectionId = `${body.bindings[0].scope.provider}-fixture`;
                const existing = records.get(connectionId);
                if (existing) return reply(200, existing, `"${existing.revision}"`);
                const record = {
                    connectionId,
                    identity: body.identity,
                    bindings: body.bindings.map((binding: any) => ({ ...binding, bindingId: "fixture-binding" })),
                    revision: "1",
                    followUps: [{ kind: "fixture-follow-up", status: "succeeded" }],
                };
                records.set(connectionId, record);
                return reply(201, record, '"1"');
            }
            if (req.method === "PATCH") {
                const record = { ...records.get(id), revision: "2" };
                records.set(id, record);
                return reply(200, record, '"2"');
            }
            if (req.method === "DELETE") {
                if (url.searchParams.get("cleanupScope") !== "doit_only")
                    return reply(400, { code: "cleanup_scope_required", requestId });
                records.delete(id);
                return reply(200, {
                    connectionId: id,
                    doitCleanup: { status: "succeeded" },
                    cloudCleanup: { status: "customer_review_required" },
                });
            }
            return reply(405, { code: "unsupported", requestId });
        });
        await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
        const address = api.address();
        if (!address || typeof address === "string") throw new Error("Fixture did not start");
        client = new Client(
            { name: "cloud-connect-fixture", version: "1" },
            { versionNegotiation: { mode: { pin: "2026-07-28" } } }
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

    it.each(fixtures)(
        "resolves, previews, registers, repairs, verifies and disconnects $scope.provider",
        async (fixture) => {
            const call = async (name: string, args: any) => {
                const result = await client.callTool({ name, arguments: args });
                expect(result.isError, text(result)).not.toBe(true);
                return JSON.parse(text(result));
            };
            const discovery = await call("get_cloud_connect_requirements", { scope: fixture.scope });
            expect(discovery.artifacts[0].deployable).toBe(false);
            const requirements = await call("get_cloud_connect_requirements", {
                scope: fixture.scope,
                featureIds: ["core"],
            });
            const registration = {
                identity: fixture.identity,
                ...(fixture.credentialMode ? { credentialMode: fixture.credentialMode } : {}),
                bindings: [{ scope: fixture.scope, featureIds: ["core"] }],
                catalogVersion: requirements.catalogVersion,
            };
            await call("dry_run_cloud_connection_change", { operation: "register", ...registration });
            expect(records.size).toBe(0);
            const connection = await call("register_cloud_connection", registration);
            await call("register_cloud_connection", registration);
            expect(records.size).toBe(1);
            const read = await call("get_cloud_connection", { connectionId: connection.connectionId });
            expect(read.etag).toBe(connection.etag);
            const patch = {
                connectionId: connection.connectionId,
                expectedEtag: read.etag,
                catalogVersion: requirements.catalogVersion,
                followUps: { retry: [{ bindingId: "fixture-binding", featureId: "core", kind: "fixture-follow-up" }] },
            };
            await call("dry_run_cloud_connection_change", { operation: "update", ...patch });
            const changed = await call("update_cloud_connection", patch);
            const stale = await client.callTool({ name: "update_cloud_connection", arguments: patch });
            expect(stale.isError).toBe(true);
            expect(JSON.parse(text(stale)).code).toBe("revision_mismatch");
            const verified = await call("verify_cloud_connect", { connectionId: connection.connectionId });
            expect(verified.checks[0].coverage.complete).toBe(true);
            await call("report_cloud_connect_event", {
                events: [
                    {
                        provider: fixture.scope.provider,
                        stage: "deployment",
                        scope: fixture.scope,
                        observation: { kind: "deployment_context", toolId: "customer_controller" },
                    },
                ],
            });
            const history = await call("explain_cloud_connect_failure", { connectionId: connection.connectionId });
            expect(history).toMatchObject({
                events: [],
                partial: false,
                sources: [
                    { source: "doit_logs", status: "available" },
                    { source: "customer_reports", status: "available" },
                ],
            });
            const remove = {
                connectionId: connection.connectionId,
                expectedEtag: changed.etag,
                cleanupScope: "doit_only",
            };
            const preview = await call("dry_run_cloud_connection_change", { operation: "remove", ...remove });
            expect(preview.doitSideEffects[0].dataLoss).toBe(true);
            expect(records.size).toBe(1);
            const removed = await call("remove_cloud_connection", remove);
            expect(removed.cloudCleanup.status).toBe("customer_review_required");
            expect((await call("list_cloud_connections", { scope: fixture.scope })).items).toEqual([]);
        }
    );
    it("preserves merged history, partial availability and invalidated cursors through stdio", async () => {
        const invoke = (args: Record<string, unknown>) =>
            client.callTool({ name: "explain_cloud_connect_failure", arguments: args });
        const filters = { requestId: "hybrid-history", since: "2026-10-14T00:00:00Z", until: "2026-10-14T23:59:59Z" };
        const first = JSON.parse(text(await invoke(filters)));
        expect(first.partial).toBe(false);
        expect(first.events.map((event: any) => [event.source, event.eventId])).toEqual([
            ["doit_logs", "shared-event-id"],
            ["customer_reports", "shared-event-id"],
        ]);
        const next = JSON.parse(text(await invoke({ ...filters, pageToken: first.nextPageToken })));
        expect(next).toMatchObject({ events: [], partial: false, sources: first.sources });
        const partial = JSON.parse(text(await invoke({ requestId: "hybrid-partial" })));
        expect(partial).toMatchObject({
            partial: true,
            sources: [
                { source: "doit_logs", status: "unavailable", error: { code: "diagnostics_source_unavailable" } },
                { source: "customer_reports", status: "available" },
            ],
        });
        const invalidated = await invoke({ requestId: "hybrid-partial", pageToken: partial.nextPageToken });
        expect(invalidated.isError).toBe(true);
        expect(JSON.parse(text(invalidated))).toMatchObject({ status: 409, code: "diagnostics_cursor_invalidated" });
        const unavailable = await invoke({ requestId: "hybrid-unavailable" });
        expect(unavailable.isError).toBe(true);
        expect(JSON.parse(text(unavailable))).toMatchObject({ status: 503, code: "diagnostics_unavailable" });
    });
    it("serves the Skills extension manifest and prompt with digest-verifiable resources", async () => {
        const listed = await client.request({ method: "skills/list", params: {} }, z.any());
        const skill = (listed as any).skills[0];
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
