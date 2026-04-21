import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    APPROVAL_TTL_MS,
    buildApprovalResponse,
    MemoryApprovalStore,
    mintApprovalToken,
    type PendingAction,
} from "../approval.js";

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
        userKey: "stdio-local",
        expiresAt: Date.now() + APPROVAL_TTL_MS,
        ...overrides,
    };
}

describe("MemoryApprovalStore", () => {
    it("stash + consume returns the pending action exactly once", async () => {
        const store = new MemoryApprovalStore();
        const pending = makePending();
        await store.stash("tok-1", pending);

        const first = await store.consume("tok-1", "stdio-local");
        expect(first).toEqual(pending);

        const second = await store.consume("tok-1", "stdio-local");
        expect(second).toBeNull();
    });

    it("returns null when the userKey does not match (and evicts the row)", async () => {
        const store = new MemoryApprovalStore();
        await store.stash("tok-2", makePending({ userKey: "alice" }));

        const result = await store.consume("tok-2", "mallory");
        expect(result).toBeNull();

        // Even the legitimate owner cannot now consume — a token seen by a wrong
        // user is considered burned to prevent retry-after-probe attacks.
        const retry = await store.consume("tok-2", "alice");
        expect(retry).toBeNull();
    });

    it("returns null after TTL expiry", async () => {
        const store = new MemoryApprovalStore();
        await store.stash("tok-3", makePending());

        vi.advanceTimersByTime(APPROVAL_TTL_MS + 1);

        const result = await store.consume("tok-3", "stdio-local");
        expect(result).toBeNull();
    });

    it("returns null for an unknown token", async () => {
        const store = new MemoryApprovalStore();
        const result = await store.consume("does-not-exist", "stdio-local");
        expect(result).toBeNull();
    });

    it("sweeps expired entries opportunistically on subsequent operations", async () => {
        const store = new MemoryApprovalStore();
        await store.stash("tok-a", makePending());
        await store.stash("tok-b", makePending());
        expect(store.size()).toBe(2);

        vi.advanceTimersByTime(APPROVAL_TTL_MS + 1);

        await store.stash("tok-c", makePending());
        expect(store.size()).toBe(1);
    });
});

describe("mintApprovalToken", () => {
    it("returns RFC 4122 UUIDs that are unique across calls", () => {
        const t1 = mintApprovalToken();
        const t2 = mintApprovalToken();
        expect(t1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(t2).not.toBe(t1);
    });
});

describe("buildApprovalResponse", () => {
    it("serializes an approval_required envelope carrying the token and summary", () => {
        const res = buildApprovalResponse("tok-xyz", 'Create budget "demo".');
        expect(res.isError).toBeFalsy();
        const text = res.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.status).toBe("approval_required");
        expect(parsed.approvalToken).toBe("tok-xyz");
        expect(parsed.summary).toBe('Create budget "demo".');
        expect(parsed.next).toContain("tok-xyz");
    });
});
