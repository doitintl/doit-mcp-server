import { z } from "zod";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const DATAHUB_DATASETS_BASE_URL = `${DOIT_API_BASE}/datahub/v1/datasets`;

// Schema and metadata for list datahub datasets
export const ListDatahubDatasetsArgumentsSchema = z.object({});

export const listDatahubDatasetsTool = {
    name: "list_datahub_datasets",
    description:
        "Use this when the user wants to see available DataHub datasets. Returns a list of datasets with metadata. Do NOT use this for billing data (use run_query) or assets (use list_assets).",
    inputSchema: zodToMcpInputSchema(ListDatahubDatasetsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading datasets...",
        "openai/toolInvocation/invoked": "Datasets loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListDatahubDatasetsRequest(args: any, token: string) {
    try {
        ListDatahubDatasetsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest(DATAHUB_DATASETS_BASE_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve DataHub datasets");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list datahub datasets request");
    }
}

// Schema and metadata for get datahub dataset
export const GetDatahubDatasetArgumentsSchema = z.object({
    name: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Dataset name is required and cannot be empty."))
        .describe("The name of the dataset to retrieve."),
});

export const getDatahubDatasetTool = {
    name: "get_datahub_dataset",
    description:
        "Use this when the user wants to view details of a specific DataHub dataset by its ID. Returns full dataset metadata and schema. Do NOT use this for listing all datasets (use list_datahub_datasets) or cost queries (use run_query).",
    inputSchema: zodToMcpInputSchema(GetDatahubDatasetArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading dataset...",
        "openai/toolInvocation/invoked": "Dataset loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetDatahubDatasetRequest(args: any, token: string) {
    try {
        const { name } = GetDatahubDatasetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${DATAHUB_DATASETS_BASE_URL}/${encodeURIComponent(name)}`;

        const data = await makeDoitRequest(url, token, { method: "GET", customerContext });

        if (!data) {
            return createErrorResponse("Failed to retrieve DataHub dataset");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get datahub dataset request");
    }
}
