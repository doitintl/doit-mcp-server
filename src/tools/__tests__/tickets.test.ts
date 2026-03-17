import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { handleListTicketsRequest, TICKETS_BASE_URL } from "../tickets.js";

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
