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

export const AVA_DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

function parseTimeoutMs(envValue: string | undefined, fallback: number): number {
    if (envValue === undefined) return fallback;
    const parsed = Number(envValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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
        "Ask DoiT AVA, the cloud cost and infrastructure expert, a question about the user's DoiT account, cloud spending, anomalies, or optimization opportunities. AVA has access to the customer's billing data, usage patterns, and DoiT-specific features. Use this for DoiT or cloud-specific questions only — not for general-purpose AI queries. Note: AVA can take a long time to respond for complex questions. If it does not respond in time, a clear error is returned with guidance to retry or simplify the question.",
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
            timeoutMs: parseTimeoutMs(process.env.AVA_TIMEOUT_MS, AVA_DEFAULT_TIMEOUT_MS),
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
        if (error instanceof DOMException && error.name === "TimeoutError") {
            return createErrorResponse(
                "AVA did not respond within the time limit. Try a simpler or more specific question, or try again later."
            );
        }
        return handleGeneralError(error, "handling ask AVA sync request");
    }
}
