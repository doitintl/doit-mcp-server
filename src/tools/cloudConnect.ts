import { z } from "zod";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const CLOUD_CONNECT_BASE_URL = `${DOIT_API_BASE}/onboarding/v2`;
const id = z.string().min(1).max(256);
const featureIds = z
    .array(id)
    .min(1)
    .max(100)
    .refine((values) => new Set(values).size === values.length, "Feature IDs must be unique.");
const inputs = z.record(id, z.record(id, z.string().max(1024)));
const provider = z.enum(["aws", "gcp", "azure"]);
export const CloudConnectScopeSchema = z
    .discriminatedUnion("kind", [
        z
            .object({
                provider: z.literal("aws"),
                kind: z.literal("aws_account"),
                accountId: z.string().regex(/^\d{12}$/),
            })
            .strict(),
        z
            .object({
                provider: z.literal("gcp"),
                kind: z.literal("gcp_organization"),
                organizationId: z.string().regex(/^\d+$/),
            })
            .strict(),
        z.object({ provider: z.literal("gcp"), kind: z.literal("gcp_project"), projectId: id }).strict(),
        z.object({ provider: z.literal("gcp"), kind: z.literal("gcp_dataset"), projectId: id, datasetId: id }).strict(),
        z
            .object({
                provider: z.literal("azure"),
                kind: z.literal("azure_management_group"),
                tenantId: z.uuid(),
                managementGroupId: id,
            })
            .strict(),
    ])
    .describe(
        "An exact supported Cloud Connect binding scope. Organization roots, OUs, folders, Azure subscriptions and tenants alone are not binding kinds."
    );
export const CloudConnectIdentitySchema = z
    .discriminatedUnion("kind", [
        z
            .object({
                kind: z.literal("aws_iam_role"),
                roleArn: z.string().regex(/^arn:aws(?:-us-gov|-cn)?:iam::\d{12}:role\/.+$/),
            })
            .strict(),
        z
            .object({
                kind: z.literal("gcp_service_account"),
                email: z.email(),
                uniqueId: z.string().regex(/^\d+$/),
                projectId: id,
            })
            .strict(),
        z
            .object({ kind: z.literal("azure_enterprise_application"), tenantId: z.uuid(), principalId: z.uuid() })
            .strict(),
    ])
    .describe(
        "The deployed identity. GCP takes the service-account descriptor, never a private key; projectId is its home project, which can differ from the binding target."
    );
const binding = z.object({ scope: CloudConnectScopeSchema, featureIds, featureInputs: inputs.optional() }).strict();
const connectionId = id.describe("Connection ID from list_cloud_connections or get_cloud_connection.");
const expectedEtag = z
    .string()
    .regex(/^"[\x21\x23-\x7e]+"$/)
    .describe(
        "Exact quoted etag returned by the latest read or write. Never synthesize it; stale values return 412 and require a fresh read and reviewed change."
    );
const catalogVersion = id
    .optional()
    .describe(
        "catalogVersion from a fresh get_cloud_connect_requirements response. A stale supplied version returns 409 catalog_version_stale; resolve again before deployment or mutation."
    );
