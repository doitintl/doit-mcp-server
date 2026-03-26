import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    ASSETS_BASE_URL,
    CREATE_ASSET_URL,
    DEFAULT_MAX_RESULTS_ASSETS,
    handleCreateAssetRequest,
    handleGetAssetRequest,
    handleListAssetsRequest,
    handleUpdateAssetRequest,
} from "../assets.js";

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

describe("handleListAssetsRequest", () => {
    const mockToken = "test-token";

    const mockAsset = {
        id: "asset-1",
        name: "My Billing Account",
        type: "google-cloud",
        quantity: 1,
        url: "https://console.doit.com/assets/asset-1",
        createTime: 1700000000,
    };

    it("should call makeDoitRequest with base URL + default maxResults and return JSON response", async () => {
        const mockApiResponse = { assets: [mockAsset], pageToken: "", rowCount: 1 };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListAssetsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${ASSETS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_ASSETS}`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.assets).toHaveLength(1);
        expect(parsed.assets[0].id).toBe("asset-1");
        expect(parsed.assets[0].name).toBe("My Billing Account");
        expect(parsed.rowCount).toBe(1);
    });

    it("should append all query params when provided", async () => {
        const mockApiResponse = { assets: [mockAsset], pageToken: "next", rowCount: 1 };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        await handleListAssetsRequest({ maxResults: "10", pageToken: "token-1", filter: "type:g-suite" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("maxResults=10"),
            mockToken,
            expect.any(Object)
        );
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("pageToken=token-1"),
            mockToken,
            expect.any(Object)
        );
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("filter=type%3Ag-suite"),
            mockToken,
            expect.any(Object)
        );
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ assets: [], rowCount: 0 });
        await handleListAssetsRequest({ customerContext: "customer-123" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const response = await handleListAssetsRequest({}, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("assets") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
        const response = await handleListAssetsRequest({}, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should reject maxResults values above the API limit", async () => {
        const response = await handleListAssetsRequest({ maxResults: "250" }, mockToken);

        expect(response).toEqual({
            content: [
                {
                    type: "text",
                    text: expect.stringContaining("maxResults: Must be a positive integer no greater than 249"),
                },
            ],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});

describe("handleGetAssetRequest", () => {
    const mockToken = "test-token";

    const mockAssetDetailed = {
        id: "asset-1",
        name: "My Billing Account",
        type: "google-cloud",
        quantity: 1,
        url: "https://console.doit.com/assets/asset-1",
        createTime: 1700000000,
        properties: {
            customerDomain: "example.com",
            customerID: "cust-123",
            reseller: "doit",
            subscription: {
                id: "sub-1",
                status: "ACTIVE",
            },
        },
    };

    it("should call makeDoitRequest with asset ID in URL and return asset data", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssetDetailed);
        const response = await handleGetAssetRequest({ id: "asset-1" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(`${ASSETS_BASE_URL}/asset-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.id).toBe("asset-1");
        expect(parsed.properties.customerDomain).toBe("example.com");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssetDetailed);
        await handleGetAssetRequest({ id: "asset-1", customerContext: "customer-123" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const response = await handleGetAssetRequest({ id: "asset-1" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("asset") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
        const response = await handleGetAssetRequest({ id: "asset-1" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleGetAssetRequest({}, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when id is empty string", async () => {
        const response = await handleGetAssetRequest({ id: "" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Asset ID is required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when id is whitespace only", async () => {
        const response = await handleGetAssetRequest({ id: "   " }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Asset ID is required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});

describe("handleCreateAssetRequest", () => {
    const mockToken = "test-token";

    const mockCreateResponse = { accountID: "new-account-123" };

    it("should call makeDoitRequest with POST and query params including defaults", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateResponse);
        const response = await handleCreateAssetRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.stringContaining(`${CREATE_ASSET_URL}?`), mockToken, {
            method: "POST",
            appendParams: false,
            customerContext: undefined,
        });
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("type=amazon-web-services"),
            mockToken,
            expect.any(Object)
        );
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("mode=New"),
            mockToken,
            expect.any(Object)
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.accountID).toBe("new-account-123");
    });

    it("should include rootEmail in query params when provided", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateResponse);
        await handleCreateAssetRequest({ rootEmail: "admin@example.com" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("rootEmail=admin%40example.com"),
            mockToken,
            expect.any(Object)
        );
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateResponse);
        await handleCreateAssetRequest({ customerContext: "customer-123" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "POST",
            appendParams: false,
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const response = await handleCreateAssetRequest({}, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("asset") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
        const response = await handleCreateAssetRequest({}, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when rootEmail is not a valid email", async () => {
        const response = await handleCreateAssetRequest({ rootEmail: "not-an-email" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("valid email") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when type is an empty string", async () => {
        const response = await handleCreateAssetRequest({ type: "" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("non-empty") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});

describe("handleUpdateAssetRequest", () => {
    const mockToken = "test-token";

    const mockUpdateResponse = {
        id: "asset-1",
        properties: {
            customerDomain: "example.com",
            customerID: "cust-123",
            reseller: "doit",
            subscription: { id: "sub-1", status: "ACTIVE" },
        },
        type: "commitment",
    };

    it("should call makeDoitRequest with PATCH, correct URL, and body without id", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdateResponse);
        const response = await handleUpdateAssetRequest({ id: "asset-1", quantity: 10 }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${ASSETS_BASE_URL}/asset-1`, mockToken, {
            method: "PATCH",
            body: { quantity: 10 },
            appendParams: false,
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.id).toBe("asset-1");
        expect(parsed.type).toBe("commitment");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdateResponse);
        await handleUpdateAssetRequest({ id: "asset-1", quantity: 5, customerContext: "customer-123" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "PATCH",
            body: { quantity: 5 },
            appendParams: false,
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const response = await handleUpdateAssetRequest({ id: "asset-1", quantity: 10 }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("asset") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
        const response = await handleUpdateAssetRequest({ id: "asset-1", quantity: 10 }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleUpdateAssetRequest({ quantity: 10 }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when id is empty string", async () => {
        const response = await handleUpdateAssetRequest({ id: "", quantity: 10 }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Asset ID is required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when id is whitespace only", async () => {
        const response = await handleUpdateAssetRequest({ id: "   ", quantity: 10 }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Asset ID is required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when quantity is missing", async () => {
        const response = await handleUpdateAssetRequest({ id: "asset-1" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when quantity is negative", async () => {
        const response = await handleUpdateAssetRequest({ id: "asset-1", quantity: -5 }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("positive") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when quantity is zero", async () => {
        const response = await handleUpdateAssetRequest({ id: "asset-1", quantity: 0 }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("positive") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});
