import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeToolHandler } from "../../utils/toolsHandler.js";
import {
    CLOUD_CONNECT_TOOLS,
    handleCloudConnectRequest,
    ReportCloudConnectEventArgumentsSchema,
} from "../cloudConnect.js";

const scope = { provider: "gcp", kind: "gcp_project", projectId: "target-project" };
const identity = {
    kind: "gcp_service_account",
    email: "doit@identity-project.iam.gserviceaccount.com",
    uniqueId: "123456789012345678901",
    projectId: "identity-project",
};
const registration = {
    identity,
    credentialMode: "workload_identity_federation",
    bindings: [{ scope, featureIds: ["core"] }],
    catalogVersion: "sha256-current",
};
const text = (response: any) => response.content.find((block: any) => block.type === "text").text;
const data = (response: any) => JSON.parse(text(response));
let requests: Array<{ url: URL; options: RequestInit; body: any }>;
let response: () => Response;

beforeEach(() => {
    requests = [];
    response = () =>
        new Response(JSON.stringify({ connectionId: "gcp-fixture", revision: "opaque-revision" }), {
            headers: { etag: '"opaque-revision"', "x-request-id": "fixture-request" },
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
    it("wraps nine distinct operations and gives dry runs their own read-only tool", () => {
        expect(new Set(CLOUD_CONNECT_TOOLS.map((tool) => tool.coversEndpoint).filter(Boolean)).size).toBe(9);
        expect(
            CLOUD_CONNECT_TOOLS.find((tool) => tool.name === "dry_run_cloud_connection_change")?.annotations
        ).toMatchObject({ readOnlyHint: true, destructiveHint: false });
        expect(
            CLOUD_CONNECT_TOOLS.find((tool) => tool.name === "verify_cloud_connect")?.annotations.destructiveHint
        ).toBe(false);
    });
    it("sends customer context and preserves response etag, request correlation and binding target", async () => {
        const result = await handleCloudConnectRequest(
            "register_cloud_connection",
            { ...registration, customerContext: "fixture-customer" },
            "fixture-token"
        );
        expect(data(result)).toMatchObject({ etag: '"opaque-revision"', requestId: "fixture-request" });
        expect(requests[0].url.pathname).toBe("/onboarding/v2/connections");
        expect(requests[0].options.headers).toMatchObject({ "X-Tenant-Id": "fixture-customer" });
        expect(requests[0].body).toEqual(registration);
        expect(requests[0].body.identity.projectId).not.toBe(requests[0].body.bindings[0].scope.projectId);
    });
    it("uses read-only dry runs for register, update and remove without leaking control fields into bodies", async () => {
        await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            { operation: "register", ...registration },
            "fixture-token"
        );
        await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            {
                operation: "update",
                connectionId: "gcp-fixture",
                expectedEtag: '"v1"',
                bindingChanges: { update: [{ bindingId: "binding-1", featureChanges: { disable: ["core"] } }] },
            },
            "fixture-token"
        );
        await handleCloudConnectRequest(
            "dry_run_cloud_connection_change",
            { operation: "remove", connectionId: "gcp-fixture", expectedEtag: '"v1"', cleanupScope: "doit_only" },
            "fixture-token"
        );
        expect(requests.map((request) => request.options.method)).toEqual(["POST", "PATCH", "DELETE"]);
        expect(requests.every((request) => request.url.searchParams.get("dryRun") === "true")).toBe(true);
        expect(requests[1].options.headers).toMatchObject({ "If-Match": '"v1"' });
        expect(requests[1].body.expectedEtag).toBeUndefined();
        expect(requests[2].body).toBeUndefined();
        expect(requests[2].url.searchParams.get("cleanupScope")).toBe("doit_only");
    });
    it("rejects mixed provider scopes, private keys and fabricated wildcard revisions before HTTP", async () => {
        for (const [name, args] of [
            ["get_cloud_connect_requirements", { scope: { ...scope, provider: "aws" } }],
            ["register_cloud_connection", { ...registration, identity: { ...identity, private_key: "secret" } }],
            ["remove_cloud_connection", { connectionId: "gcp-fixture", expectedEtag: "*", cleanupScope: "doit_only" }],
        ] as const)
            expect((await handleCloudConnectRequest(name, args, "fixture-token")).isError).toBe(true);
        expect(requests).toHaveLength(0);
    });
    it("preserves stale-catalog and stale-revision problems and does not automatically retry", async () => {
        for (const [status, code] of [
            [409, "catalog_version_stale"],
            [412, "revision_mismatch"],
        ] as const) {
            response = () =>
                new Response(
                    JSON.stringify({
                        code,
                        requestId: "problem-request",
                        findings: [{ code, message: "Resolve and review before retrying", featureId: "core" }],
                    }),
                    { status }
                );
            const result = await handleCloudConnectRequest("register_cloud_connection", registration, "fixture-token");
            expect(result.isError).toBe(true);
            expect(data(result)).toMatchObject({
                status,
                code,
                requestId: "problem-request",
                findings: [{ featureId: "core" }],
            });
        }
        expect(requests).toHaveLength(2);
    });
    it("passes pagination and exact scope filters and rejects contradictory provider filters", async () => {
        response = () => new Response(JSON.stringify({ items: [], nextPageToken: "next-page" }));
        const args = { scope, pageSize: 2, pageToken: "previous-page", featureId: "core" };
        const result = await handleCloudConnectRequest("list_cloud_connections", args, "fixture-token");
        expect(data(result).nextPageToken).toBe("next-page");
        expect(requests[0].url.searchParams.get("kind")).toBe("gcp_project");
        expect(requests[0].url.searchParams.get("projectId")).toBe("target-project");
        expect(requests[0].url.searchParams.get("pageToken")).toBe("previous-page");
        expect(
            (await handleCloudConnectRequest("list_cloud_connections", { ...args, provider: "aws" }, "fixture-token"))
                .isError
        ).toBe(true);
        expect(requests).toHaveLength(1);
    });
    it("bypasses hosted widget conversion so check coverage and named follow-ups remain intact", async () => {
        const payload = {
            checks: [
                {
                    featureId: "core",
                    status: "partial",
                    coverage: { sampledResources: ["table-1"], truncated: true, complete: false },
                },
            ],
            followUps: [{ kind: "log_sink_creation", status: "failed" }],
        };
        response = () => new Response(JSON.stringify(payload));
        const convert = vi.fn(() => ({ content: [] }));
        const result = await executeToolHandler(
            "verify_cloud_connect",
            { connectionId: "gcp-fixture" },
            "fixture-token",
            { convertResponse: convert, onResponseMetrics: () => {} }
        );
        expect(data(result)).toEqual(payload);
        expect(convert).not.toHaveBeenCalled();
    });
    it("refuses raw error messages and backend provenance in customer events, then publishes classified context", async () => {
        const event = {
            provider: "gcp",
            stage: "deployment",
            scope,
            error: { source: "terraform", operation: "apply", code: "permission_denied" },
        };
        for (const unsafe of [
            { ...event, evidenceSource: "doit_backend" },
            { ...event, error: { ...event.error, message: "Bearer private-token" } },
            { ...event, observation: { kind: "health_transition", status: "passed" } },
        ]) {
            expect(ReportCloudConnectEventArgumentsSchema.safeParse({ events: [unsafe] }).success).toBe(false);
        }
        response = () =>
            new Response(JSON.stringify({ schemaVersion: "1", accepted: [{ index: 0, eventId: "server-id" }] }), {
                status: 202,
            });
        const result = await handleCloudConnectRequest(
            "report_cloud_connect_event",
            { events: [event] },
            "fixture-token"
        );
        expect(data(result).accepted).toHaveLength(1);
        expect(requests[0].body.events[0].error.message).toBe("Customer reported permission_denied during apply.");
    });
    it("retains partial-publication uncertainty on 503 and never retries or reports a fabricated receipt", async () => {
        response = () =>
            new Response(
                JSON.stringify({
                    code: "publication_unavailable",
                    requestId: "fixture-event-request",
                    message: "private server detail",
                }),
                { status: 503 }
            );
        const result = await handleCloudConnectRequest(
            "report_cloud_connect_event",
            {
                events: [
                    {
                        provider: "aws",
                        stage: "deployment",
                        observation: { kind: "deployment_context", toolId: "cloudformation" },
                    },
                ],
            },
            "fixture-token"
        );
        expect(result.isError).toBe(true);
        expect(data(result).message).toContain("partial");
        expect(text(result)).not.toContain("private server detail");
        expect(data(result).accepted).toBeUndefined();
        expect(requests).toHaveLength(1);
    });
});
