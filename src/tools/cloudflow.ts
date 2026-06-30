import { z } from "zod";
import type { CloudFlowConnection, CloudFlowConnectionsResponse } from "../types/cloudflow.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const CLOUDFLOW_BASE_URL = `${DOIT_API_BASE}/cloudflow/v1`;
export const CLOUDFLOW_TRIGGER_BASE_URL = `${CLOUDFLOW_BASE_URL}/trigger`;
export const CLOUDFLOW_CONNECTIONS_BASE_URL = `${CLOUDFLOW_BASE_URL}/connections`;

export const DEFAULT_MAX_RESULTS_CLOUDFLOW_CONNECTIONS = "50";

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
