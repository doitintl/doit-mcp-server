import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { AVA_BASE_URL, AVA_DEFAULT_TIMEOUT_MS, handleAskAvaSyncRequest } from "../ava.js";

vi.mock("../../utils/util.js", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, makeDoitRequest: vi.fn() };
});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

const mockToken = "test-token";

describe("AVA_TIMEOUT_MS parsing", () => {
    afterEach(() => {
        delete process.env.AVA_TIMEOUT_MS;
    });

    it.each([
        ["empty string", ""],
        ["non-numeric", "abc"],
        ["NaN string", "NaN"],
        ["negative number", "-5"],
        ["zero", "0"],
    ])(`falls back to ${AVA_DEFAULT_TIMEOUT_MS} for invalid value: %s`, async (_label, value) => {
        process.env.AVA_TIMEOUT_MS = value;
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ answer: "OK" });

        await handleAskAvaSyncRequest({ question: "test" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ timeoutMs: AVA_DEFAULT_TIMEOUT_MS })
        );
    });

    it("uses the env var value when it is a valid positive number", async () => {
        process.env.AVA_TIMEOUT_MS = "30000";
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ answer: "OK" });

        await handleAskAvaSyncRequest({ question: "test" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ timeoutMs: 30_000 })
        );
    });
});

describe("handleAskAvaSyncRequest", () => {
    it("should call makeDoitRequest with POST and question, returning the answer", async () => {
        const mockResponse = {
            answer: "Based on your cloud spending, your biggest cost driver is compute.",
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleAskAvaSyncRequest({ question: "What is my biggest cost?" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${AVA_BASE_URL}/askSync`,
            mockToken,
            expect.objectContaining({
                method: "POST",
                body: expect.objectContaining({ question: "What is my biggest cost?", ephemeral: true }),
                customerContext: undefined,
            })
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.answer).toBe("Based on your cloud spending, your biggest cost driver is compute.");
    });

    it("should include conversationId and answerId when ephemeral is false", async () => {
        const mockResponse = {
            answer: "Follow-up answer here.",
            conversationId: "conv-abc123",
            answerId: "ans-xyz456",
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleAskAvaSyncRequest(
            { question: "Tell me more", conversationId: "conv-abc123", ephemeral: false },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${AVA_BASE_URL}/askSync`,
            mockToken,
            expect.objectContaining({
                body: expect.objectContaining({ ephemeral: false, conversationId: "conv-abc123" }),
            })
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.conversationId).toBe("conv-abc123");
        expect(parsed.answerId).toBe("ans-xyz456");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ answer: "OK" });

        await handleAskAvaSyncRequest({ question: "What is my spend?", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ customerContext: "customer-123" })
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleAskAvaSyncRequest({ question: "What is my spend?" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("failed or timed out") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleAskAvaSyncRequest({ question: "What is my spend?" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return Zod validation error when question is missing", async () => {
        const response = await handleAskAvaSyncRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
    });

    it("should return timeout-specific error when makeDoitRequest throws TimeoutError", async () => {
        const timeoutError = new DOMException("signal timed out", "TimeoutError");
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(timeoutError);

        const response = await handleAskAvaSyncRequest({ question: "What is my spend?" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalled();
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("did not respond within the time limit") }],
            isError: true,
        });
    });

    it("should return error when conversationId is provided with ephemeral: true (the default)", async () => {
        const response = await handleAskAvaSyncRequest(
            { question: "Tell me more", conversationId: "conv-abc123" },
            mockToken
        );

        expect(makeDoitRequest).not.toHaveBeenCalled();
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("conversationId") }],
            isError: true,
        });
    });
});
