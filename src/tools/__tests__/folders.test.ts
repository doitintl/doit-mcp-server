import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    createFolderTool,
    DEFAULT_MAX_RESULTS_FOLDERS,
    FOLDERS_BASE_URL,
    getFolderTool,
    handleCreateFolderRequest,
    handleGetFolderRequest,
    handleListFoldersRequest,
    handleUpdateFolderRequest,
    listFoldersTool,
    updateFolderTool,
} from "../folders.js";

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

describe("listFoldersTool metadata", () => {
    it("should be read-only", () => {
        expect(listFoldersTool.annotations.readOnlyHint).toBe(true);
        expect(listFoldersTool.name).toBe("list_folders");
    });
});

describe("list_folders", () => {
    const mockToken = "fake-token";

    const mockFolder = {
        id: "folder-1",
        name: "Analytics",
        description: "Cloud Analytics reports",
        parentFolderId: "root",
    };

    it("should call makeDoitRequest with base URL and return folders in response", async () => {
        const mockApiResponse = { pageToken: "", rowCount: 1, folders: [mockFolder] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListFoldersRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${FOLDERS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_FOLDERS}`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.folders).toHaveLength(1);
        expect(parsed.folders[0].id).toBe("folder-1");
        expect(parsed.folders[0].name).toBe("Analytics");
        expect(parsed.folders[0].parentFolderId).toBe("root");
        expect(parsed.rowCount).toBe(1);
    });

    it("should append maxResults and pageToken when provided", async () => {
        const mockApiResponse = { pageToken: "next", rowCount: 1, folders: [mockFolder] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListFoldersRequest({ maxResults: "10", pageToken: "token-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${FOLDERS_BASE_URL}?maxResults=10&pageToken=token-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.pageToken).toBe("next");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
            pageToken: "",
            rowCount: 1,
            folders: [mockFolder],
        });

        await handleListFoldersRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${FOLDERS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_FOLDERS}`,
            mockToken,
            {
                method: "GET",
                customerContext: "customer-123",
            }
        );
    });

    it("should handle folders without optional fields", async () => {
        const minimalFolder = { id: "folder-2", name: "Archive" };
        const mockApiResponse = { pageToken: "", rowCount: 1, folders: [minimalFolder] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListFoldersRequest({}, mockToken);

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.folders[0].id).toBe("folder-2");
        expect(parsed.folders[0]).not.toHaveProperty("description");
        expect(parsed.folders[0]).not.toHaveProperty("parentFolderId");
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListFoldersRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("folders") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListFoldersRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("get_folder", () => {
    const mockToken = "fake-token";

    const mockFolder = {
        id: "folder-1",
        name: "Analytics",
        description: "Cloud Analytics reports",
        parentFolderId: "root",
    };

    it("should call makeDoitRequest with folder ID in URL and return folder data", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockFolder);

        const response = await handleGetFolderRequest({ id: "folder-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${FOLDERS_BASE_URL}/folder-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("folder-1");
        expect(parsed.name).toBe("Analytics");
    });

    it("should resolve folder by name when id is not provided", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ pageToken: "", rowCount: 1, folders: [mockFolder] })
            .mockResolvedValueOnce(mockFolder);

        const response = await handleGetFolderRequest({ name: "Analytics" }, mockToken);

        expect(makeDoitRequest).toHaveBeenNthCalledWith(1, `${FOLDERS_BASE_URL}?maxResults=200`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });
        expect(makeDoitRequest).toHaveBeenNthCalledWith(2, `${FOLDERS_BASE_URL}/folder-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("folder-1");
    });

    it("should return error when name matches no folder", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ pageToken: "", rowCount: 0, folders: [] });

        const response = await handleGetFolderRequest({ name: "Nonexistent" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("No items found");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockFolder);

        await handleGetFolderRequest({ id: "folder-1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${FOLDERS_BASE_URL}/folder-1`, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetFolderRequest({ id: "folder-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("folder") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetFolderRequest({ id: "folder-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when neither id nor name is provided", async () => {
        const response = await handleGetFolderRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Either id or name must be provided") }],
            isError: true,
        });
    });

    it("should return error when id is only whitespace", async () => {
        const response = await handleGetFolderRequest({ id: "   " }, mockToken);

        expect(response.isError).toBe(true);
    });

    it("should have correct tool name and be read-only", () => {
        expect(getFolderTool.name).toBe("get_folder");
        expect(getFolderTool.annotations.readOnlyHint).toBe(true);
    });
});

describe("create_folder", () => {
    const mockToken = "fake-token";

    const mockFolder = {
        id: "folder-new",
        name: "New Folder",
        description: "A new folder",
        parentFolderId: "root",
    };

    it("should call makeDoitRequest with POST and return created folder", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockFolder);

        const response = await handleCreateFolderRequest(
            { name: "New Folder", description: "A new folder" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(FOLDERS_BASE_URL, mockToken, {
            method: "POST",
            body: { name: "New Folder", description: "A new folder" },
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("folder-new");
        expect(parsed.name).toBe("New Folder");
    });

    it("should create folder with parentFolderId", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockFolder, parentFolderId: "parent-1" });

        await handleCreateFolderRequest({ name: "Sub Folder", parentFolderId: "parent-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(FOLDERS_BASE_URL, mockToken, {
            method: "POST",
            body: { name: "Sub Folder", parentFolderId: "parent-1" },
            customerContext: undefined,
        });
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockFolder);

        await handleCreateFolderRequest({ name: "New Folder", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(FOLDERS_BASE_URL, mockToken, {
            method: "POST",
            body: { name: "New Folder" },
            customerContext: "customer-123",
        });
    });

    it("should return error when name is missing", async () => {
        const response = await handleCreateFolderRequest({}, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("Invalid arguments");
    });

    it("should return error when name is empty", async () => {
        const response = await handleCreateFolderRequest({ name: "" }, mockToken);

        expect(response.isError).toBe(true);
    });

    it("should return error when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleCreateFolderRequest({ name: "New Folder" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("folder") }],
            isError: true,
        });
    });

    it("should return error when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleCreateFolderRequest({ name: "New Folder" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should not be read-only", () => {
        expect(createFolderTool.name).toBe("create_folder");
        expect(createFolderTool.annotations.readOnlyHint).toBe(false);
    });
});

