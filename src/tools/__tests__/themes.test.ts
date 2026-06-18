import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    getThemeTool,
    handleGetThemeRequest,
    handleListThemesRequest,
    listThemesTool,
    THEMES_BASE_URL,
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
