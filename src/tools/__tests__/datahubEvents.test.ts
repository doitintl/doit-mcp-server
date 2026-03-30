import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { DATAHUB_EVENTS_BASE_URL, handleSendDatahubEventsRequest } from "../datahubEvents.js";

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

const minimalEvent = {
    provider: "Datadog",
    time: "2024-03-10T23:00:00Z",
};

const fullEvent = {
    provider: "Datadog",
    id: "evt-001",
    time: "2024-03-10T23:00:00Z",
    dimensions: [{ key: "env", type: "label" as const, value: "production" }],
    metrics: [{ value: 10.5, type: "cost" }],
};

describe("handleSendDatahubEventsRequest", () => {
    it("should call makeDoitRequest with POST and correct body", async () => {
        const mockResponse = { message: "Ingestion success" };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleSendDatahubEventsRequest({ events: [minimalEvent] }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(DATAHUB_EVENTS_BASE_URL, mockToken, {
            method: "POST",
            body: { events: [minimalEvent] },
            customerContext: undefined,
        });
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.message).toBe("Ingestion success");
    });

    it("should send full event with all optional fields", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ message: "Ingestion success" });

        await handleSendDatahubEventsRequest({ events: [fullEvent] }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            DATAHUB_EVENTS_BASE_URL,
            mockToken,
            expect.objectContaining({
                method: "POST",
                body: expect.objectContaining({
                    events: [
                        expect.objectContaining({
                            provider: "Datadog",
                            id: "evt-001",
                            dimensions: [{ key: "env", type: "label", value: "production" }],
                            metrics: [{ value: 10.5, type: "cost" }],
                        }),
                    ],
                }),
            })
        );
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ message: "Ingestion success" });

        await handleSendDatahubEventsRequest({ events: [minimalEvent], customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ customerContext: "customer-123" })
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleSendDatahubEventsRequest({ events: [minimalEvent] }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Failed to send DataHub events") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleSendDatahubEventsRequest({ events: [minimalEvent] }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should send multiple events in a single request", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ message: "Ingestion success" });

        const events = [minimalEvent, { ...minimalEvent, time: "2024-03-11T00:00:00Z" }];
        await handleSendDatahubEventsRequest({ events }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            DATAHUB_EVENTS_BASE_URL,
            mockToken,
            expect.objectContaining({
                body: { events },
            })
        );
    });

    it("should accept boolean dimension values", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ message: "Ingestion success" });

        const eventWithBoolDimension = {
            ...minimalEvent,
            dimensions: [{ key: "active", type: "fixed" as const, value: true }],
        };
        const response = await handleSendDatahubEventsRequest({ events: [eventWithBoolDimension] }, mockToken);

        expect(response.content[0].text).not.toContain("Invalid arguments");
    });

    it("should reject empty events array", async () => {
        const response = await handleSendDatahubEventsRequest({ events: [] }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should reject event missing provider", async () => {
        const { provider: _, ...noProvider } = minimalEvent;
        const response = await handleSendDatahubEventsRequest({ events: [noProvider] }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should reject event missing time", async () => {
        const { time: _, ...noTime } = minimalEvent;
        const response = await handleSendDatahubEventsRequest({ events: [noTime] }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should reject invalid datetime format for time field", async () => {
        const response = await handleSendDatahubEventsRequest(
            { events: [{ ...minimalEvent, time: "not-a-date" }] },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should reject invalid dimension type", async () => {
        const eventWithBadDimType = {
            ...minimalEvent,
            dimensions: [{ key: "env", type: "invalid_type", value: "prod" }],
        };
        const response = await handleSendDatahubEventsRequest({ events: [eventWithBadDimType] }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should reject provider with invalid characters", async () => {
        const response = await handleSendDatahubEventsRequest(
            { events: [{ ...minimalEvent, provider: "My@Provider!" }] },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});
