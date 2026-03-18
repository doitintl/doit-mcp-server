import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { CLOUD_DIAGRAMS_BASE_URL, handleFindCloudDiagramsRequest } from "../cloudDiagrams.js";

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

describe("find_cloud_diagrams", () => {
    const mockToken = "fake-token";

    const mockDiagrams = [
        {
            diagramUrl: "https://console.doit.com/cloud-diagrams/diagram/scheme-1/sheet-1/cust-1",
            imageUrl: "https://console.doit.com/cloud-diagrams/image/scheme-1/sheet-1",
        },
        {
            diagramUrl: "https://console.doit.com/cloud-diagrams/diagram/scheme-2/sheet-2/cust-1",
            imageUrl: "https://console.doit.com/cloud-diagrams/image/scheme-2/sheet-2",
        },
    ];

    it("should call makeDoitRequest with correct URL, method, body and return diagrams", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockDiagrams);

        const response = await handleFindCloudDiagramsRequest({ resources: ["res-1", "res-2"] }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(CLOUD_DIAGRAMS_BASE_URL, mockToken, {
            method: "POST",
            body: { resources: ["res-1", "res-2"] },
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].diagramUrl).toContain("scheme-1");
        expect(parsed[0].imageUrl).toContain("scheme-1");
        expect(parsed[1].diagramUrl).toContain("scheme-2");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockDiagrams);

        await handleFindCloudDiagramsRequest({ resources: ["res-1"], customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(CLOUD_DIAGRAMS_BASE_URL, mockToken, {
            method: "POST",
            body: { resources: ["res-1"] },
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleFindCloudDiagramsRequest({ resources: ["res-1"] }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("cloud diagrams") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleFindCloudDiagramsRequest({ resources: ["res-1"] }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when resources array is empty", async () => {
        const response = await handleFindCloudDiagramsRequest({ resources: [] }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("At least one resource ID is required") }],
            isError: true,
        });
    });
});
