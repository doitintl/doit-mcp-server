import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
  DOIT_API_BASE,
} from "../utils/util.js";

// Schema definitions
export const ReportsArgumentsSchema = z.object({
  // No required parameters based on the API documentation
});

// Interfaces
export interface Report {
  id: string;
  reportName: string;
  owner: string;
  type: string;
  createTime: number;
  updateTime: number;
  urlUI: string;
}

export interface ReportsResponse {
  rowCount: number;
  reports: Report[];
}

// Tool metadata
export const reportsTool = {
  name: "list_reports",
  description: "Lists Cloud Analytics reports that your account has access to",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

// Format a report for display
export function formatReport(report: Report): string {
  const createDate = new Date(report.createTime).toLocaleString();
  const updateDate = new Date(report.updateTime).toLocaleString();

  return [
    `ID: ${report.id}`,
    `Name: ${report.reportName}`,
    `Owner: ${report.owner}`,
    `Type: ${report.type}`,
    `Created: ${createDate}`,
    `Updated: ${updateDate}`,
    `URL: ${report.urlUI}`,
    "-----------",
  ].join("\n");
}

// Handle the reports request
export async function handleReportsRequest(args: any, token: string) {
  try {
    // Validate arguments (though there are none required for this endpoint)
    ReportsArgumentsSchema.parse(args);

    // Create API URL
    const reportsUrl = `${DOIT_API_BASE}/analytics/v1/reports`;

    try {
      const reportsData = await makeDoitRequest<ReportsResponse>(
        reportsUrl,
        token
      );

      if (!reportsData) {
        return createErrorResponse("Failed to retrieve reports data");
      }

      const reports = reportsData.reports || [];
      const rowCount = reportsData.rowCount || 0;

      if (reports.length === 0) {
        return createErrorResponse("No reports found");
      }

      const formattedReports = reports.map(formatReport);

      let reportsText = `Found ${rowCount} reports:`;
      reportsText += `\n\n${formattedReports.join("\n")}`;

      return createSuccessResponse(reportsText);
    } catch (error) {
      return handleGeneralError(error, "making DoiT API request");
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(formatZodError(error));
    }
    return handleGeneralError(error, "handling reports request");
  }
}
