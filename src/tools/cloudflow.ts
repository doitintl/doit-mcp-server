import { z } from "zod";
import type {
    CloudFlowConnection,
    CloudFlowConnectionsResponse,
    CloudFlowListResponse,
    CloudFlowTemplate,
    CloudFlowTemplatesResponse,
} from "../types/cloudflow.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
    makeDoitSSERequest,
} from "../utils/util.js";

const CLOUDFLOW_BASE_URL = `${DOIT_API_BASE}/cloudflow/v1`;
export const CLOUDFLOW_TRIGGER_BASE_URL = `${CLOUDFLOW_BASE_URL}/trigger`;
export const CLOUDFLOW_CONNECTIONS_BASE_URL = `${CLOUDFLOW_BASE_URL}/connections`;
export const CLOUDFLOW_TEMPLATES_BASE_URL = `${CLOUDFLOW_BASE_URL}/templates`;
export const CLOUDFLOW_FLOWS_BASE_URL = `${CLOUDFLOW_BASE_URL}/flows`;

export const DEFAULT_MAX_RESULTS_CLOUDFLOW_CONNECTIONS = "50";
export const DEFAULT_MAX_RESULTS_CLOUDFLOW_TEMPLATES = "50";
export const DEFAULT_MAX_RESULTS_CLOUDFLOW_FLOWS = "50";

export const TriggerCloudFlowArgumentsSchema = z.object({
    flowID: z.string().describe("The ID of the CloudFlow flow to trigger"),
    requestBodyJson: z
        .record(z.unknown())
        .optional()
        .describe("Optional JSON object to pass as the request body to the flow if the flow requires it"),
});

const CLOUDFLOW_TRIGGER_PATH = new URL(CLOUDFLOW_TRIGGER_BASE_URL).pathname.replace(/\/+$/, "");

const CLOUDFLOW_ID_PATTERN = /^[^\s%/]{1,1500}$/;

/**
 * Extracts a CloudFlow flow ID from either a plain ID or a CloudFlow trigger URL.
 * A URL is only accepted when its path matches the trigger endpoint shape
 * (".../cloudflow/v1/trigger/<flowId>") — any other URL (e.g. an execution
 * history link) is rejected rather than having an
 * unrelated path segment mistaken for a flow ID.
 * only the path shape and trailing ID segment matter
 */
export function extractCloudFlowId(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return CLOUDFLOW_ID_PATTERN.test(trimmed) ? trimmed : null;
    }

    const pathname = parsed.pathname.replace(/\/+$/, "");
    const prefix = `${CLOUDFLOW_TRIGGER_PATH}/`;
    if (!pathname.startsWith(prefix)) return null;

    const remainder = pathname.slice(prefix.length);
    return CLOUDFLOW_ID_PATTERN.test(remainder) ? remainder : null;
}

/**
 * Returns the full trigger URL for a CloudFlow, always built from this
 * project's own CLOUDFLOW_TRIGGER_BASE_URL so the request target can never
 * be redirected by caller-supplied input. Returns null when the value isn't
 * a plain flow ID or a recognizable CloudFlow trigger URL.
 */
export function getTriggerCloudFlowURL(value: string): string | null {
    const flowId = extractCloudFlowId(value);
    if (!flowId) return null;
    return `${CLOUDFLOW_TRIGGER_BASE_URL}/${encodeURIComponent(flowId)}`;
}

