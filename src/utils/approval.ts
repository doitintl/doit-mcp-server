import { createSuccessResponse } from "./util.js";

/**
 * Represents a write-gated tool call that has been staged but not yet executed.
 * The original tool handler is re-invoked only after the matching `confirm_action`
 * call resolves it via the user's `userKey`.
 */
export interface PendingAction {
    toolName: string;
    args: any;
    /**
     * Identity the approval is bound to AND the lookup key. On stdio this is a
     * constant (single-user process); on the HTTP/SSE Worker it is the OAuth-derived
     * `props.apiKey`. Never a session id, never client-supplied — see the security
     * notes in approval plan §3.
     *
     * Because the store is keyed by `userKey`, there is at most one pending action
     * per user at any time. Staging a second action for the same user before the
     * first is confirmed silently evicts the first — this is intentional so the
     * tokenless `confirm_action` call is never ambiguous about which action it is
     * confirming.
     */
    userKey: string;
    /** Unix millis when this pending action stops being valid. */
    expiresAt: number;
}

/**
 * Storage interface for pending write-gated actions. Two impls: an in-memory store for
 * the stdio transport, and a Durable-Object-backed store for the Cloudflare Worker (so
 * pending actions survive isolate eviction between the stage and confirm round-trips).
 *
 * The contract is "one pending action per `userKey`" — this is what lets
 * `confirm_action` take zero arguments while still resolving deterministically.
 */
export interface ApprovalStore {
    /**
     * Stash a pending action for `pending.userKey`. If a prior pending action exists
     * for the same user, it is overwritten. The previous action is silently dropped;
     * the LLM is responsible for not staging two actions back-to-back without an
     * intervening `confirm_action`.
     */
    stash(pending: PendingAction): Promise<void>;
    /**
     * Looks up and removes the pending action for `userKey` iff it exists and is
     * unexpired. Returns null otherwise. Always single-use: the row is deleted
     * whether we return it or it was expired.
     */
    consume(userKey: string): Promise<PendingAction | null>;
}

/** Default TTL for pending approval actions: 5 minutes. */
export const APPROVAL_TTL_MS = 5 * 60 * 1000;

/**
 * In-memory `ApprovalStore` used by the stdio transport. Safe for single-process use.
 * Not safe to share across isolates — the Worker uses `DurableObjectApprovalStore` instead.
 */
export class MemoryApprovalStore implements ApprovalStore {
    private readonly map = new Map<string, PendingAction>();

    async stash(pending: PendingAction): Promise<void> {
        this.sweep();
        // One pending action per userKey: overwrite any prior staged action so the
        // tokenless confirm_action call cannot be ambiguous.
        this.map.set(pending.userKey, pending);
    }

    async consume(userKey: string): Promise<PendingAction | null> {
        this.sweep();
        const p = this.map.get(userKey);
        if (!p) return null;
        // Always evict on lookup, even on expiry, to keep the store tidy.
        this.map.delete(userKey);
        if (p.expiresAt < Date.now()) return null;
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

/**
 * Builds the structured response returned to the LLM when a write-gated tool has been
 * staged but not yet executed. The LLM is expected to surface `userPrompt` to the user,
 * obtain explicit yes/no confirmation, and then call `confirm_action` with no arguments.
 *
 * No approval token is included — the server resolves the pending action from the
 * caller's `userKey` server-side. This keeps tokens out of MCP client permission
 * dialogs (which display raw tool arguments) so the user never sees an opaque UUID.
 */
/**
 * Fallback used when a tool's summary function returned only a string (no explicit
 * userPrompt). Takes the first non-empty line of `summary`, strips the trailing
 * sentence punctuation, lowercases the first letter, and frames it as "Are you sure
 * you want to <...>?". Single-line summaries (e.g. "Delete dashboard \"foo\".") yield
 * a clean question; multi-line summaries get a less-readable one, which is why we
 * encourage tools to provide their own `userPrompt`.
 */
function deriveUserPromptFromSummary(summary: string): string {
    const firstLine = summary.split("\n").find((l) => l.trim().length > 0) ?? summary;
    const body = firstLine.replace(/[.!?]+\s*$/, "");
    return `Are you sure you want to ${body.charAt(0).toLowerCase()}${body.slice(1)}?`;
}

export function buildApprovalResponse(summary: string, userPrompt?: string) {
    // Each tool can supply its own `userPrompt` so the yes/no question reads naturally
    // (e.g. "Are you sure you want to create the support ticket with the above
    // details?" rather than restating the multi-line header). If the tool only returns
    // a string summary (back-compat), we fall back to deriving the question from the
    // first non-empty line — single-line summaries produce a sensible question this way.
    const resolvedUserPrompt = userPrompt ?? deriveUserPromptFromSummary(summary);
    return createSuccessResponse(
        JSON.stringify(
            {
                status: "approval_required",
                summary,
                userPrompt: resolvedUserPrompt,
                next: "FIRST: display 'summary' to the user verbatim, preserving line breaks. The indented lines under the header are the structured details (e.g. body, product) the user MUST see before confirming — do not paraphrase or omit them. THEN: ask the user the exact question in 'userPrompt' and wait for an explicit yes/no answer. If the user confirms (yes/confirm/go ahead/etc.), call confirm_action with no arguments (the server resolves the pending action from the user's session). If the user declines in chat (any negative response — 'no', 'nope', 'cancel', 'don't', 'stop', 'nevermind', etc.), OR if confirm_action returns an error / is rejected by the MCP client (e.g. the user pressed Deny on a permission prompt), you MUST immediately reply to the user with a short explicit acknowledgement that the action was declined and will not be performed (e.g. 'Got it — no ticket was created. The pending request will expire on its own.'). Do NOT call confirm_action. Do NOT call any other tool. Do NOT investigate or ask follow-up questions. Do NOT stay silent. Just acknowledge the decline and stop.",
            },
            null,
            2
        )
    );
}
