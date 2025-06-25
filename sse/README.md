# DoiT MCP Server

## Connect Claude Desktop to DoiT MCP Server

To connect to the DoiT MCP server from Claude Desktop, follow [Anthropic's Quickstart](https://modelcontextprotocol.io/quickstart/user) and within Claude Desktop go to Settings > Developer > Edit Config.

Update with this configuration:

```json
{
  "mcpServers": {
    "doit-mcp-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.doit.com/sse",
        "--header",
        "Authorization: Bearer ${DOIT_API_TOKEN}"
      ]
    }
  }
}
```

Restart Claude and you should see the DoiT tools become available.

## Deploy with Yarn

```bash
yarn install
yarn deploy
```

## Only for Doers

Add customer context:

```bash
https://mcp.doit.com/sse?customerContext=${customer_id}
```