export const GetCloudConnectRequirementsArgumentsSchema = z.object({
    scope: CloudConnectScopeSchema,
    featureIds: featureIds
        .optional()
        .describe(
            "Omit only to discover the full scope slice. Discovery does not select any features or authorize deployment."
        ),
    featureInputs: inputs
        .optional()
        .describe("Only inputs published by the selected features; missing inputs are returned with their schema."),
    discoveryInputs: z
        .object({
            managementAccountId: z
                .string()
                .regex(/^\d{12}$/)
                .optional(),
        })
        .strict()
        .optional(),
});
const filters = {
    provider: provider.optional(),
    scope: CloudConnectScopeSchema.optional().describe(
        "Exact scope filter; flattened into the API's provider, kind and native identifier query parameters."
    ),
    pageSize: z.number().int().min(1).max(500).optional(),
    pageToken: id.optional().describe("Opaque cursor from the previous page; keep the same filters."),
};
export const ListCloudConnectionsArgumentsSchema = z.object({ ...filters, featureId: id.optional() });
export const GetCloudConnectionArgumentsSchema = z.object({ connectionId });
const registration = {
    identity: CloudConnectIdentitySchema,
    credentialMode: z.literal("workload_identity_federation").optional().describe("Required for GCP registration."),
    bindings: z.array(binding).min(1).max(20),
    catalogVersion,
};
export const RegisterCloudConnectionArgumentsSchema = z.object(registration);
const patch = {
    catalogVersion,
    bindingChanges: z
        .object({
            add: z.array(binding).optional(),
            update: z
                .array(
                    z
                        .object({
                            bindingId: id,
                            featureChanges: z
                                .object({ enable: z.array(id).optional(), disable: z.array(id).optional() })
                                .strict(),
                            featureInputs: inputs.optional(),
                        })
                        .strict()
                )
                .optional(),
            remove: z.array(z.object({ bindingId: id }).strict()).optional(),
        })
        .strict()
        .optional(),
    followUps: z
        .object({
            retry: z.array(z.object({ bindingId: id, featureId: z.string().max(256), kind: id }).strict()).min(1),
        })
        .strict()
        .optional()
        .describe(
            "Retry only failed or incomplete named steps, including unfinished prerequisites, from the stored follow-up ledger. Teardown resumes through DELETE, never PATCH."
        ),
    identityChange: z.object({ identity: CloudConnectIdentitySchema }).strict().optional(),
};
export const UpdateCloudConnectionArgumentsSchema = z.object({ connectionId, expectedEtag, ...patch });
export const RemoveCloudConnectionArgumentsSchema = z.object({
    connectionId,
    expectedEtag,
    cleanupScope: z
        .literal("doit_only")
        .describe(
            "Required. Removes DoiT configuration only; provider-specific backend cleanup can delete data. Read the dry-run side effects first. Customer IAM remains customer-owned."
        ),
});
export const DryRunCloudConnectionChangeArgumentsSchema = z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("register"), ...registration }),
    z.object({ operation: z.literal("update"), ...UpdateCloudConnectionArgumentsSchema.shape }),
    z.object({ operation: z.literal("remove"), ...RemoveCloudConnectionArgumentsSchema.shape }),
]);
export const VerifyCloudConnectArgumentsSchema = z.object({
    connectionId,
    bindingIds: z.array(id).optional(),
    featureIds: featureIds.optional(),
    scopeSelection: z
        .discriminatedUnion("kind", [
            z.object({ kind: z.literal("all_registered") }).strict(),
            z.object({ kind: z.literal("at_scope"), scope: CloudConnectScopeSchema }).strict(),
        ])
        .default({ kind: "all_registered" })
        .describe(
            "at_scope probes a GCP project using its registered organization identity; ancestry alone never establishes inherited access."
        ),
});
export const ExplainCloudConnectFailureArgumentsSchema = z.object({
    ...filters,
    connectionId: connectionId.optional(),
    requestId: id.optional(),
    since: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
});
const classifiedError = z
    .object({
        source: z.enum(["terraform", "cloudformation", "gcloud", "azure_cli", "ci", "customer_controller"]),
        operation: z.enum(["plan", "apply", "deploy", "destroy", "validate", "authenticate"]),
        code: z.enum([
            "permission_denied",
            "invalid_configuration",
            "identity_auth_failed",
            "deployment_failed",
            "timeout",
            "dependency_failed",
            "unknown",
        ]),
        httpStatus: z.number().int().min(100).max(599).optional(),
    })
    .strict();
const clientEvent = z
    .object({
        provider,
        stage: z.literal("deployment"),
        connectionId: connectionId.optional(),
        scope: CloudConnectScopeSchema.optional(),
        error: classifiedError
            .optional()
            .describe(
                "Classify the failure locally. Raw logs/messages, tokens, headers and credential files are never accepted by this hosted-safe tool."
            ),
        observation: z
            .object({
                kind: z.literal("deployment_context"),
                toolId: z.enum(["terraform", "cloudformation", "gcloud", "azure_cli", "ci", "customer_controller"]),
                toolVersion: z
                    .string()
                    .regex(/^[a-zA-Z0-9._+-]{1,64}$/)
                    .optional(),
            })
            .strict()
            .optional(),
        relatedRequestIds: z
            .array(z.string().regex(/^[a-zA-Z0-9._:-]{1,128}$/))
            .max(10)
            .optional(),
        exitCode: z.number().int().min(-255).max(65535).optional(),
        clientOccurredAt: z.iso.datetime({ offset: true }).optional(),
    })
    .strict()
    .refine((event) => event.error || event.observation, "An error or deployment context is required.");
