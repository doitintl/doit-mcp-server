import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeToolHandler } from "../../utils/toolsHandler.js";
import { CLOUD_CONNECT_TOOLS, handleCloudConnectRequest } from "../cloudConnect.js";

const scope = { provider: "aws", kind: "aws_account", accountId: "111111111111" };
const identity = { kind: "aws_iam_role", roleArn: "arn:aws:iam::111111111111:role/doitintl-cmp" };
const registration = {
    identity,
    bindings: [{ scope, featureIds: ["core", "quotas"] }],
    catalogVersion: "sha256:current",
};
const text = (response: any) => response.content.find((block: any) => block.type === "text").text;
const data = (response: any) => JSON.parse(text(response));
const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
    new Response(
        JSON.stringify({
            type: `https://developer.doit.com/errors/${code}`,
            title: "Problem",
            status,
            detail: "Detail.",
            instance: "https://api.doit.com/requests/req_01FIXTURE",
            code,
            retryable: false,
            ...extra,
        }),
        { status, headers: { "request-id": "req_01FIXTURE", "content-type": "application/problem+json" } }
    );
let requests: Array<{ url: URL; options: RequestInit; body: any }>;
let response: () => Response;

beforeEach(() => {
    requests = [];
    response = () =>
        new Response(JSON.stringify({ id: "amazon-web-services-111111111111", etag: '"2.abc"' }), {
            headers: { etag: '"2.abc"', "request-id": "req_01FIXTURE" },
        });
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url, options) => {
            requests.push({ url: new URL(url), options, body: options.body ? JSON.parse(options.body) : undefined });
            return response();
        })
    );
});
afterEach(() => vi.unstubAllGlobals());

