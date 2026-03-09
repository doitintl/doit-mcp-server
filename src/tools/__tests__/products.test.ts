import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { handleListProductsRequest, PRODUCTS_BASE_URL } from "../products.js";

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

describe("products", () => {
    const mockToken = "fake-token";

    const mockProduct = {
        displayName: "Compute Engine",
        id: "compute-engine",
        platform: "google_cloud_platform",
    };

    it("should call makeDoitRequest with base URL and return products in response", async () => {
        const mockApiResponse = { products: [mockProduct] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListProductsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(PRODUCTS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.products).toHaveLength(1);
        expect(parsed.products[0].id).toBe("compute-engine");
        expect(parsed.products[0].displayName).toBe("Compute Engine");
        expect(parsed.products[0].platform).toBe("google_cloud_platform");
    });

    it("should append platform query param when provided", async () => {
        const mockApiResponse = { products: [mockProduct] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListProductsRequest({ platform: "google_cloud_platform" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${PRODUCTS_BASE_URL}?platform=google_cloud_platform`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.products).toHaveLength(1);
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
            products: [mockProduct],
        });

        await handleListProductsRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(PRODUCTS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return success response when no products found", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ products: [] });

        const response = await handleListProductsRequest({}, mockToken);

        expect(response.content[0].text).toBe("No products found.");
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListProductsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("products") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListProductsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});
