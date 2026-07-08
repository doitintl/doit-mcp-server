import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    handleGetResourcePermissionsRequest,
    handleUpdateResourcePermissionsRequest,
    SHARING_BASE_URL,
} from "../permissions.js";

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

describe("permissions", () => {
    const mockToken = "fake-token";

    const mockPermissions = {
        id: "budget-123",
        name: "Q4 Cloud Spend",
        description: "Budget tracking for Q4",
        createTime: 1700000000000,
        updateTime: 1700100000000,
        permissions: [
            { user: "user@company.com", role: "owner" },
            { user: "reviewer@company.com", role: "viewer" },
        ],
        public: "viewer",
    };

    it("should call makeDoitRequest with the resourceType/resourceId path and return permissions", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockPermissions);

        const response = await handleGetResourcePermissionsRequest(
            { resourceType: "budgets", resourceId: "budget-123" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(`${SHARING_BASE_URL}/budgets/budget-123`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.id).toBe("budget-123");
        expect(parsed.permissions).toHaveLength(2);
        expect(parsed.permissions[0].role).toBe("owner");
    });

    it("should URL-encode the resourceId", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockPermissions);

        await handleGetResourcePermissionsRequest(
            { resourceType: "reports", resourceId: "report id/with spaces" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${SHARING_BASE_URL}/reports/report%20id%2Fwith%20spaces`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockPermissions);

        await handleGetResourcePermissionsRequest(
            { resourceType: "alerts", resourceId: "alert-1", customerContext: "customer-123" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(`${SHARING_BASE_URL}/alerts/alert-1`, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return a validation error for an invalid resourceType", async () => {
        const response = await handleGetResourcePermissionsRequest(
            { resourceType: "widgets", resourceId: "x" },
            mockToken
        );

        expect(response.isError).toBe(true);
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return a validation error when resourceId is missing", async () => {
        const response = await handleGetResourcePermissionsRequest({ resourceType: "budgets" }, mockToken);

        expect(response.isError).toBe(true);
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetResourcePermissionsRequest(
            { resourceType: "budgets", resourceId: "budget-123" },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("resource permissions") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetResourcePermissionsRequest(
            { resourceType: "budgets", resourceId: "budget-123" },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("update_resource_permissions", () => {
    const mockToken = "fake-token";

    const mockUpdatedPermissions = {
        id: "budget-123",
        name: "Q4 Cloud Spend",
        permissions: [
            { user: "owner@company.com", role: "owner" },
            { user: "editor@company.com", role: "editor" },
        ],
        public: null,
    };

    it("should PATCH the permissions endpoint with the provided body", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedPermissions);

        const response = await handleUpdateResourcePermissionsRequest(
            {
                resourceType: "budgets",
                resourceId: "budget-123",
                permissions: [
                    { user: "owner@company.com", role: "owner" },
                    { user: "editor@company.com", role: "editor" },
                ],
                public: null,
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(`${SHARING_BASE_URL}/budgets/budget-123`, mockToken, {
            method: "PATCH",
            body: {
                permissions: [
                    { user: "owner@company.com", role: "owner" },
                    { user: "editor@company.com", role: "editor" },
                ],
                public: null,
            },
            customerContext: undefined,
        });
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.id).toBe("budget-123");
        expect(parsed.permissions).toHaveLength(2);
        expect(parsed.public).toBeNull();
    });

    it("should send only permissions when public is omitted", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedPermissions);

        await handleUpdateResourcePermissionsRequest(
            {
                resourceType: "reports",
                resourceId: "report-1",
                permissions: [{ user: "viewer@company.com", role: "viewer" }],
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(`${SHARING_BASE_URL}/reports/report-1`, mockToken, {
            method: "PATCH",
            body: { permissions: [{ user: "viewer@company.com", role: "viewer" }] },
            customerContext: undefined,
        });
    });

    it("should send only public when permissions is omitted", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedPermissions);

        await handleUpdateResourcePermissionsRequest(
            { resourceType: "alerts", resourceId: "alert-1", public: "viewer" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(`${SHARING_BASE_URL}/alerts/alert-1`, mockToken, {
            method: "PATCH",
            body: { public: "viewer" },
            customerContext: undefined,
        });
    });

    it("should return validation error for invalid resourceType", async () => {
        const response = await handleUpdateResourcePermissionsRequest(
            { resourceType: "widgets", resourceId: "x" },
            mockToken
        );

        expect(response.isError).toBe(true);
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleUpdateResourcePermissionsRequest(
            { resourceType: "budgets", resourceId: "budget-123", public: "viewer" },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("update resource permissions") }],
            isError: true,
        });
    });
});
