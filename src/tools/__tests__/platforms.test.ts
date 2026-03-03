import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { handleListPlatformsRequest, PLATFORMS_BASE_URL } from "../platforms.js";

vi.mock("../../utils/util.js", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, makeDoitRequest: vi.fn() };
});

describe("platforms", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should call makeDoitRequest with base URL and return platforms in response", async () => {
        const mockApiResponse = {
            platforms: [
                { id: "gcp", displayName: "Google Cloud Platform" },
                { id: "aws", displayName: "Amazon Web Services" },
            ],
        };
        (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

        const response = await handleListPlatformsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(PLATFORMS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed).toEqual({
            platforms: [
                { id: "gcp", displayName: "Google Cloud Platform" },
                { id: "aws", displayName: "Amazon Web Services" },
            ],
        });
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({
            platforms: [{ id: "gcp", displayName: "Google Cloud Platform" }],
        });

        await handleListPlatformsRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(PLATFORMS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(null);

        const response = await handleListPlatformsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("platforms") }],
        });
    });

    it("should return success message when no platforms found", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ platforms: [] });

        const response = await handleListPlatformsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: "No platforms found." }],
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

        const response = await handleListPlatformsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
        });
    });
});
