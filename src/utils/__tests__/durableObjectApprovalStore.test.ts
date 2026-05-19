import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The DO store lives in the Worker subpackage because it depends on the Workers
// runtime `DurableObjectStorage` type. For unit tests we exercise it against a
// hand-rolled fake — no Worker runtime needed.
import { DurableObjectApprovalStore } from "../../../doit-mcp-server/src/durableObjectApprovalStore.js";
import { APPROVAL_TTL_MS, type PendingAction } from "../approval.js";

/**
 * Minimal stand-in for the tiny slice of `DurableObjectStorage` the approval store
 * actually uses (put/get/delete). Purposely does NOT implement the rest of the DO
 * storage API so we notice immediately if the implementation grows new dependencies.
 */
class FakeDurableObjectStorage {
    readonly map = new Map<string, unknown>();

    async put(key: string, value: unknown): Promise<void> {
        this.map.set(key, structuredClone(value));
    }

    async get<T>(key: string): Promise<T | undefined> {
        const v = this.map.get(key);
        return v === undefined ? undefined : (structuredClone(v) as T);
    }

    async delete(key: string): Promise<boolean> {
        return this.map.delete(key);
    }
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
    vi.useRealTimers();
});

function makePending(overrides: Partial<PendingAction> = {}): PendingAction {
    return {
        toolName: "create_ticket",
        args: { ticket: { subject: "demo" } },
        userKey: "api-key-alice",
        expiresAt: Date.now() + APPROVAL_TTL_MS,
        ...overrides,
    };
}

describe("DurableObjectApprovalStore", () => {
    it("round-trips a pending action exactly once", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);
        const pending = makePending();
        await store.stash(pending);

        const first = await store.consume("api-key-alice");
        expect(first).toEqual(pending);

        const second = await store.consume("api-key-alice");
        expect(second).toBeNull();
    });

    it("namespaces keys under 'pending:<userKey>' so it cannot collide with other DO storage", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);
        await store.stash(makePending({ userKey: "api-key-alice" }));

        expect(storage.map.has("pending:api-key-alice")).toBe(true);
        expect(storage.map.has("api-key-alice")).toBe(false);
    });

    it("isolates pending actions per userKey — alice's confirm does not see mallory's", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);
        await store.stash(makePending({ userKey: "api-key-alice" }));

        const r1 = await store.consume("api-key-mallory");
        expect(r1).toBeNull();

        // Alice can still consume — unlike the old token-keyed model, a probe by
        // another user does not burn alice's row.
        const r2 = await store.consume("api-key-alice");
        expect(r2).not.toBeNull();
    });

    it("returns null after TTL expiry and evicts the row", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);
        await store.stash(makePending());

        vi.advanceTimersByTime(APPROVAL_TTL_MS + 1);

        const r = await store.consume("api-key-alice");
        expect(r).toBeNull();
        expect(storage.map.size).toBe(0);
    });

    it("returns null for a user with no pending action without touching anything", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);
        const r = await store.consume("api-key-nobody");
        expect(r).toBeNull();
        expect(storage.map.size).toBe(0);
    });

    it("staging twice for the same user overwrites — confirm_action only sees the latest", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);

        await store.stash(makePending({ args: { ticket: { subject: "first" } } }));
        await store.stash(makePending({ args: { ticket: { subject: "second" } } }));

        const consumed = await store.consume("api-key-alice");
        expect(consumed?.args).toEqual({ ticket: { subject: "second" } });
        expect(storage.map.size).toBe(0);
    });
});
