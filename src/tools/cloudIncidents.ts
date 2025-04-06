import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
  DOIT_API_BASE,
  appendUrlParameters,
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

// Schema definitions
export const CloudIncidentsArgumentsSchema = z.object({
  platform: z.nativeEnum(KnownIssuePlatforms).optional(),
});

export const CloudIncidentArgumentsSchema = z.object({
  id: z.string(),
});

// Interfaces
export interface CloudIncident {
  id: string;
  createTime: number;
  platform: string;
  product: string;
  title: string;
  status: string;
}

export interface CloudIncidentsResponse {
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
    `Product: ${incident.product}`,
    `Title: ${incident.title}`,
    `Status: ${incident.status}`,
    `Created: ${createDate}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");
}

// Handle cloud incidents request
export async function handleCloudIncidentsRequest(args: any, token: string) {
  try {
    const { platform } = CloudIncidentsArgumentsSchema.parse(args);

    let incidentsUrl = `${DOIT_API_BASE}/core/v1/cloudincidents`;
    incidentsUrl = appendUrlParameters(incidentsUrl);

    try {
      const incidentsData = await makeDoitRequest<CloudIncidentsResponse>(
        incidentsUrl,
        token
      );

      if (!incidentsData) {
        return createErrorResponse("Failed to retrieve cloud incidents data");
      }

      let incidents = incidentsData.incidents || [];

      // Filter by platform if specified
      if (platform) {
        incidents = incidents.filter(
          (incident) =>
            incident.platform.toLowerCase() === platform.toLowerCase()
        );
      }

      if (incidents.length === 0) {
        return createErrorResponse(
          platform
            ? `No incidents found for ${platform}`
            : "No cloud incidents found"
        );
      }

      const formattedIncidents = incidents
        .map(formatCloudIncident)
        .slice(0, 20);
      const incidentsText = platform
        ? `Cloud incidents for ${platform}:\n\n${formattedIncidents.join("\n")}`
        : `Cloud incidents:\n\n${formattedIncidents.join("\n")}`;

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
    const { id } = CloudIncidentArgumentsSchema.parse(args);

    let incidentUrl = `${DOIT_API_BASE}/core/v1/cloudincidents/${id}`;

    try {
      const incident = await makeDoitRequest<CloudIncident>(incidentUrl, token);

      if (!incident) {
        return createErrorResponse(
          `Failed to retrieve cloud incident with ID: ${id}`
        );
      }

      const formattedIncident = formatCloudIncident(incident);
      return createSuccessResponse(
        `Cloud incident details:\n\n${formattedIncident}`
      );
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
