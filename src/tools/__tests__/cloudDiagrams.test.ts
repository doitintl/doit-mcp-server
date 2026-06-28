import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    CLOUD_DIAGRAMS_BASE_URL,
    CLOUD_DIAGRAMS_SEARCH_URL,
    CLOUD_DIAGRAMS_STATS_URL,
    CLOUD_DIAGRAMS_STATUSSHEET_URL,
    handleFindCloudDiagramsRequest,
    handleGetCloudDiagramCostSnapshotRequest,
    handleGetCloudDiagramResourceRelationshipsRequest,
    handleGetCloudDiagramsStatsRequest,
    handleSearchCloudDiagramsRequest,
} from "../cloudDiagrams.js";

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

describe("get_cloud_diagrams_stats", () => {
    const mockToken = "fake-token";

    const mockStats = [
        {
            _id: "scheme-1",
            ss_id: "sheet-1",
            name: "Production VPC",
            type: "infrastructure",
            account_name: "prod-account",
            account_id: "123456789012",
            account_type: "AWS",
            changes: [{ type: "NODE_CREATE", service: "EC2", count: 3 }],
            import: {
                status: "success",
                type: "AWS",
                account: "conn-1",
                cloudId: "123456789012",
                syncedAt: "2026-04-28T00:00:00Z",
            },
        },
    ];

    it("should call makeDoitRequest with start/end query params and return stats", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);

        const response = await handleGetCloudDiagramsStatsRequest(
            { start: "2026-04-01T00:00:00Z", end: "2026-04-28T00:00:00Z" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUD_DIAGRAMS_STATS_URL}?start=2026-04-01T00%3A00%3A00Z&end=2026-04-28T00%3A00%3A00Z`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]._id).toBe("scheme-1");
        expect(parsed[0].changes[0].type).toBe("NODE_CREATE");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);

        await handleGetCloudDiagramsStatsRequest(
            { start: "2026-04-01T00:00:00Z", end: "2026-04-28T00:00:00Z", customerContext: "customer-123" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.stringContaining(CLOUD_DIAGRAMS_STATS_URL), mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetCloudDiagramsStatsRequest(
            { start: "2026-04-01T00:00:00Z", end: "2026-04-28T00:00:00Z" },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("cloud diagrams stats") }],
            isError: true,
        });
    });

    it("should return error for an invalid date-time", async () => {
        const response = await handleGetCloudDiagramsStatsRequest(
            { start: "2026-04-01", end: "not-a-date" },
            mockToken
        );

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("RFC3339");
    });
});

describe("search_cloud_diagrams", () => {
    const mockToken = "fake-token";

    const mockSearch = {
        scheme: [{ _id: "sheet-1", type: "statussheet", scheme: "Production", ss_id: "sheet-1" }],
        component: [{ _id: "node-1", type: "node", name: "web-server", node_type: "host" }],
        prop: [],
    };

    it("should call makeDoitRequest with only query in body and return results", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockSearch);

        const response = await handleSearchCloudDiagramsRequest({ query: "production" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(CLOUD_DIAGRAMS_SEARCH_URL, mockToken, {
            method: "POST",
            body: { query: "production" },
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.scheme).toHaveLength(1);
        expect(parsed.component[0].name).toBe("web-server");
    });

    it("should include optional ss_id, from and size in the body", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockSearch);

        await handleSearchCloudDiagramsRequest(
            { query: "ec2", ss_id: "sheet-1", from: 0, size: 5, customerContext: "customer-123" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(CLOUD_DIAGRAMS_SEARCH_URL, mockToken, {
            method: "POST",
            body: { query: "ec2", ss_id: "sheet-1", from: 0, size: 5 },
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleSearchCloudDiagramsRequest({ query: "production" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("search cloud diagrams") }],
            isError: true,
        });
    });

    it("should return error when query is empty", async () => {
        const response = await handleSearchCloudDiagramsRequest({ query: "" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("search query string is required");
    });
});

describe("get_cloud_diagram_cost_snapshot", () => {
    const mockToken = "fake-token";

    const mockSnapshot = {
        diagramId: "sheet-1",
        currency: "USD",
        timeRange: { startDate: "2026-04-01", endDate: "2026-04-30", interval: "day" },
        total: 1234.56,
        trendingPct: 12.5,
        topResources: [{ id: "node-1", name: "web-server", type: "AWS::EC2::Instance", amount: 500 }],
        byService: [{ service: "EC2", amount: 800 }],
        trend: [{ bucketStart: "2026-04-01", amount: 40 }],
    };

    it("should call makeDoitRequest with layer ID in path and date query params", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockSnapshot);

        const response = await handleGetCloudDiagramCostSnapshotRequest(
            { layerId: "sheet-1", startDate: "2026-04-01", endDate: "2026-04-30" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/sheet-1/costs?startDate=2026-04-01&endDate=2026-04-30`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.diagramId).toBe("sheet-1");
        expect(parsed.total).toBe(1234.56);
        expect(parsed.byService[0].service).toBe("EC2");
    });

    it("should include the optional interval and pass customerContext", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockSnapshot);

        await handleGetCloudDiagramCostSnapshotRequest(
            {
                layerId: "sheet-1",
                startDate: "2026-04-01",
                endDate: "2026-04-30",
                interval: "month",
                customerContext: "customer-123",
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/sheet-1/costs?startDate=2026-04-01&endDate=2026-04-30&interval=month`,
            mockToken,
            { method: "GET", customerContext: "customer-123" }
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetCloudDiagramCostSnapshotRequest(
            { layerId: "sheet-1", startDate: "2026-04-01", endDate: "2026-04-30" },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("cloud diagram cost snapshot") }],
            isError: true,
        });
    });

    it("should return error for an invalid date", async () => {
        const response = await handleGetCloudDiagramCostSnapshotRequest(
            { layerId: "sheet-1", startDate: "2026-04-01T00:00:00Z", endDate: "nope" },
            mockToken
        );

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("YYYY-MM-DD");
    });
});

describe("get_cloud_diagram_resource_relationships", () => {
    const mockToken = "fake-token";

    const mockRelationships = {
        anchor: { id: "node-1", type: "node", name: "web-server", serviceType: "AWS::EC2::Instance" },
        direction: "both",
        depth: "direct",
        kind: "edges",
        relations: [
            {
                id: "node-2",
                type: "node",
                name: "db",
                serviceType: "AWS::RDS::DBInstance",
                relation: "downstream",
                hops: 1,
            },
        ],
        truncated: false,
    };

    it("should call makeDoitRequest with layer and resource IDs in path", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockRelationships);

        const response = await handleGetCloudDiagramResourceRelationshipsRequest(
            { layerId: "sheet-1", resourceId: "node-1" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/sheet-1/resources/node-1/relationships`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.anchor.id).toBe("node-1");
        expect(parsed.relations[0].relation).toBe("downstream");
        expect(parsed.relations[0].hops).toBe(1);
    });

    it("should include optional direction, depth and kind query params", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockRelationships);

        await handleGetCloudDiagramResourceRelationshipsRequest(
            {
                layerId: "sheet-1",
                resourceId: "node-1",
                direction: "downstream",
                depth: "transitive",
                kind: "both",
                customerContext: "customer-123",
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/sheet-1/resources/node-1/relationships?direction=downstream&depth=transitive&kind=both`,
            mockToken,
            { method: "GET", customerContext: "customer-123" }
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetCloudDiagramResourceRelationshipsRequest(
            { layerId: "sheet-1", resourceId: "node-1" },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("cloud diagram resource relationships") }],
            isError: true,
        });
    });

    it("should return error when resourceId is missing", async () => {
        const response = await handleGetCloudDiagramResourceRelationshipsRequest({ layerId: "sheet-1" }, mockToken);

        expect(response.isError).toBe(true);
    });
});
