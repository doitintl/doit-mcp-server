import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPROVAL_TTL_MS, MemoryApprovalStore } from "../../utils/approval.js";
import { handleConfirmActionRequest } from "../confirmAction.js";

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("handleConfirmActionRequest", () => {
    const userKey = "stdio-local";
    const apiToken = "fake-api-token";

    async function stash(store: MemoryApprovalStore, token: string) {
        await store.stash(token, {
            toolName: "create_budget",
            args: { name: "demo", amount: 100, currency: "USD" },
            userKey,
            expiresAt: Date.now() + APPROVAL_TTL_MS,
        });
    }

    it("happy path: calls runOriginal with the stashed tool + args, returns its result", async () => {
        const store = new MemoryApprovalStore();
        await stash(store, "tok-happy");
        const runOriginal = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });

        const result = await handleConfirmActionRequest({ token: "tok-happy" }, apiToken, userKey, store, runOriginal);

        expect(runOriginal).toHaveBeenCalledWith(
            "create_budget",
            { name: "demo", amount: 100, currency: "USD" },
            apiToken
        );
        expect(result).toEqual({ content: [{ type: "text", text: "ok" }] });
    });

    it("returns an error without running the tool when the token is unknown", async () => {
        const store = new MemoryApprovalStore();
        const runOriginal = vi.fn();

        const result = await handleConfirmActionRequest(
            { token: "does-not-exist" },
            apiToken,
            userKey,
            store,
            runOriginal
        );

        expect(runOriginal).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("unknown or expired");
    });

    it("returns an error without running the tool when the token has expired", async () => {
        const store = new MemoryApprovalStore();
        await stash(store, "tok-stale");
        const runOriginal = vi.fn();

        vi.advanceTimersByTime(APPROVAL_TTL_MS + 1);

        const result = await handleConfirmActionRequest({ token: "tok-stale" }, apiToken, userKey, store, runOriginal);

        expect(runOriginal).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
    });

    it("returns an error without running the tool when the userKey does not match", async () => {
        const store = new MemoryApprovalStore();
        await stash(store, "tok-mismatch");
        const runOriginal = vi.fn();

        const result = await handleConfirmActionRequest(
            { token: "tok-mismatch" },
            apiToken,
            "different-user",
            store,
            runOriginal
        );

        expect(runOriginal).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
    });

    it("is single-use: a second confirm_action with the same token is rejected", async () => {
        const store = new MemoryApprovalStore();
        await stash(store, "tok-reused");
        const runOriginal = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });

        await handleConfirmActionRequest({ token: "tok-reused" }, apiToken, userKey, store, runOriginal);
        const retry = await handleConfirmActionRequest({ token: "tok-reused" }, apiToken, userKey, store, runOriginal);

        expect(runOriginal).toHaveBeenCalledTimes(1);
        expect(retry.isError).toBe(true);
    });

    it("rejects args without a token and never touches the store", async () => {
        const store = new MemoryApprovalStore();
        const stashSpy = vi.spyOn(store, "consume");
        const runOriginal = vi.fn();

        const result = await handleConfirmActionRequest({}, apiToken, userKey, store, runOriginal);

        expect(stashSpy).not.toHaveBeenCalled();
        expect(runOriginal).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
    });
});
