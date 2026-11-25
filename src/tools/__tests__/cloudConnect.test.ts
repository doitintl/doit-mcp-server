import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeToolHandler } from "../../utils/toolsHandler.js";
import { CLOUD_CONNECT_TOOLS, handleCloudConnectRequest } from "../cloudConnect.js";

const awsScope = { provider: "aws", kind: "aws_account", accountId: "111111111111" } as const;
const awsRegistration = {
    provider: "aws",
    accountId: "111111111111",
    roleArn: "arn:aws:iam::111111111111:role/doitintl-cmp",
    featureIds: ["core", "quotas"],
    catalogVersion: "sha256:current",
} as const;
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
    it("explains Azure identifier mistakes before making an API request", async () => {
        const azureScope = {
            provider: "azure",
            kind: "azure_management_group",
            tenantId: "11111111-1111-4111-8111-111111111111",
            managementGroupId: "example-child",
        };
        for (const managementGroupId of [
            "Example Group",
            "/providers/Microsoft.Management/managementGroups/example-child",
        ]) {
            const result = await handleCloudConnectRequest(
                "get_cloud_connect_requirements",
                { scope: { ...azureScope, managementGroupId } },
                "fixture-token"
            );
            expect(result.isError).toBe(true);
            expect(text(result)).toContain("scope.managementGroupId");
            expect(text(result)).toContain("bare Azure management group ID");
            expect(text(result)).toContain("not a display name or full ARM resource path");
        }
        const result = await handleCloudConnectRequest(
            "get_cloud_connect_requirements",
            { scope: { ...azureScope, tenantId: "example-tenant" } },
            "fixture-token"
        );
        expect(result.isError).toBe(true);
        expect(text(result)).toContain("scope.tenantId");
        expect(text(result)).toContain("Microsoft Entra tenant ID in UUID format");
        expect(requests).toHaveLength(0);
    });

    it("routes Azure requirements, discovery and registration to flat management-group endpoints", async () => {
        const tenantId = "11111111-1111-4111-8111-111111111111";
        const scope = {
            provider: "azure",
            kind: "azure_management_group",
            tenantId,
            managementGroupId: "example-child",
        };
        await handleCloudConnectRequest(
            "get_cloud_connect_requirements",
            { scope, featureIds: ["attribute"] },
            "fixture-token"
        );
        expect(requests[0].url.pathname).toBe("/onboarding/v2/cloud-connect/azure/requirements");
        expect(requests[0].body).toEqual({
            tenantId,
            managementGroupId: "example-child",
            featureIds: ["attribute"],
        });

        await handleCloudConnectRequest("list_cloud_connections", { scope }, "fixture-token");
        expect(requests[1].url.pathname).toBe("/onboarding/v2/cloud-connect/azure/management-groups");
        expect(requests[1].url.searchParams.get("filter")).toBe(`tenantId:${tenantId}|managementGroupId:example-child`);

        await handleCloudConnectRequest(
            "register_cloud_connection",
            {
                provider: "azure",
                tenantId,
                managementGroupId: "example-child",
                featureIds: ["advisor", "attribute"],
            },
            "fixture-token"
        );
        expect(requests[2].url.pathname).toBe("/onboarding/v2/cloud-connect/azure/management-groups");
        expect(requests[2].body).toEqual({
            tenantId,
            managementGroupId: "example-child",
            featureIds: ["advisor", "attribute"],
        });
        expect(requests[2].options.headers).toHaveProperty("Idempotency-Key");
        const tool = CLOUD_CONNECT_TOOLS.find((entry) => entry.name === "register_cloud_connection");
        expect(JSON.stringify(tool?.inputSchema)).toContain("managementGroupId");
        expect(JSON.stringify(tool?.inputSchema)).toContain("tenantId");
    });

    it("rejects Azure foreign identifiers and customer secrets before HTTP", async () => {
        const tenantId = "11111111-1111-4111-8111-111111111111";
        for (const args of [
            {
                provider: "azure",
                tenantId,
                managementGroupId: "example-child",
                featureIds: ["advisor"],
                clientSecret: "forbidden-fixture",
            },
            {
                provider: "azure",
                tenantId,
                managementGroupId: "example-child",
                roleArn: "arn:aws:iam::111111111111:role/example",
                featureIds: ["advisor"],
            },
        ]) {
            expect((await handleCloudConnectRequest("register_cloud_connection", args, "fixture-token")).isError).toBe(
                true
            );
        }
        const azureScope = {
            provider: "azure",
            kind: "azure_management_group",
            tenantId,
            managementGroupId: "example-child",
        };
        for (const invalid of [
            { ...azureScope, accountId: "111111111111" },
            { ...azureScope, managementGroupId: "bad/group" },
            { ...azureScope, tenantId: "invalid" },
        ]) {
            expect(
                (await handleCloudConnectRequest("get_cloud_connect_requirements", { scope: invalid }, "fixture-token"))
                    .isError
            ).toBe(true);
        }
        expect(requests).toHaveLength(0);
    });

    it.each(["r-ab12", "ou-ab12-cdef3456"])("resolves organization artifact requirements for %s", async (targetId) => {
        const scope = { provider: "aws", kind: "aws_organization", managementAccountId: "111111111111", targetId };
        const artifact = {
            artifactId: "aws-cloudformation-organization",
            kind: "cloudformation",
            registration: "callback",
            entrypoint: "management.yml",
            requirementsSatisfied: true,
            parameters: { DeploymentTargetID: targetId, SourceTemplateURL: "https://example.com/member.yml" },
            files: [
                {
                    path: "management.yml",
                    url: "https://example.com/management.yml",
                    sha256: "1".repeat(64),
                },
                {
                    path: "member.yml",
                    url: "https://example.com/member.yml",
                    sha256: "2".repeat(64),
                },
            ],
        };
        response = () =>
            new Response(
                JSON.stringify({
                    scopeKind: "aws_organization",
                    managementAccountId: "111111111111",
                    targetId,
                    artifacts: [artifact],
                })
            );
        const result = await executeToolHandler(
            "get_cloud_connect_requirements",
            { scope, featureIds: ["core", "quotas"] },
            "fixture-token"
        );
        expect(requests[0].url.pathname).toBe("/onboarding/v2/cloud-connect/aws/requirements");
        expect(requests[0].body).toEqual({
            scopeKind: "aws_organization",
            managementAccountId: "111111111111",
            targetId,
            featureIds: ["core", "quotas"],
        });
        expect(data(result).artifacts).toEqual([artifact]);
        expect(requests[0].options.headers).not.toHaveProperty("Idempotency-Key");
    });

    it("rejects organization registrations, invalid targets, and mismatched requirement inputs before HTTP", async () => {
        const orgScope = {
            provider: "aws",
            kind: "aws_organization",
            managementAccountId: "111111111111",
            targetId: "r-ab12",
        };
        for (const args of [
            { scope: { ...orgScope, targetId: "ou-invalid" } },
            { scope: { ...orgScope, targetId: "r-ab12,r-cd34" } },
            { scope: { ...orgScope, accountId: "111111111111" } },
            { scope: { ...orgScope, managementAccountId: "11111111111o" } },
            { scope: orgScope, discoveryInputs: { managementAccountId: "111111111111" } },
            { scope: awsScope, identityInputs: { projectId: "example-project" } },
        ]) {
            expect(
                (await handleCloudConnectRequest("get_cloud_connect_requirements", args, "fixture-token")).isError
            ).toBe(true);
        }
        for (const [tool, args] of [
            ["register_cloud_connection", { ...awsRegistration, targetId: "r-ab12" }],
            ["dry_run_cloud_connection_change", { operation: "register", ...awsRegistration, targetId: "r-ab12" }],
            ["list_cloud_connections", { scope: orgScope }],
        ] as const) {
            expect((await handleCloudConnectRequest(tool, args, "fixture-token")).isError).toBe(true);
        }
        expect(requests).toHaveLength(0);
    });

    it("wraps all 21 per-provider operations plus a read-only dry-run tool", () => {
        expect(CLOUD_CONNECT_TOOLS).toHaveLength(8);
        const covered = CLOUD_CONNECT_TOOLS.flatMap((entry) =>
            entry.coversEndpoint
                ? Array.isArray(entry.coversEndpoint)
                    ? entry.coversEndpoint
                    : [entry.coversEndpoint]
                : []
        );
        expect(new Set(covered).size).toBe(21);
        expect(covered).toContain("post:/onboarding/v2/cloud-connect/aws/accounts/{id}/actions/verify");
        expect(covered).toContain("post:/onboarding/v2/cloud-connect/gcp/connections/{id}/actions/verify");
        expect(covered).toContain("post:/onboarding/v2/cloud-connect/azure/management-groups/{id}/actions/verify");
        expect(
            CLOUD_CONNECT_TOOLS.find((entry) => entry.name === "dry_run_cloud_connection_change")?.annotations
        ).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    });

    it("sends customer context, an Idempotency-Key and returns etag, Request-Id and the key used", async () => {
        const result = await handleCloudConnectRequest(
            "register_cloud_connection",
            { ...awsRegistration, customerContext: "fixture-customer" },
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
        expect(requests[0].url.pathname).toBe("/onboarding/v2/cloud-connect/aws/accounts");
        expect(requests[0].body).toEqual({
            accountId: "111111111111",
            roleArn: "arn:aws:iam::111111111111:role/doitintl-cmp",
            featureIds: ["core", "quotas"],
            catalogVersion: "sha256:current",
        });
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
        const result = await executeToolHandler(
            "get_cloud_connection",
            { provider: "aws", connectionId: "fixture" },
            "fixture-token"
        );
        expect(requests[0].url.pathname).toBe("/onboarding/v2/cloud-connect/aws/accounts/fixture");
        expect(data(result).etag).toBe(expected);
    });

    it("keeps a caller-supplied Idempotency-Key for an identical retry", async () => {
        await handleCloudConnectRequest(
            "register_cloud_connection",
            { ...awsRegistration, idempotencyKey: "retry-key" },
            "fixture-token"
        );
        await handleCloudConnectRequest(
            "register_cloud_connection",
            { ...awsRegistration, idempotencyKey: "retry-key" },
            "fixture-token"
        );
        expect(requests.map((request) => (request.options.headers as any)["Idempotency-Key"])).toEqual([
            "retry-key",
            "retry-key",
        ]);
        expect(requests[0].body.idempotencyKey).toBeUndefined();
    });

    it("sends PATCH as a flat merge patch of desired state with If-Match", async () => {
        await handleCloudConnectRequest(
            "update_cloud_connection",
            {
                provider: "aws",
                connectionId: "amazon-web-services-111111111111",
                expectedEtag: '"1.abc"',
                catalogVersion: "sha256:current",
                featureIds: ["core", "quotas", "eks"],
            },
            "fixture-token"
        );
        const headers = requests[0].options.headers as Record<string, string>;
        expect(requests[0].options.method).toBe("PATCH");
        expect(requests[0].url.pathname).toBe(
            "/onboarding/v2/cloud-connect/aws/accounts/amazon-web-services-111111111111"
        );
        expect(headers).toMatchObject({ "Content-Type": "application/merge-patch+json", "If-Match": '"1.abc"' });
        expect(headers["Idempotency-Key"]).toBeTruthy();
        expect(requests[0].body).toEqual({
            catalogVersion: "sha256:current",
            featureIds: ["core", "quotas", "eks"],
        });
    });

    it("uses read-only dry runs for register, update and remove without leaking control fields", async () => {
        const id = "amazon-web-services-111111111111";
        await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            { operation: "register", ...awsRegistration },
            "fixture-token"
        );
        await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            {
                operation: "update",
                provider: "aws",
                connectionId: id,
                expectedEtag: '"v1"',
                featureIds: ["core"],
            },
            "fixture-token"
        );
        await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            { operation: "remove", provider: "aws", connectionId: id, expectedEtag: '"v1"', cleanupScope: "doit_only" },
            "fixture-token"
        );
        expect(requests.map((request) => request.options.method)).toEqual(["POST", "PATCH", "DELETE"]);
        expect(requests.map((request) => request.url.pathname)).toEqual([
            "/onboarding/v2/cloud-connect/aws/accounts",
            `/onboarding/v2/cloud-connect/aws/accounts/${id}`,
            `/onboarding/v2/cloud-connect/aws/accounts/${id}`,
        ]);
        expect(requests.every((request) => request.url.searchParams.get("dryRun") === "true")).toBe(true);
        expect(requests[1].options.headers).toMatchObject({ "If-Match": '"v1"' });
        expect(requests[1].body).toEqual({ featureIds: ["core"] });
        expect(requests[2].body).toBeUndefined();
        expect(requests[2].url.searchParams.get("cleanupScope")).toBe("doit_only");
    });

    it("rejects bad scopes, private keys, bad account IDs, empty patches and wildcard etags before HTTP", async () => {
        for (const [name, args] of [
            ["get_cloud_connect_requirements", { scope: { provider: "gcp", kind: "gcp_project", projectId: "x" } }],
            ["get_cloud_connect_requirements", { scope: { ...awsScope, accountId: "11111111111o" } }],
            ["register_cloud_connection", { ...awsRegistration, private_key: "secret" }],
            [
                "remove_cloud_connection",
                { provider: "aws", connectionId: "c", expectedEtag: "*", cleanupScope: "doit_only" },
            ],
            [
                "remove_cloud_connection",
                { provider: "aws", connectionId: "c", expectedEtag: 'W/"1"', cleanupScope: "doit_only" },
            ],
            ["update_cloud_connection", { provider: "aws", connectionId: "c", expectedEtag: '"1"' }],
            ["update_cloud_connection", { provider: "aws", connectionId: "c", expectedEtag: '"1"', featureIds: [] }],
            ["explain_cloud_connect_failure", {}],
            ["report_cloud_connect_event", { events: [] }],
        ] as const)
            expect((await handleCloudConnectRequest(name, args, "fixture-token")).isError).toBe(true);
        expect(requests).toHaveLength(0);
    });

    it.each([
        ["get_cloud_connect_requirements", { scope: { ...awsScope, accountId: "11111111111o" } }, "scope.accountId"],
        ["list_cloud_connections", { scope: { ...awsScope, accountId: "11111111111o" } }, "scope.accountId"],
        ["register_cloud_connection", { ...awsRegistration, accountId: "11111111111o" }, "accountId"],
        [
            "get_cloud_connect_requirements",
            {
                scope: {
                    provider: "aws",
                    kind: "aws_organization",
                    managementAccountId: "11111111111o",
                    targetId: "r-abcd",
                },
            },
            "scope.managementAccountId",
        ],
        [
            "get_cloud_connect_requirements",
            { scope: awsScope, discoveryInputs: { managementAccountId: "11111111111o" } },
            "discoveryInputs.managementAccountId",
        ],
    ] as const)("explains invalid AWS IDs for %s before HTTP", async (name, args, field) => {
        const result = await handleCloudConnectRequest(name, args, "fixture-token");
        expect(result.isError).toBe(true);
        expect(text(result)).toContain(
            `${field}: Use the 12-digit AWS account ID (digits only; a letter o is not a zero).`
        );
        expect(requests).toHaveLength(0);
    });

    it("sends requirements with typed feature inputs and no catalogVersion, without a write key", async () => {
        await handleCloudConnectRequest(
            "get_cloud_connect_requirements",
            {
                scope: awsScope,
                featureIds: ["real-time-data"],
                featureInputs: { realTimeData: { bucketName: "b", bucketRegion: "us-east-1" } },
            },
            "fixture-token"
        );
        expect((requests[0].options.headers as any)["Idempotency-Key"]).toBeUndefined();
        expect(requests[0].url.pathname).toBe("/onboarding/v2/cloud-connect/aws/requirements");
        expect(requests[0].body).toEqual({
            scopeKind: "aws_account",
            accountId: "111111111111",
            featureIds: ["real-time-data"],
            featureInputs: { realTimeData: { bucketName: "b", bucketRegion: "us-east-1" } },
        });
    });

    it("verifies through the provider connection action with optional featureIds as body", async () => {
        await handleCloudConnectRequest(
            "verify_cloud_connect",
            { provider: "aws", connectionId: "amazon-web-services-111111111111", featureIds: ["core"] },
            "fixture-token"
        );
        expect(requests[0].options.method).toBe("POST");
        expect(requests[0].url.pathname).toBe(
            "/onboarding/v2/cloud-connect/aws/accounts/amazon-web-services-111111111111/actions/verify"
        );
        expect(requests[0].body).toEqual({ featureIds: ["core"] });
        expect((requests[0].options.headers as any)["Idempotency-Key"]).toBeUndefined();
    });

    it("preserves standards problems, correlates by Request-Id, returns the key and never retries", async () => {
        for (const [status, code, extra] of [
            [
                400,
                "validation_failed",
                {
                    details: [
                        {
                            issue: "invalid_value",
                            field: "managementGroupId",
                            message: "Use a bare management group ID.",
                        },
                    ],
                },
            ],
            [409, "onboarding.catalog_version_stale", {}],
            [409, "onboarding.connection_exists", { details: [{ issue: "exists", id: "amazon-web-services-1" }] }],
            [412, "precondition_failed", {}],
            [422, "onboarding.registration_gate_failed", { retryable: true }],
        ] as const) {
            response = () => problem(status, code, extra);
            const result = await handleCloudConnectRequest(
                "register_cloud_connection",
                awsRegistration,
                "fixture-token"
            );
            expect(result.isError).toBe(true);
            expect(data(result)).toMatchObject({
                status,
                code,
                requestId: "req_01FIXTURE",
                idempotencyKey: expect.any(String),
                ...extra,
            });
        }
        expect(requests).toHaveLength(5);
    });

    it("redacts credentials from problem bodies", async () => {
        response = () =>
            problem(400, "validation_failed", { detail: "Authorization: Bearer fixture-token AKIAABCDEFGHIJKLMNOP" });
        const result = await handleCloudConnectRequest(
            "get_cloud_connect_requirements",
            { scope: awsScope },
            "fixture-token"
        );
        expect(text(result)).not.toContain("fixture-token");
        expect(text(result)).not.toContain("AKIAABCDEFGHIJKLMNOP");
    });

    it("builds flat provider list filters and passes paging", async () => {
        response = () => new Response(JSON.stringify({ items: [], pageToken: "next-page" }));
        const result = await handleCloudConnectRequest(
            "list_cloud_connections",
            { scope: awsScope, featureId: "core", maxResults: 2, pageToken: "previous-page" },
            "fixture-token"
        );
        expect(data(result).pageToken).toBe("next-page");
        expect(requests[0].url.pathname).toBe("/onboarding/v2/cloud-connect/aws/accounts");
        const params = requests[0].url.searchParams;
        expect(params.get("filter")).toBe("accountId:111111111111|featureIds:core");
        expect(params.get("maxResults")).toBe("2");
        expect(params.get("pageToken")).toBe("previous-page");

        await handleCloudConnectRequest("list_cloud_connections", {}, "fixture-token");
        expect(requests[1].url.pathname).toBe("/onboarding/v2/cloud-connect/aws/accounts");
        expect(requests[1].url.searchParams.get("filter")).toBeNull();
    });

    it("reports a 204 removal as deleted with the key used and keeps the record on cleanup_failed", async () => {
        const remove = {
            provider: "aws",
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
        expect(requests[0].url.pathname).toBe(
            "/onboarding/v2/cloud-connect/aws/accounts/amazon-web-services-111111111111"
        );
        response = () => problem(409, "onboarding.cleanup_failed", { retryable: true });
        const failed = await handleCloudConnectRequest("remove_cloud_connection", remove, "fixture-token");
        expect(failed.isError).toBe(true);
        expect(data(failed)).toMatchObject({ code: "onboarding.cleanup_failed", retryable: true });
    });

    it.each(["..", ".", "%2e%2e", "a%2f..%2fb"])(
        "rejects traversal connectionId %j before calling fetch",
        async (badId) => {
            const callsBefore = requests.length;
            const res = await handleCloudConnectRequest(
                "remove_cloud_connection",
                { provider: "aws", connectionId: badId, expectedEtag: '"2.abc"', cleanupScope: "doit_only" },
                "fixture-token"
            );
            expect(res.isError).toBe(true);
            expect(requests.length).toBe(callsBefore);
        }
    );
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
            { provider: "aws", connectionId: "amazon-web-services-111111111111" },
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
        { provider: "gcp", kind: "gcp_dataset", projectId: "example-project", datasetId: "2026_export" },
    ] as const)("registers, fetches requirements and filters native scope $kind", async (scope) => {
        const { provider: _provider, kind: scopeKind, ...ids } = scope;
        await executeToolHandler(
            "get_cloud_connect_requirements",
            { scope, featureIds: ["core"], identityInputs: { projectId: "example-project" } },
            "fixture-token"
        );
        expect(requests[0].url.pathname).toBe("/onboarding/v2/cloud-connect/gcp/requirements");
        expect(requests[0].body).toEqual({
            scopeKind,
            ...ids,
            featureIds: ["core"],
            identityInputs: { projectId: "example-project" },
        });

        await executeToolHandler(
            "register_cloud_connection",
            { provider: "gcp", scopeKind, ...ids, serviceAccount, featureIds: ["core"] },
            "fixture-token"
        );
        expect(requests[1].url.pathname).toBe("/onboarding/v2/cloud-connect/gcp/connections");
        expect(requests[1].body).toEqual({
            scopeKind,
            ...ids,
            serviceAccount,
            featureIds: ["core"],
        });

        await executeToolHandler("list_cloud_connections", { scope }, "fixture-token");
        expect(requests[2].url.pathname).toBe("/onboarding/v2/cloud-connect/gcp/connections");
        const filter = requests[2].url.searchParams.get("filter");
        expect(filter).toContain(`scopeKind:${scopeKind}`);
        for (const [key, value] of Object.entries(ids)) expect(filter).toContain(`${key}:${value}`);
    });

    it("rejects mismatched GCP scope fields before HTTP", async () => {
        for (const args of [
            {
                provider: "gcp",
                scopeKind: "gcp_organization",
                projectId: "example-project",
                serviceAccount,
                featureIds: ["core"],
            },
            {
                provider: "gcp",
                scopeKind: "gcp_project",
                organizationId: "123456789012",
                serviceAccount,
                featureIds: ["core"],
            },
            {
                provider: "gcp",
                scopeKind: "gcp_dataset",
                projectId: "example-project",
                serviceAccount,
                featureIds: ["core"],
            },
            {
                provider: "gcp",
                scopeKind: "gcp_project",
                projectId: "example-project",
                roleArn: "arn:aws:iam::111111111111:role/x",
                serviceAccount,
                featureIds: ["core"],
            },
        ]) {
            const result = await executeToolHandler("register_cloud_connection", args, "fixture-token");
            expect(result.isError).toBe(true);
        }
        expect(requests).toHaveLength(0);
    });

    it("rejects service-account private key material", async () => {
        const result = await executeToolHandler(
            "register_cloud_connection",
            {
                provider: "gcp",
                scopeKind: "gcp_project",
                projectId: "example-project",
                serviceAccount: { ...serviceAccount, private_key: "fixture-forbidden-key" },
                featureIds: ["core"],
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

    it("rejects featureInputs on Azure requirements, register and update", async () => {
        const azureTenant = "11111111-1111-4111-8111-111111111111";
        for (const [toolName, args] of [
            [
                "get_cloud_connect_requirements",
                {
                    scope: {
                        provider: "azure",
                        kind: "azure_management_group",
                        tenantId: azureTenant,
                        managementGroupId: "mg-root",
                    },
                    featureIds: ["advisor"],
                    featureInputs: { advisor: { key: "value" } },
                },
            ],
            [
                "register_cloud_connection",
                {
                    provider: "azure",
                    tenantId: azureTenant,
                    managementGroupId: "mg-root",
                    featureIds: ["advisor"],
                    featureInputs: { advisor: { key: "value" } },
                },
            ],
            [
                "update_cloud_connection",
                {
                    provider: "azure",
                    connectionId: "microsoft-azure-1",
                    expectedEtag: '"1.az"',
                    featureIds: ["advisor"],
                    featureInputs: { advisor: { key: "value" } },
                },
            ],
        ] as const) {
            const result = await executeToolHandler(toolName, args, "fixture-token");
            expect(result.isError).toBe(true);
        }
        expect(requests).toHaveLength(0);
    });

    it("surfaces dryRun: true on projected update previews and names missing provider on dry-run errors", async () => {
        const preview = await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            {
                operation: "update",
                provider: "aws",
                connectionId: "amazon-web-services-111111111111",
                expectedEtag: '"1.abc"',
                featureIds: ["core"],
            },
            "fixture-token"
        );
        expect(preview.isError).not.toBe(true);
        expect(data(preview).dryRun).toBe(true);

        const missingProviderUpdate = await executeToolHandler(
            "dry_run_cloud_connection_change",
            {
                operation: "update",
                connectionId: "amazon-web-services-111111111111",
                expectedEtag: '"1.abc"',
                featureIds: ["core"],
            },
            "fixture-token"
        );
        expect(missingProviderUpdate.isError).toBe(true);
        expect(text(missingProviderUpdate)).toContain("provider");

        const missingProviderRemove = await executeToolHandler(
            "dry_run_cloud_connection_change",
            {
                operation: "remove",
                connectionId: "amazon-web-services-111111111111",
                expectedEtag: '"1.abc"',
                cleanupScope: "doit_only",
            },
            "fixture-token"
        );
        expect(missingProviderRemove.isError).toBe(true);
        expect(text(missingProviderRemove)).toContain("provider");
    });

    it("accepts typed AWS and GCP featureInputs including single-property null clearing and rejects cross-provider or legacy keys", async () => {
        const awsPatch = await handleCloudConnectRequest(
            "update_cloud_connection",
            {
                provider: "aws",
                connectionId: "amazon-web-services-111111111111",
                expectedEtag: '"1.abc"',
                featureInputs: { realTimeData: null },
            },
            "fixture-token"
        );
        expect(awsPatch.isError).not.toBe(true);
        expect(requests[0].body).toEqual({ featureInputs: { realTimeData: null } });

        const gcpPatch = await handleCloudConnectRequest(
            "update_cloud_connection",
            {
                provider: "gcp",
                connectionId: "google-cloud-1",
                expectedEtag: '"1.gcp"',
                featureInputs: { bigqueryFinops: { location: null } },
            },
            "fixture-token"
        );
        expect(gcpPatch.isError).not.toBe(true);
        expect(requests[1].body).toEqual({ featureInputs: { bigqueryFinops: { location: null } } });

        for (const [toolName, args] of [
            [
                "get_cloud_connect_requirements",
                {
                    scope: awsScope,
                    featureIds: ["real-time-data"],
                    featureInputs: { "real-time-data": { bucketName: "b", bucketRegion: "us-east-1" } },
                },
            ],
            [
                "get_cloud_connect_requirements",
                {
                    scope: awsScope,
                    featureIds: ["core"],
                    featureInputs: { bigqueryFinops: { location: "US" } },
                },
            ],
            [
                "update_cloud_connection",
                {
                    provider: "gcp",
                    connectionId: "google-cloud-1",
                    expectedEtag: '"1.gcp"',
                    featureInputs: { realTimeData: { bucketName: "b", bucketRegion: "us-east-1" } },
                },
            ],
        ] as const) {
            const rejected = await executeToolHandler(toolName, args, "fixture-token");
            expect(rejected.isError).toBe(true);
        }
        expect(requests).toHaveLength(2);
    });
});
