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

export const AVA_BASE_URL = `${DOIT_API_BASE}/ava/v1`;

export const AskAvaSyncArgumentsSchema = z
    .object({
        question: z
            .string()
            .describe("The question to ask AVA about the user's DoiT account, cloud costs, or infrastructure."),
        conversationId: z
            .string()
            .optional()
            .describe(
                "ID of a prior non-ephemeral conversation to continue. Requires ephemeral to be set to false — cannot be used with ephemeral: true (the default)."
            ),
        ephemeral: z
            .boolean()
            .optional()
            .default(true)
            .describe(
                "When true (default), the conversation is not persisted and no conversationId or answerId is returned. Set to false to receive conversationId and answerId in the response, which are needed for follow-up questions or submitting feedback."
            ),
    })
    .refine((data) => !(data.conversationId !== undefined && data.ephemeral !== false), {
        message:
            "conversationId cannot be used when ephemeral is true. Set ephemeral to false to continue a conversation.",
        path: ["conversationId"],
    });

export const askAvaSyncTool = {
    name: "ask_ava_sync",
    description:
        "Ask DoiT AVA, the cloud cost and infrastructure expert, a question about the user's DoiT account, cloud spending, anomalies, or optimization opportunities. AVA has access to the customer's billing data, usage patterns, and DoiT-specific features. Use this for DoiT or cloud-specific questions only — not for general-purpose AI queries. By default the conversation is ephemeral (stateless). Set ephemeral to false to receive a conversationId and answerId for follow-up questions or feedback. Note: AVA may take over 60 seconds to respond — some MCP clients may time out before receiving a response.",
    inputSchema: zodToMcpInputSchema(AskAvaSyncArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Asking AVA...",
        "openai/toolInvocation/invoked": "AVA responded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleAskAvaSyncRequest(args: any, token: string) {
    try {
        const { question, conversationId, ephemeral } = AskAvaSyncArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest(`${AVA_BASE_URL}/askSync`, token, {
            method: "POST",
            body: { question, conversationId, ephemeral },
            customerContext,
        });

        if (!data) {
            return createErrorResponse(
                "AVA request failed or timed out. Try simplifying your question or try again later."
            );
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling ask AVA sync request");
    }
}
