import type { ApprovalStore, PendingAction } from "../../src/utils/approval.js";

/**
 * Durable-Object-backed `ApprovalStore` used by the Cloudflare Worker transport.
 *
 * Lives in `doit-mcp-server/` (not the main package) because it depends on
 * `DurableObjectStorage`, which is only available inside Worker runtime. The stdio
 * build uses `MemoryApprovalStore` from `src/utils/approval.ts`.
 *
 * Pending actions are persisted under keys of the form `pending:${userKey}` (one per
 * user) so the DO isolate can be evicted between the destructive tool call and the
 * matching `confirm_action` without losing the staged action. TTL is enforced at
 * `consume` time — we do not schedule alarms.
 */
export class DurableObjectApprovalStore implements ApprovalStore {
    private static readonly KEY_PREFIX = "pending:";

    constructor(private readonly storage: DurableObjectStorage) {}

    async stash(pending: PendingAction): Promise<void> {
        // One pending action per userKey: `put` naturally overwrites any prior staged
        // action for the same user, matching MemoryApprovalStore semantics.
        await this.storage.put(this.key(pending.userKey), pending);
    }

    async consume(userKey: string): Promise<PendingAction | null> {
        const k = this.key(userKey);
        const p = await this.storage.get<PendingAction>(k);
        if (!p) return null;
        // Single-use: evict on every lookup regardless of expiry so an expired
        // entry does not linger across isolate restarts.
        await this.storage.delete(k);
        if (p.expiresAt < Date.now()) return null;
        return p;
    }

    private key(userKey: string): string {
        return `${DurableObjectApprovalStore.KEY_PREFIX}${userKey}`;
    }
}