export const ReportCloudConnectEventArgumentsSchema = z.object({
    schemaVersion: z.literal("1").default("1"),
    events: z.array(clientEvent).min(1).max(20),
});

function tool(
    name: string,
    schema: z.ZodType,
    endpoint: string | null,
    description: string,
    readOnly: boolean,
    destructive = false
) {
    return {
        name,
        title: name
            .split("_")
            .map((word) => word[0].toUpperCase() + word.slice(1))
            .join(" "),
        description,
        coversEndpoint: endpoint,
        inputSchema: zodToMcpInputSchema(schema),
        annotations: { readOnlyHint: readOnly, destructiveHint: destructive, openWorldHint: true },
        securitySchemes: [{ type: "oauth2", scopes: readOnly ? ["read_data"] : ["read_data", "write_data"] }],
    };
}
const base = "/onboarding/v2";
export const getCloudConnectRequirementsTool = tool(
    "get_cloud_connect_requirements",
    GetCloudConnectRequirementsArgumentsSchema,
    `post:${base}/requirements`,
    "Resolve fresh customer-specific Cloud Connect prerequisites, identity, inline permissions, inputs and deployable artifacts. Plan from this response; never deploy from an offline catalog alone. Omitted featureIds is discovery only. This does not enable billing exports.",
    true
);
export const listCloudConnectionsTool = tool(
    "list_cloud_connections",
    ListCloudConnectionsArgumentsSchema,
    `get:${base}/connections`,
    "Discover existing Cloud Connect records by exact provider/scope/feature filters. An empty list means no registration, not that cloud resources are absent. Follow nextPageToken without dropping filters.",
    true
);
export const getCloudConnectionTool = tool(
    "get_cloud_connection",
    GetCloudConnectionArgumentsSchema,
    `get:${base}/connections/{connectionId}`,
    "Read Cloud Connect bindings, desired features, verification freshness and named follow-ups. Returns etag for conditional writes. Stored health is not a fresh access probe; use verify_cloud_connect.",
    true
);
export const registerCloudConnectionTool = tool(
    "register_cloud_connection",
    RegisterCloudConnectionArgumentsSchema,
    `post:${base}/connections`,
    "Register a deployed identity after fresh requirements, local plan review and dry_run_cloud_connection_change. Never duplicate registration owned by a Terraform provider or CloudFormation callback; read its result instead. Registration is not full feature completion. Semantic retries reconcile the same identity; never use POST to bypass a PATCH revision check.",
    false
);
export const updateCloudConnectionTool = tool(
    "update_cloud_connection",
    UpdateCloudConnectionArgumentsSchema,
    `patch:${base}/connections/{connectionId}`,
    "Change scoped bindings/features or retry named follow-ups after reading the connection and dry-running this exact change. Keep expectedEtag from that read; return 412 to the user and re-evaluate before retrying. Obtain the user's confirmation of any removals/identity replacement and dry-run side effects. Identity replacement is currently rejected and needs a separately reviewed registration transition. Respect existing IaC ownership.",
    false,
    true
);
export const removeCloudConnectionTool = tool(
    "remove_cloud_connection",
    RemoveCloudConnectionArgumentsSchema,
    `delete:${base}/connections/{connectionId}`,
    "Disconnect after reading and dry-running removal, explaining affected consumers and data loss, and obtaining the user's confirmation. GCP backend cleanup can delete a BigQuery dataset with contents. Uses exact expectedEtag and doit_only cleanup; customer IAM/IaC cleanup remains separate. Do not retry blindly after uncertain outcomes.",
    false,
    true
);
export const dryRunCloudConnectionChangeTool = tool(
    "dry_run_cloud_connection_change",
    DryRunCloudConnectionChangeArgumentsSchema,
    null,
    "Run the registration/update/removal validation and available live checks without committing. New AWS roles can return aws_broker_requires_registration; explain that limit and do not claim access verified. Returns prerequisites, consumers, backend side effects and follow-ups. wouldApply is informational, not a reservation or approval. Preserve any destructive effects for user review before the real mutation.",
    true
);
export const verifyCloudConnectTool = tool(
    "verify_cloud_connect",
    VerifyCloudConnectArgumentsSchema,
    `post:${base}/verifications`,
    "Fresh synchronous access checks for a registered connection. Evaluate authentication, every selected feature check, sampled coverage and required follow-ups. Partial/not_checked/truncated results are not passed; access health never proves data arrival. No setup run or polling endpoint is created.",
    false
);
export const explainCloudConnectFailureTool = tool(
    "explain_cloud_connect_failure",
    ExplainCloudConnectFailureArgumentsSchema,
    `get:${base}/diagnostics`,
    "Read bounded Cloud Connect diagnostic history including labelled customer reports and DoiT callback outcomes. Filter by request/connection/scope/time. Audit publication is eventually queryable; absence of an event is not proof of completion. Use reads and verification for current state.",
    true
);
export const reportCloudConnectEventTool = tool(
    "report_cloud_connect_event",
    ReportCloudConnectEventArgumentsSchema,
    `post:${base}/events`,
    "Opt-in publication of bounded classified customer deployment failures/context. No raw logs or free-text errors are accepted. Acknowledgement means all events reached Kafka, not that diagnostics can query them yet. A 503 may follow partial publication; a fresh retry may get new IDs. Reporting failure must not block onboarding and never establishes health or approval.",
    false
);
export const CLOUD_CONNECT_TOOLS = [
    getCloudConnectRequirementsTool,
    listCloudConnectionsTool,
    getCloudConnectionTool,
    registerCloudConnectionTool,
    updateCloudConnectionTool,
    removeCloudConnectionTool,
    dryRunCloudConnectionChangeTool,
    verifyCloudConnectTool,
    explainCloudConnectFailureTool,
    reportCloudConnectEventTool,
];
export const CLOUD_CONNECT_SCHEMAS: Record<string, z.ZodType> = {
    get_cloud_connect_requirements: GetCloudConnectRequirementsArgumentsSchema,
    list_cloud_connections: ListCloudConnectionsArgumentsSchema,
    get_cloud_connection: GetCloudConnectionArgumentsSchema,
    register_cloud_connection: RegisterCloudConnectionArgumentsSchema,
    update_cloud_connection: UpdateCloudConnectionArgumentsSchema,
    remove_cloud_connection: RemoveCloudConnectionArgumentsSchema,
    dry_run_cloud_connection_change: DryRunCloudConnectionChangeArgumentsSchema,
    verify_cloud_connect: VerifyCloudConnectArgumentsSchema,
    explain_cloud_connect_failure: ExplainCloudConnectFailureArgumentsSchema,
    report_cloud_connect_event: ReportCloudConnectEventArgumentsSchema,
};

