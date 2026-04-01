import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    handleGetTicketRequest,
    handleListTicketCommentsRequest,
    handleListTicketsRequest,
    TICKETS_BASE_URL,
} from "../tickets.js";

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
            method: "GET",
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

        expect(makeDoitRequest).toHaveBeenCalledWith(`${TICKETS_BASE_URL}?`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

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

describe("handleGetTicketRequest", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with correct URL including ticket ID", async () => {
        const mockTicket = {
            id: 12345,
            subject: "VM not starting",
            description: "The VM fails to boot after the last update.",
            requester: "alice@example.com",
            severity: "high",
            platform: "google_cloud_platform",
            product: "Compute Engine",
            status: "open",
            createTime: 1700000000000,
            updateTime: 1700100000000,
            urlUI: "https://console.doit.com/tickets/12345",
            is_public: false,
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockTicket);

        const response = await handleGetTicketRequest({ id: "12345" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${TICKETS_BASE_URL}/12345`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.id).toBe(12345);
        expect(parsed.subject).toBe("VM not starting");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 12345 });

        await handleGetTicketRequest({ id: "12345", customerContext: "customer-abc" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "GET",
            customerContext: "customer-abc",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetTicketRequest({ id: "12345" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("ticket") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetTicketRequest({ id: "12345" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleGetTicketRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
    });

    it("should return error when id is empty string", async () => {
        const response = await handleGetTicketRequest({ id: "" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("required") }],
            isError: true,
        });
    });

    it("should return error when id is whitespace only", async () => {
        const response = await handleGetTicketRequest({ id: "   " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("required") }],
            isError: true,
        });
    });

    it("should return error when id is non-numeric and not call makeDoitRequest", async () => {
        const response = await handleGetTicketRequest({ id: "ticket-abc" }, mockToken);

        expect(makeDoitRequest).not.toHaveBeenCalled();
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("numeric") }],
            isError: true,
        });
    });
});

describe("handleListTicketCommentsRequest", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with correct URL and return data", async () => {
        const mockResponse = {
            comments: [
                { id: 1, body: "Please check the logs.", author: "support@doit.com", created: 1700000000000 },
                { id: 2, body: "Resolved after restart.", author: "alice@example.com", created: 1700100000000 },
            ],
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleListTicketCommentsRequest({ ticketId: "12345" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${TICKETS_BASE_URL}/12345/comments`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.comments).toHaveLength(2);
        expect(parsed.comments[0].author).toBe("support@doit.com");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ comments: [] });

        await handleListTicketCommentsRequest({ ticketId: "12345", customerContext: "customer-abc" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "GET",
            customerContext: "customer-abc",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListTicketCommentsRequest({ ticketId: "12345" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("ticket comments") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListTicketCommentsRequest({ ticketId: "12345" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when ticketId is missing", async () => {
        const response = await handleListTicketCommentsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
    });

    it("should return error when ticketId is empty string", async () => {
        const response = await handleListTicketCommentsRequest({ ticketId: "" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("required") }],
            isError: true,
        });
    });

    it("should return error when ticketId is whitespace only", async () => {
        const response = await handleListTicketCommentsRequest({ ticketId: "   " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("required") }],
            isError: true,
        });
    });

    it("should return error when ticketId is non-numeric and not call makeDoitRequest", async () => {
        const response = await handleListTicketCommentsRequest({ ticketId: "ticket-abc" }, mockToken);

        expect(makeDoitRequest).not.toHaveBeenCalled();
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("numeric") }],
            isError: true,
        });
    });
});
