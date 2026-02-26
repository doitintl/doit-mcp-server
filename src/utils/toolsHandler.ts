import { z } from "zod";
import {
    handleCreateAllocationRequest,
    handleGetAllocationRequest,
    handleListAllocationsRequest,
    handleUpdateAllocationRequest,
} from "../tools/allocations.js";
import { handleAnomaliesRequest, handleAnomalyRequest } from "../tools/anomalies.js";
import { handleListAssetsRequest } from "../tools/assets.js";
import { handleTriggerCloudFlowRequest } from "../tools/cloudflow.js";
import { handleCloudIncidentRequest, handleCloudIncidentsRequest } from "../tools/cloudIncidents.js";
import { handleDimensionRequest } from "../tools/dimension.js";
import { handleDimensionsRequest } from "../tools/dimensions.js";
import { handleGetInvoiceRequest, handleListInvoicesRequest } from "../tools/invoices.js";
import { handleGetReportResultsRequest, handleReportsRequest, handleRunQueryRequest } from "../tools/reports.js";
import { handleListTicketsRequest } from "../tools/tickets.js";
import { handleValidateUserRequest } from "../tools/validateUser.js";
import { handleGetAlertRequest, handleListAlertsRequest } from "../tools/alerts.js";
import { createErrorResponse, formatZodError, handleGeneralError } from "./util.js";

/**
 * Executes a tool handler with proper error handling
 * @param toolName - The name of the tool to execute
 * @param args - The arguments to pass to the tool handler
 * @param token - The API token to use
 * @param convertResponse - Optional function to convert the response format
 * @returns The tool execution result
 */
export async function executeToolHandler(
    toolName: string,
    args: any,
    token: string,
    convertResponse?: (response: any) => any
): Promise<any> {
    try {
        let result: any;

        switch (toolName) {
            case "get_cloud_incidents":
                result = await handleCloudIncidentsRequest(args, token);
                break;
            case "get_cloud_incident":
                result = await handleCloudIncidentRequest(args, token);
                break;
            case "get_anomalies":
                result = await handleAnomaliesRequest(args, token);
                break;
            case "get_anomaly":
                result = await handleAnomalyRequest(args, token);
                break;
            case "list_reports":
                result = await handleReportsRequest(args, token);
                break;
            case "run_query":
                result = await handleRunQueryRequest(args, token);
                break;
            case "get_report_results":
                result = await handleGetReportResultsRequest(args, token);
                break;
            case "validate_user":
                result = await handleValidateUserRequest(args, token);
                break;
            case "list_dimensions":
                result = await handleDimensionsRequest(args, token);
                break;
            case "get_dimension":
                result = await handleDimensionRequest(args, token);
                break;
            case "list_tickets":
                result = await handleListTicketsRequest(args, token);
                break;
            case "list_invoices":
                result = await handleListInvoicesRequest(args, token);
                break;
            case "get_invoice":
                result = await handleGetInvoiceRequest(args, token);
                break;
            case "list_allocations":
                result = await handleListAllocationsRequest(args, token);
                break;
            case "get_allocation":
                result = await handleGetAllocationRequest(args, token);
                break;
            case "create_allocation":
                result = await handleCreateAllocationRequest(args, token);
                break;
            case "update_allocation":
                result = await handleUpdateAllocationRequest(args, token);
                break;
            case "list_assets":
                result = await handleListAssetsRequest(args, token);
                break;
            case "trigger_cloud_flow":
                result = await handleTriggerCloudFlowRequest(args, token);
                break;
            case "list_alerts":
                result = await handleListAlertsRequest(args, token);
                break;
            case "get_alert":
                result = await handleGetAlertRequest(args, token);
                break;
            default:
                return createErrorResponse(`Unknown tool: ${toolName}`);
        }

        // Apply response conversion if provided
        return convertResponse ? convertResponse(result) : result;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertResponse ? convertResponse(errorResult) : errorResult;
        }
        const errorResult = handleGeneralError(error, "handling tool request");
        return convertResponse ? convertResponse(errorResult) : errorResult;
    }
}
