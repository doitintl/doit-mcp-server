import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPROVAL_TTL_MS, buildApprovalResponse, MemoryApprovalStore, type PendingAction } from "../approval.js";

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
        userKey: "stdio-local",
        expiresAt: Date.now() + APPROVAL_TTL_MS,
        ...overrides,
    };
}

describe("MemoryApprovalStore", () => {
    it("stash + consume returns the pending action exactly once", async () => {
        const store = new MemoryApprovalStore();
        const pending = makePending();
        await store.stash(pending);

        const first = await store.consume("stdio-local");
        expect(first).toEqual(pending);

        const second = await store.consume("stdio-local");
        expect(second).toBeNull();
    });

    it("isolates pending actions per userKey — one user cannot consume another's", async () => {
        const store = new MemoryApprovalStore();
        await store.stash(makePending({ userKey: "alice" }));

        const wrongUser = await store.consume("mallory");
        expect(wrongUser).toBeNull();

        // Alice can still consume her own — unlike the previous token-keyed design,
        // a probe by another user does not burn the row.
        const alice = await store.consume("alice");
        expect(alice).not.toBeNull();
        expect(alice?.userKey).toBe("alice");
    });

    it("returns null after TTL expiry", async () => {
        const store = new MemoryApprovalStore();
        await store.stash(makePending());

        vi.advanceTimersByTime(APPROVAL_TTL_MS + 1);

        const result = await store.consume("stdio-local");
        expect(result).toBeNull();
    });

    it("returns null for a user with no pending action", async () => {
        const store = new MemoryApprovalStore();
        const result = await store.consume("nobody-staged-anything");
        expect(result).toBeNull();
    });

    it("staging a second action for the same user evicts the first", async () => {
        const store = new MemoryApprovalStore();
        await store.stash(
            makePending({
                args: { ticket: { subject: "first" } },
            })
        );
        await store.stash(
            makePending({
                args: { ticket: { subject: "second" } },
            })
        );

        const consumed = await store.consume("stdio-local");
        // The first staged action is dropped; the second is what `confirm_action` sees.
        expect(consumed?.args).toEqual({ ticket: { subject: "second" } });
        expect(store.size()).toBe(0);
    });

    it("sweeps expired entries opportunistically on subsequent operations", async () => {
        const store = new MemoryApprovalStore();
        await store.stash(makePending({ userKey: "u-a" }));
        await store.stash(makePending({ userKey: "u-b" }));
        expect(store.size()).toBe(2);

        vi.advanceTimersByTime(APPROVAL_TTL_MS + 1);

        await store.stash(makePending({ userKey: "u-c" }));
        expect(store.size()).toBe(1);
    });
});

describe("buildApprovalResponse", () => {
    it("serializes an approval_required envelope WITHOUT exposing any token to the LLM", () => {
        const res = buildApprovalResponse('Create support ticket: "demo".');
        expect(res.isError).toBeFalsy();
        const parsed = JSON.parse(res.content[0].text);
        expect(parsed.status).toBe("approval_required");
        expect(parsed.summary).toBe('Create support ticket: "demo".');
        // No approvalToken field anywhere — the prior design surfaced this in MCP
        // client permission dialogs as a raw UUID.
        expect(parsed.approvalToken).toBeUndefined();
        expect(JSON.stringify(parsed)).not.toMatch(/token/i);
    });

    it("derives a yes/no userPrompt from the summary and tells the LLM to call confirm_action with no args", () => {
        const res = buildApprovalResponse('Create support ticket: "demo".');
        const parsed = JSON.parse(res.content[0].text);
        expect(parsed.userPrompt).toBe('Are you sure you want to create support ticket: "demo"?');
        expect(parsed.next).toMatch(/userPrompt/);
        expect(parsed.next).toMatch(/no arguments/);
    });

    it("uses the caller-supplied userPrompt verbatim when one is provided", () => {
        // This is the preferred path for new gated tools: the tool's `summary` function
        // returns `{ summary, userPrompt }` so the question can be phrased naturally
        // (e.g. "…with the above details?") instead of restating the multi-line header.
        const summary =
            'Create support ticket with severity "high" on platform "aws" with subject "demo". More details below:\n' +
            "  Platform: aws\n  Body: please help";
        const explicit = "Are you sure you want to create the support ticket with the above details?";
        const res = buildApprovalResponse(summary, explicit);
        const parsed = JSON.parse(res.content[0].text);
        expect(parsed.userPrompt).toBe(explicit);
        expect(parsed.summary).toBe(summary);
    });

    it("derives userPrompt from JUST the first line when summary is a multi-line details block", () => {
        // Tools like create_ticket return a header + indented key/value details so the
        // user can verify every populated field before confirming.
        const summary =
            'Create support ticket with severity high on platform aws with subject "demo".\n' +
            "  Platform: aws\n" +
            "  Product:  Compute Engine\n" +
            "  Severity: high\n" +
            "  Subject:  demo\n" +
            "  Body:     please help";
        const res = buildApprovalResponse(summary);
        const parsed = JSON.parse(res.content[0].text);

        // Question is short — only the first line is folded into it.
        expect(parsed.userPrompt).toBe(
            'Are you sure you want to create support ticket with severity high on platform aws with subject "demo"?'
        );
        // Full summary survives in the envelope verbatim (including the indented details
        // the user needs to see), and the LLM is told to render it before asking.
        expect(parsed.summary).toBe(summary);
        expect(parsed.next).toMatch(/verbatim/i);
        expect(parsed.next).toMatch(/preserv\w* line breaks/i);
    });

    it("instructs the LLM to surface a 'declined' message on chat-no AND on permission-deny", () => {
        const res = buildApprovalResponse('Create support ticket: "demo".');
        const parsed = JSON.parse(res.content[0].text);
        // Without this, a `Deny` click in Claude Code's confirm_action permission prompt
        // leaves the LLM silently stopped, which feels like a hang.
        expect(parsed.next).toMatch(/rejected by the MCP client|permission prompt|Deny/i);
        // Must forbid retrying confirm_action so the LLM doesn't loop.
        expect(parsed.next).toMatch(/do NOT call confirm_action/i);
        // Must forbid silence — the original "hang" bug was the LLM doing nothing
        // after the user typed "no" or pressed Deny.
        expect(parsed.next).toMatch(/do NOT stay silent/i);
        // Must require an immediate, explicit "declined" acknowledgement so the user
        // sees that their decline registered.
        expect(parsed.next).toMatch(/immediately reply|acknowledge.*decline/i);
        // Must list common chat-decline phrasings so the LLM recognizes them
        // (the previous wording said only "declines in chat" without examples).
        expect(parsed.next).toMatch(/no|cancel|stop/i);
    });
});
