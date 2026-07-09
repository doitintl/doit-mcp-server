import { z } from "zod";
import type { ActiveTheme, CustomTheme, ThemesResponse } from "../types/themes.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
    matchByName,
} from "../utils/util.js";

export const THEMES_BASE_URL = `${DOIT_API_BASE}/analytics/v1/settings/themes`;
export const ACTIVE_THEME_URL = `${DOIT_API_BASE}/analytics/v1/settings/active-theme`;

// Schema and metadata for list themes
export const ListThemesArgumentsSchema = z.object({});

export const listThemesTool = {
    name: "list_themes",
    coversEndpoint: { method: "get", path: "/analytics/v1/settings/themes" },
    description:
        "Use this when the user wants to see the custom color themes defined for their account, which control the colors applied to Cloud Analytics reports. Returns a list of themes with their metadata. Do NOT use this for listing reports (use list_reports) or labels (use list_labels).",
    inputSchema: zodToMcpInputSchema(ListThemesArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading themes...",
        "openai/toolInvocation/invoked": "Themes loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListThemesRequest(args: any, token: string) {
    try {
        ListThemesArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<ThemesResponse>(THEMES_BASE_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve themes");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list themes request");
    }
}

// Schema and metadata for get theme
export const GetThemeArgumentsSchema = z
    .object({
        id: z
            .string()
            .transform((val) => val.trim())
            .pipe(z.string().min(1))
            .optional()
            .describe("The ID of the custom theme to retrieve."),
        name: z
            .string()
            .optional()
            .describe("Partial name match (case-insensitive). Used to find the theme when ID is unknown."),
    })
    .refine((d) => d.id || d.name, {
        message: "Either id or name must be provided.",
    });

export const getThemeTool = {
    name: "get_theme",
    coversEndpoint: { method: "get", path: "/analytics/v1/settings/themes/{id}" },
    description:
        "Use this when the user wants to view details of a specific custom color theme. Accepts either the theme ID or a partial name (case-insensitive). Do NOT use this for listing all themes (use list_themes).",
    inputSchema: {
        type: "object",
        properties: {
            id: {
                type: "string",
                description: "The ID of the custom theme to retrieve.",
            },
            name: {
                type: "string",
                description: "Partial name match (case-insensitive). Used to find the theme when ID is unknown.",
            },
        },
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading theme...",
        "openai/toolInvocation/invoked": "Theme loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetThemeRequest(args: any, token: string) {
    try {
        const parsed = GetThemeArgumentsSchema.parse(args);
        const { customerContext } = args;
        let resolvedId = parsed.id;

        if (!resolvedId && parsed.name) {
            const listData = await makeDoitRequest<ThemesResponse>(THEMES_BASE_URL, token, {
                method: "GET",
                customerContext,
            });
            const items = listData?.themes ?? [];
            const result = matchByName(items, parsed.name);
            if ("error" in result) return createErrorResponse(result.error);
            resolvedId = result.resolved;
        }

        const url = `${THEMES_BASE_URL}/${encodeURIComponent(resolvedId as string)}`;
        const data = await makeDoitRequest<CustomTheme>(url, token, {
            method: "GET",
            customerContext,
        });
        if (!data) {
            return createErrorResponse("Failed to retrieve theme");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get theme request");
    }
}

// Schema and metadata for get active theme
export const GetActiveThemeArgumentsSchema = z.object({});

export const getActiveThemeTool = {
    name: "get_active_theme",
    coversEndpoint: {
        method: "get",
        path: "/analytics/v1/settings/active-theme",
    },
    description:
        'Use this when the user wants to know which color theme is currently active for their account (the theme applied to Cloud Analytics reports). Returns the active theme id; the reserved sentinel "default" means no custom or preset theme is selected and the built-in default is in use. Do NOT use this to list all themes (use list_themes) or to fetch a specific theme by id (use get_theme).',
    inputSchema: zodToMcpInputSchema(GetActiveThemeArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading active theme...",
        "openai/toolInvocation/invoked": "Active theme loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetActiveThemeRequest(args: any, token: string) {
    try {
        GetActiveThemeArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<ActiveTheme>(ACTIVE_THEME_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve active theme");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get active theme request");
    }
}

// Schema and metadata for set active theme
export const SetActiveThemeArgumentsSchema = z.object({
    themeId: z
        .string()
        .min(1)
        .describe(
            'The ID of the theme to set as active, or the reserved sentinel "default" to revert to the built-in default (no custom theme).'
        ),
});

export const setActiveThemeTool = {
    name: "set_active_theme",
    coversEndpoint: {
        method: "put",
        path: "/analytics/v1/settings/active-theme",
    },
    description:
        'Use this when the user wants to change or activate a custom color theme for their Cloud Analytics reports. Accepts a theme ID or the sentinel "default" to revert to the built-in default. Ask the user to confirm the change before executing. Do NOT use this to retrieve the current active theme (use get_active_theme) or to update theme colors (use update_theme).',
    inputSchema: zodToMcpInputSchema(SetActiveThemeArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Setting active theme...",
        "openai/toolInvocation/invoked": "Active theme set",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleSetActiveThemeRequest(args: any, token: string) {
    try {
        const parsed = SetActiveThemeArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<ActiveTheme>(ACTIVE_THEME_URL, token, {
            method: "PUT",
            body: { themeId: parsed.themeId },
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to set active theme");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling set active theme request");
    }
}

// Schema and metadata for update theme
const ThemeColorsSchema = z.object({
    light: z.array(z.string()).describe("Array of hex color values for light mode."),
    dark: z.array(z.string()).describe("Array of hex color values for dark mode."),
});

export const UpdateThemeArgumentsSchema = z
    .object({
        id: z
            .string()
            .transform((val) => val.trim())
            .pipe(z.string().min(1))
            .optional()
            .describe("The ID of the theme to update."),
        name: z
            .string()
            .optional()
            .describe("Partial name match (case-insensitive) used to find the theme when ID is unknown."),
        newName: z.string().min(1).optional().describe("New display name for the theme."),
        primaryColor: z.string().optional().describe("New primary hex color for the theme (e.g. #1A73E8)."),
        colors: ThemeColorsSchema.optional().describe(
            "New color palette for the theme. Provide both light and dark arrays."
        ),
    })
    .refine((d) => d.id || d.name, {
        message: "Either id or name must be provided to identify the theme.",
    })
    .refine((d) => d.newName || d.primaryColor || d.colors, {
        message: "At least one of newName, primaryColor, or colors must be provided.",
    });

export const updateThemeTool = {
    name: "update_theme",
    coversEndpoint: {
        method: "patch",
        path: "/analytics/v1/settings/themes/{id}",
    },
    description:
        "Use this when the user wants to modify an existing custom color theme — rename it, change its primary color, or update its color palette. Accepts either the theme ID or a partial name match. Ask the user to confirm changes before executing. Do NOT use this for creating a new theme or changing which theme is active (use set_active_theme).",
    inputSchema: zodToMcpInputSchema(UpdateThemeArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Updating theme...",
        "openai/toolInvocation/invoked": "Theme updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleUpdateThemeRequest(args: any, token: string) {
    try {
        const parsed = UpdateThemeArgumentsSchema.parse(args);
        const { customerContext } = args;
        let resolvedId = parsed.id;

        if (!resolvedId && parsed.name) {
            const listData = await makeDoitRequest<ThemesResponse>(THEMES_BASE_URL, token, {
                method: "GET",
                customerContext,
            });
            const items = listData?.themes ?? [];
            const result = matchByName(items, parsed.name);
            if ("error" in result) return createErrorResponse(result.error);
            resolvedId = result.resolved;
        }

        const { newName, primaryColor, colors } = parsed;
        const body: Record<string, unknown> = {};
        if (newName !== undefined) body.name = newName;
        if (primaryColor !== undefined) body.primaryColor = primaryColor;
        if (colors !== undefined) body.colors = colors;

        const url = `${THEMES_BASE_URL}/${encodeURIComponent(resolvedId as string)}`;
        const data = await makeDoitRequest<CustomTheme>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to update theme");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update theme request");
    }
}
