import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    LABEL_ASSIGNMENT_OBJECT_TYPE_VALUES,
    LABEL_COLOR_VALUES,
    LABEL_SORT_BY_VALUES,
    LABEL_SORT_ORDER_VALUES,
} from "../../types/labels.js";
import { makeDoitRequest } from "../../utils/util.js";
import {
    assignObjectsToLabelTool,
    createLabelTool,
    DEFAULT_MAX_RESULTS_LABELS,
    getLabelAssignmentsTool,
    handleAssignObjectsToLabelRequest,
    handleCreateLabelRequest,
    handleGetLabelAssignmentsRequest,
    handleGetLabelRequest,
    handleListLabelsRequest,
    handleUpdateLabelRequest,
    LABELS_BASE_URL,
    listLabelsTool,
    updateLabelTool,
} from "../labels.js";

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

describe("listLabelsTool metadata", () => {
    it("should include sortBy accepted values in description", () => {
        const sortByProp = listLabelsTool.inputSchema.properties?.sortBy as { description: string };
        for (const value of LABEL_SORT_BY_VALUES) {
            expect(sortByProp.description).toContain(value);
        }
    });

    it("should include sortOrder accepted values in description", () => {
        const sortOrderProp = listLabelsTool.inputSchema.properties?.sortOrder as { description: string };
        for (const value of LABEL_SORT_ORDER_VALUES) {
            expect(sortOrderProp.description).toContain(value);
        }
    });
});

