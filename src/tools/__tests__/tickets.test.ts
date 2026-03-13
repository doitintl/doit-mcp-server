import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { handleCreateTicketRequest, handleListTicketsRequest, TICKETS_BASE_URL } from "../tickets.js";

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

describe("handleListTicketsRequest", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with correct parameters and return success response", async () => {
        const mockApiResponse = {
            pageToken: "another-page",
            rowCount: 1,
            tickets: [
                {
                    id: 1,
                    subject: "Test Ticket",
                    status: "open",
                    severity: "normal",
                    platform: "google_cloud_platform",
                    product: "BigQuery",
                    requester: "test@example.com",
                    createTime: 1678886400000,
                    updateTime: 1678972800000,
                    is_public: false,
                    urlUI: "https://console.doit.com/tickets/1",
                },
            ],
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListTicketsRequest({ pageToken: "next-page", pageSize: 10 }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${TICKETS_BASE_URL}?pageToken=next-page&pageSize=10`, mockToken, {
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.tickets).toHaveLength(1);
        expect(parsed.tickets[0].subject).toBe("Test Ticket");
    });

    it("should handle request without optional parameters", async () => {
        const mockApiResponse = { rowCount: 0, tickets: [] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListTicketsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${TICKETS_BASE_URL}?`, mockToken, { customerContext: undefined });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.tickets).toHaveLength(0);
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListTicketsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Failed to fetch tickets") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListTicketsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("handleCreateTicketRequest", () => {
    const mockToken = "fake-token";

    const validTicketArgs = {
        ticket: {
            subject: "GCP billing issue",
            body: "We noticed unexpected charges on our GCP account.",
            platform: "google_cloud_platform",
            product: "Billing",
            severity: "normal",
            created: "2024-01-15T10:00:00Z",
        },
    };

    it("should call makeDoitRequest with correct parameters and return success response", async () => {
        const mockApiResponse = {
            id: 42,
            subject: "GCP billing issue",
            status: "new",
            severity: "normal",
            platform: "google_cloud_platform",
            urlUI: "https://console.doit.com/tickets/42",
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleCreateTicketRequest(validTicketArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(TICKETS_BASE_URL, mockToken, {
            method: "POST",
            body: { ticket: validTicketArgs.ticket },
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe(42);
        expect(parsed.urlUI).toBe("https://console.doit.com/tickets/42");
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleCreateTicketRequest(validTicketArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Failed to create ticket") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleCreateTicketRequest(validTicketArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should pass customerContext when provided", async () => {
        const argsWithContext = { ...validTicketArgs, customerContext: "customer-123" };
        const mockApiResponse = { id: 43, subject: "GCP billing issue" };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        await handleCreateTicketRequest(argsWithContext, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(TICKETS_BASE_URL, mockToken, {
            method: "POST",
            body: { ticket: validTicketArgs.ticket },
            customerContext: "customer-123",
        });
    });

    it("should work with different platform values", async () => {
        const awsArgs = {
            ticket: { ...validTicketArgs.ticket, platform: "amazon_web_services" },
        };
        const mockApiResponse = { id: 44, subject: "GCP billing issue" };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleCreateTicketRequest(awsArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(TICKETS_BASE_URL, mockToken, {
            method: "POST",
            body: { ticket: awsArgs.ticket },
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe(44);
    });

    it("should work with different severity values", async () => {
        const urgentArgs = {
            ticket: { ...validTicketArgs.ticket, severity: "urgent" },
        };
        const mockApiResponse = { id: 45, subject: "GCP billing issue" };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleCreateTicketRequest(urgentArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(TICKETS_BASE_URL, mockToken, {
            method: "POST",
            body: { ticket: urgentArgs.ticket },
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe(45);
    });
});
