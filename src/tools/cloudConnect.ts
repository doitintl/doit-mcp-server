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

export const CLOUD_CONNECT_BASE_URL = `${DOIT_API_BASE}/onboarding/v2/cloud-connect`;

const providerEnum = z.enum(["aws", "gcp", "azure"]);
type CloudConnectProvider = z.infer<typeof providerEnum>;

const PROVIDER_COLLECTION: Record<CloudConnectProvider, string> = {
    aws: "/aws/accounts",
    gcp: "/gcp/connections",
    azure: "/azure/management-groups",
};

const PROVIDER_REQUIREMENTS: Record<CloudConnectProvider, string> = {
    aws: "/aws/requirements",
    gcp: "/gcp/requirements",
    azure: "/azure/requirements",
};

const id = z.string().min(1).max(256);
const featureIds = z
    .array(id)
    .min(1)
    .max(100)
    .refine((values) => new Set(values).size === values.length, "Feature IDs must be unique.");
const inputs = z.record(id, z.record(id, z.string().max(1024)));
const awsAccountId = z
    .string()
    .regex(/^\d{12}$/, "Use the 12-digit AWS account ID (digits only; a letter o is not a zero).");
const awsRoleArn = z.string().regex(/^arn:aws(?:-us-gov|-cn)?:iam::\d{12}:role\/.+$/);
const gcpIdPattern = "[a-z][a-z0-9-]{4,28}[a-z0-9]";
const projectId = z.string().regex(new RegExp(`^${gcpIdPattern}$`));
const organizationId = z.string().regex(/^[1-9][0-9]{0,24}$/);
const datasetId = z
    .string()
    .min(1)
    .max(1024)
    .regex(/^[A-Za-z0-9_]+$/);
const serviceAccountId = projectId;
const gcpServiceAccount = z
    .object({
        email: z.string().regex(new RegExp(`^${gcpIdPattern}@${gcpIdPattern}\\.iam\\.gserviceaccount\\.com$`)),
        uniqueId: z.string().regex(/^[0-9]{1,32}$/),
        projectId,
    })
    .strict()
    .describe(
        "Metadata from gcloud iam service-accounts describe. No private keys. Google authentication must match the email and uniqueId; the host project must match project/dataset scopes."
    );
const tenantId = z
    .string()
    .regex(/^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/, "Use the Microsoft Entra tenant ID in UUID format.")
    .describe(
        "Existing Microsoft Entra tenant UUID supplied in the prompt or selected by the user. Missing identifiers require clarification; onboarding does not create a tenant."
    );
const managementGroupId = z
    .string()
    .regex(
        /^[A-Za-z0-9._()-]{1,90}$/,
        "Use the bare Azure management group ID (for example, example-group), not a display name or full ARM resource path."
    )
    .describe(
        "Existing root or child management-group ID selected by the user. Ask when missing; a tenant UUID or CLI default does not select its root group. Setup does not create groups or move subscriptions."
    );
const roleId = z.string().regex(/^[A-Za-z0-9_.]{3,64}$/);
const connectionId = id.describe(
    "Exact connection `id` returned by register_cloud_connection, list_cloud_connections or get_cloud_connection. This is distinct from a cloud account, project, organization or tenant ID; do not construct it from those identifiers."
);
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

export const CloudConnectScopeSchema = z
    .discriminatedUnion("kind", [
        z
            .object({
                provider: z.literal("aws"),
                kind: z.literal("aws_account"),
                accountId: awsAccountId,
            })
            .strict(),
        z.object({ provider: z.literal("gcp"), kind: z.literal("gcp_organization"), organizationId }).strict(),
        z.object({ provider: z.literal("gcp"), kind: z.literal("gcp_project"), projectId }).strict(),
        z.object({ provider: z.literal("gcp"), kind: z.literal("gcp_dataset"), projectId, datasetId }).strict(),
        z
            .object({
                provider: z.literal("azure"),
                kind: z.literal("azure_management_group"),
                tenantId,
                managementGroupId,
            })
            .strict(),
    ])
    .describe(
        "One existing target selected by the user: an AWS account, GCP organization/project/dataset or Azure management group (tenantId and managementGroupId). Azure includes root or child management groups and descendants; tenant billing grants are separate. AWS roots/OUs are deployment targets. GCP organization inheritance does not prove project-specific feature setup or data arrival."
    );