describe("labels", () => {
    const mockToken = "fake-token";

    const mockLabel = {
        id: "label-1",
        name: "Engineering",
        color: "blue",
        type: "custom",
        createTime: "2026-01-01T00:00:00.000Z",
        updateTime: "2026-01-02T00:00:00.000Z",
    };

    it("should call makeDoitRequest with base URL and return labels in response", async () => {
        const mockApiResponse = { pageToken: "", rowCount: 1, labels: [mockLabel] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListLabelsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${LABELS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_LABELS}`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.labels).toHaveLength(1);
        expect(parsed.labels[0].id).toBe("label-1");
        expect(parsed.labels[0].name).toBe("Engineering");
        expect(parsed.labels[0].color).toBe("blue");
        expect(parsed.rowCount).toBe(1);
    });

    it("should append all query params when provided", async () => {
        const mockApiResponse = { pageToken: "next", rowCount: 1, labels: [mockLabel] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListLabelsRequest(
            {
                maxResults: "10",
                pageToken: "token-1",
                filter: "name:test",
                sortBy: "name",
                sortOrder: "asc",
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${LABELS_BASE_URL}?maxResults=10&pageToken=token-1&filter=name%3Atest&sortBy=name&sortOrder=asc`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.labels).toHaveLength(1);
        expect(parsed.pageToken).toBe("next");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
            pageToken: "",
            rowCount: 1,
            labels: [mockLabel],
        });

        await handleListLabelsRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${LABELS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_LABELS}`,
            mockToken,
            {
                method: "GET",
                customerContext: "customer-123",
            }
        );
    });

    it("should include createTime and updateTime when present in response", async () => {
        const mockApiResponse = { pageToken: "", rowCount: 1, labels: [mockLabel] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListLabelsRequest({}, mockToken);

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.labels[0].createTime).toBe("2026-01-01T00:00:00.000Z");
        expect(parsed.labels[0].updateTime).toBe("2026-01-02T00:00:00.000Z");
    });

    it("should handle labels without createTime and updateTime", async () => {
        const labelWithoutTimes = { id: "label-2", name: "Finance", color: "teal", type: "preset" };
        const mockApiResponse = { pageToken: "", rowCount: 1, labels: [labelWithoutTimes] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListLabelsRequest({}, mockToken);

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.labels).toHaveLength(1);
        expect(parsed.labels[0].id).toBe("label-2");
        expect(parsed.labels[0].name).toBe("Finance");
        expect(parsed.labels[0]).not.toHaveProperty("createTime");
        expect(parsed.labels[0]).not.toHaveProperty("updateTime");
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListLabelsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("labels") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListLabelsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("get_label", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with label ID in URL and return label data", async () => {
        const mockLabel = {
            id: "label-1",
            name: "Engineering",
            color: "blue",
            type: "custom",
            createTime: "2026-01-01T00:00:00.000Z",
            updateTime: "2026-01-02T00:00:00.000Z",
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockLabel);

        const response = await handleGetLabelRequest({ id: "label-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("label-1");
        expect(parsed.name).toBe("Engineering");
        expect(parsed.color).toBe("blue");
        expect(parsed.type).toBe("custom");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        const mockLabel = { id: "label-1", name: "Engineering", color: "blue", type: "custom" };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockLabel);

        await handleGetLabelRequest({ id: "label-1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-1`, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetLabelRequest({ id: "label-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("label") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetLabelRequest({ id: "label-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleGetLabelRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Either id or name must be provided") }],
            isError: true,
        });
    });

    it("should return error when id is an empty string", async () => {
        const response = await handleGetLabelRequest({ id: "" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
    });

    it("should return error when id is only whitespace", async () => {
        const response = await handleGetLabelRequest({ id: "   " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
    });
});

describe("createLabelTool metadata", () => {
    it("should include color accepted values in description", () => {
        const colorProp = createLabelTool.inputSchema.properties?.color as { description: string };
        for (const value of LABEL_COLOR_VALUES) {
            expect(colorProp.description).toContain(value);
        }
    });
});

describe("create_label", () => {
    const mockToken = "fake-token";
    const validArgs = { name: "New Label", color: "teal" as const };

    it("should call makeDoitRequest with POST and correct body", async () => {
        const mockResponse = { id: "label-new", name: "New Label", color: "teal", type: "custom" };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleCreateLabelRequest(validArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(LABELS_BASE_URL, mockToken, {
            method: "POST",
            body: { name: "New Label", color: "teal" },
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("label-new");
        expect(parsed.name).toBe("New Label");
        expect(parsed.color).toBe("teal");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "label-new" });

        await handleCreateLabelRequest({ ...validArgs, customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(LABELS_BASE_URL, mockToken, {
            method: "POST",
            body: { name: "New Label", color: "teal" },
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleCreateLabelRequest(validArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("label") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleCreateLabelRequest(validArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should reject when name is missing", async () => {
        const response = await handleCreateLabelRequest({ color: "blue" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
    });

    it("should reject empty string name", async () => {
        const response = await handleCreateLabelRequest({ name: "", color: "blue" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("String must contain at least 1 character") }],
            isError: true,
        });
    });

    it("should reject when color is missing", async () => {
        const response = await handleCreateLabelRequest({ name: "Test" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
    });

    it("should reject invalid color value", async () => {
        const response = await handleCreateLabelRequest({ name: "Test", color: "red" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid") }],
            isError: true,
        });
    });
});

describe("updateLabelTool metadata", () => {
    it("should include color accepted values in description", () => {
        const colorProp = updateLabelTool.inputSchema.properties?.color as { description: string };
        for (const value of LABEL_COLOR_VALUES) {
            expect(colorProp.description).toContain(value);
        }
    });
});

describe("update_label", () => {
    const mockToken = "fake-token";
    const validUpdateArgs = { id: "label-123", name: "Updated Name" };

    it("should call makeDoitRequest with PATCH, correct URL, and body without id", async () => {
        const mockResponse = { id: "label-123", name: "Updated Name", color: "blue", type: "custom" };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleUpdateLabelRequest(validUpdateArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-123`, mockToken, {
            method: "PATCH",
            body: { name: "Updated Name" },
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("label-123");
        expect(parsed.name).toBe("Updated Name");
    });

    it("should update only color when name is not provided", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "label-123", color: "purple" });

        await handleUpdateLabelRequest({ id: "label-123", color: "purple" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-123`, mockToken, {
            method: "PATCH",
            body: { color: "purple" },
            customerContext: undefined,
        });
    });

    it("should accept null for name", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "label-123", name: null });

        await handleUpdateLabelRequest({ id: "label-123", name: null }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-123`, mockToken, {
            method: "PATCH",
            body: { name: null },
            customerContext: undefined,
        });
    });

    it("should accept null for color", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "label-123", color: null });

        await handleUpdateLabelRequest({ id: "label-123", color: null }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-123`, mockToken, {
            method: "PATCH",
            body: { color: null },
            customerContext: undefined,
        });
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "label-123" });

        await handleUpdateLabelRequest({ ...validUpdateArgs, customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-123`, mockToken, {
            method: "PATCH",
            body: { name: "Updated Name" },
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleUpdateLabelRequest(validUpdateArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("label") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleUpdateLabelRequest(validUpdateArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should reject when id is missing", async () => {
        const response = await handleUpdateLabelRequest({ name: "Updated" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
    });

    it("should reject empty string id", async () => {
        const response = await handleUpdateLabelRequest({ id: "", name: "Updated" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Label ID is required and cannot be empty") }],
            isError: true,
        });
    });

    it("should reject whitespace-only id", async () => {
        const response = await handleUpdateLabelRequest({ id: "   ", name: "Updated" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Label ID is required and cannot be empty") }],
            isError: true,
        });
    });

    it("should reject invalid color value", async () => {
        const response = await handleUpdateLabelRequest({ id: "label-123", color: "red" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid") }],
            isError: true,
        });
    });

    it("should reject when neither name nor color is provided", async () => {
        const response = await handleUpdateLabelRequest({ id: "label-123" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("At least one of") }],
            isError: true,
        });
    });
});

describe("getLabelAssignmentsTool metadata", () => {
    it("should have correct tool name", () => {
        expect(getLabelAssignmentsTool.name).toBe("get_label_assignments");
    });
});

describe("get_label_assignments", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with label ID in URL and return assignments", async () => {
        const mockResponse = {
            assignments: [
                { objectId: "report-1", objectType: "report" },
                { objectId: "budget-1", objectType: "budget" },
            ],
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleGetLabelAssignmentsRequest({ id: "label-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-1/assignments`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.assignments).toHaveLength(2);
        expect(parsed.assignments[0].objectId).toBe("report-1");
        expect(parsed.assignments[1].objectType).toBe("budget");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ assignments: [] });

        await handleGetLabelAssignmentsRequest({ id: "label-1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-1/assignments`, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetLabelAssignmentsRequest({ id: "label-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("label assignments") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetLabelAssignmentsRequest({ id: "label-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleGetLabelAssignmentsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
    });

    it("should return error when id is empty string", async () => {
        const response = await handleGetLabelAssignmentsRequest({ id: "" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Label ID is required and cannot be empty") }],
            isError: true,
        });
    });

    it("should return error when id is whitespace only", async () => {
        const response = await handleGetLabelAssignmentsRequest({ id: "   " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Label ID is required and cannot be empty") }],
            isError: true,
        });
    });
});

describe("assignObjectsToLabelTool metadata", () => {
    it("should include objectType accepted values in description", () => {
        const schema = assignObjectsToLabelTool.inputSchema;
        const addProp = schema.properties?.add as { items?: { properties?: { objectType?: { description: string } } } };
        for (const value of LABEL_ASSIGNMENT_OBJECT_TYPE_VALUES) {
            expect(addProp.items?.properties?.objectType?.description).toContain(value);
        }
    });
});

describe("assign_objects_to_label", () => {
    const mockToken = "fake-token";
    const validArgs = {
        id: "label-1",
        add: [{ objectId: "report-1", objectType: "report" }],
    };

    it("should call makeDoitRequest with POST and correct body", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const response = await handleAssignObjectsToLabelRequest(validArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-1/assignments`, mockToken, {
            method: "POST",
            body: { add: [{ objectId: "report-1", objectType: "report" }] },
            customerContext: undefined,
            parseResponse: false,
        });

        const text = response.content[0].text;
        expect(text).toContain("Successfully");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

        await handleAssignObjectsToLabelRequest({ ...validArgs, customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "POST",
            body: { add: [{ objectId: "report-1", objectType: "report" }] },
            customerContext: "customer-123",
            parseResponse: false,
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleAssignObjectsToLabelRequest(validArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("label") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleAssignObjectsToLabelRequest(validArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should support remove array", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

        await handleAssignObjectsToLabelRequest(
            { id: "label-1", remove: [{ objectId: "budget-1", objectType: "budget" }] },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "POST",
            body: { remove: [{ objectId: "budget-1", objectType: "budget" }] },
            customerContext: undefined,
            parseResponse: false,
        });
    });

    it("should support both add and remove arrays", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

        await handleAssignObjectsToLabelRequest(
            {
                id: "label-1",
                add: [{ objectId: "report-1", objectType: "report" }],
                remove: [{ objectId: "budget-1", objectType: "budget" }],
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "POST",
            body: {
                add: [{ objectId: "report-1", objectType: "report" }],
                remove: [{ objectId: "budget-1", objectType: "budget" }],
            },
            customerContext: undefined,
            parseResponse: false,
        });
    });

    it("should reject when id is missing", async () => {
        const response = await handleAssignObjectsToLabelRequest(
            { add: [{ objectId: "report-1", objectType: "report" }] },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
    });

    it("should reject when neither add nor remove is provided", async () => {
        const response = await handleAssignObjectsToLabelRequest({ id: "label-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("At least one") }],
            isError: true,
        });
    });

    it("should reject invalid objectType", async () => {
        const response = await handleAssignObjectsToLabelRequest(
            { id: "label-1", add: [{ objectId: "x", objectType: "invalid" }] },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid") }],
            isError: true,
        });
    });
});
