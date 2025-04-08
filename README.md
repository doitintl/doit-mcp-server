# DoiT MCP Server
[![smithery badge](https://smithery.ai/badge/@doitintl/doit-mcp-server)](https://smithery.ai/server/@doitintl/doit-mcp-server)

DoiT MCP Server provides access to the DoiT API. This server enables LLMs like Claude to access DoiT platform data for troubleshooting and analysis.

https://github.com/user-attachments/assets/2eacc19c-4dbf-44a5-bef2-3d9afc9005c6

## Requirements

- Node.js v18 or higher
- DoiT API key with appropriate permissions
- Customer context identifier (for customer-specific data)

## Installation

There are several ways to install and configure the MCP server:

### Installing via Smithery

To install doit-mcp-server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@doitintl/doit-mcp-server):

```bash
npx -y @smithery/cli install @doitintl/doit-mcp-server --client claude
```

### Claude Desktop App

To manually configure the MCP server for Claude Desktop App, add the following to your `claude_desktop_config.json` file (typically located in your user directory):

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
- `CUSTOMER_CONTEXT`: Your customer context identifier

### Cursor

For Cursor IDE, you can install this MCP server with the following command in your project:

```bash
env DOIT_API_KEY=[KEY] npx -y @doitintl/doit-mcp-server@latest
```

Don't forget to replace the `env` values in that command with your actual values.

If you have the latest version (v0.47 and above) of Cursor, you can create an `mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "DoiT": {
      "command": "npx",
      "args": [
        "DOIT_API_KEY=your_doit_api_key",
        "--",
        "npx",
        "-y",
        "@doitintl/doit-mcp-server@latest"
      ]
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

- `get_cloud_incidents`: Retrieve cloud incidents from various platforms
- `get_cloud_incident`: Get details about a specific cloud incident by ID
- `get_anomalies`: Retrieve anomalies detected in cloud resources
- `get_anomaly`: Get details about a specific anomaly by ID
- `list_reports`: Lists Cloud Analytics reports that your account has access to
- `run_query`: Runs a report query with the specified configuration without persisting it
- `validate_user`: Validates the current API user and returns domain and email information
- `list_dimensions`: Lists Cloud Analytics dimensions that your account has access to
- `get_dimension`: Get a specific Cloud Analytics dimension by type and ID

## Environment Variables

- `DOIT_API_KEY`: Your DoiT API key (required)
- `CUSTOMER_CONTEXT`: Your customer context identifier (required)
