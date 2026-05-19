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

    async function stash(store: MemoryApprovalStore) {
        await store.stash({
            toolName: "create_ticket",
            args: { ticket: { subject: "demo", severity: "high" } },
            userKey,
            expiresAt: Date.now() + APPROVAL_TTL_MS,
        });
    }

    it("happy path: calls runOriginal with the stashed tool + args, returns its result", async () => {
        const store = new MemoryApprovalStore();
        await stash(store);
        const runOriginal = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });

        const result = await handleConfirmActionRequest({}, apiToken, userKey, store, runOriginal);

        expect(runOriginal).toHaveBeenCalledWith(
            "create_ticket",
            { ticket: { subject: "demo", severity: "high" } },
            apiToken
        );
        expect(result).toEqual({ content: [{ type: "text", text: "ok" }] });
    });

    it("returns an error without running the tool when there is no pending action for the user", async () => {
        const store = new MemoryApprovalStore();
        const runOriginal = vi.fn();

        const result = await handleConfirmActionRequest({}, apiToken, userKey, store, runOriginal);

        expect(runOriginal).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("No pending action to confirm");
    });

    it("returns an error without running the tool when the pending action has expired", async () => {
        const store = new MemoryApprovalStore();
        await stash(store);
        const runOriginal = vi.fn();

        vi.advanceTimersByTime(APPROVAL_TTL_MS + 1);

        const result = await handleConfirmActionRequest({}, apiToken, userKey, store, runOriginal);

        expect(runOriginal).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
    });

    it("returns nothing-pending error when a DIFFERENT user calls confirm_action", async () => {
        const store = new MemoryApprovalStore();
        await stash(store); // staged for `stdio-local`
        const runOriginal = vi.fn();

        const result = await handleConfirmActionRequest({}, apiToken, "different-user", store, runOriginal);

        expect(runOriginal).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
    });

    it("is single-use: a second confirm_action for the same user is rejected", async () => {
        const store = new MemoryApprovalStore();
        await stash(store);
        const runOriginal = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });

        await handleConfirmActionRequest({}, apiToken, userKey, store, runOriginal);
        const retry = await handleConfirmActionRequest({}, apiToken, userKey, store, runOriginal);

        expect(runOriginal).toHaveBeenCalledTimes(1);
        expect(retry.isError).toBe(true);
    });

    it("rejects args that include unexpected fields (the schema is strict) and never touches the store", async () => {
        const store = new MemoryApprovalStore();
        await stash(store);
        const consumeSpy = vi.spyOn(store, "consume");
        const runOriginal = vi.fn();

        // Defends against LLMs that pass a leftover `token` field from the prior contract.
        const result = await handleConfirmActionRequest(
            { token: "00000000-0000-0000-0000-000000000000" },
            apiToken,
            userKey,
            store,
            runOriginal
        );

        expect(consumeSpy).not.toHaveBeenCalled();
        expect(runOriginal).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("no arguments");
    });
});