describe("update_folder", () => {
    const mockToken = "fake-token";

    const mockFolder = {
        id: "folder-1",
        name: "Updated Folder",
        description: "Updated description",
        parentFolderId: "root",
    };

    it("should call makeDoitRequest with PATCH and return updated folder", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockFolder);

        const response = await handleUpdateFolderRequest({ id: "folder-1", name: "Updated Folder" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${FOLDERS_BASE_URL}/folder-1`, mockToken, {
            method: "PATCH",
            body: { name: "Updated Folder" },
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("folder-1");
        expect(parsed.name).toBe("Updated Folder");
    });

    it("should reparent folder by setting parentFolderId", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockFolder, parentFolderId: "parent-2" });

        await handleUpdateFolderRequest({ id: "folder-1", parentFolderId: "parent-2" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${FOLDERS_BASE_URL}/folder-1`, mockToken, {
            method: "PATCH",
            body: { parentFolderId: "parent-2" },
            customerContext: undefined,
        });
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockFolder);

        await handleUpdateFolderRequest(
            { id: "folder-1", name: "Updated Folder", customerContext: "customer-123" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(`${FOLDERS_BASE_URL}/folder-1`, mockToken, {
            method: "PATCH",
            body: { name: "Updated Folder" },
            customerContext: "customer-123",
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleUpdateFolderRequest({ name: "Updated" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("Required");
    });

    it("should return error when id is only whitespace", async () => {
        const response = await handleUpdateFolderRequest({ id: "   " }, mockToken);

        expect(response.isError).toBe(true);
    });

    it("should return error when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleUpdateFolderRequest({ id: "folder-1", name: "Updated Folder" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("folder") }],
            isError: true,
        });
    });

    it("should return error when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleUpdateFolderRequest({ id: "folder-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should not be read-only", () => {
        expect(updateFolderTool.name).toBe("update_folder");
        expect(updateFolderTool.annotations.readOnlyHint).toBe(false);
    });
});
