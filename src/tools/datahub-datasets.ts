import { z } from "zod";
import type { DatahubDataset, DatahubDatasetsResponse } from "../types/datahub-datasets.js";
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
        "Returns a list of all DataHub datasets for the customer. Each dataset includes its name, description, record count, last updated time, and who last updated it.",
    inputSchema: zodToMcpInputSchema(ListDatahubDatasetsArgumentsSchema),
};

export async function handleListDatahubDatasetsRequest(args: any, token: string) {
    try {
        ListDatahubDatasetsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<DatahubDatasetsResponse>(DATAHUB_DATASETS_BASE_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve datahub datasets");
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
        "Returns details of a specific DataHub dataset by its name, including description, record count, last updated time, and who last updated it.",
    inputSchema: zodToMcpInputSchema(GetDatahubDatasetArgumentsSchema),
};

export async function handleGetDatahubDatasetRequest(args: any, token: string) {
    try {
        const { name } = GetDatahubDatasetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${DATAHUB_DATASETS_BASE_URL}/${encodeURIComponent(name)}`;

        const data = await makeDoitRequest<DatahubDataset>(url, token, { method: "GET", customerContext });

        if (!data) {
            return createErrorResponse("Failed to retrieve datahub dataset");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get datahub dataset request");
    }
}
