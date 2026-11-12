# Claude Code channel mode (stdio)

The stdio server can act as a [Claude Code channel](https://code.claude.com/docs/en/channels): while
a Claude Code session is open, it pushes DoiT events into that session so Claude can react to them
with the server's existing tools.

Channels are a Claude Code **research preview**. The flag syntax and protocol contract may change,
and this mode may change with them. It is off unless you opt in, and it applies to the local stdio
server only — the remote server at `mcp.doit.com` cannot be a channel.

## Enabling it

Channel mode needs a server release that includes it; earlier releases ignore the settings below.

### As a plugin (recommended)

This repository is a Claude Code plugin marketplace (`doitintl`) with one plugin, `doit`. The
plugin runs the published server with `npx` (pinned to the plugin's own version), turns channel mode on, and stores your API key in the
operating system's credential store.

```sh
claude plugin marketplace add doitintl/doit-mcp-server
claude plugin install doit@doitintl
```

Set the plugin's three settings with `/plugin configure doit@doitintl` in Claude Code, then restart
Claude Code. (`claude plugin configure doit@doitintl` in a shell lists them; add `--values-stdin` to
set them from a JSON object.) Set the API key before expecting events.

| Setting | Meaning | Default |
|---|---|---|
| DoiT API key | Personal API token, stored as a secret | none (required) |
| Events | Comma-separated event kinds: `anomalies`, `incidents` | `anomalies,incidents` |
| Poll interval (seconds) | How often to check for new events, minimum 60 | `300` |

Then start Claude Code with the channel. Which flag works depends on your organization:

```sh
# Your organization lists the plugin in allowedChannelPlugins (see below)
claude --channels plugin:doit@doitintl

# Otherwise: the development flag, which shows a confirmation dialog
claude --dangerously-load-development-channels plugin:doit@doitintl
```

The plugin is not on Anthropic's default channel allowlist, so plain `--channels` registers it only
where an organization has allowed it. To do that, an administrator sets this in managed settings
(or under Organization settings > Claude Code > Channels):

```json
{
  "channelsEnabled": true,
  "allowedChannelPlugins": [{ "marketplace": "doitintl", "plugin": "doit" }]
}
```

`allowedChannelPlugins` replaces Anthropic's default list, so include any other channel plugins the
organization uses.

While the plugin is enabled, its server runs in channel mode in every Claude Code session it is
loaded into, whether or not the session was started with a channel flag. A user-scope install loads
it into every session on the machine; install with `--scope project` to limit it to one project. In
each of those sessions it polls the DoiT API, and it speaks the 2025-era protocol
only, so native Skills loading is unavailable (tool descriptions point to the guides instead). Each
open session runs its own poller. Disable the plugin when you do not want that.

If the same DoiT server is also configured separately (for example in `.mcp.json` or as the remote
connector), Claude sees its tools twice. Disable one of them.

### As a plain MCP server

Set `DOIT_CHANNEL_EVENTS` in the server's environment:

| Variable | Value | Default |
|---|---|---|
| `DOIT_CHANNEL_EVENTS` | Comma-separated event kinds: `anomalies`, `incidents` | unset (channel mode off) |
| `DOIT_CHANNEL_POLL_SECONDS` | Poll interval in seconds, minimum 60 | `300` |

```json
{
  "mcpServers": {
    "doit": {
      "command": "npx",
      "args": ["-y", "@doitintl/doit-mcp-server@latest"],
      "env": {
        "DOIT_API_KEY": "your_doit_api_key",
        "DOIT_CHANNEL_EVENTS": "anomalies,incidents"
      }
    }
  }
}
```

A server configured this way can only be registered with the development flag:

```sh
claude --dangerously-load-development-channels server:doit
```

### Requirements that apply either way

Team and Enterprise organizations need channels enabled by an owner (`channelsEnabled`). Channels
need claude.ai or Console authentication and are not available through Amazon Bedrock, Google Cloud
or Microsoft Foundry. See the Claude Code documentation for the current rules.

Turning channel mode on without registering the server as a channel is harmless but wasteful: the
server polls and Claude Code silently drops the events. The server cannot detect this.

## What it sends

Events are `notifications/claude/channel` messages. Claude sees each one as a `<channel>` tag whose
attributes come from the event's `meta`:

| `event_type` | Other attributes | Follow-up tool |
|---|---|---|
| `cost_anomaly` | `anomaly_id`, `severity`, `platform`, `service`, `cost_of_anomaly` | `get_anomaly` |
| `cloud_incident` | `incident_id`, `platform`, `product`, `status` | `get_cloud_incident` |
| `anomalies_summary`, `incidents_summary` | `additional_count` | `get_anomalies`, `get_cloud_incidents` |

Design points:

- **One-way.** There is no reply tool and no permission relay. Claude acts through the normal tools.
- **No free text.** The event body is a fixed sentence, and attribute values are reduced to
  letters, digits and `. _ : / -` (so `Compute Engine` arrives as `Compute_Engine`). Titles,
  descriptions and attribution names are never forwarded, because event text lands directly in the
  model's context. Claude fetches details through the tools.
- **New items only.** A change to an existing anomaly or incident (severity, status) sends nothing.
- **No replay.** The first successful poll of each event kind is a baseline and sends nothing.
  Later polls send one event per item whose ID has not been seen in this process.
- **Bounded.** At most 10 events per kind per poll; the rest are reported in one summary event.
- **Events only arrive while the session is open.** Nothing is queued across restarts, and Claude
  Code does not acknowledge delivery.

## How it polls

A local process cannot receive webhooks, so the server polls the DoiT API with `DOIT_API_KEY`
(and `CUSTOMER_CONTEXT`, if set), starting when the client completes `initialize`:

- **Anomalies:** `GET /anomalies/v1`, newest first, over a 7-day window. The window is wide because
  the API filters on usage start time and an anomaly is detected some time after its usage began.
- **Incidents:** `GET /core/v1/cloudincidents` with `status:active`, created in the last 24 hours.

Only the first page (100 items) of each is read. A failed poll backs off exponentially, up to an
hour, and is reported on stderr; a 401 or 403 stops that event kind until restart. Polling
failures never affect the tools. Polling stops when the connection closes; a request already in
flight can keep the process alive for up to its 30-second timeout.

The event sources are isolated behind `ChannelSource` (`src/channel/sources.ts`), so a future
push-based public event stream could replace polling without touching the rest.

## Protocol

Channel mode serves the 2025-era protocol only. See
[protocol-compatibility.md](protocol-compatibility.md#channel-mode).

## Code map

| File | Role |
|---|---|
| `src/channel/config.ts` | Parses the environment opt-in |
| `src/channel/sources.ts` | Anomaly and incident fetchers, event shape, value sanitizing |
| `src/channel/poller.ts` | Baseline, de-duplication, backoff, scheduling |
| `src/channel/protocol.ts` | Capability key, notification method, instruction text |
| `src/channel/serve.ts` | Channel entry used by `src/index.ts` |
| `.claude-plugin/marketplace.json` | The `doitintl` marketplace |
| `plugins/doit/.claude-plugin/plugin.json` | The `doit` plugin: server command, channel binding, settings |
