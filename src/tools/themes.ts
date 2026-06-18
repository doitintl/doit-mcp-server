import { z } from "zod";
import type { CustomTheme, ThemesResponse } from "../types/themes.js";
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

// Schema and metadata for list themes
export const ListThemesArgumentsSchema = z.object({});

export const listThemesTool = {
    name: "list_themes",
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
    .refine((d) => d.id || d.name, { message: "Either id or name must be provided." });

export const getThemeTool = {
    name: "get_theme",
    description:
        "Use this when the user wants to view details of a specific custom color theme. Accepts either the theme ID or a partial name (case-insensitive). Do NOT use this for listing all themes (use list_themes).",
    inputSchema: {
        type: "object",
        properties: {
            id: { type: "string", description: "The ID of the custom theme to retrieve." },
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
        const data = await makeDoitRequest<CustomTheme>(url, token, { method: "GET", customerContext });
        if (!data) {
            return createErrorResponse("Failed to retrieve theme");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get theme request");
    }
}
