import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { ACCOUNT_TEAM_BASE_URL, handleListAccountTeamRequest } from "../accountTeam.js";

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

describe("accountTeam", () => {
    const mockToken = "fake-token";

    const mockManager = {
        email: "manager@doit.com",
        id: "mgr-123",
        name: "John Manager",
        role: "Account Manager",
        calendlyLink: "https://calendly.com/john-manager",
    };

    it("should call makeDoitRequest with base URL and return account managers", async () => {
        const mockApiResponse = { accountManagers: [mockManager] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListAccountTeamRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ACCOUNT_TEAM_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.accountManagers).toHaveLength(1);
        expect(parsed.accountManagers[0].email).toBe("manager@doit.com");
        expect(parsed.accountManagers[0].name).toBe("John Manager");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ accountManagers: [mockManager] });

        await handleListAccountTeamRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ACCOUNT_TEAM_BASE_URL, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return a friendly message when there are no account team members", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ accountManagers: [] });

        const response = await handleListAccountTeamRequest({}, mockToken);

        expect(response.content[0].text).toContain("No account team members found.");
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListAccountTeamRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("account team") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListAccountTeamRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});
