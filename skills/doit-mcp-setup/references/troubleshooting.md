# Troubleshooting Reference

## Connection Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Server not appearing after config write | Client needs restart | Restart client or run `/mcp` (Claude Code) |
| "Unauthorized" after OAuth flow | OAuth token expired or revoked | Re-authorize in client UI |
| "Forbidden" on tool calls | User lacks `Billing Profiles Admin` permission | Ask DoiT admin to grant the permission |
| Tool list loads but calls fail | Session not scoped to correct customer | Call `validate_user` to confirm customer context |
| Connection timeout | Network/firewall blocking `mcp.doit.com` | Check network access to `https://mcp.doit.com/sse` |

## Config Conflicts

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Duplicate server entries | Previous setup with different key name (`doit`, `doit_mcp_server`, `doit-mcp`) | Ask user which to keep, remove duplicates |
| Mixed local + remote config | Previous stdio setup alongside new HTTP setup | Remove the stdio entry; remote OAuth is the recommended flow |
| Claude Code shows "type" error | Config missing `"type": "http"` | Claude Code requires explicit `type` field — other clients do not |
| Codex TOML parse error | JSON syntax in TOML file | Use `[mcp_servers.doit-mcp]` table syntax, not JSON |

## Client-Specific Notes

### ChatGPT
- Requires developer mode enabled first — Settings > Developer > Enable
- Needs both API key AND Customer ID during OAuth prompt
- If the connector already exists, check Settings > Apps & Connectors to update it

### Claude (web)
- Do NOT mention Customer ID — OAuth handles it
- If the connector shows "disconnected", remove and re-add it

### Claude Code
- The `"type": "http"` field is required — this is unique to Claude Code
- Project-scoped config goes under the project's `mcpServers` key, not the top-level one
- Run `/mcp` to check server status without restarting

### Cursor
- Config is per-project (`.cursor/mcp.json` in project root)
- If MCP panel shows no servers, check the file is valid JSON and restart Cursor

### Gemini CLI
- Run `/mcp auth doit-mcp` if the server requires authentication
- Config is global at `~/.gemini/settings.json`

### Codex
- Config uses TOML format, not JSON
- Alternative: `codex mcp add doit-mcp --url https://mcp.doit.com/sse`
- Run `codex mcp list` to verify registration
