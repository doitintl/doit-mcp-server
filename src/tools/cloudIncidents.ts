import { z } from "zod";
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

export const CLOUD_INCIDENTS_BASE_URL = `${DOIT_API_BASE}/core/v1/cloudincidents`;

// Define known platforms enum
export enum KnownIssuePlatforms {
    AWS = "amazon-web-services",
    GoogleCloud = "google-cloud",
}

// Valid filter keys for cloud incidents
export enum CloudIncidentFilterKeys {
    Platform = "platform",
    Status = "status",
    Product = "product",
}

// Schema definitions
export const CloudIncidentsArgumentsSchema = z.object({
    platform: z
        .union([z.nativeEnum(KnownIssuePlatforms), z.literal("google-cloud-project")])
        .optional()
        .describe(
            "Platform constraint: amazon-web-services or google-cloud. Legacy google-cloud-project is normalized to google-cloud. If filter also contains platform, it must specify this same single platform."
        ),
    filter: z
        .string()
        .optional()
        .describe(
            "Exact filters in format key:value|key:value. Keys: platform (amazon-web-services or google-cloud), status (active or archived), product. Different keys use AND; repeated values of one key use OR. Only one key may repeat. Example: platform:google-cloud|status:active."
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Token for pagination, from a previous response; returns the next page of results."),
});

export const CloudIncidentArgumentsSchema = z
    .object({
        id: z
            .union([z.string(), z.number()])
            .transform((v) => String(v))
            .optional()
            .describe("The ID of the cloud incident."),
        title: z
            .string()
            .optional()
            .describe(
                "Case-insensitive partial title lookup in the 200 most recent incidents only. Multiple matches return an ambiguity error. ID takes precedence."
            ),
    })
    .refine((d) => d.id || d.title, { message: "Either id or title must be provided." });

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
    pageToken?: string | null;
    incidents: CloudIncident[];
}

// Tool metadata
export const cloudIncidentsTool = {
    name: "get_cloud_incidents",
    title: "List cloud incidents",
    coversEndpoint: "get:/core/v1/cloudincidents",
    description:
        "Use this when the user wants to check for active cloud platform outages, service disruptions, or incidents from AWS or Google Cloud. Both active and archived incidents are included unless status is filtered. Do NOT use this for cost anomalies (use get_anomalies) or support tickets (use list_tickets).",
    inputSchema: zodToMcpInputSchema(CloudIncidentsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Checking cloud incidents...",
        "openai/toolInvocation/invoked": "Incidents loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export const cloudIncidentTool = {
    name: "get_cloud_incident",
    title: "Get cloud incident",
    coversEndpoint: "get:/core/v1/cloudincidents/{id}",
    description:
        "Use this when the user wants to view details of a specific cloud platform incident. Accepts either the incident ID or a partial title match (case-insensitive). Do NOT use this for listing all incidents (use get_cloud_incidents) or anomalies (use get_anomalies).",
    inputSchema: zodToMcpInputSchema(CloudIncidentArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading incident details...",
        "openai/toolInvocation/invoked": "Incident details loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
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
        const filters = filter ? filter.split("|") : [];
        const platformValue = platform === "google-cloud-project" ? "google-cloud" : platform;
        const platformFilters = filters.filter((part) => part.startsWith("platform:"));
        if (platformValue) {
            if (
                platformFilters.some(
                    (part) =>
                        part !== `platform:${platformValue}` &&
                        !(platformValue === "google-cloud" && part === "platform:google-cloud-project")
                )
            ) {
                return createErrorResponse(
                    "platform conflicts with filter; use a single matching platform or omit platform to use the filter's OR values."
                );
            }
            if (platformFilters.length === 0) filters.push(`platform:${platformValue}`);
        }
        const counts = new Map<string, number>();
        for (const part of filters) {
            const [key, value, extra] = part.split(":");
            if (
                !Object.values(CloudIncidentFilterKeys).includes(key as CloudIncidentFilterKeys) ||
                !value ||
                extra !== undefined
            ) {
                return createErrorResponse(
                    "Incident filters must use platform, status or product in key:value format."
                );
            }
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        if ([...counts.values()].filter((count) => count > 1).length > 1) {
            return createErrorResponse("Only one incident filter key may repeat (OR).");
        }
        if (filters.length) params.append("filter", filters.join("|"));
        if (pageToken) {
            params.append("pageToken", pageToken);
        }

        let incidentsUrl = CLOUD_INCIDENTS_BASE_URL;
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

            const incidents = incidentsData.incidents || [];

            return createSuccessResponse(
                JSON.stringify({
                    rowCount: incidents.length,
                    incidents,
                    pageToken: incidentsData.pageToken ?? null,
                })
            );
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
        const parsed = CloudIncidentArgumentsSchema.parse(args);
        const { customerContext } = args;
        let resolvedId = parsed.id;

        if (!resolvedId && parsed.title) {
            const listData = await makeDoitRequest<CloudIncidentsResponse>(
                `${CLOUD_INCIDENTS_BASE_URL}?maxResults=200`,
                token,
                {
                    method: "GET",
                    customerContext,
                }
            );
            const items = (listData?.incidents ?? []).map((i) => ({ ...i, name: i.title }));
            const result = matchByName(items, parsed.title, "name");
            if ("error" in result) return createErrorResponse(result.error);
            // (multiple match case now handled as error by matchByName)
            resolvedId = result.resolved;
        }

        const incidentUrl = `${CLOUD_INCIDENTS_BASE_URL}/${encodeURIComponent(resolvedId as string)}`;

        try {
            // Explicitly set appendParams to true to ensure URL parameters are added
            const incident = await makeDoitRequest<CloudIncident>(incidentUrl, token, {
                method: "GET",
                appendParams: true,
                customerContext,
            });

            if (!incident) {
                return createErrorResponse(`Failed to retrieve cloud incident with ID: ${resolvedId}`);
            }

            return createSuccessResponse(JSON.stringify(incident));
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
