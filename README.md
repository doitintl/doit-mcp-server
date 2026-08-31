# DoiT MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![NPM Version](https://img.shields.io/npm/v/%40doitintl%2Fdoit-mcp-server?registry_uri=https%3A%2F%2Fregistry.npmjs.com%2F%40doitintl%2Fdoit-mcp-server)

DoiT MCP Server provides access to the DoiT API. This server enables LLMs like Claude to access DoiT platform data for troubleshooting and analysis.

![top-services](https://github.com/user-attachments/assets/749dd237-3021-439d-b447-64605393389d)

## Authentication

How you authenticate depends on the connection method:

| Method | URL / command | Auth |
| --- | --- | --- |
| Remote (Streamable HTTP) | `https://mcp.doit.com/mcp` | OAuth — your client opens a DoiT sign-in and consent page. |
| Local (stdio) | `npx -y @doitintl/doit-mcp-server@latest` | Personal API token via `DOIT_API_KEY`. |

The legacy SSE endpoint (`https://mcp.doit.com/sse`) is deprecated and should not be used for new setups.

Your DoiT plan must include API access. Tools follow the same permissions as the [DoiT API](https://developer.doit.com/). See the [Connections](https://help.doit.com/docs/mcp/connections) guide for client-specific walkthroughs.

## Remote (Streamable HTTP)

Add a remote / HTTP MCP server with URL `https://mcp.doit.com/mcp`. When you connect, complete DoiT sign-in in the browser and select **Allow access**. Field names vary by client (`url`, `httpUrl`, or **Remote MCP server URL**).

### Claude (Desktop / web)

Add a custom connector (in Claude: **+ → Add connector → Add custom connector**). Set the remote MCP server URL to `https://mcp.doit.com/mcp`, then complete DoiT sign-in when prompted. Do not use `npx` or `mcp-remote` for this path.

### Claude Code

```bash
claude mcp add --transport http doit-mcp-server https://mcp.doit.com/mcp
```

### Cursor / VS Code

```json
{
  "mcpServers": {
    "doit_mcp_server": {
      "url": "https://mcp.doit.com/mcp"
    }
  }
}
```

### Amazon Q CLI

Add the server with `type: "http"`. Amazon Q starts the OAuth flow when you load the server (`/mcp` in a Q chat session).

```json
{
  "mcpServers": {
    "doit_mcp_server": {
      "type": "http",
      "url": "https://mcp.doit.com/mcp"
    }
  }
}
```

## Local (stdio)

Requires Node.js v18 or higher and a personal API token as `DOIT_API_KEY`. Create a token from the [Personal API tokens](https://help.doit.com/docs/general/profile/api-tokens) page in the DoiT console.

### Claude Desktop App

Add the following to `claude_desktop_config.json` or through Settings as described [here](https://modelcontextprotocol.io/quickstart/user#2-add-the-filesystem-mcp-server):

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

- `DOIT_API_KEY`: Your DoiT API token (required)
- `CUSTOMER_CONTEXT`: Customer context identifier (optional) — required for Do’ers

[Restart Claude for Desktop](https://modelcontextprotocol.io/quickstart/user#3-restart-claude) after changing the config.

### Cursor

Create an `mcp.json` file in your project root (Cursor v0.47+):

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

4. **Run the server**

```bash
DOIT_API_KEY=your_doit_api_key node dist/index.js
```

## Core package API

Applications that provide their own MCP transport can reuse the published,
transport-independent implementation:

```bash
npm install @doitintl/doit-mcp-server@latest
```

```ts
import {
    COVERED_ENDPOINTS,
    executeToolHandler,
    generateTools,
    generatedToolsOpenApiSpec,
    HAND_WRITTEN_TOOLS,
} from "@doitintl/doit-mcp-server/core";
```

The `/core` entry includes the tool and prompt definitions, generated-tool
utilities, request handling, and shared configuration APIs. It does not initialize
the stdio transport or include the Cloudflare Worker, OAuth, Durable Objects, or
widget implementation.

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

Used by the local stdio server. Remote `/mcp` connections authenticate with OAuth.

- `DOIT_API_KEY`: Your DoiT [personal API token](https://help.doit.com/docs/general/profile/api-tokens) (required for stdio)
- `CUSTOMER_CONTEXT`: Your customer context identifier (optional)
