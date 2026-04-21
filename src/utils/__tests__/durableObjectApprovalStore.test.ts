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
        toolName: "create_budget",
        args: { name: "demo" },
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
        await store.stash("tok-1", pending);

        const first = await store.consume("tok-1", "api-key-alice");
        expect(first).toEqual(pending);

        const second = await store.consume("tok-1", "api-key-alice");
        expect(second).toBeNull();
    });

    it("namespaces keys under 'pending:' so it cannot collide with other DO storage", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);
        await store.stash("tok-ns", makePending());

        expect(storage.map.has("pending:tok-ns")).toBe(true);
        expect(storage.map.has("tok-ns")).toBe(false);
    });

    it("returns null and burns the row when userKey mismatches", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);
        await store.stash("tok-mismatch", makePending({ userKey: "api-key-alice" }));

        const r1 = await store.consume("tok-mismatch", "api-key-mallory");
        expect(r1).toBeNull();

        const r2 = await store.consume("tok-mismatch", "api-key-alice");
        expect(r2).toBeNull();
    });

    it("returns null after TTL expiry and evicts the row", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);
        await store.stash("tok-stale", makePending());

        vi.advanceTimersByTime(APPROVAL_TTL_MS + 1);

        const r = await store.consume("tok-stale", "api-key-alice");
        expect(r).toBeNull();
        expect(storage.map.size).toBe(0);
    });

    it("returns null for an unknown token without touching anything", async () => {
        const storage = new FakeDurableObjectStorage();
        const store = new DurableObjectApprovalStore(storage as any);
        const r = await store.consume("missing", "api-key-alice");
        expect(r).toBeNull();
    });
});
