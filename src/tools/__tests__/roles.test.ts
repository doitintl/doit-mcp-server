import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { handleListRolesRequest, ROLES_BASE_URL } from "../roles.js";

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

describe("roles", () => {
    const mockToken = "fake-token";

    const mockRole = {
        id: "role-1",
        name: "Admin",
        type: "preset",
        customer: "",
        permissions: ["billing.read", "billing.write"],
    };

    it("should call makeDoitRequest with base URL and return roles in response", async () => {
        const mockApiResponse = { roles: [mockRole] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListRolesRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ROLES_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.roles).toHaveLength(1);
        expect(parsed.roles[0].id).toBe("role-1");
        expect(parsed.roles[0].name).toBe("Admin");
        expect(parsed.roles[0].type).toBe("preset");
        expect(parsed.roles[0].permissions).toContain("billing.read");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ roles: [mockRole] });

        await handleListRolesRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ROLES_BASE_URL, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListRolesRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("roles") }],
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListRolesRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
        });
    });
});
