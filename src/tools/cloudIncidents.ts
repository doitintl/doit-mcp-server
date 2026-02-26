import { z } from "zod";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

// Define known platforms enum
export enum KnownIssuePlatforms {
    AWS = "amazon-web-services",
    GCP = "google-cloud-project",
    GSuite = "g-suite",
    Office365 = "office-365",
    GoogleCloud = "google-cloud",
    OpenAI = "open-ai",
}

// Valid filter keys for cloud incidents
export enum CloudIncidentFilterKeys {
    Platform = "platform",
    Status = "status",
    Product = "product",
}

// Schema definitions
export const CloudIncidentsArgumentsSchema = z.object({
    platform: z.nativeEnum(KnownIssuePlatforms).optional(),
    filter: z
        .string()
        .optional()
        .describe(
            "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. Example: 'platform:google-cloud|status:active'"
        ),
    pageToken: z.string().optional().describe("Token for pagination. Use this to get the next page of results."),
});

export const CloudIncidentArgumentsSchema = z.object({
    id: z.string(),
    customerContext: z.string().optional(),
});

// Interfaces
export interface CloudIncident {
    id: string;
    createTime: number;
    platform: string;
    product: string;
    title: string;
    status: string;
    summary?: string;
    description?: string;
    symptoms?: string;
    workaround?: string;
}

export interface CloudIncidentsResponse {
    pageToken: any;
    incidents: CloudIncident[];
}

// Tool metadata
export const cloudIncidentsTool = {
    name: "get_cloud_incidents",
    description: "Get cloud incidents",
    inputSchema: {
        type: "object",
        properties: {
            platform: {
                type: "string",
                description: "platform name",
                enum: Object.values(KnownIssuePlatforms),
            },
            filter: {
                type: "string",
                description:
                    "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. Example: 'platform:google-cloud|status:active' or 'platform:google-cloud|platform:amazon-web-services'",
            },
            pageToken: {
                type: "string",
                description: "Token for pagination. Use this to get the next page of results.",
            },
        },
    },
};

export const cloudIncidentTool = {
    name: "get_cloud_incident",
    description: "Get a specific cloud incident by ID",
    inputSchema: {
        type: "object",
        properties: {
            id: {
                type: "string",
                description: "incident ID",
            },
        },
        required: ["id"],
    },
};

// Format cloud incident data
export function formatCloudIncident(incident: CloudIncident): string {
    const createDate = new Date(incident.createTime).toLocaleString();

    return [
        `ID: ${incident.id}`,
        `Platform: ${incident.platform}`,
        `Product: ${incident.product || "N/A"}`,
        `Title: ${incident.title}`,
        `Status: ${incident.status}`,
        `Created: ${createDate}`,
        incident.summary ? `Summary: ${incident.summary}` : null,
        incident.description ? `Description: ${incident.description}` : null,
        incident.symptoms ? `Symptoms: ${incident.symptoms}` : null,
        incident.workaround ? `Workaround: ${incident.workaround}` : null,
        "-----------",
    ]
        .filter(Boolean)
        .join("\n");
}

// Handle cloud incidents request
export async function handleCloudIncidentsRequest(args: any, token: string) {
    try {
        const { platform, filter, pageToken } = CloudIncidentsArgumentsSchema.parse(args);
        const { customerContext } = args;

        // Create API URL with query parameters
        const params = new URLSearchParams();
        if (filter) {
            params.append("filter", filter);
        }
        if (pageToken) {
            params.append("pageToken", pageToken);
        }

        let incidentsUrl = `${DOIT_API_BASE}/core/v1/cloudincidents`;
        if (params.toString()) {
            incidentsUrl += `?${params.toString()}`;
        }

        try {
            const incidentsData = await makeDoitRequest<CloudIncidentsResponse>(incidentsUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!incidentsData) {
                return createErrorResponse("Failed to retrieve cloud incidents data");
            }

            let incidents = incidentsData.incidents || [];

            // Filter by platform if specified and not already filtered by the API
            if (platform && !filter?.includes(`platform:${platform}`)) {
                incidents = incidents.filter((incident) => incident.platform.toLowerCase() === platform.toLowerCase());
            }

            if (incidents.length === 0) {
                return createErrorResponse(
                    platform ? `No incidents found for ${platform}` : "No cloud incidents found"
                );
            }

            const formattedIncidents = incidents.map(formatCloudIncident);

            // Create a descriptive message that includes filter information if provided
            let incidentsText = "Cloud incidents";
            if (platform) {
                incidentsText += ` for ${platform}`;
            }
            if (filter) {
                incidentsText += ` (filtered by: ${filter})`;
            }

            incidentsText += `:\n\n${formattedIncidents.join("\n")} \n\n${
                incidentsData.pageToken ? `Page token: ${incidentsData.pageToken}` : ""
            }`;

            return createSuccessResponse(incidentsText);
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling cloud incidents request");
    }
}

// Handle specific cloud incident request
export async function handleCloudIncidentRequest(args: any, token: string) {
    try {
        const { id, customerContext } = CloudIncidentArgumentsSchema.parse(args);

        const incidentUrl = `${DOIT_API_BASE}/core/v1/cloudincidents/${id}`;

        try {
            // Explicitly set appendParams to true to ensure URL parameters are added
            const incident = await makeDoitRequest<CloudIncident>(incidentUrl, token, {
                method: "GET",
                appendParams: true,
                customerContext,
            });

            if (!incident) {
                return createErrorResponse(`Failed to retrieve cloud incident with ID: ${id}`);
            }

            const formattedIncident = formatCloudIncident(incident);
            return createSuccessResponse(`Cloud incident details:\n\n${formattedIncident}`);
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling cloud incident request");
    }
}
