import { z } from "zod";
import type { ApprovalStore } from "../utils/approval.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import { createErrorResponse, handleGeneralError } from "../utils/util.js";

/**
 * `confirm_action` takes no arguments — the server resolves the pending action from
 * the caller's `userKey`. We still parse with Zod so additional/unexpected fields
 * are surfaced loudly rather than silently ignored (`.strict()`).
 */
export const ConfirmActionArgumentsSchema = z.object({}).strict();

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
 * This tool should never be called without a prior write-action staging call. It takes
 * no arguments: the server looks up the pending action by the caller's identity so the
 * client never has to surface an internal approval id to the end user (the previous
 * design exposed a UUID in MCP client permission dialogs).
 */
export const confirmActionTool = {
    name: "confirm_action",
    description:
        "Finalizes the pending write action (e.g. creating, updating, or deleting a resource) " +
        "previously staged for the current user by another tool. Only call this AFTER the user " +
        "has explicitly confirmed the action summary returned by the previous tool call. If the " +
        "user declined, do not call this tool — the pending action will expire automatically. " +
        "Takes no arguments: the server resolves the pending action from the caller's session.",
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
 * Runs the previously-staged write-gated tool for `userKey`. The caller supplies
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
        // Validate args even though we don't use them — surfaces a clear error if the
        // LLM passes a stray field instead of silently ignoring it.
        ConfirmActionArgumentsSchema.parse(args ?? {});
        const pending = await store.consume(userKey);
        if (!pending) {
            return createErrorResponse(
                "No pending action to confirm (or it expired). Re-issue the original tool call to stage a new one."
            );
        }
        return await runOriginal(pending.toolName, pending.args, apiToken);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse("confirm_action takes no arguments. Call it with an empty arguments object.");
        }
        return handleGeneralError(error, "handling confirm_action request");
    }
}
