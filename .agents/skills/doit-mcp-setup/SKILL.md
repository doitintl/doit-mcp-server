---
name: doit-mcp-setup
description: Set up the DoiT MCP server in supported clients and verify the connection flow. Use when the agent needs to configure ChatGPT, Claude, Claude Code, Codex, Cursor, or Gemini CLI for DoiT MCP access, produce the correct connection snippet, explain required credentials, or troubleshoot why a DoiT MCP client is not connecting.
---

# DoiT MCP Setup

Set up DoiT MCP clients automatically when possible. For clients with writable config files, collect the required credentials and write the config directly. For clients that require manual UI steps, guide the user through each step.

Do not invent alternate URLs, auth methods, or config keys.

## Reference Files

- `templates/` — ready-to-use config snippets for each automated client. Read and merge from these files instead of reconstructing config from prose.
- `references/troubleshooting.md` — expanded troubleshooting table with client-specific notes. Read this when the user reports a connection issue.

## Setup Flow

1. Ask the user which client to configure: ChatGPT, Claude (web), Claude Code, Codex, Cursor, or Gemini CLI.
2. Confirm the user has the `Billing Profiles Admin` permission in DoiT.
3. Determine the auth flow before asking for credentials:
   - ChatGPT: ask for the DoiT API key and DoiT Customer ID because the OAuth flow prompts for them.
   - Claude (web), Claude Code, Codex, Cursor, and Gemini CLI: use the remote OAuth flow. Do not ask for an API key up front.
4. Follow the client-specific section below.

Do not write placeholder credentials into config files.

## Automated Clients

These clients have local config files the agent can write directly. Use the template files in `templates/` as the source — read the template, merge into the existing config, and write back.

### Claude Code

Config file: `~/.claude.json`
Template: `templates/claude-code.json`

1. Read `~/.claude.json`.
2. Read `templates/claude-code.json` for the server snippet.
3. If the user wants the server available only for one project, merge the snippet into that project's `mcpServers` key. Otherwise merge it into the top-level `mcpServers` key. Preserve any existing servers.
4. Write the merged result back to `~/.claude.json`.
5. Tell the user to open the MCP UI in Claude Code and click `Authorize` for the DoiT server.
6. Tell the user to restart Claude Code or run `/mcp` if the server does not appear immediately after saving.

### Cursor

Config file: `.cursor/mcp.json` in the project root.
Template: `templates/cursor.json`

1. Read `.cursor/mcp.json` (create it if it does not exist).
2. Read `templates/cursor.json` for the server snippet.
3. Merge the snippet into the existing `mcpServers` key (preserve any existing servers).
4. Write the merged result back to `.cursor/mcp.json`.
5. Tell the user to complete Cursor's OAuth flow for the DoiT server if Cursor prompts for authentication.
6. Tell the user to restart Cursor or reload the MCP servers panel if the server does not appear immediately after saving.

### Gemini CLI

Config file: `~/.gemini/settings.json`
Template: `templates/gemini-cli.json`

1. Read `~/.gemini/settings.json` (create it if it does not exist).
2. Read `templates/gemini-cli.json` for the server snippet.
3. Merge the snippet into the existing `mcpServers` key (preserve any existing servers).
4. Write the merged result back to `~/.gemini/settings.json`.
5. Tell the user to run `/mcp auth doit-mcp` in Gemini CLI if the server requires authentication.
6. Tell the user to restart Gemini CLI if the server does not appear immediately after saving.

### Codex

Config file: `~/.codex/config.toml`
Template: `templates/codex.toml`

1. Read `~/.codex/config.toml` (create it if it does not exist).
2. Read `templates/codex.toml` for the server snippet.
3. Merge the TOML snippet into the file, preserving any existing `mcp_servers` entries.
4. Write the merged result back to `~/.codex/config.toml`.
5. Tell the user they can alternatively run `codex mcp add doit-mcp --url https://mcp.doit.com/sse`.
6. Tell the user to restart Codex or run `codex mcp list` to verify the server is registered, then complete the authorization flow if prompted.

## Manual Clients

These clients require UI interaction the agent cannot automate. Guide the user step by step.

### ChatGPT

1. Tell the user to enable ChatGPT developer mode first.
2. Create a connector from `Settings` -> `Apps & Connectors` -> `Create`.
3. Set `MCP Server URL` to `https://mcp.doit.com/sse`.
4. Select `OAuth` for auth.
5. Tell the user they will need both the DoiT API key and DoiT Customer ID during authorization.

Do not give a local config snippet for ChatGPT.

### Claude (web)

1. Tell the user to add a custom connector in Claude.
2. Set the remote MCP server URL to `https://mcp.doit.com/sse`.
3. Tell the user to click `Authorize` in the Claude UI and complete the OAuth flow.

Do not mention Customer ID for Claude web.

## Verification

After setup, verify the connection:

1. For automated clients: confirm the DoiT MCP server appears in the client and is marked connected after authorization.
2. For manual clients: tell the user to confirm the DoiT MCP server shows as connected after authorization and the tool list is visible.
3. Suggest a smoke test prompt: "Show me recent anomalies" or "List my reports".

## Troubleshooting

For detailed troubleshooting, read `references/troubleshooting.md`.

Quick checks:

- If the user mixed local and remote setup patterns, correct the flow instead of trying to merge them.
- If auth fails in Claude, Claude Code, Codex, Cursor, or Gemini CLI, verify the user completed the remote authorization flow in the client.
- If auth fails in ChatGPT, check whether the wrong credential was used: API key plus Customer ID.
- If a config file already has a `doit-mcp`, `doit`, or `doit_mcp_server` entry, ask the user whether to overwrite or replace it with the remote connector format for that client.
- If the user asks for a client that is not covered here, say that supported clients are ChatGPT, Claude (web), Claude Code, Codex, Cursor, and Gemini CLI.

## Gotchas

- **Claude Code requires `"type": "http"`**: This is unique to Claude Code. Other clients infer the transport from the URL. Missing this field causes a silent failure.
- **Cursor config is per-project**: The file lives at `.cursor/mcp.json` in the project root, not in the home directory. Setting it globally does not work.
- **Codex uses TOML, not JSON**: Writing JSON syntax into `~/.codex/config.toml` will break the file. Use the TOML template.
- **ChatGPT needs developer mode first**: Without enabling developer mode in Settings, the MCP connector option is not visible.
- **Do not mix local and remote**: If the user previously had a stdio-based setup (`command: "npx"`, `DOIT_API_KEY`), it must be fully removed before adding the remote HTTP setup. Mixing both causes duplicate or conflicting sessions.
- **OAuth tokens expire**: If a previously working connection stops, the most likely cause is an expired OAuth token. Re-authorize in the client UI.
- **`Billing Profiles Admin` is required**: Without this DoiT permission, tool calls will return 403 even if the connection succeeds. Verify this before starting setup.
