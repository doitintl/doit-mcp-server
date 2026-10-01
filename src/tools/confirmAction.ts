import { z } from "zod";
import type { ApprovalStore } from "../utils/approval.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import { createErrorResponse, formatZodError, handleGeneralError } from "../utils/util.js";

export const ConfirmActionArgumentsSchema = z.object({
    token: z
        .string()
        .min(1, "token is required and cannot be empty.")
        .describe(
            "The approval token returned by a previous write/mutating tool call. Exactly as received, no quoting changes."
        ),
});

/**
 * The "gate" tool. Annotated `destructiveHint: true` because this is the call that actually
 * performs the staged write: the original tool call only returned `status: "approval_required"`
 * with a summary, and today the gated calls are generated DELETE operations, which cannot be
 * undone. Directory listings (e.g. the Claude Connectors Directory) also require every tool to
 * set `readOnlyHint` or `destructiveHint` to true, and this tool is not read-only.
 *
 * This tool should never be called without a prior write-action staging call.
 */
export const confirmActionTool = {
    name: "confirm_action",
    title: "Confirm pending action",
    coversEndpoint: null,
    description:
        "Runs a write action (e.g. creating, updating, or deleting a resource) that another " +
        'tool staged and returned as `status: "approval_required"` with a summary and a ' +
        "one-time approval token. Applies once the user has approved that summary. A token " +
        "that is never confirmed expires after 5 minutes, and the staged action does not run. " +
        "The token must match the returned value exactly.",
    inputSchema: zodToMcpInputSchema(ConfirmActionArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Confirming action...",
        "openai/toolInvocation/invoked": "Action confirmed",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

/**
 * Runs a previously-staged write-gated tool, identified by `token`. The caller supplies
 * `runOriginal` so this module does not have to depend on the full dispatch switch in
 * `toolsHandler.ts` — this keeps the wiring direction one-way and avoids a cycle.
 */
export async function handleConfirmActionRequest(
    args: any,
    apiToken: string,
    userKey: string,
    store: ApprovalStore,
    runOriginal: (toolName: string, args: any, apiToken: string) => Promise<any>
): Promise<any> {
    try {
        const { token } = ConfirmActionArgumentsSchema.parse(args);
        const pending = await store.consume(token, userKey);
        if (!pending) {
            return createErrorResponse(
                "Approval token unknown or expired. Re-issue the original tool call to get a fresh token."
            );
        }
        return await runOriginal(pending.toolName, pending.args, apiToken);
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling confirm_action request");
    }
}
