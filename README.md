# DoiT MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![NPM Version](https://img.shields.io/npm/v/%40doitintl%2Fdoit-mcp-server?registry_uri=https%3A%2F%2Fregistry.npmjs.com%2F%40doitintl%2Fdoit-mcp-server)

DoiT MCP Server provides access to the DoiT API. This server enables LLMs like Claude to access DoiT platform data for troubleshooting and analysis.

![top-services](https://github.com/user-attachments/assets/749dd237-3021-439d-b447-64605393389d)

## Requirements

- Node.js v18 or higher
- DoiT API key with appropriate permissions

## Installation

To get your DoiT API key, visit the [API key section in your DoiT profile](https://help.doit.com/docs/general/profile#api-key).

There are several ways to install and configure the MCP server:

### DoiT MCP URL

The DoiT MCP server is available at: https://mcp.doit.com/sse

### Claude Desktop App

```json
{
  "mcpServers": {
    "doit_mcp_server": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.doit.com/sse"]
    }
  }
}
```

## STDIO - local server

### Claude Desktop App

To manually configure the MCP server for Claude Desktop App, add the following to your `claude_desktop_config.json` file or through "Settings" as described [here](https://modelcontextprotocol.io/quickstart/user#2-add-the-filesystem-mcp-server):

```json
{
  "mcpServers": {
    "doit_mcp_server": {
      "command": "npx",
      "args": ["-y", "@doitintl/doit-mcp-server@latest"],
      "env": {
        "DOIT_API_KEY": "your_doit_api_key"
      }
    }
  }
}
```

Make sure to replace the environment variables with your actual values:

- `DOIT_API_KEY`: Your DoiT API key with appropriate permissions
- `CUSTOMER_CONTEXT`: Your customer context identifier (optional) - Required for Do’ers

NOTE: you need to [restart Claude for Desktop](https://modelcontextprotocol.io/quickstart/user#3-restart-claude) after updating the configuration for changes to take effect.

### Cursor

Don't forget to replace the `env` values in that command with your actual values.

If you have the latest version (v0.47 and above) of Cursor, you can create an `mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "doit_mcp_server": {
      "command": "npx",
      "args": ["-y", "@doitintl/doit-mcp-server@latest"],
      "env": {
        "DOIT_API_KEY": "your_doit_api_key"
      }
    }
  }
}
```

### Clone to Local Repository

If you want to clone and run this MCP server directly from the source code, follow these steps:

1. **Clone the repository**

```bash
git clone https://github.com/doitintl/doit-mcp-server
cd doit-mcp-server
```

2. **Install dependencies**

```bash
yarn install
```

3. **Build the project**

```bash
yarn build
```

5. **Run the server**

```bash
node dist/index.js
```

## Tools

This MCP server provides the following tools:

- [`get_cloud_incidents`](https://developer.doit.com/reference/listknownissues): Retrieve cloud incidents from various platforms
- [`get_cloud_incident`](https://developer.doit.com/reference/getknownissue): Get details about a specific cloud incident by ID
- [`get_anomalies`](https://developer.doit.com/reference/listanomalies): Retrieve anomalies detected in cloud resources
- [`get_anomaly`](https://developer.doit.com/reference/getanomaly): Get details about a specific anomaly by ID
- `list_reports`: Lists Cloud Analytics reports that your account has access to
- [`run_query`](https://developer.doit.com/reference/query): Runs a report query with the specified configuration without persisting it
- [`get_report_results`](https://developer.doit.com/reference/getreport): Get the results of a specific report by ID
- [`validate_user`](https://developer.doit.com/reference/validate): Validates the current API user and returns domain and email information
- [`list_dimensions`](https://developer.doit.com/reference/listdimensions): Lists Cloud Analytics dimensions that your account has access to
- [`get_dimension`](https://developer.doit.com/reference/getdimensions): Get a specific Cloud Analytics dimension by type and ID
- [`list_tickets`](https://developer.doit.com/reference/listtickets): List support tickets from DoiT using the support API
- [`create_ticket`](https://developer.doit.com/reference/createticket): Create a new support ticket in DoiT using the support API
- [`list_invoices`](https://developer.doit.com/reference/listinvoices): List all current and historical invoices for your organization from the DoiT API
- [`get_invoice`](https://developer.doit.com/reference/getinvoice): Retrieve the full details of an invoice specified by the invoice number from the DoiT API

## Usage Examples

Here are some common queries you can ask using the DoiT MCP server:

### Cost Analysis and Savings

- "What are my Flexsave savings?" - This will analyze your Flexsave cost optimization savings across your cloud accounts.
- "What are my top 3 AWS services by cost?" - This will run a Cloud Analytics query to identify your highest-spending AWS services.

### Reports and Analytics

- "List all my available reports" - This will show all Cloud Analytics reports you have access to.
- "Show me the results of my 'Monthly Cost Overview' report" - This will fetch and display results from a specific report.

### Anomaly Detection

- "What are my recent GCP anomalies?" - This will show recent cost or usage anomalies detected in your Google Cloud Platform accounts.
- "Show me details about anomaly ABC123" - This will provide detailed information about a specific anomaly.

### Invoices

- "List all my invoices" - This will show all current and historical invoices for your organization.
- "Show me details for invoice INV-2024-001" - This will provide full details for a specific invoice, including line items and payment status.

These examples demonstrate basic usage patterns. You can combine and modify these queries based on your needs. The MCP server will interpret your natural language queries and use the appropriate tools to fetch the requested information.

## Environment Variables

- `DOIT_API_KEY`: Your DoiT API key (required)
- `CUSTOMER_CONTEXT`: Your customer context identifier (optional)
