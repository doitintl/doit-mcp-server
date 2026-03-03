import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { handleListOrganizationsRequest, ORGANIZATIONS_BASE_URL } from "../organizations.js";

vi.mock("../../utils/util.js", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, makeDoitRequest: vi.fn() };
});

describe("organizations", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should call makeDoitRequest with base URL and return organizations in response", async () => {
        const mockApiResponse = {
            organizations: [
                { id: "org-1", name: "Acme Corp" },
                { id: "org-2", name: "Beta Inc" },
            ],
        };
        (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

        const response = await handleListOrganizationsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ORGANIZATIONS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed).toEqual({
            organizations: [
                { id: "org-1", name: "Acme Corp" },
                { id: "org-2", name: "Beta Inc" },
            ],
        });
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({
            organizations: [{ id: "org-1", name: "Acme Corp" }],
        });

        await handleListOrganizationsRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ORGANIZATIONS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(null);

        const response = await handleListOrganizationsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("organizations") }],
        });
    });

    it("should return success message when no organizations found", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ organizations: [] });

        const response = await handleListOrganizationsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: "No organizations found." }],
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

        const response = await handleListOrganizationsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
        });
    });
});
