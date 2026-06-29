import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    CLOUD_DIAGRAMS_ACTIVITY_URL,
    CLOUD_DIAGRAMS_BASE_URL,
    CLOUD_DIAGRAMS_NODE_ACTIVITIES_URL,
    CLOUD_DIAGRAMS_SEARCH_URL,
    CLOUD_DIAGRAMS_STATS_URL,
    CLOUD_DIAGRAMS_STATUSSHEET_URL,
    handleExportCloudDiagramJsonRequest,
    handleFindCloudDiagramsRequest,
    handleGetCloudDiagramLayerComponentsRequest,
    handleGetCloudDiagramsStatsRequest,
    handleListCloudDiagramActivityGroupsRequest,
    handleListCloudDiagramNodeActivitiesRequest,
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

describe("list_cloud_diagram_activity_groups", () => {
    const mockToken = "fake-token";

    const mockGroups = [
        {
            _id: "group-1",
            statussheet: "sheet-1",
            timestamp: "2026-04-28T00:00:00Z",
            tags: ["sync"],
            snapshot: "snap-1",
            items: [
                {
                    _id: "item-1",
                    group: "group-1",
                    activity: "NODE_CREATE",
                    metadata: { nodeId: "node-1" },
                    timestamp: "2026-04-28T00:00:00Z",
                    service_type: "AWS::EC2::Instance",
                },
            ],
        },
    ];

    it("should call makeDoitRequest with ss_id query param and return groups", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroups);

        const response = await handleListCloudDiagramActivityGroupsRequest({ ss_id: "sheet-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUD_DIAGRAMS_ACTIVITY_URL}?ss_id=sheet-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]._id).toBe("group-1");
        expect(parsed[0].items[0].activity).toBe("NODE_CREATE");
    });

    it("should append limit, offset and repeated tags query params", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroups);

        await handleListCloudDiagramActivityGroupsRequest(
            { ss_id: "sheet-1", limit: 5, offset: 10, tags: ["sync", "import"], customerContext: "customer-123" },
            mockToken
        );

        const calledUrl = (makeDoitRequest as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(calledUrl).toContain("ss_id=sheet-1");
        expect(calledUrl).toContain("limit=5");
        expect(calledUrl).toContain("offset=10");
        expect(calledUrl).toContain("tags=sync");
        expect(calledUrl).toContain("tags=import");
        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListCloudDiagramActivityGroupsRequest({ ss_id: "sheet-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("activity groups") }],
            isError: true,
        });
    });

    it("should return error when ss_id is missing", async () => {
        const response = await handleListCloudDiagramActivityGroupsRequest({}, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("ss_id");
    });
});

describe("list_cloud_diagram_node_activities", () => {
    const mockToken = "fake-token";

    const mockActivities = [
        {
            _id: "act-1",
            activity: "NODE_UPDATE",
            metadata: { field: "name" },
            timestamp: "2026-04-28T00:00:00Z",
            user: "user-1",
            statussheet: "sheet-1",
        },
    ];

    it("should call makeDoitRequest with ss_id and nodeId query params and return activities", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockActivities);

        const response = await handleListCloudDiagramNodeActivitiesRequest(
            { ss_id: "sheet-1", nodeId: "node-1" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUD_DIAGRAMS_NODE_ACTIVITIES_URL}?ss_id=sheet-1&nodeId=node-1`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]._id).toBe("act-1");
        expect(parsed[0].user).toBe("user-1");
    });

    it("should append limit and offset query params and pass customerContext", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockActivities);

        await handleListCloudDiagramNodeActivitiesRequest(
            { ss_id: "sheet-1", nodeId: "node-1", limit: 25, offset: 5, customerContext: "customer-123" },
            mockToken
        );

        const calledUrl = (makeDoitRequest as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(calledUrl).toContain("ss_id=sheet-1");
        expect(calledUrl).toContain("nodeId=node-1");
        expect(calledUrl).toContain("limit=25");
        expect(calledUrl).toContain("offset=5");
        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListCloudDiagramNodeActivitiesRequest(
            { ss_id: "sheet-1", nodeId: "node-1" },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("node activities") }],
            isError: true,
        });
    });

    it("should return error when nodeId is missing", async () => {
        const response = await handleListCloudDiagramNodeActivitiesRequest({ ss_id: "sheet-1" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("nodeId");
    });
});

describe("export_cloud_diagram_json", () => {
    const mockToken = "fake-token";

    const mockExport = {
        statussheet: { _id: "layer-1" },
        metadata: { user: "alice@example.com", date: "2026-06-29T00:00:00Z", version: "1" },
        nodes: [{ _id: "node-1", name: "EC2" }],
    };

    it("should call makeDoitRequest with the export-json URL and return the export", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockExport);

        const response = await handleExportCloudDiagramJsonRequest({ id: "layer-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/layer-1/export-json`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.statussheet._id).toBe("layer-1");
        expect(parsed.nodes[0]._id).toBe("node-1");
    });

    it("should url-encode the layer id and pass customerContext", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockExport);

        await handleExportCloudDiagramJsonRequest({ id: "layer/1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/layer%2F1/export-json`,
            mockToken,
            { method: "GET", customerContext: "customer-123" }
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleExportCloudDiagramJsonRequest({ id: "layer-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("export cloud diagram") }],
            isError: true,
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleExportCloudDiagramJsonRequest({ id: "" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("A layer ID is required") }],
            isError: true,
        });
    });
});

describe("get_cloud_diagram_layer_components", () => {
    const mockToken = "fake-token";

    const mockComponents = {
        node: { "node-1": { _id: "node-1", name: "EC2", cld_type: "AWS" } },
    };

    it("should POST only the provided component lists and return components", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockComponents);

        const response = await handleGetCloudDiagramLayerComponentsRequest(
            { id: "layer-1", node: ["node-1"] },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUD_DIAGRAMS_STATUSSHEET_URL}/layer-1/get`, mockToken, {
            method: "POST",
            body: { node: ["node-1"] },
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.node["node-1"].name).toBe("EC2");
    });

    it("should append the projection query and pass customerContext", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockComponents);

        await handleGetCloudDiagramLayerComponentsRequest(
            { id: "layer-1", node: ["node-1"], element: ["el-1"], p: "name color", customerContext: "customer-123" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/layer-1/get?p=name%20color`,
            mockToken,
            { method: "POST", body: { node: ["node-1"], element: ["el-1"] }, customerContext: "customer-123" }
        );
    });

    it("should return error when no component lists are provided", async () => {
        const response = await handleGetCloudDiagramLayerComponentsRequest({ id: "layer-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("At least one list of component IDs") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetCloudDiagramLayerComponentsRequest(
            { id: "layer-1", node: ["node-1"] },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("cloud diagram layer components") }],
            isError: true,
        });
    });
});
