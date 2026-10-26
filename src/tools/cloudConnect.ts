import { randomUUID } from "node:crypto";
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
export const CloudConnectScopeSchema = z
    .object({
        provider: z.literal("aws"),
        kind: z.literal("aws_account"),
        accountId: z
            .string()
            .regex(/^\d{12}$/, "Use the 12-digit AWS account ID (digits only; a letter o is not a zero)."),
    })
    .strict()
    .describe(
        "One AWS account. Organization roots and OUs are deployment targets only, never connection scopes. This API version supports AWS only."
    );
export const CloudConnectIdentitySchema = z
    .object({
        kind: z.literal("aws_iam_role"),
        roleArn: z.string().regex(/^arn:aws(?:-us-gov|-cn)?:iam::\d{12}:role\/.+$/),
    })
    .strict()
    .describe(
        "The customer-owned IAM role DoiT assumes. DoiT fills roleId and accountId from the live GetRole result."
    );
const binding = z.object({ scope: CloudConnectScopeSchema, featureIds, featureInputs: inputs.optional() }).strict();
const connectionId = id.describe("Connection ID (`id`) from list_cloud_connections or get_cloud_connection.");
const expectedEtag = z
    .string()
    .regex(/^"[\x21\x23-\x7e]+"$/)
    .describe(
        "Exact quoted `etag` returned by the latest read or write, not a synthesized value. A stale value returns 412; retrying requires the current etag and a re-evaluated change."
    );
const catalogVersion = id
    .optional()
    .describe(
        "catalogVersion from a fresh get_cloud_connect_requirements response. A stale value returns 409 onboarding.catalog_version_stale; resolve again before retrying."
    );
const idempotencyKey = z
    .string()
    .min(1)
    .max(255)
    .optional()
    .describe(
        "Optional. One key per logical write. When omitted a fresh key is generated and returned as `idempotencyKey` in the result or error. A lost response or timeout can leave the outcome uncertain; the connection record supports reconciliation before retrying. An unchanged retry uses the identical request and key; a different body requires a different key."
    );
