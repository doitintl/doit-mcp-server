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
  filter: z
    .string()
    .optional()
    .describe(
      "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. Example: 'type:billing|owner:john@example.com'"
    ),
});

// Run Query Schema Definition
export const RunQueryArgumentsSchema = z.object({
  config: z
    .record(z.any())
    .describe(
      "The configuration for the query, including dimensions, metrics, filters, etc."
    ),
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

export interface QueryResult {
  schema: Array<{
    name: string;
    type: string;
  }>;
  rows: Array<Array<any>>;
  cacheHit: boolean;
}

export interface QueryResponse {
  result: QueryResult;
  error?: string;
}

// Tool metadata
export const reportsTool = {
  name: "list_reports",
  description: "Lists Cloud Analytics reports that your account has access to",
  inputSchema: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description:
          "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. Example: 'type:billing|owner:john@example.com'",
      },
    },
  },
};

export const runQueryTool = {
  name: "run_query",
  description: `Runs a report query with the specified configuration without persisting it. 
    Fields that are not populated will use their default values if needed.
    Use the dimension tool before running the query to get the list of dimensions and their types.`,
  inputSchema: {
    type: "object",
    properties: {
      config: {
        type: "object",
        description:
          "The configuration for the query, including dimensions, metrics, filters, etc.",
        properties: {
          metric: {
            type: "object",
            description: "The metric to apply (e.g., cost, usage, savings)",
            properties: {
              type: {
                type: "string",
                enum: ["basic", "custom", "extended"],
              },
              value: {
                type: "string",
                description:
                  "For basic metrics: 'cost', 'usage', or 'savings'. For custom metrics, the value must refer to an existing custom id.",
              },
            },
          },
          metricFilter: {
            type: "object",
            description:
              "The metric filter to limit the report results by value",
            properties: {
              metric: {
                type: "object",
                description: "Metric definition",
                properties: {
                  type: {
                    type: "string",
                    enum: ["basic", "custom", "extended"],
                  },
                  value: { type: "string" },
                },
              },
              operator: {
                type: "string",
                enum: ["gt", "lt", "lte", "gte", "b", "nb", "e", "ne"],
                description:
                  "Filter operator: gt (greater than), lt (less than), etc.",
              },
              values: {
                type: "array",
                items: { type: "number" },
                description: "Values to filter by",
              },
            },
          },
          aggregation: {
            type: "string",
            enum: ["total", "percent_total", "percent_col", "percent_row"],
            description: "How to aggregate the metric values",
          },
          timeInterval: {
            type: "string",
            enum: [
              "hour",
              "day",
              "dayCumSum",
              "week",
              "isoweek",
              "month",
              "quarter",
              "year",
              "week_day",
            ],
            description: "Time interval for the report",
          },
          dimensions: {
            type: "array",
            description: "Dimensions to include in the report",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
              },
            },
          },
          timeRange: {
            type: "object",
            description: "The time range for the report",
            properties: {
              amount: { type: "number" },
              includeCurrent: { type: "boolean" },
              mode: { type: "string", enum: ["last", "latest", "custom"] },
              unit: {
                type: "string",
                enum: ["day", "week", "month", "quarter", "year"],
              },
            },
          },
          includePromotionalCredits: {
            type: "boolean",
            description:
              "Whether to include promotional credits. If true, timeInterval must be month, quarter, or year.",
          },
          includeSubtotals: {
            type: "boolean",
            description: "Whether to include subgroup totals",
          },
          filters: {
            type: "array",
            description: "Filters to apply to the report",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "The field to filter on" },
                type: {
                  type: "string",
                  enum: [
                    "datetime",
                    "fixed",
                    "optional",
                    "label",
                    "tag",
                    "project_label",
                    "system_label",
                    "attribution",
                    "attribution_group",
                    "gke",
                    "gke_label",
                  ],
                },
                inverse: {
                  type: "boolean",
                  description: "Set to true to exclude the values",
                },
                values: {
                  type: "array",
                  items: { type: "string" },
                  description: "Values to filter on",
                },
              },
            },
          },
          group: {
            type: "array",
            description:
              "The rows that appear in the tabular format of the report",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                limit: {
                  type: "object",
                  properties: {
                    metric: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        value: { type: "string" },
                      },
                    },
                    sort: { type: "string" },
                    value: { type: "number" },
                  },
                },
              },
            },
          },
          layout: {
            type: "string",
            enum: [
              "column_chart",
              "stacked_column_chart",
              "bar_chart",
              "stacked_bar_chart",
              "line_chart",
              "spline_chart",
              "area_chart",
              "area_spline_chart",
              "stacked_area_chart",
              "treemap_chart",
              "table",
              "table_heatmap",
              "table_row_heatmap",
              "table_col_heatmap",
              "csv_export",
              "sheets_export",
            ],
            description: "The visualization of the report",
          },
          displayValues: {
            type: "string",
            enum: [
              "actuals_only",
              "absolute_change",
              "percentage_change",
              "absolute_and_percentage",
            ],
            description: "How to display comparative data",
          },
          currency: {
            type: "string",
            description: "Currency code (e.g., USD)",
          },
          dataSource: {
            type: "string",
            enum: ["billing", "bqlens", "billing_datahub"],
            description: "Data source of the report",
          },
          splits: {
            type: "array",
            description: "The splits to use in the report",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                includeOrigin: { type: "boolean" },
                mode: {
                  type: "string",
                  enum: ["even", "custom", "proportional"],
                },
                targets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: { type: "string" },
                      value: { type: "number" },
                    },
                  },
                },
              },
            },
          },
          customTimeRange: {
            type: "object",
            description: "Required when the time range is set to 'custom'",
            properties: {
              from: {
                type: "string",
                format: "date-time",
                description:
                  "The start timestamp in RFC3339 format (e.g., 2024-03-10T23:00:00Z)",
              },
              to: {
                type: "string",
                format: "date-time",
                description:
                  "The end timestamp in RFC3339 format (e.g., 2024-03-12T23:00:00Z)",
              },
            },
          },
        },
      },
    },
    required: ["config"],
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