export const triggerCloudFlowTool = {
    name: "trigger_cloud_flow",
    coversEndpoint: "post:/cloudflow/v1/trigger/{flowId}",
    description:
        "Use this when the user wants to trigger an automated CloudFlow workflow by its flow ID. This executes automation that may modify cloud resources externally. Ask the user to confirm the flow ID and any parameters before executing. Do NOT use this for viewing CloudFlow definitions or checking available flows.",
    inputSchema: {
        type: "object",
        properties: {
            flowID: {
                type: "string",
                description: "The ID of the CloudFlow flow to trigger",
            },
            requestBodyJson: {
                type: "object",
                description: "Optional JSON object to pass as the request body to the flow if the flow requires it",
            },
        },
        required: ["flowID"],
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Triggering CloudFlow...",
        "openai/toolInvocation/invoked": "CloudFlow triggered",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export const RefineCloudflowArgumentsSchema = z.object({
    question: z.string().describe("The instruction or question to refine or rebuild the flow"),
    flowId: z.string().describe("The ID of the CloudFlow flow to refine"),
    conversationId: z.string().optional().describe("Optional conversation ID for multi-turn sessions"),
});

export const refineCloudflowTool = {
    name: "refine_cloudflow",
    coversEndpoint: "post:/cloudflow/v1/flows/{flowId}/actions/refine",
    description:
        "Use this when the user wants to refine or rebuild an existing CloudFlow automation using natural language. Streams real-time progress updates while the AI builds the flow, then returns the final result.",
    inputSchema: {
        type: "object",
        properties: {
            question: {
                type: "string",
                description: "The instruction or question to refine or rebuild the flow",
            },
            flowId: {
                type: "string",
                description: "The ID of the CloudFlow flow to refine",
            },
            conversationId: {
                type: "string",
                description: "Optional conversation ID for multi-turn sessions",
            },
        },
        required: ["question", "flowId"],
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Refining CloudFlow...",
        "openai/toolInvocation/invoked": "CloudFlow refined",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export const BuildCloudflowArgumentsSchema = z.object({
    question: z.string().describe("Natural language description of the CloudFlow to build from scratch."),
    conversationId: z.string().optional().describe("Optional conversation ID to continue an existing build session."),
});

export const buildCloudflowTool = {
    name: "build_cloud_flow",
    coversEndpoint: "post:/cloudflow/v1/flows/actions/build",
    description:
        "Use this when the user wants to build a brand-new CloudFlow automation from scratch using natural language. Streams real-time progress while the AI builds the flow, then returns the newly created flow's ID, the builder's answer, and the build steps that ran. Use refine_cloudflow to change an existing flow; use this only to create a new one.",
    inputSchema: {
        type: "object",
        properties: {
            question: {
                type: "string",
                description: "Natural language description of the CloudFlow to build from scratch.",
            },
            conversationId: {
                type: "string",
                description: "Optional conversation ID to continue an existing build session.",
            },
        },
        required: ["question"],
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Building CloudFlow...",
        "openai/toolInvocation/invoked": "CloudFlow built",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

/**
 * The CloudFlow NL builder (build and refine) answers with a text/event-stream of build
 * events rather than a single JSON body: tool-lifecycle markers, token-by-token assistant
 * text, and a custom event carrying the created flow's ID. The generic generated-tool path
 * (callOperation.ts) sends `Accept: application/json` and reads one response body, so on
 * these endpoints it gets a 406/parse failure and reports an opaque "Failed to call
 * POST ..." — which is why build and refine are hand-written and consume the stream here.
 *
 * parseBuilderLifecycleEvent distinguishes the stream's embedded lifecycle JSON
 * (toolStart/toolEnd/llmStart/llmEnd/customEvent) from plain assistant text: a token that
 * merely looks like JSON stays text unless it carries one of the lifecycle keys.
 */
function parseBuilderLifecycleEvent(token: string): Record<string, unknown> | null {
    if (!token.startsWith("{")) return null;
    let event: Record<string, unknown>;
    try {
        event = JSON.parse(token);
    } catch {
        return null;
    }
    if (!event || typeof event !== "object") return null;
    for (const key of ["toolStart", "toolEnd", "llmStart", "llmEnd", "customEvent"]) {
        if (key in event) return event;
    }
    return null;
}

/** Extracts the created flow's ID from a `cloudflow_created` custom event, if this is one. */
function builderCreatedFlowId(lifecycle: Record<string, unknown>): string | undefined {
    const custom = lifecycle.customEvent as Record<string, unknown> | undefined;
    if (!custom || custom.messageId !== "cloudflow_created") return undefined;
    const data = custom.data as Record<string, unknown> | undefined;
    const flowId = data?.flowId;
    return typeof flowId === "string" && flowId ? flowId : undefined;
}

type CloudflowBuilderResult = {
    answer: string;
    conversationId?: string;
    flowId?: string;
    steps: string[];
};

/**
 * Consumes the NL builder's SSE stream, mutating `accumulator` as events arrive and
 * forwarding progress steps to `onProgress`. The accumulator is passed in (rather than
 * returned) so a caller can still report the flow ID the stream emitted before an error
 * interrupted it — a partially built flow is recoverable.
 */
async function consumeCloudflowBuilderStream(
    url: string,
    body: Record<string, unknown>,
    token: string,
    accumulator: CloudflowBuilderResult,
    onProgress?: (message: string) => Promise<void>
): Promise<void> {
    let answerText = "";
    for await (const { data } of makeDoitSSERequest(url, body, token)) {
        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(data);
        } catch {
            continue;
        }

        if (typeof parsed.conversationId === "string" && parsed.conversationId) {
            accumulator.conversationId = parsed.conversationId;
        }

        const answer = parsed.answer;
        if (typeof answer !== "string") continue;

        const lifecycle = parseBuilderLifecycleEvent(answer);
        if (!lifecycle) {
            answerText += answer;
            continue;
        }

        const step = lifecycle.toolStart;
        if (typeof step === "string" && step) {
            accumulator.steps.push(step);
            await onProgress?.(step);
        }
        const createdFlowId = builderCreatedFlowId(lifecycle);
        if (createdFlowId) accumulator.flowId = createdFlowId;
    }
    accumulator.answer = answerText;
}

/** makeDoitSSERequest preserves existing query params, so append customerContext here so
 *  the builder endpoints can be scoped to a customer (required for DoiT-employee tokens). */
function buildCustomerContextUrl(baseUrl: string, customerContext?: string): string {
    if (!customerContext) return baseUrl;
    const url = new URL(baseUrl);
    url.searchParams.set("customerContext", customerContext);
    return url.href;
}

export async function handleBuildCloudflowRequest(
    args: any,
    token: string,
    onProgress?: (message: string) => Promise<void>
) {
    try {
        const { question, conversationId } = BuildCloudflowArgumentsSchema.parse(args);
        const customerContext = (args?.customerContext as string | undefined) || process.env.CUSTOMER_CONTEXT;

        const url = buildCustomerContextUrl(`${CLOUDFLOW_FLOWS_BASE_URL}/actions/build`, customerContext);
        const body: Record<string, unknown> = { question };
        if (conversationId) body.conversationId = conversationId;

        const accumulator: CloudflowBuilderResult = { answer: "", steps: [] };

        try {
            await consumeCloudflowBuilderStream(url, body, token, accumulator, onProgress);
        } catch (error) {
            // Surface the real underlying error, plus any flow ID the stream emitted before it
            // failed, instead of the generic generated-path "Failed to call POST ...".
            const detail = error instanceof Error ? error.message : String(error);
            const recovered = accumulator.flowId
                ? ` A flow was created before the stream failed (flowId: ${accumulator.flowId}); inspect it with export_cloudflow_flow or delete it if unusable.`
                : "";
            return createErrorResponse(`CloudFlow build stream failed: ${detail}.${recovered}`);
        }

        if (!accumulator.answer && !accumulator.flowId && !accumulator.conversationId) {
            return createErrorResponse("No result received from CloudFlow build stream");
        }

        const result: Record<string, unknown> = {};
        if (accumulator.flowId) result.flowId = accumulator.flowId;
        if (accumulator.conversationId) result.conversationId = accumulator.conversationId;
        if (accumulator.answer) result.answer = accumulator.answer;
        if (accumulator.steps.length > 0) result.steps = accumulator.steps;
        return createSuccessResponse(JSON.stringify(result, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling build CloudFlow request");
    }
}

export async function handleRefineCloudflowRequest(
    args: any,
    token: string,
    onProgress?: (message: string) => Promise<void>
) {
    try {
        const { flowId, question, conversationId } = RefineCloudflowArgumentsSchema.parse(args);
        const customerContext = (args?.customerContext as string | undefined) || process.env.CUSTOMER_CONTEXT;

        const url = buildCustomerContextUrl(
            `${CLOUDFLOW_BASE_URL}/flows/${encodeURIComponent(flowId)}/actions/refine`,
            customerContext
        );
        const body: Record<string, unknown> = { question };
        if (conversationId) body.conversationId = conversationId;

        const accumulator: CloudflowBuilderResult = { answer: "", steps: [] };

        try {
            await consumeCloudflowBuilderStream(url, body, token, accumulator, onProgress);
        } catch (error) {
            return handleGeneralError(error, "calling refine CloudFlow API");
        }

        if (!accumulator.answer) {
            return createErrorResponse("No result received from CloudFlow build stream");
        }

        const result: Record<string, unknown> = { answer: accumulator.answer };
        if (accumulator.conversationId) result.conversationId = accumulator.conversationId;
        if (accumulator.flowId) result.flowId = accumulator.flowId;
        if (accumulator.steps.length > 0) result.steps = accumulator.steps;
        return createSuccessResponse(JSON.stringify(result, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling refine CloudFlow request");
    }
}

export async function handleTriggerCloudFlowRequest(args: any, token: string) {
    try {
        const { flowID, requestBodyJson } = TriggerCloudFlowArgumentsSchema.parse(args);
        const { customerContext } = args;

        if (!flowID.trim()) {
            return createErrorResponse(
                "Please request the user to specify the target flow ID and optionally the request body JSON if the flow requires it"
            );
        }
        const url = getTriggerCloudFlowURL(flowID);
        if (!url) {
            return createErrorResponse(
                "The flowID must be a plain CloudFlow flow ID or a CloudFlow trigger URL (e.g. https://api.doit.com/cloudflow/v1/trigger/<flowId>)"
            );
        }

        try {
            const data = await makeDoitRequest<Record<string, unknown>>(url, token, {
                method: "POST",
                body: requestBodyJson ?? {},
                customerContext,
            });

            if (!data) {
                return createErrorResponse(`Failed to trigger CloudFlow: ${url}`);
            }

            return createSuccessResponse(JSON.stringify(data, null, 2));
        } catch (error) {
            return handleGeneralError(error, "calling trigger CloudFlow API");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling trigger CloudFlow request");
    }
}

// Schema and metadata for list CloudFlow connections
export const ListCloudFlowConnectionsArgumentsSchema = z.object({
    maxResults: z
        .string()
        .optional()
        .describe(
            `Maximum number of connections to return (1–100). Defaults to ${DEFAULT_MAX_RESULTS_CLOUDFLOW_CONNECTIONS}.`
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Pagination cursor returned by a previous call, to request the next page of results."),
});

export const listCloudFlowConnectionsTool = {
    name: "list_cloudflow_connections",
    coversEndpoint: "get:/cloudflow/v1/connections",
    description:
        "Use this when the user wants to see their CloudFlow cloud provider connections (the GCP/AWS accounts connected for automation). Returns a cursor-paginated list of connections with their config and status. Do NOT use this to trigger a flow (use trigger_cloud_flow) or to view a single connection's details (use get_cloudflow_connection).",
    inputSchema: zodToMcpInputSchema(ListCloudFlowConnectionsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading CloudFlow connections...",
        "openai/toolInvocation/invoked": "CloudFlow connections loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListCloudFlowConnectionsRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken } = ListCloudFlowConnectionsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_CLOUDFLOW_CONNECTIONS);
        if (pageToken) params.append("pageToken", pageToken);

        const url = `${CLOUDFLOW_CONNECTIONS_BASE_URL}?${params}`;

        const data = await makeDoitRequest<CloudFlowConnectionsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve CloudFlow connections");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list CloudFlow connections request");
    }
}

// Schema and metadata for get a CloudFlow connection
export const GetCloudFlowConnectionArgumentsSchema = z.object({
    connectionId: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1))
        .describe("The ID of the CloudFlow connection to retrieve."),
});

export const getCloudFlowConnectionTool = {
    name: "get_cloudflow_connection",
    coversEndpoint: "get:/cloudflow/v1/connections/{connectionId}",
    description:
        "Use this when the user wants to view the details of a specific CloudFlow cloud provider connection by its ID, including its GCP/AWS configuration, collaborators, and status. Do NOT use this to list all connections (use list_cloudflow_connections) or to trigger a flow (use trigger_cloud_flow).",
    inputSchema: zodToMcpInputSchema(GetCloudFlowConnectionArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading CloudFlow connection...",
        "openai/toolInvocation/invoked": "CloudFlow connection loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetCloudFlowConnectionRequest(args: any, token: string) {
    try {
        const { connectionId } = GetCloudFlowConnectionArgumentsSchema.parse(args);
        const { customerContext } = args;

        const url = `${CLOUDFLOW_CONNECTIONS_BASE_URL}/${encodeURIComponent(connectionId)}`;

        const data = await makeDoitRequest<CloudFlowConnection>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve CloudFlow connection");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get CloudFlow connection request");
    }
}

// Reusable sub-schemas for CloudFlow connection configuration (create/update)
const CloudFlowCustomRoleSchema = z.object({
    roleId: z.string().optional().describe("The ID of the custom role."),
    permissions: z.array(z.string()).optional().describe("The list of permissions granted by the custom role."),
});

const CloudFlowGcpConfigSchema = z.object({
    organizationId: z.string().optional().describe("The GCP organization ID."),
    folderId: z.string().optional().describe("The GCP folder ID."),
    projectId: z.string().optional().describe("The GCP project ID."),
    level: z.enum(["organization", "folder", "project"]).optional().describe("The scope level of the GCP connection."),
    serviceAccountName: z.string().optional().describe("The service account used for the connection."),
    predefinedRoles: z.array(z.string()).optional().describe("Predefined GCP roles to grant."),
    customRole: CloudFlowCustomRoleSchema.optional().describe("A custom role definition."),
    infraManagerProject: z.string().optional().describe("The Infrastructure Manager project."),
    infraManagerLocation: z.string().optional().describe("The Infrastructure Manager location."),
    infraManagerServiceAccount: z.string().optional().describe("The Infrastructure Manager service account."),
});

const CloudFlowAwsContextSchema = z.object({
    accountId: z.string().optional().describe("The AWS account ID."),
    regions: z.array(z.string()).optional().describe("The AWS regions in scope for this account."),
});

const CloudFlowAwsConfigSchema = z.object({
    context: z
        .array(CloudFlowAwsContextSchema)
        .optional()
        .describe("Per-account AWS context (account ID and regions)."),
    roleName: z.string().optional().describe("The AWS role name to assume."),
    permissions: z.record(z.unknown()).optional().describe("The permissions map for the AWS connection."),
    managementAccount: z.string().optional().describe("The AWS management (payer) account ID."),
    organizationRootId: z.string().optional().describe("The AWS organization root ID."),
    scopeTargetedOrganizationalUnitIds: z
        .array(z.string())
        .optional()
        .describe("Organizational unit IDs to include in scope."),
    scopeExplicitAccountIds: z.array(z.string()).optional().describe("Account IDs explicitly included in scope."),
    scopeExcludedAccountIds: z.array(z.string()).optional().describe("Account IDs excluded from scope."),
    scopeManagementAccountExplicitInScope: z
        .boolean()
        .optional()
        .describe("Whether the management account is explicitly in scope."),
});

const CloudFlowCollaboratorSchema = z.object({
    email: z.string().email().optional().describe("The collaborator's email address."),
    role: z.enum(["owner", "editor", "user"]).optional().describe("The collaborator's role on the connection."),
});

// Schema and metadata for create a CloudFlow connection
export const CreateCloudFlowConnectionArgumentsSchema = z.object({
    name: z.string().min(1).describe("Human-readable connection name (required, non-empty)."),
    description: z.string().optional().describe("Optional description of the connection."),
    gcpConfig: CloudFlowGcpConfigSchema.optional().describe(
        "GCP configuration. Exactly one of gcpConfig or awsConfig must be supplied."
    ),
    awsConfig: CloudFlowAwsConfigSchema.optional().describe(
        "AWS configuration. Exactly one of gcpConfig or awsConfig must be supplied."
    ),
    collaborators: z
        .array(CloudFlowCollaboratorSchema)
        .optional()
        .describe("List of collaborators and their roles on the connection."),
    enabled: z.boolean().optional().describe("Whether the connection is enabled. Defaults to true."),
});

export const createCloudFlowConnectionTool = {
    name: "create_cloudflow_connection",
    description:
        "Use this when the user wants to create a new CloudFlow cloud provider connection (a GCP or AWS account connected for automation). Exactly one of gcpConfig or awsConfig must be supplied. Ask the user to confirm the connection details before executing. Do NOT use this to update an existing connection (use update_cloudflow_connection) or to trigger a flow (use trigger_cloud_flow).",
    coversEndpoint: "post:/cloudflow/v1/connections",
    inputSchema: zodToMcpInputSchema(CreateCloudFlowConnectionArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Creating CloudFlow connection...",
        "openai/toolInvocation/invoked": "CloudFlow connection created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleCreateCloudFlowConnectionRequest(args: any, token: string) {
    try {
        const parsed = CreateCloudFlowConnectionArgumentsSchema.parse(args);
        const { customerContext } = args;

        if (Boolean(parsed.gcpConfig) === Boolean(parsed.awsConfig)) {
            return createErrorResponse("Exactly one of gcpConfig or awsConfig must be supplied.");
        }

        const data = await makeDoitRequest<CloudFlowConnection>(CLOUDFLOW_CONNECTIONS_BASE_URL, token, {
            method: "POST",
            body: parsed,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to create CloudFlow connection");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create CloudFlow connection request");
    }
}

// Schema and metadata for update a CloudFlow connection
export const UpdateCloudFlowConnectionArgumentsSchema = z.object({
    connectionId: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Connection ID is required and cannot be empty."))
        .describe("The ID of the CloudFlow connection to update (required)."),
    name: z.string().min(1).optional().describe("New connection name."),
    description: z.string().optional().describe("New description for the connection."),
    enabled: z.boolean().optional().describe("Set to false to disable the connection, true to re-enable it."),
    gcpConfig: CloudFlowGcpConfigSchema.optional().describe(
        "Updated GCP configuration. At most one of gcpConfig or awsConfig may be set per request."
    ),
    awsConfig: CloudFlowAwsConfigSchema.optional().describe(
        "Updated AWS configuration. At most one of gcpConfig or awsConfig may be set per request."
    ),
    collaborators: z
        .array(CloudFlowCollaboratorSchema)
        .optional()
        .describe("Updated list of collaborators and their roles on the connection."),
});

export const updateCloudFlowConnectionTool = {
    name: "update_cloudflow_connection",
    description:
        "Use this when the user wants to update an existing CloudFlow cloud provider connection — rename it, change its description, enable/disable it, update its GCP/AWS configuration, or change collaborators. All fields except connectionId are optional; at most one of gcpConfig or awsConfig may be set per request. Ask the user to confirm the changes before executing. Do NOT use this to create a new connection (use create_cloudflow_connection) or to trigger a flow (use trigger_cloud_flow).",
    coversEndpoint: "patch:/cloudflow/v1/connections/{connectionId}",
    inputSchema: zodToMcpInputSchema(UpdateCloudFlowConnectionArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Updating CloudFlow connection...",
        "openai/toolInvocation/invoked": "CloudFlow connection updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleUpdateCloudFlowConnectionRequest(args: any, token: string) {
    try {
        const parsed = UpdateCloudFlowConnectionArgumentsSchema.parse(args);
        const { customerContext } = args;
        const { connectionId, ...body } = parsed;

        if (body.gcpConfig && body.awsConfig) {
            return createErrorResponse("At most one of gcpConfig or awsConfig may be set per request.");
        }

        const url = `${CLOUDFLOW_CONNECTIONS_BASE_URL}/${encodeURIComponent(connectionId)}`;

        const data = await makeDoitRequest<CloudFlowConnection>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to update CloudFlow connection");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update CloudFlow connection request");
    }
}

// Schema and metadata for list CloudFlow templates
export const ListCloudFlowTemplatesArgumentsSchema = z.object({
    maxResults: z
        .string()
        .optional()
        .describe(
            `Maximum number of templates to return (1–500). Defaults to ${DEFAULT_MAX_RESULTS_CLOUDFLOW_TEMPLATES}.`
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Pagination cursor returned by a previous call, to request the next page of results."),
});

export const listCloudFlowTemplatesTool = {
    name: "list_cloudflow_templates",
    coversEndpoint: "get:/cloudflow/v1/templates",
    description:
        "Use this when the user wants to see the catalogue of available CloudFlow templates (read-only blueprints they can build a flow from). Returns a cursor-paginated list of templates with their id, name, description, and instructions. Do NOT use this to view a single template's details (use get_cloudflow_template) or to trigger a flow (use trigger_cloud_flow).",
    inputSchema: zodToMcpInputSchema(ListCloudFlowTemplatesArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading CloudFlow templates...",
        "openai/toolInvocation/invoked": "CloudFlow templates loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListCloudFlowTemplatesRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken } = ListCloudFlowTemplatesArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_CLOUDFLOW_TEMPLATES);
        if (pageToken) params.append("pageToken", pageToken);

        const url = `${CLOUDFLOW_TEMPLATES_BASE_URL}?${params}`;

        const data = await makeDoitRequest<CloudFlowTemplatesResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve CloudFlow templates");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list CloudFlow templates request");
    }
}

// Schema and metadata for retrieve a CloudFlow template
export const GetCloudFlowTemplateArgumentsSchema = z.object({
    templateId: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1))
        .describe("The ID of the CloudFlow template to retrieve."),
});

export const getCloudFlowTemplateTool = {
    name: "get_cloudflow_template",
    coversEndpoint: "get:/cloudflow/v1/templates/{templateId}",
    description:
        "Use this when the user wants to view the details of a specific CloudFlow template by its ID, including its name, description, and configuration instructions. Do NOT use this to list all templates (use list_cloudflow_templates) or to trigger a flow (use trigger_cloud_flow).",
    inputSchema: zodToMcpInputSchema(GetCloudFlowTemplateArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading CloudFlow template...",
        "openai/toolInvocation/invoked": "CloudFlow template loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetCloudFlowTemplateRequest(args: any, token: string) {
    try {
        const { templateId } = GetCloudFlowTemplateArgumentsSchema.parse(args);
        const { customerContext } = args;

        const url = `${CLOUDFLOW_TEMPLATES_BASE_URL}/${encodeURIComponent(templateId)}`;

        const data = await makeDoitRequest<CloudFlowTemplate>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve CloudFlow template");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get CloudFlow template request");
    }
}

// Schema and metadata for list CloudFlows
export const ListCloudFlowsArgumentsSchema = z.object({
    maxResults: z
        .string()
        .optional()
        .describe(`Maximum number of flows to return (1–500). Defaults to ${DEFAULT_MAX_RESULTS_CLOUDFLOW_FLOWS}.`),
    pageToken: z
        .string()
        .optional()
        .describe("Pagination cursor returned by a previous call, to request the next page of results."),
});

export const listCloudFlowsTool = {
    name: "list_cloudflows",
    coversEndpoint: "get:/cloudflow/v1/flows",
    description:
        "Use this when the user wants to see their CloudFlow automation flows. Returns a cursor-paginated list of flows with their metadata, status, and last execution info.",
    inputSchema: zodToMcpInputSchema(ListCloudFlowsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading CloudFlows...",
        "openai/toolInvocation/invoked": "CloudFlows loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListCloudFlowsRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken } = ListCloudFlowsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_CLOUDFLOW_FLOWS);
        if (pageToken) params.append("pageToken", pageToken);

        const url = `${CLOUDFLOW_FLOWS_BASE_URL}?${params}`;

        const data = await makeDoitRequest<CloudFlowListResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve CloudFlows");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list CloudFlows request");
    }
}
