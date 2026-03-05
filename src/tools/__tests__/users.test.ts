import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { handleListUsersRequest, USERS_BASE_URL } from "../users.js";

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

describe("users", () => {
    const mockToken = "fake-token";

    const mockUser = {
        id: "user-1",
        email: "alice@example.com",
        displayName: "Alice Smith",
        firstName: "Alice",
        lastName: "Smith",
        jobFunction: "Software / Ops Engineer",
        phone: "+1",
        phoneExtension: "123",
        language: "en",
        roleId: "role-1",
        organizationId: "org-1",
        status: "active",
    };

    it("should call makeDoitRequest with base URL and return users in response", async () => {
        const mockApiResponse = { users: [mockUser], rowCount: 1 };
        (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

        const response = await handleListUsersRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(USERS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.rowCount).toBe(1);
        expect(parsed.users).toHaveLength(1);
        expect(parsed.users[0].email).toBe("alice@example.com");
        expect(parsed.users[0].status).toBe("active");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ users: [mockUser], rowCount: 1 });

        await handleListUsersRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(USERS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(null);

        const response = await handleListUsersRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("users") }],
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

        const response = await handleListUsersRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
        });
    });
});
