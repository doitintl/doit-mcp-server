import { randomUUID } from "node:crypto";
import { createSuccessResponse } from "./util.js";

/**
 * Represents a destructive tool call that has been staged but not yet executed.
 * The original tool handler is re-invoked only after the matching approval token
 * is consumed via the `confirm_action` tool.
 */
export interface PendingAction {
    toolName: string;
    args: any;
    /**
     * Identity the approval is bound to. On stdio this is a constant (single-user process);
     * on the HTTP/SSE Worker it is the OAuth-derived `props.apiKey`. Never a session id
     * and never client-supplied — see the security notes in approval plan §3.
     */
    userKey: string;
    /** Unix millis when this pending action stops being valid. */
    expiresAt: number;
}

/**
 * Storage interface for pending destructive actions. Two impls: an in-memory store for
 * the stdio transport, and a Durable-Object-backed store for the Cloudflare Worker (so
 * tokens survive isolate eviction between the stage and confirm round-trips).
 */
export interface ApprovalStore {
    stash(token: string, pending: PendingAction): Promise<void>;
    /**
     * Looks up and removes the pending action iff the token exists, is unexpired, and the
     * supplied `userKey` matches. Returns null otherwise. Always single-use: the row is
     * deleted whether we return it, it was expired, or the user key mismatched.
     */
    consume(token: string, userKey: string): Promise<PendingAction | null>;
}

/** Default TTL for pending approval tokens: 5 minutes. */
export const APPROVAL_TTL_MS = 5 * 60 * 1000;

/**
 * In-memory `ApprovalStore` used by the stdio transport. Safe for single-process use.
 * Not safe to share across isolates — the Worker uses `DurableObjectApprovalStore` instead.
 */
export class MemoryApprovalStore implements ApprovalStore {
    private readonly map = new Map<string, PendingAction>();

    async stash(token: string, pending: PendingAction): Promise<void> {
        this.sweep();
        this.map.set(token, pending);
    }

    async consume(token: string, userKey: string): Promise<PendingAction | null> {
        this.sweep();
        const p = this.map.get(token);
        if (!p) return null;
        // Always evict on lookup, even on mismatch, to avoid leaking a valid token
        // across identities on subsequent attempts.
        this.map.delete(token);
        if (p.userKey !== userKey || p.expiresAt < Date.now()) return null;
        return p;
    }

    /** Visible for tests. */
    size(): number {
        return this.map.size;
    }

    private sweep(): void {
        const now = Date.now();
        for (const [k, v] of this.map) {
            if (v.expiresAt < now) this.map.delete(k);
        }
    }
}

/** Generates an unguessable one-time approval token. */
export function mintApprovalToken(): string {
    return randomUUID();
}

/**
 * Builds the structured response returned to the LLM when a destructive tool has been
 * staged but not yet executed. The LLM is expected to surface `summary` to the user,
 * obtain explicit confirmation, and then call `confirm_action` with `token`.
 */
export function buildApprovalResponse(token: string, summary: string) {
    return createSuccessResponse(
        JSON.stringify(
            {
                status: "approval_required",
                approvalToken: token,
                summary,
                next: `Call confirm_action with { token: "${token}" } once the user has explicitly confirmed this action. Do not call confirm_action if the user declined — the token will expire on its own.`,
            },
            null,
            2
        )
    );
}
