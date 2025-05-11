import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  handleCloudIncidentsRequest,
  CloudIncidentsArgumentsSchema,
  CloudIncidentArgumentsSchema,
  handleCloudIncidentRequest,
} from "./tools/cloudIncidents";
import {
  AnomaliesArgumentsSchema,
  AnomalyArgumentsSchema,
  handleAnomalyRequest,
} from "./tools/anomalies";
import { handleAnomaliesRequest } from "./tools/anomalies";
import { handleDimensionsRequest } from "./tools/dimensions";
import { DimensionsArgumentsSchema } from "./tools/dimensions";
import { handleDimensionRequest } from "./tools/dimension";
import { DimensionArgumentsSchema } from "./tools/dimension";
import {
  GetReportResultsArgumentsSchema,
  handleGetReportResultsRequest,
  handleRunQueryRequest,
  ReportsArgumentsSchema,
  RunQueryArgumentsSchema,
} from "./tools/reports";
import { handleReportsRequest } from "./tools/reports";
import { ValidateUserArgumentsSchema } from "./tools/validateUser";
import { handleValidateUserRequest } from "./tools/validateUser";

// Define the Env interface for environment variables
interface Env {
  DOIT_API_KEY: string;
  CUSTOMER_CONTEXT: string;
}

type Props = {
  bearerToken: string;
  customerContext: string;
};

// Define our MCP agent with tools
export class DoitMCP extends McpAgent<Env, Props> {
  server = new McpServer({
    name: "Doit MCP",
    version: "1.0.0",
  });

  async init() {
    this.server.tool(
      "list_cloud_incidents",
      CloudIncidentsArgumentsSchema,
      async (params) => {
        return await handleCloudIncidentsRequest(
          params,
          this.props.bearerToken as string,
          this.props.customerContext as string
        );
      }
    );

    this.server.tool(
      "get_cloud_incident",
      CloudIncidentArgumentsSchema,
      async (params) => {
        return await handleCloudIncidentRequest(
          params,
          this.props.bearerToken as string,
          this.props.customerContext as string
        );
      }
    );

    this.server.tool(
      "list_anomalies",
      AnomaliesArgumentsSchema,
      async (params) => {
        return await handleAnomaliesRequest(
          params,
          this.props.bearerToken as string,
          this.props.customerContext as string
        );
      }
    );

    this.server.tool("get_anomaly", AnomalyArgumentsSchema, async (params) => {
      return await handleAnomalyRequest(
        params,
        this.props.bearerToken as string,
        this.props.customerContext as string
      );
    });

    this.server.tool(
      "list_dimensions",
      DimensionsArgumentsSchema,
      async (params) => {
        return await handleDimensionsRequest(
          params,
          this.props.bearerToken as string,
          this.props.customerContext as string
        );
      }
    );

    this.server.tool(
      "get_dimension",
      DimensionArgumentsSchema,
      async (params) => {
        return await handleDimensionRequest(
          params,
          this.props.bearerToken as string,
          this.props.customerContext as string
        );
      }
    );

    this.server.tool("list_reports", ReportsArgumentsSchema, async (params) => {
      return await handleReportsRequest(
        params,
        this.props.bearerToken as string,
        this.props.customerContext as string
      );
    });

    this.server.tool("run_query", RunQueryArgumentsSchema, async (params) => {
      return await handleRunQueryRequest(
        params,
        this.props.bearerToken as string,
        this.props.customerContext as string
      );
    });

    this.server.tool(
      "get_report_results",
      GetReportResultsArgumentsSchema,
      async (params) => {
        return await handleGetReportResultsRequest(
          params,
          this.props.bearerToken as string,
          this.props.customerContext as string
        );
      }
    );

    this.server.tool(
      "validate_user",
      ValidateUserArgumentsSchema,
      async (params) => {
        return await handleValidateUserRequest(
          params,
          this.props.bearerToken as string,
          this.props.customerContext as string
        );
      }
    );
  }
}

// Define CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCors(response: Response) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization");

    const tokenFromEnv = env.DOIT_API_KEY;
    const tokenFromQuery = url.searchParams.get("key");
    if (!authHeader && !tokenFromEnv && !tokenFromQuery) {
      return withCors(new Response("Unauthorized", { status: 401 }));
    }

    const token = authHeader || tokenFromEnv || tokenFromQuery;

    const customerContext = url.searchParams.get("customerContext");

    ctx.props = {
      bearerToken: token,
      customerContext,
    };

    if (url.pathname.includes("/sse") || url.pathname === "/sse/message") {
      // @ts-ignore
      return withCors(await DoitMCP.serveSSE("/sse").fetch(request, env, ctx));
    }

    if (url.pathname === "/mcp") {
      // @ts-ignore
      return withCors(await DoitMCP.serve("/mcp").fetch(request, env, ctx));
    }

    return withCors(new Response("Not found", { status: 404 }));
  },
};
