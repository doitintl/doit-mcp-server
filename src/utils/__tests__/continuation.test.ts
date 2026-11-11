import { describe, expect, it } from "vitest";
import {
    CONTINUATION_TOKEN_PREFIX,
    type ContinuationPayload,
    isContinuationToken,
    signContinuation,
    verifyContinuation,
} from "../continuation.js";

const SECRET = "test-secret";
const payload: ContinuationPayload = {
    v: 1,
    tool: "list_tickets",
    args: { pageSize: 40, subject: "billing" },
    upstream: "upstream-cursor",
    position: { afterId: "23", afterIndex: 22 },
};

describe("continuation tokens", () => {
    it("round-trips a payload through sign and verify", async () => {
        const token = await signContinuation(payload, SECRET);
        expect(isContinuationToken(token)).toBe(true);
        await expect(verifyContinuation(token, SECRET)).resolves.toEqual(payload);
    });

    it("rejects a token signed with another secret", async () => {
        const token = await signContinuation(payload, "other-secret");
        await expect(verifyContinuation(token, SECRET)).resolves.toBeUndefined();
    });

    it("rejects a token whose body was altered after signing", async () => {
        const token = await signContinuation(payload, SECRET);
        const signature = token.slice(CONTINUATION_TOKEN_PREFIX.length).split(".")[1];
        const forgedBody = (await signContinuation({ ...payload, position: { afterIndex: 0 } }, SECRET))
            .slice(CONTINUATION_TOKEN_PREFIX.length)
            .split(".")[0];
        await expect(
            verifyContinuation(`${CONTINUATION_TOKEN_PREFIX}${forgedBody}.${signature}`, SECRET)
        ).resolves.toBeUndefined();
    });

    it.each(["", "upstream-cursor", "dci1.", "dci1.abc", "dci1.a.b.c", `${CONTINUATION_TOKEN_PREFIX}not*base64.sig`])(
        "treats %j as not a valid continuation token",
        async (value) => {
            await expect(verifyContinuation(value, SECRET)).resolves.toBeUndefined();
        }
    );

    it("does not mistake an upstream cursor or a non-string for a continuation token", () => {
        expect(isContinuationToken("NG5Jd2JJRzZ1aUV3ZEJRa2RrYm4")).toBe(false);
        expect(isContinuationToken(undefined)).toBe(false);
        expect(isContinuationToken(42)).toBe(false);
    });

    it("rejects a correctly signed body that is not a continuation payload", async () => {
        const token = await signContinuation({ hello: "world" } as unknown as ContinuationPayload, SECRET);
        await expect(verifyContinuation(token, SECRET)).resolves.toBeUndefined();
    });
});
