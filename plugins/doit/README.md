# DoiT Cloud Intelligence channel for Claude Code

This plugin is a Claude Code channel for [DoiT Cloud Intelligence](https://www.doit.com). While a
session is open, it tells Claude about new cost anomalies and cloud provider incidents as they
appear, so you can ask Claude to look into them.

It sends events only and adds no tools. Claude looks up an event's details with the DoiT tools you
already have: the DoiT Cloud Intelligence plugin from the Claude plugin directory, or the DoiT
connector at `https://mcp.doit.com/mcp`. Install one of those as well.

Channels are a Claude Code research preview, so this plugin may change.

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

Start Claude Code with the channel:

```sh
claude --channels plugin:doit@doitintl
```

Plain `--channels` registers the plugin only where your organization has allowed it. See the
[channel guide](https://github.com/doitintl/doit-mcp-server/blob/main/docs/channels.md) for the
organization settings and for the development flag to use otherwise.

## Things to try

With the channel running, a new anomaly or incident arrives in the session by itself. Then ask, for
example:

- "What drove this anomaly, and which resources are responsible?"
- "Is this incident affecting any of the services we use?"
- "Compare this week's spend on that service with last week's."

## What this plugin runs, sends and fetches

- **Runs:** `npx -y @doitintl/doit-mcp-server@3.1.0`, the open-source DoiT MCP server from
  [this repository](https://github.com/doitintl/doit-mcp-server), pinned to an exact version and
  started in events-only mode. `npx` downloads that package and its dependencies from the npm
  registry the first time it runs.
- **Sends:** read-only requests to the DoiT API at `https://api.doit.com`, authenticated with your
  API key, with the MCP client's name and version. Nothing is sent to services outside DoiT.
- **Fetches:** two lists, cost anomalies and active cloud incidents, at the poll interval, in every
  Claude Code session the plugin is loaded into.
- **Stores:** nothing on disk beyond the options above.

Events contain a fixed sentence and identifiers only (an anomaly or incident ID, severity, platform,
service). Titles, descriptions and other free text stay in DoiT until Claude fetches them with a
tool.

## Troubleshooting

- **No events arrive:** the API key is not set, the session was not started with the channel flag,
  or your organization has not allowed the channel. Events only arrive while a session is open, and
  only for anomalies and incidents that appear after the session started.
- **Claude cannot look up an event:** this plugin has no tools. Install the DoiT Cloud Intelligence
  plugin or add the DoiT connector, and sign in.
- **Polling in sessions that do not need it:** install with `--scope project` to limit the plugin to
  one project, or disable it when it is not in use.

## Support and privacy

- Support: <https://support.doit.com>
- Bug reports for this plugin: <https://github.com/doitintl/doit-mcp-server/issues>
- Privacy policy: <https://www.doit.com/privacy>
- License: MIT
