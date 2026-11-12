# DoiT Cloud Intelligence for Claude Code

This plugin connects Claude Code to [DoiT Cloud Intelligence](https://www.doit.com). It adds the
DoiT MCP server's tools for cloud cost analysis, anomalies, budgets, reports, invoices, support
tickets and more, and it can act as a Claude Code channel that tells an open session about new cost
anomalies and cloud provider incidents as they appear.

Channels are a Claude Code research preview, so the channel part of this plugin may change.

## Install

```
/plugin install doit --marketplace doitintl/doit-mcp-server
```

Then set the plugin's options with `/plugin configure doit@doitintl` and restart Claude Code. The
commands on this page use `doit@doitintl`, the plugin's id when installed from this repository's
marketplace; if you installed it another way, use the id that `/plugin` shows.

| Option | Meaning | Default |
|---|---|---|
| DoiT API key | A personal API token from the DoiT console (Profile > API tokens). Stored in your operating system's credential store. | none (required) |
| Events | Comma-separated event kinds to push into the session: `anomalies`, `incidents` | `anomalies,incidents` |
| Poll interval (seconds) | How often to check for new events, minimum 60 | `300` |

The tools work in any session once the API key is set. To also receive events, start Claude Code
with the channel:

```sh
claude --channels plugin:doit@doitintl
```

Plain `--channels` registers the plugin only where your organization has allowed it. See the
[channel guide](https://github.com/doitintl/doit-mcp-server/blob/main/docs/channels.md) for the
organization settings and for the development flag to use otherwise.

## Things to try

- "Show me this month's cost anomalies and what drove the largest one."
- "Compare last month's spend with the month before, broken down by service."
- "Are there any active cloud incidents affecting the services we use?"

With the channel running, a new anomaly or incident arrives in the session by itself, and you can
ask Claude to look into it.

## What this plugin runs, sends and fetches

- **Runs:** `npx -y @doitintl/doit-mcp-server@3.1.0`, the open-source DoiT MCP server from
  [this repository](https://github.com/doitintl/doit-mcp-server), pinned to an exact version. `npx`
  downloads that package and its dependencies from the npm registry the first time it runs.
- **Sends:** requests to the DoiT API at `https://api.doit.com`, authenticated with your API key.
  Requests carry what a tool call needs (for example a report query or a ticket comment you asked
  Claude to write) and the MCP client's name and version. Nothing is sent to services outside DoiT.
- **Fetches:** your organization's DoiT data, with the permissions of your API key. While the plugin
  is enabled it also polls two read-only endpoints (cost anomalies and active cloud incidents) at
  the poll interval, in every Claude Code session the plugin is loaded into.
- **Stores:** nothing on disk beyond the options above.

Every tool declares whether it is read-only or changes data, so Claude Code can ask before a tool
that changes something runs.

Events contain a fixed sentence and identifiers only (an anomaly or incident ID, severity, platform,
service). Titles, descriptions and other free text stay in DoiT until Claude fetches them with a
tool.

## Troubleshooting

- **No tools appear:** the server does not start until the API key is set. Run
  `/plugin configure doit@doitintl`, then restart Claude Code.
- **Tools work but no events arrive:** the session was not started with the channel flag, or your
  organization has not allowed the channel. Events only arrive while a session is open, and only for
  anomalies and incidents that appear after the session started.
- **Tools appear twice:** the DoiT server is also configured elsewhere (for example in `.mcp.json` or
  as the remote connector). Disable one of them.
- **Polling in sessions that do not need it:** install with `--scope project` to limit the plugin to
  one project, or disable it when it is not in use.

## Support and privacy

- Issues and questions: <https://github.com/doitintl/doit-mcp-server/issues>
- Privacy policy: <https://www.doit.com/privacy>
- License: MIT