export const CloudConnectRequirementsScopeSchema = z
    .discriminatedUnion("kind", [
        ...CloudConnectScopeSchema.options,
        z
            .object({
                provider: z.literal("aws"),
                kind: z.literal("aws_organization"),
                managementAccountId: awsAccountId,
                targetId: z.string().regex(/^(r-[a-z0-9]{4,32}|ou-[a-z0-9]{4,32}-[a-z0-9]{8,32})$/),
            })
            .strict(),
    ])
    .describe(
        "An existing AWS account, GCP organization/project/dataset or Azure management group, or AWS organization deployment requirements with managementAccountId and one root/OU targetId. AWS organization requirements return the management StackSet template and member dependency; they do not create a fleet connection or validate membership. AWS connections remain account-scoped."
    );

export const GetCloudConnectRequirementsArgumentsSchema = z
    .object({
        scope: CloudConnectRequirementsScopeSchema,
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
        identityInputs: z
            .object({
                projectId: projectId.optional(),
                serviceAccountId: serviceAccountId.optional(),
                roleId: roleId.optional(),
            })
            .strict()
            .optional()
            .describe(
                "GCP service-account placement: organization scope needs a host projectId; dataset scope needs serviceAccountId. Other scopes default to doit-cmp."
            ),
        discoveryInputs: z
            .object({
                managementAccountId: awsAccountId
                    .optional()
                    .describe(
                        "Optional management-account hint for aws_account member requests only; omit for aws_organization. It does not associate an undiscovered member with the customer or override DoiT account/payer prerequisites."
                    ),
            })
            .strict()
            .optional(),
    })
    .strict();

export const ListCloudConnectionsArgumentsSchema = z
    .object({
        provider: providerEnum
            .optional()
            .describe(
                "Provider to list when scope is omitted. Defaults to aws; pass gcp or azure for those providers. Azure lists management-group connections only."
            ),
        scope: CloudConnectScopeSchema.optional().describe(
            "Exact native scope filter, including provider and every identifier in this scope."
        ),
        featureId: id.optional().describe("Only connections selecting this feature."),
        maxResults: z.number().int().min(1).max(500).optional(),
        pageToken: id.optional().describe("Opaque `pageToken` from the previous page; keep the same filters."),
    })
    .strict();

export const GetCloudConnectionArgumentsSchema = z
    .object({
        provider: providerEnum.describe("Cloud provider for this connection (`aws`, `gcp`, or `azure`)."),
        connectionId,
    })
    .strict();

const awsRegisterShape = {
    provider: z.literal("aws"),
    accountId: awsAccountId,
    roleArn: awsRoleArn,
    featureIds,
    featureInputs: inputs.optional(),
    catalogVersion,
    idempotencyKey,
};

const gcpRegisterShape = {
    provider: z.literal("gcp"),
    scopeKind: z.enum(["gcp_organization", "gcp_project", "gcp_dataset"]),
    organizationId: organizationId.optional(),
    projectId: projectId.optional(),
    datasetId: datasetId.optional(),
    serviceAccount: gcpServiceAccount,
    roleId: roleId.optional(),
    featureIds,
    featureInputs: inputs.optional(),
    catalogVersion,
    idempotencyKey,
};

const azureRegisterShape = {
    provider: z.literal("azure"),
    tenantId,
    managementGroupId,
    featureIds,
    featureInputs: inputs.optional(),
    catalogVersion,
    idempotencyKey,
};

