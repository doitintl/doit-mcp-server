import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    ACTIVE_THEME_URL,
    getActiveThemeTool,
    getThemeTool,
    handleGetActiveThemeRequest,
    handleGetThemeRequest,
    handleListThemesRequest,
    handleSetActiveThemeRequest,
    handleUpdateThemeRequest,
    listThemesTool,
    setActiveThemeTool,
    THEMES_BASE_URL,
    updateThemeTool,
} from "../themes.js";

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

const mockTheme = {
    id: "theme-1",
    name: "Ocean",
    primaryColor: "#1A73E8",
    colors: {
        light: ["#1A73E8", "#34A853"],
        dark: ["#0B57D0", "#1E8E3E"],
    },
    createTime: "2026-01-01T00:00:00.000Z",
    updateTime: "2026-01-02T00:00:00.000Z",
};

describe("listThemesTool metadata", () => {
    it("should be read-only and named list_themes", () => {
        expect(listThemesTool.annotations.readOnlyHint).toBe(true);
        expect(listThemesTool.name).toBe("list_themes");
    });
});

describe("list_themes", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with the base URL and return themes", async () => {
        const mockApiResponse = { rowCount: 1, themes: [mockTheme] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListThemesRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(THEMES_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.themes).toHaveLength(1);
        expect(parsed.themes[0].id).toBe("theme-1");
        expect(parsed.themes[0].name).toBe("Ocean");
        expect(parsed.themes[0].primaryColor).toBe("#1A73E8");
        expect(parsed.rowCount).toBe(1);
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0, themes: [] });

        await handleListThemesRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(THEMES_BASE_URL, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListThemesRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("themes") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListThemesRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("get_theme", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with theme ID in URL and return theme data", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockTheme);

        const response = await handleGetThemeRequest({ id: "theme-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${THEMES_BASE_URL}/theme-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.id).toBe("theme-1");
        expect(parsed.colors.light).toEqual(["#1A73E8", "#34A853"]);
    });

    it("should resolve theme by name when id is not provided", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ rowCount: 1, themes: [mockTheme] })
            .mockResolvedValueOnce(mockTheme);

        const response = await handleGetThemeRequest({ name: "Ocean" }, mockToken);

        expect(makeDoitRequest).toHaveBeenNthCalledWith(1, THEMES_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });
        expect(makeDoitRequest).toHaveBeenNthCalledWith(2, `${THEMES_BASE_URL}/theme-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.id).toBe("theme-1");
    });

    it("should return error when name matches no theme", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0, themes: [] });

        const response = await handleGetThemeRequest({ name: "Nonexistent" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("No items found");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockTheme);

        await handleGetThemeRequest({ id: "theme-1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${THEMES_BASE_URL}/theme-1`, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetThemeRequest({ id: "theme-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("theme") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetThemeRequest({ id: "theme-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when neither id nor name is provided", async () => {
        const response = await handleGetThemeRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Either id or name must be provided") }],
            isError: true,
        });
    });

    it("should return error when id is only whitespace", async () => {
        const response = await handleGetThemeRequest({ id: "   " }, mockToken);

        expect(response.isError).toBe(true);
    });

    it("should have correct tool name and be read-only", () => {
        expect(getThemeTool.name).toBe("get_theme");
        expect(getThemeTool.annotations.readOnlyHint).toBe(true);
    });
});

describe("getActiveThemeTool metadata", () => {
    it("should be read-only and named get_active_theme", () => {
        expect(getActiveThemeTool.annotations.readOnlyHint).toBe(true);
        expect(getActiveThemeTool.name).toBe("get_active_theme");
    });
});

describe("get_active_theme", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with the active-theme URL and return the active theme", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "theme-1" });

        const response = await handleGetActiveThemeRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ACTIVE_THEME_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.themeId).toBe("theme-1");
    });

    it("should return the default sentinel when no custom theme is active", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "default" });

        const response = await handleGetActiveThemeRequest({}, mockToken);

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.themeId).toBe("default");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "theme-1" });

        await handleGetActiveThemeRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ACTIVE_THEME_URL, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetActiveThemeRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("active theme") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetActiveThemeRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("setActiveThemeTool metadata", () => {
    it("should be write-only and named set_active_theme", () => {
        expect(setActiveThemeTool.annotations.readOnlyHint).toBe(false);
        expect(setActiveThemeTool.name).toBe("set_active_theme");
    });
});

