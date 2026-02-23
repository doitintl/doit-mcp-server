import { z } from "zod";
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

export const TriggerCloudFlowArgumentsSchema = z.object({
    flowID: z.string().describe("The ID of the CloudFlow to trigger"),
    requestBodyJson: z
        .record(z.unknown())
        .optional()
        .describe("Optional JSON object to pass as the request body to the flow"),
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
    description: "Triggers a CloudFlow by its flow ID, optionally passing a JSON payload as the request body",
    inputSchema: {
        type: "object",
        properties: {
            flowID: {
                type: "string",
                description: "The ID of the CloudFlow to trigger",
            },
            requestBodyJson: {
                type: "object",
                description: "Optional JSON object to pass as the request body to the flow",
                additionalProperties: true,
            },
        },
        required: ["flowID"],
    },
};

export async function handleTriggerCloudFlowRequest(args: any, token: string) {
    try {
        const { flowID, requestBodyJson } = TriggerCloudFlowArgumentsSchema.parse(args);
        const { customerContext } = args;

        if (!flowID.trim()) {
            return createErrorResponse("please request the user for target cloudflow id");
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