function validateGcpScopeFields(
    value: {
        scopeKind: "gcp_organization" | "gcp_project" | "gcp_dataset";
        organizationId?: string;
        projectId?: string;
        datasetId?: string;
    },
    ctx: z.RefinementCtx
) {
    if (value.scopeKind === "gcp_organization") {
        if (!value.organizationId) {
            ctx.addIssue({
                code: "custom",
                path: ["organizationId"],
                message: "organizationId is required for gcp_organization.",
            });
        }
        if (value.projectId !== undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["projectId"],
                message: "projectId is not valid for gcp_organization.",
            });
        }
        if (value.datasetId !== undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["datasetId"],
                message: "datasetId is not valid for gcp_organization.",
            });
        }
    } else if (value.scopeKind === "gcp_project") {
        if (!value.projectId) {
            ctx.addIssue({ code: "custom", path: ["projectId"], message: "projectId is required for gcp_project." });
        }
        if (value.organizationId !== undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["organizationId"],
                message: "organizationId is not valid for gcp_project.",
            });
        }
        if (value.datasetId !== undefined) {
            ctx.addIssue({ code: "custom", path: ["datasetId"], message: "datasetId is not valid for gcp_project." });
        }
    } else {
        if (!value.projectId) {
            ctx.addIssue({ code: "custom", path: ["projectId"], message: "projectId is required for gcp_dataset." });
        }
        if (!value.datasetId) {
            ctx.addIssue({ code: "custom", path: ["datasetId"], message: "datasetId is required for gcp_dataset." });
        }
        if (value.organizationId !== undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["organizationId"],
                message: "organizationId is not valid for gcp_dataset.",
            });
        }
    }
}

const awsRegisterSchema = z.object(awsRegisterShape).strict();
const gcpRegisterSchema = z.object(gcpRegisterShape).strict().superRefine(validateGcpScopeFields);
const azureRegisterSchema = z.object(azureRegisterShape).strict();

export const RegisterCloudConnectionArgumentsSchema = z.discriminatedUnion("provider", [
    awsRegisterSchema,
    gcpRegisterSchema,
    azureRegisterSchema,
]);

const updateShape = {
    provider: providerEnum.describe("Cloud provider for this connection (`aws`, `gcp`, or `azure`)."),
    connectionId,
    expectedEtag,
    catalogVersion,
    featureIds: featureIds.optional().describe("Complete desired feature list for this connection, not a delta."),
    featureInputs: inputs
        .nullable()
        .optional()
        .describe("Complete desired inputs for this connection; null clears them."),
    idempotencyKey,
};

function validateUpdateBody(
    value: { featureIds?: string[]; featureInputs?: Record<string, Record<string, string>> | null },
    ctx: z.RefinementCtx
) {
    if (value.featureIds === undefined && value.featureInputs === undefined) {
        ctx.addIssue({ code: "custom", message: "Provide featureIds or featureInputs to update." });
    }
}

export const UpdateCloudConnectionArgumentsSchema = z.object(updateShape).strict().superRefine(validateUpdateBody);

const removeShape = {
    provider: providerEnum.describe("Cloud provider for this connection (`aws`, `gcp`, or `azure`)."),
    connectionId,
    expectedEtag,
    cleanupScope: z
        .literal("doit_only")
        .describe(
            "Required acknowledgement. Removes the DoiT record and DoiT-side cleanup only; customer IAM, stacks and Terraform stay customer-owned. The removal dry run exposes side effects for review."
        ),
    idempotencyKey,
};

export const RemoveCloudConnectionArgumentsSchema = z.object(removeShape).strict();

export const DryRunCloudConnectionChangeArgumentsSchema = z.union([
    z.object({ operation: z.literal("register"), ...awsRegisterShape }).strict(),
    z
        .object({ operation: z.literal("register"), ...gcpRegisterShape })
        .strict()
        .superRefine(validateGcpScopeFields),
    z.object({ operation: z.literal("register"), ...azureRegisterShape }).strict(),
    z
        .object({ operation: z.literal("update"), ...updateShape })
        .strict()
        .superRefine(validateUpdateBody),
    z.object({ operation: z.literal("remove"), ...removeShape }).strict(),
]);

export const VerifyCloudConnectArgumentsSchema = z
    .object({
        provider: providerEnum.describe("Cloud provider for this connection (`aws`, `gcp`, or `azure`)."),
        connectionId,
        featureIds: featureIds.optional().describe("Limit to these selected features; default all selected features."),
    })
    .strict();