describe("set_active_theme", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with PUT method and themeId in body", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "theme-1" });

        const response = await handleSetActiveThemeRequest({ themeId: "theme-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ACTIVE_THEME_URL, mockToken, {
            method: "PUT",
            body: { themeId: "theme-1" },
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.themeId).toBe("theme-1");
    });

    it("should support the default sentinel to revert to built-in default", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "default" });

        const response = await handleSetActiveThemeRequest({ themeId: "default" }, mockToken);

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.themeId).toBe("default");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "theme-1" });

        await handleSetActiveThemeRequest({ themeId: "theme-1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ACTIVE_THEME_URL, mockToken, {
            method: "PUT",
            body: { themeId: "theme-1" },
            customerContext: "customer-123",
        });
    });

    it("should return error when themeId is missing", async () => {
        const response = await handleSetActiveThemeRequest({}, mockToken);
        expect(response.isError).toBe(true);
    });

    it("should return error when themeId is empty string", async () => {
        const response = await handleSetActiveThemeRequest({ themeId: "" }, mockToken);
        expect(response.isError).toBe(true);
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleSetActiveThemeRequest({ themeId: "theme-1" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("active theme");
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleSetActiveThemeRequest({ themeId: "theme-1" }, mockToken);

        expect(response.isError).toBe(true);
    });
});

describe("updateThemeTool metadata", () => {
    it("should be destructive and named update_theme", () => {
        expect(updateThemeTool.annotations.readOnlyHint).toBe(false);
        expect(updateThemeTool.annotations.destructiveHint).toBe(true);
        expect(updateThemeTool.name).toBe("update_theme");
    });
});

describe("update_theme", () => {
    const mockToken = "fake-token";
    const mockUpdatedTheme = {
        id: "theme-1",
        name: "Ocean Updated",
        primaryColor: "#0B57D0",
        colors: {
            light: ["#0B57D0", "#34A853"],
            dark: ["#0842A0", "#1E8E3E"],
        },
        createTime: "2026-01-01T00:00:00.000Z",
        updateTime: "2026-03-01T00:00:00.000Z",
    };

    it("should call makeDoitRequest with PATCH method by id and return updated theme", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedTheme);

        const response = await handleUpdateThemeRequest({ id: "theme-1", newName: "Ocean Updated" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${THEMES_BASE_URL}/theme-1`, mockToken, {
            method: "PATCH",
            body: { name: "Ocean Updated" },
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.id).toBe("theme-1");
        expect(parsed.name).toBe("Ocean Updated");
    });

    it("should resolve theme by name when id is not provided", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ rowCount: 1, themes: [mockTheme] })
            .mockResolvedValueOnce(mockUpdatedTheme);

        const response = await handleUpdateThemeRequest({ name: "Ocean", primaryColor: "#0B57D0" }, mockToken);

        expect(makeDoitRequest).toHaveBeenNthCalledWith(1, THEMES_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });
        expect(makeDoitRequest).toHaveBeenNthCalledWith(2, `${THEMES_BASE_URL}/theme-1`, mockToken, {
            method: "PATCH",
            body: { primaryColor: "#0B57D0" },
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.id).toBe("theme-1");
    });

    it("should update colors palette when provided", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedTheme);

        const newColors = { light: ["#0B57D0"], dark: ["#0842A0"] };
        await handleUpdateThemeRequest({ id: "theme-1", colors: newColors }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${THEMES_BASE_URL}/theme-1`, mockToken, {
            method: "PATCH",
            body: { colors: newColors },
            customerContext: undefined,
        });
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedTheme);

        await handleUpdateThemeRequest(
            { id: "theme-1", newName: "New Name", customerContext: "customer-123" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(`${THEMES_BASE_URL}/theme-1`, mockToken, {
            method: "PATCH",
            body: { name: "New Name" },
            customerContext: "customer-123",
        });
    });

    it("should return error when neither id nor name is provided", async () => {
        const response = await handleUpdateThemeRequest({ newName: "X" }, mockToken);
        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("Either id or name must be provided");
    });

    it("should return error when no update fields are provided", async () => {
        const response = await handleUpdateThemeRequest({ id: "theme-1" }, mockToken);
        expect(response.isError).toBe(true);
    });

    it("should return error when name matches no theme", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0, themes: [] });

        const response = await handleUpdateThemeRequest({ name: "Nonexistent", newName: "X" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("No items found");
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleUpdateThemeRequest({ id: "theme-1", newName: "X" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("theme");
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleUpdateThemeRequest({ id: "theme-1", newName: "X" }, mockToken);

        expect(response.isError).toBe(true);
    });
});