export async function handleCloudConnectRequest(name: string, args: any, token: string) {
    let problem: Record<string, unknown> | undefined;
    try {
        const schema = CLOUD_CONNECT_SCHEMAS[name];
        if (!schema) return createErrorResponse("Unknown Cloud Connect tool");
        const parsed = schema.parse(args) as Record<string, any>;
        const params = new URLSearchParams();
        const headers: Record<string, string> = {};
        let method = "GET";
        let path = "/connections";
        let body: Record<string, any> | undefined;
        let action = name;
        if (name === "dry_run_cloud_connection_change") {
            action = `${parsed.operation === "remove" ? "remove" : parsed.operation === "update" ? "update" : "register"}_cloud_connection`;
            delete parsed.operation;
            params.set("dryRun", "true");
        }
        if (action === "get_cloud_connect_requirements") {
            path = "/requirements";
            method = "POST";
            body = parsed;
        } else if (action === "verify_cloud_connect") {
            path = "/verifications";
            method = "POST";
            body = parsed;
        } else if (action === "report_cloud_connect_event") {
            path = "/events";
            method = "POST";
            body = {
                ...parsed,
                events: parsed.events.map((event: any) => ({
                    ...event,
                    ...(event.error
                        ? {
                              error: {
                                  ...event.error,
                                  message: `Customer reported ${event.error.code} during ${event.error.operation}.`,
                              },
                          }
                        : {}),
                })),
            };
        } else if (action === "register_cloud_connection") {
            method = "POST";
            body = parsed;
        } else if (
            action === "get_cloud_connection" ||
            action === "update_cloud_connection" ||
            action === "remove_cloud_connection"
        ) {
            const { connectionId, expectedEtag, cleanupScope, ...changes } = parsed;
            path += `/${encodeURIComponent(connectionId)}`;
            if (expectedEtag) headers["If-Match"] = expectedEtag;
            if (action === "update_cloud_connection") {
                method = "PATCH";
                body = changes;
            }
            if (action === "remove_cloud_connection") {
                method = "DELETE";
                params.set("cleanupScope", cleanupScope);
            }
        } else {
            if (action === "explain_cloud_connect_failure") path = "/diagnostics";
            const { scope, ...query } = parsed;
            if (scope && query.provider && scope.provider !== query.provider)
                return createErrorResponse("provider must match scope.provider");
            for (const [key, value] of Object.entries({ ...query, ...scope }))
                if (value !== undefined) params.set(key, String(value));
        }
        let etag: string | null = null;
        let requestId: string | null = null;
        const data = await makeDoitRequest<Record<string, unknown>>(
            `${CLOUD_CONNECT_BASE_URL}${path}${params.size ? `?${params}` : ""}`,
            token,
            {
                method,
                body,
                headers,
                customerContext: args.customerContext,
                readOnly: name === "get_cloud_connect_requirements" || name === "dry_run_cloud_connection_change",
                timeoutMs: 60_000,
                onResponseHeaders: (responseHeaders) => {
                    etag = responseHeaders.get("etag");
                    requestId = responseHeaders.get("x-request-id");
                },
                onErrorResponse: async (response) => {
                    try {
                        const raw = await response.text();
                        if (raw.length > 65536) return;
                        const parsed = JSON.parse(raw);
                        if (typeof parsed.code !== "string" || typeof parsed.requestId !== "string") return;
                        // Only this API's public problem contract crosses the tool boundary.
                        // General server failures retain their bounded code/correlation, not internal detail.
                        const selected: Record<string, unknown> = {
                            status: response.status,
                            code: parsed.code,
                            requestId: parsed.requestId,
                        };
                        if (response.status < 500) {
                            for (const key of ["type", "title", "detail", "message", "findings", "retry"])
                                if (parsed[key] !== undefined) selected[key] = parsed[key];
                        }
                        if (response.status === 503 && name === "report_cloud_connect_event")
                            selected.message =
                                "Publication may be partial; visibility is delayed. A fresh submission can receive new event IDs.";
                        const safe = JSON.stringify(selected)
                            .split(token)
                            .join("[redacted]")
                            .replace(/(?:Bearer|Basic)\s+[^\s"\\]+/gi, "[redacted]")
                            .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[redacted]");
                        problem = JSON.parse(safe);
                    } catch {
                        /* Standard HTTP error handling remains authoritative for malformed bodies. */
                    }
                },
            }
        );
        if (!data)
            return createErrorResponse(
                "Cloud Connect returned no response; read the connection before retrying a mutation."
            );
        return createSuccessResponse(
            JSON.stringify(
                { ...data, ...(etag ? { etag } : {}), ...(requestId && !data.requestId ? { requestId } : {}) },
                null,
                2
            )
        );
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        if (problem) return createErrorResponse(JSON.stringify(problem, null, 2));
        return handleGeneralError(error, "handling Cloud Connect request");
    }
}

export const CLOUD_CONNECT_HANDLERS = Object.fromEntries(
    CLOUD_CONNECT_TOOLS.map((definition) => [
        definition.name,
        (args: any, token: string) => handleCloudConnectRequest(definition.name, args, token),
    ])
);
