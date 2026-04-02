import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    handleInviteUserRequest,
    handleListUsersRequest,
    handleUpdateUserRequest,
    USERS_BASE_URL,
    USERS_INVITE_URL,
} from "../users.js";

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
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

        const response = await handleListUsersRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("handleUpdateUserRequest", () => {
    const mockToken = "fake-token";
    const validUpdateArgs = { id: "user-1", firstName: "Alice" };

    it("should call makeDoitRequest with PATCH, correct URL, and body without id", async () => {
        const mockResponse = { message: "User updated successfully", user: { id: "user-1", firstName: "Alice" } };
        (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

        await handleUpdateUserRequest(validUpdateArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/user-1"),
            mockToken,
            expect.objectContaining({
                method: "PATCH",
                body: { firstName: "Alice" },
                customerContext: undefined,
            })
        );
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ message: "ok", user: { id: "user-1" } });

        await handleUpdateUserRequest({ ...validUpdateArgs, customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ customerContext: "customer-123" })
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(null);

        const response = await handleUpdateUserRequest(validUpdateArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("user") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

        const response = await handleUpdateUserRequest(validUpdateArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return validation error for empty id", async () => {
        const response = await handleUpdateUserRequest({ id: "  " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("ID is required") }],
            isError: true,
        });
    });

    it("should return validation error when only id is provided (no fields to update)", async () => {
        const response = await handleUpdateUserRequest({ id: "user-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("At least one field") }],
            isError: true,
        });
    });

    it("should pass jobFunction through in the request body", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ message: "ok", user: { id: "user-1" } });

        await handleUpdateUserRequest({ id: "user-1", jobFunction: "Management" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/user-1"),
            mockToken,
            expect.objectContaining({
                method: "PATCH",
                body: { jobFunction: "Management" },
            })
        );
    });

    it("should not rewrite jobFunction to jobTitle", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ message: "ok", user: { id: "user-1" } });

        await handleUpdateUserRequest({ id: "user-1", jobFunction: "Founder" }, mockToken);

        const calledBody = (makeDoitRequest as vi.Mock).mock.calls[0][2].body;
        expect(calledBody).toHaveProperty("jobFunction", "Founder");
        expect(calledBody).not.toHaveProperty("jobTitle");
    });

    it("should not include jobTitle in body when jobFunction is not provided", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ message: "ok", user: { id: "user-1" } });

        await handleUpdateUserRequest({ id: "user-1", firstName: "Alice" }, mockToken);

        const calledBody = (makeDoitRequest as vi.Mock).mock.calls[0][2].body;
        expect(calledBody).not.toHaveProperty("jobTitle");
        expect(calledBody).not.toHaveProperty("jobFunction");
    });

    it("should accept language 'en'", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ message: "ok", user: { id: "user-1" } });

        await handleUpdateUserRequest({ id: "user-1", language: "en" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/user-1"),
            mockToken,
            expect.objectContaining({ body: { language: "en" } })
        );
    });

    it("should accept language 'ja'", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ message: "ok", user: { id: "user-1" } });

        await handleUpdateUserRequest({ id: "user-1", language: "ja" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/user-1"),
            mockToken,
            expect.objectContaining({ body: { language: "ja" } })
        );
    });

    it("should accept language 'es'", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ message: "ok", user: { id: "user-1" } });

        await handleUpdateUserRequest({ id: "user-1", language: "es" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/user-1"),
            mockToken,
            expect.objectContaining({ body: { language: "es" } })
        );
    });

    it("should reject invalid language value", async () => {
        const response = await handleUpdateUserRequest({ id: "user-1", language: "fr" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.any(String) }],
            isError: true,
        });
    });

    it("should accept a short phoneExtension (e.g. 3 digits)", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ message: "ok", user: { id: "user-1" } });

        await handleUpdateUserRequest({ id: "user-1", phoneExtension: "123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/user-1"),
            mockToken,
            expect.objectContaining({ body: { phoneExtension: "123" } })
        );
    });

    it("should reject phoneExtension with non-digit characters", async () => {
        const response = await handleUpdateUserRequest({ id: "user-1", phoneExtension: "12abc" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("digits") }],
            isError: true,
        });
    });
});

describe("handleInviteUserRequest", () => {
    const mockToken = "fake-token";
    const validArgs = { email: "newuser@example.com", roleId: "role-1", organizationId: "org-1" };
    const mockResponse = {
        message: "User invited successfully",
        user: {
            id: "user-3",
            email: "newuser@example.com",
            roleId: "role-1",
            organizationId: "org-1",
            status: "invited",
        },
    };

    it("should call makeDoitRequest with POST, invite URL, and correct body", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

        const response = await handleInviteUserRequest(validArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            USERS_INVITE_URL,
            mockToken,
            expect.objectContaining({
                method: "POST",
                body: expect.objectContaining({ email: "newuser@example.com" }),
                customerContext: undefined,
            })
        );
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.user.email).toBe("newuser@example.com");
        expect(parsed.user.status).toBe("invited");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

        await handleInviteUserRequest({ ...validArgs, customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ customerContext: "customer-123" })
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(null);

        const response = await handleInviteUserRequest(validArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("invite user") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

        const response = await handleInviteUserRequest(validArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return validation error for missing email", async () => {
        const response = await handleInviteUserRequest({ roleId: "role-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.any(String) }],
            isError: true,
        });
    });

    it("should return validation error for invalid email format", async () => {
        const response = await handleInviteUserRequest({ email: "not-an-email" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.any(String) }],
            isError: true,
        });
    });

    it("should return validation error for whitespace-only roleId", async () => {
        const response = await handleInviteUserRequest({ email: "newuser@example.com", roleId: "   " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Role ID") }],
            isError: true,
        });
    });

    it("should return validation error for whitespace-only organizationId", async () => {
        const response = await handleInviteUserRequest(
            { email: "newuser@example.com", organizationId: "   " },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Organization ID") }],
            isError: true,
        });
    });

    it("should work with email only (roleId and organizationId optional)", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

        await handleInviteUserRequest({ email: "newuser@example.com" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            USERS_INVITE_URL,
            mockToken,
            expect.objectContaining({
                method: "POST",
                body: { email: "newuser@example.com" },
            })
        );
    });
});
