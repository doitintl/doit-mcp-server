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

/**
 * Returns the full trigger URL for a CloudFlow.
 * If value is a valid URL, it is returned as-is, otherwise expected to be a flow ID.
 */
export function getTriggerCloudFlowURL(value: string): string {
    const trimmed = value.trim();
    try {
        new URL(trimmed);
        return trimmed;
    } catch {}
    return `${CLOUDFLOW_TRIGGER_BASE_URL}/${trimmed}`;
}

export const triggerCloudFlowTool = {
    name: "trigger_cloud_flow",
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

export async function handleRefineCloudflowRequest(
    args: any,
    token: string,
    onProgress?: (message: string) => Promise<void>
) {
    try {
        const { flowId, question, conversationId } = RefineCloudflowArgumentsSchema.parse(args);

        const url = `${CLOUDFLOW_BASE_URL}/flows/${encodeURIComponent(flowId)}/actions/refine`;
        const body: Record<string, unknown> = { question };
        if (conversationId) body.conversationId = conversationId;

        let answerText = "";
        let responseConversationId: string | undefined;

        try {
            for await (const { data } of makeDoitSSERequest(url, body, token)) {
                let parsed: Record<string, unknown>;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    continue;
                }

                if (parsed.conversationId) {
                    responseConversationId = parsed.conversationId as string;
                    continue;
                }

                const answer = parsed.answer;
                if (typeof answer !== "string") continue;

                // Lifecycle events have answer values that are JSON objects (llmStart, llmEnd, toolStart, toolEnd)
                let isLifecycle = false;
                try {
                    const inner = JSON.parse(answer);
                    if (inner && typeof inner === "object") {
                        isLifecycle = true;
                        const label =
                            (inner as any).toolStart ?? (inner as any).toolEnd ?? (inner as any).value ?? null;
                        if (label) await onProgress?.(String(label));
                    }
                } catch {
                    // not JSON — plain text chunk
                }

                if (!isLifecycle) {
                    answerText += answer;
                }
            }
        } catch (error) {
            return handleGeneralError(error, "calling refine CloudFlow API");
        }

        if (!answerText) {
            return createErrorResponse("No result received from CloudFlow build stream");
        }

        const result: Record<string, unknown> = { answer: answerText };
        if (responseConversationId) result.conversationId = responseConversationId;
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
