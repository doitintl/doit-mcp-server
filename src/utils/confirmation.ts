import type { ClientCapabilities, ElicitRequestFormParams, ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { createErrorResponse } from "./util.js";

export type ToolElicitFn = (params: ElicitRequestFormParams) => Promise<ElicitResult>;

/** Tools that require MCP form elicitation when the client supports it. */
export const DESTRUCTIVE_TOOLS_REQUIRING_CONFIRMATION = new Set([
    "create_report",
    "update_report",
    "create_allocation",
    "update_allocation",
    "create_alert",
    "update_alert",
    "trigger_cloud_flow",
    "create_label",
    "update_label",
    "assign_objects_to_label",
    "create_budget",
    "update_budget",
    "create_annotation",
    "update_annotation",
    "update_user",
    "invite_user",
    "create_datahub_dataset",
    "update_datahub_dataset",
    "send_datahub_events",
]);

const CONFIRM_REQUESTED_SCHEMA = {
    type: "object" as const,
    properties: {
        confirm: {
            type: "boolean" as const,
            title: "Confirm action",
            description: "Set to true to proceed with this action.",
            default: true,
        },
    },
    required: ["confirm"],
};

function stripInjectedContext(args: unknown): unknown {
    if (!args || typeof args !== "object" || Array.isArray(args)) {
        return args;
    }
    const { customerContext: _ignored, ...rest } = args as Record<string, unknown>;
    return rest;
}

function summarizeArgs(args: unknown, maxLen = 420): string {
    try {
        const s = JSON.stringify(stripInjectedContext(args));
        if (s.length <= maxLen) {
            return s;
        }
        return `${s.slice(0, maxLen)}…`;
    } catch {
        return "(unable to serialize arguments)";
    }
}

function destructiveConfirmationMessage(toolName: string, args: any): string {
    const a = args as Record<string, unknown>;
    switch (toolName) {
        case "create_report":
            return `Create Cloud Analytics report "${a.name}"?`;
        case "update_report":
            return `Update report "${a.id}"${a.name ? ` (new name: "${a.name}")` : ""}?`;
        case "create_allocation":
            return `Create cost allocation "${a.name}"?`;
        case "update_allocation":
            return `Update cost allocation "${a.id}"?`;
        case "create_alert":
            return `Create cost alert "${a.name}"?`;
        case "update_alert":
            return `Update cost alert "${a.id}"?`;
        case "trigger_cloud_flow":
            return `Trigger CloudFlow "${a.flowID}"?`;
        case "create_label":
            return `Create label "${a.name}"?`;
        case "update_label":
            return `Update label "${a.id}"?`;
        case "assign_objects_to_label":
            return `Assign or unassign objects on label "${a.id}"?`;
        case "create_budget":
            return `Create budget "${a.name}" with amount ${String(a.amount)} ${String(a.currency)}?`;
        case "update_budget":
            return `Update budget "${a.id}"?`;
        case "create_annotation":
            return `Create annotation at timestamp "${a.timestamp}"?`;
        case "update_annotation":
            return `Update annotation "${a.id}"?`;
        case "update_user":
            return `Update user "${a.id}"?`;
        case "invite_user":
            return `Invite user with email "${a.email}"?`;
        case "create_datahub_dataset":
            return `Create DataHub dataset "${a.name}"?`;
        case "update_datahub_dataset":
            return `Update DataHub dataset "${a.name}"?`;
        case "send_datahub_events": {
            const events = a.events as unknown[] | undefined;
            const n = Array.isArray(events) ? events.length : "?";
            const first = events?.[0] as Record<string, unknown> | undefined;
            const provider = first?.provider;
            const prov = provider !== undefined && provider !== null ? ` (sample provider: "${String(provider)}")` : "";
            return `Send ${n} DataHub event(s) for ingestion${prov}?`;
        }
        default:
            return `Run ${toolName} with arguments: ${summarizeArgs(args)}?`;
    }
}

export function clientSupportsFormElicitation(clientCapabilities: ClientCapabilities | undefined): boolean {
    return Boolean(clientCapabilities?.elicitation?.form);
}

/** Logs once per session whether the MCP client advertised form elicitation (stderr; safe for stdio transport). */
export function logMcpFormElicitationStatus(enabled: boolean, client?: { name?: string; version?: string }): void {
    const label =
        client?.name != null ? `${client.name}${client.version != null ? ` ${client.version}` : ""}` : "unknown client";
    console.error(`[doit-mcp] MCP form elicitation: ${enabled ? "enabled" : "disabled"} (${label})`);
}

function isElicitationFallbackError(error: unknown): boolean {
    if (error instanceof McpError) {
        return error.code === ErrorCode.InvalidParams || error.code === ErrorCode.MethodNotFound;
    }
    if (error instanceof Error) {
        return error.message.includes("Client does not support form elicitation");
    }
    return false;
}

export function withConfirmation<A>(
    handler: (args: A, token: string) => Promise<unknown>,
    messageBuilder: (args: A) => string
) {
    return async (args: A, token: string, elicit?: ToolElicitFn): Promise<unknown> => {
        if (!elicit) {
            return handler(args, token);
        }

        let elicitResult: ElicitResult;
        try {
            elicitResult = await elicit({
                mode: "form",
                message: messageBuilder(args),
                requestedSchema: CONFIRM_REQUESTED_SCHEMA,
            });
        } catch (error) {
            if (isElicitationFallbackError(error)) {
                return handler(args, token);
            }
            throw error;
        }

        if (elicitResult.action === "cancel") {
            return createErrorResponse("Operation cancelled.");
        }
        if (elicitResult.action === "decline") {
            return createErrorResponse("Operation declined by user. You can ask again if you change your mind.");
        }

        const confirm = elicitResult.content?.confirm;
        if (confirm !== true) {
            return createErrorResponse("Operation cancelled by user.");
        }

        return handler(args, token);
    };
}

/**
 * Runs a mutating tool handler, optionally pausing for MCP elicitation when `elicit` is provided.
 */
export async function runDestructiveIfNeeded(
    toolName: string,
    args: any,
    token: string,
    elicit: ToolElicitFn | undefined,
    handler: (args: any, token: string) => Promise<unknown>
): Promise<unknown> {
    if (!DESTRUCTIVE_TOOLS_REQUIRING_CONFIRMATION.has(toolName)) {
        return handler(args, token);
    }
    const messageBuilder = (a: any) => destructiveConfirmationMessage(toolName, a);
    return withConfirmation(handler, messageBuilder)(args, token, elicit);
}