describe("Cloud Connect transport contract", () => {
    it("wraps the seven AWS operations plus a read-only dry-run tool", () => {
        expect(CLOUD_CONNECT_TOOLS).toHaveLength(8);
        expect(new Set(CLOUD_CONNECT_TOOLS.map((tool) => tool.coversEndpoint).filter(Boolean)).size).toBe(7);
        expect(CLOUD_CONNECT_TOOLS.map((tool) => tool.coversEndpoint)).toContain(
            "post:/onboarding/v2/connections/{connectionId}/actions/verify"
        );
        expect(
            CLOUD_CONNECT_TOOLS.find((tool) => tool.name === "dry_run_cloud_connection_change")?.annotations
        ).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    });
    it("sends customer context, an Idempotency-Key and returns etag, Request-Id and the key used", async () => {
        const result = await handleCloudConnectRequest(
            "register_cloud_connection",
            { ...registration, customerContext: "fixture-customer" },
            "fixture-token"
        );
        const headers = requests[0].options.headers as Record<string, string>;
        expect(headers).toMatchObject({ "X-Tenant-Id": "fixture-customer" });
        expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
        expect(data(result)).toMatchObject({
            etag: '"2.abc"',
            requestId: "req_01FIXTURE",
            idempotencyKey: headers["Idempotency-Key"],
        });
        expect(requests[0].url.pathname).toBe("/onboarding/v2/connections");
        expect(requests[0].body).toEqual(registration);
    });
    it.each([
        ['"body"', 'W/"body"', '"body"'],
        ['"body"', '"header"', '"body"'],
        ['"body"', undefined, '"body"'],
        [undefined, '"header"', '"header"'],
    ])("returns body etag %s with header %s as %s", async (bodyEtag, headerEtag, expected) => {
        response = () =>
            new Response(JSON.stringify({ id: "fixture", ...(bodyEtag ? { etag: bodyEtag } : {}) }), {
                headers: headerEtag ? { etag: headerEtag } : {},
            });
        const result = await executeToolHandler("get_cloud_connection", { connectionId: "fixture" }, "fixture-token");
        expect(data(result).etag).toBe(expected);
    });
    it("keeps a caller-supplied Idempotency-Key for an identical retry", async () => {
        await handleCloudConnectRequest(
            "register_cloud_connection",
            { ...registration, idempotencyKey: "retry-key" },
            "fixture-token"
        );
        await handleCloudConnectRequest(
            "register_cloud_connection",
            { ...registration, idempotencyKey: "retry-key" },
            "fixture-token"
        );
        expect(requests.map((request) => (request.options.headers as any)["Idempotency-Key"])).toEqual([
            "retry-key",
            "retry-key",
        ]);
        expect(requests[0].body.idempotencyKey).toBeUndefined();
    });
    it("sends PATCH as a merge patch of complete desired state with If-Match", async () => {
        await handleCloudConnectRequest(
            "update_cloud_connection",
            {
                connectionId: "amazon-web-services-111111111111",
                expectedEtag: '"1.abc"',
                catalogVersion: "sha256:current",
                bindings: [{ bindingId: "binding_aws_account_111111111111", featureIds: ["core", "quotas", "eks"] }],
            },
            "fixture-token"
        );
        const headers = requests[0].options.headers as Record<string, string>;
        expect(requests[0].options.method).toBe("PATCH");
        expect(headers).toMatchObject({ "Content-Type": "application/merge-patch+json", "If-Match": '"1.abc"' });
        expect(headers["Idempotency-Key"]).toBeTruthy();
        expect(requests[0].body).toEqual({
            catalogVersion: "sha256:current",
            bindings: [{ bindingId: "binding_aws_account_111111111111", featureIds: ["core", "quotas", "eks"] }],
        });
    });
    it("uses read-only dry runs for register, update and remove without leaking control fields", async () => {
        const id = "amazon-web-services-111111111111";
        await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            { operation: "register", ...registration },
            "fixture-token"
        );
        await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            {
                operation: "update",
                connectionId: id,
                expectedEtag: '"v1"',
                bindings: [{ bindingId: "b", featureIds: ["core"] }],
            },
            "fixture-token"
        );
        await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            { operation: "remove", connectionId: id, expectedEtag: '"v1"', cleanupScope: "doit_only" },
            "fixture-token"
        );
        expect(requests.map((request) => request.options.method)).toEqual(["POST", "PATCH", "DELETE"]);
        expect(requests.every((request) => request.url.searchParams.get("dryRun") === "true")).toBe(true);
        expect(requests[1].options.headers).toMatchObject({ "If-Match": '"v1"' });
        expect(requests[1].body.expectedEtag).toBeUndefined();
        expect(requests[1].body.idempotencyKey).toBeUndefined();
        expect(requests[2].body).toBeUndefined();
        expect(requests[2].url.searchParams.get("cleanupScope")).toBe("doit_only");
    });
    it("rejects non-AWS scopes, private keys, bad account IDs and wildcard etags before HTTP", async () => {
        for (const [name, args] of [
            ["get_cloud_connect_requirements", { scope: { provider: "gcp", kind: "gcp_project", projectId: "x" } }],
            ["get_cloud_connect_requirements", { scope: { ...scope, accountId: "11111111111o" } }],
            ["register_cloud_connection", { ...registration, identity: { ...identity, private_key: "secret" } }],
            ["remove_cloud_connection", { connectionId: "c", expectedEtag: "*", cleanupScope: "doit_only" }],
            ["remove_cloud_connection", { connectionId: "c", expectedEtag: 'W/"1"', cleanupScope: "doit_only" }],
            [
                "register_cloud_connection",
                { ...registration, bindings: [registration.bindings[0], registration.bindings[0]] },
            ],
            ["update_cloud_connection", { connectionId: "c", expectedEtag: '"1"', bindings: [] }],
            ["explain_cloud_connect_failure", {}],
            ["report_cloud_connect_event", { events: [] }],
        ] as const)
            expect((await handleCloudConnectRequest(name, args, "fixture-token")).isError).toBe(true);
        expect(requests).toHaveLength(0);
    });
    it("sends requirements with discovery inputs and no catalogVersion, without a write key", async () => {
        await handleCloudConnectRequest(
            "get_cloud_connect_requirements",
            { scope, featureIds: ["real-time-data"], featureInputs: { "real-time-data": { bucketName: "b" } } },
            "fixture-token"
        );
        expect((requests[0].options.headers as any)["Idempotency-Key"]).toBeUndefined();
        expect(requests[0].url.pathname).toBe("/onboarding/v2/requirements");
        expect(requests[0].body.catalogVersion).toBeUndefined();
    });
    it("verifies through the connection action with the optional selection as body", async () => {
        await handleCloudConnectRequest(
            "verify_cloud_connect",
            { connectionId: "amazon-web-services-111111111111", featureIds: ["core"] },
            "fixture-token"
        );
        expect(requests[0].options.method).toBe("POST");
        expect(requests[0].url.pathname).toBe(
            "/onboarding/v2/connections/amazon-web-services-111111111111/actions/verify"
        );
        expect(requests[0].body).toEqual({ featureIds: ["core"] });
        expect((requests[0].options.headers as any)["Idempotency-Key"]).toBeUndefined();
    });
    it("preserves standards problems, correlates by Request-Id, returns the key and never retries", async () => {
        for (const [status, code, extra] of [
            [409, "onboarding.catalog_version_stale", {}],
            [409, "onboarding.connection_exists", { details: [{ issue: "exists", id: "amazon-web-services-1" }] }],
            [412, "precondition_failed", {}],
            [422, "onboarding.registration_gate_failed", { retryable: true }],
        ] as const) {
            response = () => problem(status, code, extra);
            const result = await handleCloudConnectRequest("register_cloud_connection", registration, "fixture-token");
            expect(result.isError).toBe(true);
            expect(data(result)).toMatchObject({
                status,
                code,
                requestId: "req_01FIXTURE",
                idempotencyKey: expect.any(String),
                ...extra,
            });
        }
        expect(requests).toHaveLength(4);
    });
    it("redacts credentials from problem bodies", async () => {
        response = () =>
            problem(400, "validation_failed", { detail: "Authorization: Bearer fixture-token AKIAABCDEFGHIJKLMNOP" });
        const result = await handleCloudConnectRequest("get_cloud_connect_requirements", { scope }, "fixture-token");
        expect(text(result)).not.toContain("fixture-token");
        expect(text(result)).not.toContain("AKIAABCDEFGHIJKLMNOP");
    });
    it("builds the list filter from exact scope and feature and passes paging", async () => {
        response = () => new Response(JSON.stringify({ items: [], pageToken: "next-page" }));
        const result = await handleCloudConnectRequest(
            "list_cloud_connections",
            { scope, featureId: "core", maxResults: 2, pageToken: "previous-page" },
            "fixture-token"
        );
        expect(data(result).pageToken).toBe("next-page");
        const params = requests[0].url.searchParams;
        expect(params.get("filter")).toBe(
            "provider:aws|bindings.scope.kind:aws_account|bindings.scope.accountId:111111111111|bindings.featureIds:core"
        );
        expect(params.get("maxResults")).toBe("2");
        expect(params.get("pageToken")).toBe("previous-page");
        await handleCloudConnectRequest("list_cloud_connections", {}, "fixture-token");
        expect(requests[1].url.searchParams.get("filter")).toBe("provider:aws");
    });
    it("reports a 204 removal as deleted with the key used and keeps the record on cleanup_failed", async () => {
        const remove = {
            connectionId: "amazon-web-services-111111111111",
            expectedEtag: '"2.abc"',
            cleanupScope: "doit_only",
            idempotencyKey: "remove-key",
        };
        response = () => new Response(null, { status: 204, headers: { "request-id": "req_01DELETE" } });
        expect(data(await handleCloudConnectRequest("remove_cloud_connection", remove, "fixture-token"))).toEqual({
            deleted: true,
            requestId: "req_01DELETE",
            idempotencyKey: "remove-key",
        });
        response = () => problem(409, "onboarding.cleanup_failed", { retryable: true });
        const failed = await handleCloudConnectRequest("remove_cloud_connection", remove, "fixture-token");
        expect(failed.isError).toBe(true);
        expect(data(failed)).toMatchObject({ code: "onboarding.cleanup_failed", retryable: true });
    });
    it("bypasses hosted widget conversion so check coverage and follow-ups remain intact", async () => {
        const payload = {
            checks: [
                {
                    featureId: "real-time-data",
                    status: "partial",
                    coverage: { sampledResources: ["object-1"], truncated: true, complete: false },
                },
            ],
            recorded: true,
        };
        response = () => new Response(JSON.stringify(payload));
        const convert = vi.fn(() => ({ content: [] }));
        const result = await executeToolHandler(
            "verify_cloud_connect",
            { connectionId: "amazon-web-services-111111111111" },
            "fixture-token",
            { convertResponse: convert, onResponseMetrics: () => {} }
        );
        expect(data(result)).toEqual(payload);
        expect(convert).not.toHaveBeenCalled();
    });
});

