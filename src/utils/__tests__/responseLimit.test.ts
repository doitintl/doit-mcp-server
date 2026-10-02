import { describe, expect, it, vi } from "vitest";
import { finalizeToolResponse, MAX_TOOL_RESULT_CHARS, measureToolResponse } from "../responseLimit.js";

const textResult = (text: string) => ({ content: [{ type: "text", text }] });
const base = { toolName: "run_query", operation: "read" as const, durationMs: 12, onMetrics: vi.fn() };
const oversized = () => textResult("x".repeat(MAX_TOOL_RESULT_CHARS));

describe("final MCP response size guard", () => {
    it("preserves a result at the limit and rejects it one character over", () => {
        const overhead = JSON.stringify(textResult("")).length;
        const atLimit = textResult("x".repeat(MAX_TOOL_RESULT_CHARS - overhead));
        expect(finalizeToolResponse(atLimit, base)).toBe(atLimit);
        const overLimit = textResult(`${atLimit.content[0].text}x`);
        const result = finalizeToolResponse(overLimit, base);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("RESPONSE_TOO_LARGE");
        expect(result.content[0].text).toContain("shorter time range");
        expect(measureToolResponse(result)?.serializedChars).toBeLessThan(MAX_TOOL_RESULT_CHARS);
    });

    it("counts every content block, structured content and metadata together", () => {
        const result = {
            content: [
                { type: "text", text: "a".repeat(40_000) },
                { type: "text", text: "b".repeat(40_000) },
            ],
            structuredContent: { body: "c".repeat(40_000) },
            _meta: { body: "d".repeat(40_000) },
        };
        expect(finalizeToolResponse(result, base).isError).toBe(true);
        expect(measureToolResponse(result)?.textChars).toBe(80_000);
    });

    it("measures encoded bytes separately and includes JSON escaping", () => {
        const result = textResult('é😀"\n');
        const serialized = JSON.stringify(result);
        expect(measureToolResponse(result)).toEqual({
            textChars: 5,
            serializedChars: serialized.length,
            serializedBytes: Buffer.byteLength(serialized, "utf8"),
        });
    });

    it("preserves successful writes with bounded identifiers without returning body data", () => {
        const result = textResult(JSON.stringify({ id: "ticket-123", secret: "private", body: "x".repeat(150_000) }));
        const receipt = finalizeToolResponse(result, { ...base, toolName: "create_ticket", operation: "write" });
        expect(receipt.isError).toBe(false);
        expect(JSON.parse(receipt.content[0].text)).toMatchObject({
            status: "completed",
            responseOmitted: true,
            identifiers: { id: "ticket-123" },
        });
        expect(receipt.content[0].text).not.toContain("private");
        expect(receipt.content[0].text).toContain("Do not repeat the write");
    });

    it("does not copy oversized identifiers or invented ones into receipts", () => {
        const sourceResponse = textResult(JSON.stringify({ id: "x".repeat(150_000), unknownId: "123" }));
        const receipt = finalizeToolResponse(oversized(), { ...base, operation: "write", sourceResponse });
        expect(JSON.parse(receipt.content[0].text).identifiers).toEqual({});
        expect(measureToolResponse(receipt)?.serializedChars).toBeLessThan(2_000);
    });

    it("never converts an oversized write error into success", () => {
        const sourceResponse = { ...oversized(), isError: true };
        const result = finalizeToolResponse(textResult("formatter lost the error flag"), {
            ...base,
            operation: "write",
            sourceResponse,
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Verify the current state");
    });

    it("preserves a small source error even when the formatter lost its flag", () => {
        const sourceResponse = { ...textResult("Permission denied"), isError: true };
        expect(finalizeToolResponse(textResult("widget output"), { ...base, sourceResponse })).toBe(sourceResponse);
    });

    it("never claims that an oversized approval request has executed", () => {
        const result = finalizeToolResponse(oversized(), { ...base, operation: "not_executed" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("action was not executed");
    });

    it("handles unserializable results without turning a successful write into a failure", () => {
        const circular: any = textResult("ok");
        circular.self = circular;
        expect(finalizeToolResponse(circular, base).isError).toBe(true);
        const receipt = finalizeToolResponse(circular, { ...base, operation: "write" });
        expect(receipt.isError).toBe(false);
        expect(receipt.content[0].text).toContain("RESPONSE_SERIALIZATION_FAILED");
    });

    it("logs only size and execution metadata, never payloads", () => {
        const onMetrics = vi.fn();
        const source = textResult("private-customer-data");
        finalizeToolResponse(source, { ...base, client: "claude", onMetrics });
        expect(onMetrics).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "mcp_tool_response",
                toolName: "run_query",
                client: "claude",
                durationMs: 12,
                disposition: "unchanged",
                exceededLimit: false,
                original: measureToolResponse(source),
            })
        );
        expect(JSON.stringify(onMetrics.mock.calls)).not.toContain("private-customer-data");
    });

    it("writes default metrics only to stderr and tolerates logging failures", () => {
        const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
        const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
        const result = textResult("ok");
        try {
            expect(finalizeToolResponse(result, { ...base, onMetrics: undefined })).toBe(result);
            expect(stderr).toHaveBeenCalledOnce();
            expect(stdout).not.toHaveBeenCalled();
            expect(
                finalizeToolResponse(result, {
                    ...base,
                    onMetrics: () => {
                        throw new Error("logger unavailable");
                    },
                })
            ).toBe(result);
        } finally {
            vi.restoreAllMocks();
        }
    });
});
