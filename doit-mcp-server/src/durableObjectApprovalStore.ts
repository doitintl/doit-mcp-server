import type { ApprovalStore, PendingAction } from "../../src/utils/approval.js";

/**
 * Durable-Object-backed `ApprovalStore` used by the Cloudflare Worker transport.
 *
 * Lives in `doit-mcp-server/` (not the main package) because it depends on
 * `DurableObjectStorage`, which is only available inside Worker runtime. The stdio
 * build uses `MemoryApprovalStore` from `src/utils/approval.ts`.
 *
 * Pending actions are persisted under keys of the form `pending:${token}` so the DO
 * isolate can be evicted between the destructive tool call and the matching
 * `confirm_action` without losing the staged action. TTL is enforced at `consume`
 * time — we do not schedule alarms.
 */
export class DurableObjectApprovalStore implements ApprovalStore {
    private static readonly KEY_PREFIX = "pending:";

    constructor(private readonly storage: DurableObjectStorage) {}

    async stash(token: string, pending: PendingAction): Promise<void> {
        await this.storage.put(this.key(token), pending);
    }

    async consume(token: string, userKey: string): Promise<PendingAction | null> {
        const k = this.key(token);
        const p = await this.storage.get<PendingAction>(k);
        if (!p) return null;
        // Single-use: evict on every successful lookup regardless of match/expiry so a
        // leaked token cannot be retried and an expired token does not linger.
        await this.storage.delete(k);
        if (p.userKey !== userKey || p.expiresAt < Date.now()) return null;
        return p;
    }

    private key(token: string): string {
        return `${DurableObjectApprovalStore.KEY_PREFIX}${token}`;
    }
}