describe("Google Cloud scopes", () => {
    const serviceAccount = {
        email: "doit-cmp@example-project.iam.gserviceaccount.com",
        uniqueId: "100000000000000000001",
        projectId: "example-project",
    };
    it.each([
        { provider: "gcp", kind: "gcp_organization", organizationId: "123456789012" },
        { provider: "gcp", kind: "gcp_project", projectId: "example-project" },
        { provider: "gcp", kind: "gcp_dataset", projectId: "example-project", datasetId: "example_dataset" },
    ])("registers and filters native scope $kind", async (scope) => {
        await executeToolHandler(
            "register_cloud_connection",
            { identity: { kind: "gcp_service_account", serviceAccount }, bindings: [{ scope, featureIds: ["core"] }] },
            "fixture-token"
        );
        expect(requests[0].body.identity.serviceAccount).toEqual(serviceAccount);
        expect(requests[0].body.bindings[0].scope).toEqual(scope);
        await executeToolHandler("list_cloud_connections", { scope }, "fixture-token");
        const filter = requests[1].url.searchParams.get("filter");
        expect(filter).toContain("provider:gcp");
        expect(filter).toContain(`bindings.scope.kind:${scope.kind}`);
        for (const [key, value] of Object.entries(scope))
            if (key !== "provider" && key !== "kind") expect(filter).toContain(`bindings.scope.${key}:${value}`);
    });
    it("rejects a cross-provider identity before HTTP", async () => {
        const result = await executeToolHandler(
            "register_cloud_connection",
            {
                identity,
                bindings: [
                    {
                        scope: { provider: "gcp", kind: "gcp_project", projectId: "example-project" },
                        featureIds: ["core"],
                    },
                ],
            },
            "fixture-token"
        );
        expect(result.isError).toBe(true);
        expect(requests).toHaveLength(0);
    });
    it("rejects service-account private key material", async () => {
        const result = await executeToolHandler(
            "register_cloud_connection",
            {
                identity: {
                    kind: "gcp_service_account",
                    serviceAccount: { ...serviceAccount, private_key: "fixture-forbidden-key" },
                },
                bindings: [
                    {
                        scope: { provider: "gcp", kind: "gcp_project", projectId: "example-project" },
                        featureIds: ["core"],
                    },
                ],
            },
            "fixture-token"
        );
        expect(result.isError).toBe(true);
        expect(requests).toHaveLength(0);
    });
    it("rejects provider and scope mismatch on list", async () => {
        const result = await executeToolHandler(
            "list_cloud_connections",
            { provider: "aws", scope: { provider: "gcp", kind: "gcp_project", projectId: "example-project" } },
            "fixture-token"
        );
        expect(result.isError).toBe(true);
        expect(requests).toHaveLength(0);
    });
});
