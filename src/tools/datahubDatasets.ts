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

export const DATASET_NAME_PATTERN = /^[a-zA-Z0-9_-]+( [a-zA-Z0-9_-]+)*$/;

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
        "Returns details of a specific DataHub dataset by its name, including description, record count, last updated time, and who last updated it.",
    inputSchema: zodToMcpInputSchema(GetDatahubDatasetArgumentsSchema),
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

// Schema and metadata for create datahub dataset
export const CreateDatahubDatasetArgumentsSchema = z.object({
    name: z
        .string()
        .transform((val) => val.trim())
        .pipe(
            z
                .string()
                .min(1, "Dataset name is required and cannot be empty.")
                .regex(
                    DATASET_NAME_PATTERN,
                    "Dataset name may only contain alphanumeric characters (0-9,a-z,A-Z), underscores (_), dashes (-), and spaces between words."
                )
        )
        .describe(
            "The name of the dataset (required). Allowed characters: alphanumeric (0-9,a-z,A-Z), underscore (_), dash (-), and spaces between words."
        ),
    description: z.string().optional().describe("An optional description for the dataset."),
});

export const createDatahubDatasetTool = {
    name: "create_datahub_dataset",
    description:
        "Creates a new DataHub dataset in the DoiT platform. A dataset requires a name and can optionally include a description.",
    inputSchema: zodToMcpInputSchema(CreateDatahubDatasetArgumentsSchema),
};

export async function handleCreateDatahubDatasetRequest(args: any, token: string) {
    try {
        const parsed = CreateDatahubDatasetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const body = { ...parsed };

        const data = await makeDoitRequest(DATAHUB_DATASETS_BASE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to create DataHub dataset");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create datahub dataset request");
    }
}

// Schema and metadata for update datahub dataset
const UpdateDatahubDatasetBaseSchema = z.object({
    name: z
        .string()
        .transform((val) => val.trim())
        .pipe(
            z
                .string()
                .min(1, "Dataset name is required and cannot be empty.")
                .regex(
                    DATASET_NAME_PATTERN,
                    "Dataset name may only contain alphanumeric characters (0-9,a-z,A-Z), underscores (_), dashes (-), and spaces between words."
                )
        )
        .describe("The name of the dataset to update (required). Used for identification; the name cannot be changed."),
    description: z
        .string()
        .optional()
        .describe("The new description for the dataset. At least one updatable field (description) must be provided."),
});

export const UpdateDatahubDatasetArgumentsSchema = UpdateDatahubDatasetBaseSchema.refine(
    (data) => data.description !== undefined,
    {
        message: "At least one updatable field must be provided. Currently only 'description' can be updated.",
    }
);

export const updateDatahubDatasetTool = {
    name: "update_datahub_dataset",
    description:
        "Updates an existing DataHub dataset in the DoiT platform. The dataset name is required to identify the dataset. Only the description can be changed; at least description must be provided.",
    inputSchema: zodToMcpInputSchema(UpdateDatahubDatasetArgumentsSchema),
};

export async function handleUpdateDatahubDatasetRequest(args: any, token: string) {
    try {
        const parsed = UpdateDatahubDatasetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const { name, ...body } = parsed;
        const url = `${DATAHUB_DATASETS_BASE_URL}/${encodeURIComponent(name)}`;

        const data = await makeDoitRequest(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to update DataHub dataset");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update datahub dataset request");
    }
}