export const GetCloudConnectRequirementsArgumentsSchema = z.object({
    scope: CloudConnectScopeSchema,
    featureIds: featureIds
        .optional()
        .describe(
            "Omitting this field discovers available features without selecting any. Discovery artifacts are not requirementsSatisfied until features are chosen."
        ),
    featureInputs: inputs
        .optional()
        .describe(
            "Only inputs published by the selected features (real-time-data: bucketName and bucketRegion), identifying the customer's actual cloud resources. The API does not prove the bucket exists or that its region is correct."
        ),
    discoveryInputs: z
        .object({
            managementAccountId: z
                .string()
                .regex(/^\d{12}$/)
                .optional()
                .describe(
                    "Optional management-account hint for member accounts. It does not associate an undiscovered member with the customer or override DoiT account/payer prerequisites."
                ),
        })
        .strict()
        .optional(),
});
export const ListCloudConnectionsArgumentsSchema = z.object({
    scope: CloudConnectScopeSchema.optional().describe(
        "Exact account filter; sent as the bindings.scope.kind and bindings.scope.accountId filter keys."
    ),
    featureId: id.optional().describe("Only connections whose binding selects this feature."),
    maxResults: z.number().int().min(1).max(500).optional(),
    pageToken: id.optional().describe("Opaque `pageToken` from the previous page; keep the same filters."),
});
export const GetCloudConnectionArgumentsSchema = z.object({ connectionId });
const registration = {
    identity: CloudConnectIdentitySchema,
    bindings: z.array(binding).length(1).describe("Exactly one account binding per connection in this API version."),
    catalogVersion,
    idempotencyKey,
};
export const RegisterCloudConnectionArgumentsSchema = z.object(registration);
const patch = {
    catalogVersion,
    bindings: z
        .array(
            z
                .object({
                    bindingId: id,
                    featureIds: featureIds
                        .optional()
                        .describe("Complete desired feature list for this binding, not a delta."),
                    featureInputs: inputs
                        .nullable()
                        .optional()
                        .describe("Complete desired inputs for this binding; null clears them."),
                })
                .strict()
        )
        .length(1)
        .describe(
            "Desired state, sent as a JSON merge patch: list the connection's one existing binding with its full desired features. Re-sending the current desired state retries failed follow-ups. Adding/removing bindings or replacing the identity is rejected."
        ),
    idempotencyKey,
};
export const UpdateCloudConnectionArgumentsSchema = z.object({ connectionId, expectedEtag, ...patch });
export const RemoveCloudConnectionArgumentsSchema = z.object({
    connectionId,
    expectedEtag,
    cleanupScope: z
        .literal("doit_only")
        .describe(
            "Required acknowledgement. Removes the DoiT record and DoiT-side cleanup only; customer IAM, stacks and Terraform stay customer-owned. The removal dry run exposes side effects for review."
        ),
    idempotencyKey,
});
export const DryRunCloudConnectionChangeArgumentsSchema = z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("register"), ...registration }),
    z.object({ operation: z.literal("update"), ...UpdateCloudConnectionArgumentsSchema.shape }),
    z.object({ operation: z.literal("remove"), ...RemoveCloudConnectionArgumentsSchema.shape }),
]);
export const VerifyCloudConnectArgumentsSchema = z.object({
    connectionId,
    bindingIds: z.array(id).optional().describe("Limit to these binding IDs; default all registered bindings."),
    featureIds: featureIds.optional().describe("Limit to these selected features; default all selected features."),
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
    "Resolve fresh customer-specific AWS Cloud Connect prerequisites, identity trust, per-feature permissions, inputs and deployment artifacts for one account. Read-only. Returns the account CloudFormation template and per-account Terraform module; no organization management template or root/OU rollout operation is returned. Artifacts are reference implementations for adaptation to customer tooling; their requirements and registration behavior remain relevant when adapted. The selected artifact's requirementsSatisfied and findings determine artifact readiness; feature-level flags or preconditions alone do not. requirementsSatisfied covers entitlement, inputs, account prerequisites and artifact support; it does not prove cloud resources, deployment success or access. Discovery and blocked artifacts have requirementsSatisfied=false and empty parameters. Returned artifact parameters have exact spelling and structure; unchanged artifacts require them verbatim, while adapted implementations require an explicit mapping of the same requirements. Does not enable billing exports.",
    true
);
export const listCloudConnectionsTool = tool(
    "list_cloud_connections",
    ListCloudConnectionsArgumentsSchema,
    `get:${base}/connections`,
    "Discover existing Cloud Connect records by exact account/feature filters. An empty list means no matching registration, not that cloud resources are absent. Subsequent pages use pageToken with the same filters.",
    true
);
export const getCloudConnectionTool = tool(
    "get_cloud_connection",
    GetCloudConnectionArgumentsSchema,
    `get:${base}/connections/{connectionId}`,
    "Read a connection's bindings, desired features, last verification summary and named follow-ups. Returns the etag for conditional writes. Stored state is not a fresh access probe; fresh checks are available through verify_cloud_connect.",
    true
);
export const registerCloudConnectionTool = tool(
    "register_cloud_connection",
    RegisterCloudConnectionArgumentsSchema,
    `post:${base}/connections`,
    "Register a deployed IAM role explicitly when the final deployment does not register it automatically and no connection exists yet. Retained DoiT Terraform provider resources and CloudFormation callbacks perform registration through their own workflow; an additional registration duplicates that operation. An existing connection for the account returns 409 connection_exists; changes to that record use a conditional update. Fresh requirements describe prerequisites, and dry_run_cloud_connection_change previews the request. Registration alone does not establish feature access.",
    false
);
export const updateCloudConnectionTool = tool(
    "update_cloud_connection",
    UpdateCloudConnectionArgumentsSchema,
    `patch:${base}/connections/{connectionId}`,
    "Change a binding's desired features/inputs, or retry failed follow-ups by re-sending the current desired state. Requires the latest connection etag; 412 indicates a stale value and a change that needs re-evaluation. dry_run_cloud_connection_change previews the exact request and its effects, including removals. Does not change IAM or the identity.",
    false,
    true
);
export const removeCloudConnectionTool = tool(
    "remove_cloud_connection",
    RemoveCloudConnectionArgumentsSchema,
    `delete:${base}/connections/{connectionId}`,
    "Disconnect the DoiT record using its exact etag and cleanupScope doit_only; customer IAM/IaC cleanup remains separate. dry_run_cloud_connection_change previews removal effects. 204 means the record is gone; a 409 cleanup_failed keeps it, and another removal attempt requires a fresh etag. A later 404 means already absent.",
    false,
    true
);
export const dryRunCloudConnectionChangeTool = tool(
    "dry_run_cloud_connection_change",
    DryRunCloudConnectionChangeArgumentsSchema,
    null,
    "Validate a register, update or remove request and run available live checks without committing (dryRun=true). A new, unregistered AWS role returns aws_broker_requires_registration because the broker cannot probe it before registration; this result does not verify access. Returns preconditions, DoiT side effects, follow-ups and customer cleanup for review. wouldApply is informational, not a reservation or approval.",
    true
);
export const verifyCloudConnectTool = tool(
    "verify_cloud_connect",
    VerifyCloudConnectArgumentsSchema,
    `post:${base}/connections/{connectionId}/actions/verify`,
    "Run fresh synchronous access checks for a registered connection. Results include authentication, per-feature checks and coverage, and `recorded` indicating whether the observation was stored. partial, not_checked and failed checks are not passed; a failed authentication leaves every feature not_checked. Declared-permission checks do not prove effective access, and access never proves billing data arrived. Nothing is stored as a run; requestId provides correlation.",
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
};

const MERGE_PATCH = "application/merge-patch+json";

export async function handleCloudConnectRequest(name: string, args: any, token: string) {
    let problem: Record<string, unknown> | undefined;
    let usedKey: string | undefined;
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
        const dryRun = name === "dry_run_cloud_connection_change";
        if (dryRun) {
            action = `${parsed.operation}_cloud_connection`;
            delete parsed.operation;
            params.set("dryRun", "true");
        }
        const { idempotencyKey: suppliedKey, ...fields } = parsed;
        const writes =
            action === "register_cloud_connection" ||
            action === "update_cloud_connection" ||
            action === "remove_cloud_connection";
        if (writes) {
            const key: string = suppliedKey ?? randomUUID();
            usedKey = key;
            headers["Idempotency-Key"] = key;
        }
        if (action === "get_cloud_connect_requirements") {
            path = "/requirements";
            method = "POST";
            body = fields;
        } else if (action === "verify_cloud_connect") {
            const { connectionId, ...selection } = fields;
            path = `/connections/${encodeURIComponent(connectionId)}/actions/verify`;
            method = "POST";
            body = selection;
        } else if (action === "register_cloud_connection") {
            method = "POST";
            body = fields;
        } else if (action === "list_cloud_connections") {
            const { scope, featureId, ...paging } = fields;
            const filter = [
                "provider:aws",
                ...(scope ? [`bindings.scope.kind:${scope.kind}`, `bindings.scope.accountId:${scope.accountId}`] : []),
                ...(featureId
                    ? [`bindings.featureIds:${featureId.replace(/[,|\\]/g, (c: string) => encodeURIComponent(c))}`]
                    : []),
            ].join("|");
            params.set("filter", filter);
            for (const [key, value] of Object.entries(paging)) if (value !== undefined) params.set(key, String(value));
        } else {
            const { connectionId, expectedEtag, cleanupScope, ...changes } = fields;
            path += `/${encodeURIComponent(connectionId)}`;
            if (expectedEtag) headers["If-Match"] = expectedEtag;
            if (action === "update_cloud_connection") {
                method = "PATCH";
                body = changes;
                headers["Content-Type"] = MERGE_PATCH;
            }
            if (action === "remove_cloud_connection") {
                method = "DELETE";
                params.set("cleanupScope", cleanupScope);
            }
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
                readOnly: name === "get_cloud_connect_requirements" || dryRun,
                timeoutMs: 60_000,
                onResponseHeaders: (responseHeaders) => {
                    etag = responseHeaders.get("etag");
                    requestId = responseHeaders.get("request-id");
                },
                onErrorResponse: async (response) => {
                    try {
                        const raw = await response.text();
                        if (raw.length > 65536) return;
                        const parsedProblem = JSON.parse(raw);
                        if (typeof parsedProblem.code !== "string") return;
                        const instanceId =
                            typeof parsedProblem.instance === "string"
                                ? parsedProblem.instance.split("/").pop()
                                : undefined;
                        // Only this API's public problem contract crosses the tool boundary.
                        // General server failures retain their bounded code/correlation, not internal detail.
                        const selected: Record<string, unknown> = {
                            status: response.status,
                            code: parsedProblem.code,
                            requestId: response.headers.get("request-id") ?? instanceId,
                            ...(usedKey ? { idempotencyKey: usedKey } : {}),
                        };
                        if (response.status < 500) {
                            for (const key of ["type", "title", "detail", "retryable", "details"])
                                if (parsedProblem[key] !== undefined) selected[key] = parsedProblem[key];
                        }
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
        if (!data) {
            // A successful DELETE returns 204 with no body.
            if (method === "DELETE" && !dryRun)
                return createSuccessResponse(
                    JSON.stringify(
                        { deleted: true, ...(requestId ? { requestId } : {}), idempotencyKey: usedKey },
                        null,
                        2
                    )
                );
            return createErrorResponse(
                "Cloud Connect returned no response; read the connection before retrying a mutation."
            );
        }
        return createSuccessResponse(
            JSON.stringify(
                {
                    // The body validator is for writes; compression can weaken the HTTP header.
                    ...(etag ? { etag } : {}),
                    ...data,
                    ...(requestId ? { requestId } : {}),
                    ...(usedKey ? { idempotencyKey: usedKey } : {}),
                },
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