// Format query result for display
export function formatQueryResult(queryResult: QueryResult): string {
  const { schema, rows, cacheHit } = queryResult;

  // Format schema information
  const schemaInfo = schema
    .map((field) => `${field.name} (${field.type})`)
    .join(", ");

  return [
    `Query Results:`,
    `Schema: ${schemaInfo}`,
    `Cache Hit: ${cacheHit}`,
    `Rows (${rows.length} total):`,
    rows,
  ].join("\n");
}

// Handle the reports request
export async function handleReportsRequest(args: any, token: string) {
  try {
    // Validate arguments
    const { filter } = ReportsArgumentsSchema.parse(args);

    // Create API URL
    let reportsUrl = `${DOIT_API_BASE}/analytics/v1/reports`;

    // Add filter parameter if provided
    if (filter) {
      reportsUrl += `?filter=${encodeURIComponent(filter)}`;
    }

    try {
      const reportsData = await makeDoitRequest<ReportsResponse>(
        reportsUrl,
        token,
        { method: "GET" }
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

      // Create a descriptive message that includes filter information if provided
      let reportsText = `Found ${rowCount} reports`;
      if (filter) {
        reportsText += ` (filtered by: ${filter})`;
      }
      reportsText += `:`;
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

// Handle the run query request
export async function handleRunQueryRequest(args: any, token: string) {
  try {
    // Validate arguments
    const { config } = RunQueryArgumentsSchema.parse(args);

    // Create API URL for the query endpoint
    const queryUrl = `${DOIT_API_BASE}/analytics/v1/reports/query`;

    try {
      // Use enhanced makeDoitRequest for POST request
      const queryResponse = await makeDoitRequest<QueryResponse>(
        queryUrl,
        token,
        {
          method: "POST",
          body: { config },
          appendParams: true,
        }
      );

      if (!queryResponse || !queryResponse.result || queryResponse?.error) {
        return createErrorResponse(
          `Failed to run query or empty result received - ${JSON.stringify(
            queryResponse
          )}`
        );
      }

      const formattedResult = formatQueryResult(queryResponse.result);

      return createSuccessResponse(formattedResult);
    } catch (error) {
      return handleGeneralError(error, "making DoiT API query request");
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(formatZodError(error));
    }
    return handleGeneralError(error, "handling run query request");
  }
}
