import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { ASSETS_BASE_URL, handleGetAssetRequest, handleListAssetsRequest } from "../assets.js";

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
            expect.stringContaining(`${ASSETS_BASE_URL}?maxResults=`),
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
