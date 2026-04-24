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
 * The "gate" tool. This itself is annotated `destructiveHint: false` because, per the MCP
 * spec, that hint refers specifically to *destructive updates* (irreversible changes) —
 * `confirm_action` itself just dispatches a previously-staged call. The actual write
 * (which may be a create, update, or delete — not necessarily destructive) was already
 * announced upstream when the original tool call returned `status: "approval_required"`
 * with a human-readable summary. Setting `destructiveHint: true` here would cause
 * annotation-honoring clients to prompt a second time on top of that summary, which is a
 * confusing UX.
 *
 * This tool should never be called without a prior write-action staging call.
 */
export const confirmActionTool = {
    name: "confirm_action",
    description:
        "Finalizes a pending write action (e.g. creating, updating, or deleting a resource) " +
        "that was previously staged by another tool. Only call this after the user has " +
        "explicitly confirmed the action summary returned by the previous tool call. If the " +
        "user declined, do not call this tool — the token will expire automatically. Pass the " +
        "token exactly as it was returned.",
    inputSchema: zodToMcpInputSchema(ConfirmActionArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
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