function tool(
    name: string,
    schema: z.ZodType,
    endpoint: string | readonly string[] | null,
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

const base = "/onboarding/v2/cloud-connect";

export const getCloudConnectRequirementsTool = tool(
    "get_cloud_connect_requirements",
    GetCloudConnectRequirementsArgumentsSchema,
    [`post:${base}/aws/requirements`, `post:${base}/gcp/requirements`, `post:${base}/azure/requirements`],
    "Resolve fresh customer-specific AWS, GCP or Azure Cloud Connect prerequisites, identity trust, per-feature permissions, inputs and deployment artifacts. Read-only. Azure management-group requirements return an inline Azure CLI plan/apply script with exact selected roles and `identity.customerBinding`; it grants access without registering and does not elevate the operator. GCP organization, project and dataset scopes use the returned inline shell artifact. AWS account scopes return the account CloudFormation template and per-account Terraform module. AWS organization scopes return one management StackSet artifact with entrypoint, a flat files list (path, URL and SHA-256 for both templates) and parameters for one root/OU; no fleet connection or rollout operation is created. AWS membership, Organizations/StackSets prerequisites, deployment success and access remain separate checks. AWS organization real-time bucket/enrollment configuration is unsupported by the pinned artifact. Artifacts are reference implementations for adaptation to customer tooling; their requirements and registration behavior remain relevant when adapted. The selected artifact's requirementsSatisfied and findings determine artifact readiness; feature-level flags or preconditions alone do not. Discovery and blocked artifacts have requirementsSatisfied=false and empty parameters. Returned parameters preserve the artifact's exact spelling and structure. Does not enable billing exports.",
    true
);

export const listCloudConnectionsTool = tool(
    "list_cloud_connections",
    ListCloudConnectionsArgumentsSchema,
    [`get:${base}/aws/accounts`, `get:${base}/gcp/connections`, `get:${base}/azure/management-groups`],
    "Discover existing Cloud Connect records by provider, native scope and featureId filters. Pass provider `azure` or `gcp`, or that provider's exact scope, for non-AWS discovery; omitting both defaults to AWS. Azure lists management-group connections only; legacy tenant billing records are excluded. An empty list means no matching registration, not that cloud resources are absent. Subsequent pages use pageToken with the same filters.",
    true
);

export const getCloudConnectionTool = tool(
    "get_cloud_connection",
    GetCloudConnectionArgumentsSchema,
    [`get:${base}/aws/accounts/{id}`, `get:${base}/gcp/connections/{id}`, `get:${base}/azure/management-groups/{id}`],
    "Read a connection's target identifiers, desired features, last verification summary and named follow-ups by provider and connectionId. Returns the etag for conditional writes. Stored state is not a fresh access probe; fresh checks are available through verify_cloud_connect.",
    true
);

export const registerCloudConnectionTool = tool(
    "register_cloud_connection",
    RegisterCloudConnectionArgumentsSchema,
    [`post:${base}/aws/accounts`, `post:${base}/gcp/connections`, `post:${base}/azure/management-groups`],
    "Register a deployed AWS IAM role, GCP service account or Azure management-group connection explicitly when the final deployment does not register it automatically and no connection exists yet. For AWS, retained DoiT Terraform provider resources and CloudFormation callbacks perform registration through their own workflow; an additional registration duplicates that operation. An existing connection for the scope returns 409 connection_exists; changes to that record use a conditional update. Fresh requirements describe prerequisites, and dry_run_cloud_connection_change previews the request. GCP setup scripts grant access but do not register: use descriptor metadata (`serviceAccount`), `scopeKind` and target IDs. Azure registers by `tenantId` and `managementGroupId`; live selected grants must carry the setup-written customer binding and no Azure credentials or secrets are accepted. The response returns the authoritative connection `id` and registered target identifiers for subsequent operations. Registration records an existing cloud target; it does not create an account, project, organization or Azure tenant/group. Registration alone does not establish feature readiness or data arrival.",
    false
);

export const updateCloudConnectionTool = tool(
    "update_cloud_connection",
    UpdateCloudConnectionArgumentsSchema,
    [
        `patch:${base}/aws/accounts/{id}`,
        `patch:${base}/gcp/connections/{id}`,
        `patch:${base}/azure/management-groups/{id}`,
    ],
    "Change a connection's desired `featureIds` or `featureInputs` as a JSON merge patch, or retry failed follow-ups by re-sending the current desired state. Requires `provider`, `connectionId` and the latest quoted `expectedEtag`; 412 indicates a stale value and a change that needs re-evaluation. `dry_run_cloud_connection_change` previews the exact request. Does not change IAM or the identity.",
    false,
    true
);

export const removeCloudConnectionTool = tool(
    "remove_cloud_connection",
    RemoveCloudConnectionArgumentsSchema,
    [
        `delete:${base}/aws/accounts/{id}`,
        `delete:${base}/gcp/connections/{id}`,
        `delete:${base}/azure/management-groups/{id}`,
    ],
    "Disconnect the DoiT record using `provider`, `connectionId`, its exact `expectedEtag` and `cleanupScope: doit_only`; customer IAM/IaC cleanup remains separate. `dry_run_cloud_connection_change` previews removal effects. 204 means the record is gone; a 409 cleanup_failed keeps it, and another removal attempt requires a fresh etag. A later 404 means already absent.",
    false,
    true
);

export const dryRunCloudConnectionChangeTool = tool(
    "dry_run_cloud_connection_change",
    DryRunCloudConnectionChangeArgumentsSchema,
    null,
    "Validate a register, update or remove request and run available live checks without committing (dryRun=true). For register and remove, returns preconditions, DoiT side effects, follow-ups and customer cleanup for review (`wouldApply` is informational, not a reservation or approval). A new unregistered AWS role returns `aws_broker_requires_registration` because the broker cannot probe it before registration. For update, returns the projected connection resource with `X-Dry-Run: true` or a 422 problem if gates fail.",
    true
);

export const verifyCloudConnectTool = tool(
    "verify_cloud_connect",
    VerifyCloudConnectArgumentsSchema,
    [
        `post:${base}/aws/accounts/{id}/actions/verify`,
        `post:${base}/gcp/connections/{id}/actions/verify`,
        `post:${base}/azure/management-groups/{id}/actions/verify`,
    ],
    "Run fresh synchronous access checks for a registered connection by `provider` and `connectionId`. Results include authentication, per-feature checks and coverage, and `recorded` indicating whether the observation was stored. partial, not_checked and failed checks are not passed; a failed authentication leaves every feature not_checked. AWS declared-policy checks do not prove effective access. GCP checks effective scope permissions; BigQuery dataset results expose sampled table coverage. Azure checks fresh management-group access and unconditional role assignments held by the DoiT application at that exact scope; this does not evaluate every effective permission or deny assignment. Access never proves billing data arrived. Nothing is stored as a run; requestId provides correlation.",
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

function encodeFilterValue(value: string): string {
    return value.replace(/[,|\\]/g, (c) => encodeURIComponent(c));
}

function buildRequirementsRequest(fields: z.infer<typeof GetCloudConnectRequirementsArgumentsSchema>):
    | {
          path: string;
          body: Record<string, unknown>;
      }
    | { error: string } {
    const { scope, featureIds: selectedFeatures, featureInputs, identityInputs, discoveryInputs } = fields;
    if (scope.provider === "aws") {
        if (identityInputs !== undefined) {
            return { error: "identityInputs is only supported for GCP requirements." };
        }
        if (scope.kind === "aws_organization" && discoveryInputs !== undefined) {
            return { error: "discoveryInputs is only supported for aws_account requirements." };
        }
        const body: Record<string, unknown> =
            scope.kind === "aws_account"
                ? { scopeKind: scope.kind, accountId: scope.accountId }
                : { scopeKind: scope.kind, managementAccountId: scope.managementAccountId, targetId: scope.targetId };
        if (selectedFeatures !== undefined) body.featureIds = selectedFeatures;
        if (featureInputs !== undefined) body.featureInputs = featureInputs;
        if (discoveryInputs !== undefined) body.discoveryInputs = discoveryInputs;
        return { path: PROVIDER_REQUIREMENTS.aws, body };
    }
    if (scope.provider === "gcp") {
        if (discoveryInputs !== undefined) {
            return { error: "discoveryInputs is only supported for AWS account requirements." };
        }
        const body: Record<string, unknown> = { scopeKind: scope.kind };
        if (scope.kind === "gcp_organization") body.organizationId = scope.organizationId;
        if (scope.kind === "gcp_project") body.projectId = scope.projectId;
        if (scope.kind === "gcp_dataset") {
            body.projectId = scope.projectId;
            body.datasetId = scope.datasetId;
        }
        if (selectedFeatures !== undefined) body.featureIds = selectedFeatures;
        if (featureInputs !== undefined) body.featureInputs = featureInputs;
        if (identityInputs !== undefined) body.identityInputs = identityInputs;
        return { path: PROVIDER_REQUIREMENTS.gcp, body };
    }
    if (identityInputs !== undefined) {
        return { error: "identityInputs is only supported for GCP requirements." };
    }
    if (discoveryInputs !== undefined) {
        return { error: "discoveryInputs is only supported for AWS account requirements." };
    }
    const body: Record<string, unknown> = {
        tenantId: scope.tenantId,
        managementGroupId: scope.managementGroupId,
    };
    if (selectedFeatures !== undefined) body.featureIds = selectedFeatures;
    if (featureInputs !== undefined) body.featureInputs = featureInputs;
    return { path: PROVIDER_REQUIREMENTS.azure, body };
}

function buildListFilter(
    scope: z.infer<typeof CloudConnectScopeSchema> | undefined,
    featureId: string | undefined
): string {
    const clauses: string[] = [];
    if (scope) {
        if (scope.provider === "aws") {
            clauses.push(`accountId:${scope.accountId}`);
        } else if (scope.provider === "gcp") {
            clauses.push(`scopeKind:${scope.kind}`);
            if (scope.kind === "gcp_organization") clauses.push(`organizationId:${scope.organizationId}`);
            if (scope.kind === "gcp_project") clauses.push(`projectId:${scope.projectId}`);
            if (scope.kind === "gcp_dataset") {
                clauses.push(`projectId:${scope.projectId}`);
                clauses.push(`datasetId:${encodeFilterValue(scope.datasetId)}`);
            }
        } else {
            clauses.push(`tenantId:${scope.tenantId}`);
            clauses.push(`managementGroupId:${encodeFilterValue(scope.managementGroupId)}`);
        }
    }
    if (featureId) {
        clauses.push(`featureIds:${encodeFilterValue(featureId)}`);
    }
    return clauses.join("|");
}

export async function handleCloudConnectRequest(name: string, args: any, token: string) {
    let problem: Record<string, unknown> | undefined;
    let usedKey: string | undefined;
    try {
        const schema = CLOUD_CONNECT_SCHEMAS[name];
        if (!schema) return createErrorResponse("Unknown Cloud Connect tool");
        const { customerContext, ...toolArgs } = (args ?? {}) as Record<string, unknown>;
        const parsed = schema.parse(toolArgs) as Record<string, any>;
        const params = new URLSearchParams();
        const headers: Record<string, string> = {};
        let method = "GET";
        let path = "";
        let body: Record<string, unknown> | undefined;
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
            const req = buildRequirementsRequest(fields as z.infer<typeof GetCloudConnectRequirementsArgumentsSchema>);
            if ("error" in req) return createErrorResponse(req.error);
            path = req.path;
            method = "POST";
            body = req.body;
        } else if (action === "verify_cloud_connect") {
            const { provider, connectionId: idValue, ...selection } = fields;
            path = `${PROVIDER_COLLECTION[provider as CloudConnectProvider]}/${encodeURIComponent(idValue)}/actions/verify`;
            method = "POST";
            body = selection;
        } else if (action === "register_cloud_connection") {
            const { provider, ...payload } = fields;
            path = PROVIDER_COLLECTION[provider as CloudConnectProvider];
            method = "POST";
            body = payload;
        } else if (action === "list_cloud_connections") {
            const { scope, provider, featureId, ...paging } = fields;
            if (scope && provider && scope.provider !== provider)
                return createErrorResponse("provider must match scope.provider");
            const targetProvider: CloudConnectProvider = scope?.provider ?? provider ?? "aws";
            path = PROVIDER_COLLECTION[targetProvider];
            const filter = buildListFilter(scope, featureId);
            if (filter) params.set("filter", filter);
            for (const [key, value] of Object.entries(paging)) if (value !== undefined) params.set(key, String(value));
        } else {
            const { provider, connectionId: idValue, expectedEtag: ifMatch, cleanupScope, ...changes } = fields;
            path = `${PROVIDER_COLLECTION[provider as CloudConnectProvider]}/${encodeURIComponent(idValue)}`;
            if (ifMatch) headers["If-Match"] = ifMatch;
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
                customerContext: typeof customerContext === "string" ? customerContext : undefined,
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
                    } catch {}
                },
            }
        );
        if (!data) {
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
