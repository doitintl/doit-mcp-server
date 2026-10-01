# MCP protocol compatibility (stdio)

The stdio server (`npx @doitintl/doit-mcp-server`, entry `src/index.ts`) serves MCP clients of
**both** protocol eras from one binary: 2025-era clients that open with `initialize`, and
2026-07-28 clients that open with `server/discover`. Neither kind of client needs any
configuration.

This document covers the stdio server only. The remote Worker in a separate private repo builds
its own `Server` and transport from the `/core` export, and is not affected by anything here.

## Supported protocol versions

| Protocol version | Era | Opening exchange | Per-request `_meta` envelope |
|---|---|---|---|
| `2024-10-07`, `2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25` | 2025 ("legacy") | `initialize` → `notifications/initialized` | none |
| `2026-07-28` | modern | `server/discover` (optional probe), then requests | required on every request |

The version lists come from the SDK: `SUPPORTED_PROTOCOL_VERSIONS` (2025 era) and
`SUPPORTED_MODERN_PROTOCOL_VERSIONS` (modern era) in `@modelcontextprotocol/server` 2.2.0.

## How the era is chosen

`main()` calls `serveDoitStdio()` (`src/stdio.ts`). That wraps the SDK's
`serveStdio(factory, { legacy: "serve" })`, which reads the connection's **opening message** and
picks the era from it:

- An `initialize` request, or any message without a protocol-version claim in `_meta`, opens a
  **2025-era** connection. It is served exactly as a hand-wired `server.connect(transport)`
  would serve it.
- A request whose `_meta["io.modelcontextprotocol/protocolVersion"]` claims `2026-07-28` opens a
  **modern** connection. For modern instances the SDK answers `server/discover` itself, using our
  capabilities and server instructions.
- A claim naming any other version gets error `-32022`, whose data lists the supported versions.
  A malformed envelope gets `-32602`.

`createServer()` (`src/server.ts`) is the factory, and it builds a fresh `Server` for every
connection attempt. It can run twice on one connection: a client may probe with
`server/discover` and then fall back to `initialize`. In that case the probe instance is thrown
away.

### Why a hand-wired server is not enough

A `Server` connected directly with `server.connect(new StdioServerTransport())` only speaks the
2025 era:
- It answers `server/discover` with `-32601 Method not found`.
- A client pinned to 2026-07-28 has no `initialize` fallback, so it fails with
  `SdkError(EraNegotiationFailed)`.

This was how `src/index.ts` worked up to 2.1.0. `mainWithServer(customServer)` still wires a
`Server` you pass to it this way, for backward compatibility, so that path is 2025-only.

## Limits and era differences

- **One era per connection.** After a modern request has pinned a connection, a later
  `initialize` is refused with `-32022`. The connection does not switch eras.
- **Client identity for analytics.** On modern connections the server reads the client name,
  client version and protocol version from each request's `_meta` envelope
  (`ctx.mcpReq.envelope`). On 2025-era connections it reads them from what `initialize`
  recorded. `server.getClientVersion()` is always `undefined` on modern stdio connections.
  See `resolveTrackingContext` in `src/server.ts`.
- **Progress.** `build_cloud_flow` and `refine_cloudflow` send `notifications/progress` through
  `ctx.mcpReq.notify`, which works in both eras. A progress token may be `0`: v2 clients use the
  request id as the token, and the first request after discovery has id 0.
- **No server→client requests.** The 2026-07-28 wire has no elicitation, sampling or ping in
  that direction. This server uses none of them: the write-approval flow (`approval_required` →
  `confirm_action`) is carried entirely in tool results.
- **Unchanged:** the tool, prompt and resource surface is identical in both eras. That includes
  non-spec tool fields such as `securitySchemes`, which v2 clients drop when they parse a tool.

## Evidence

All of the following are executable. Run them from `test/integration` after a root
`yarn install` and `yarn build`, plus a `yarn install` in `test/integration`.

| Claim | Test |
|---|---|
| A hand-wired server cannot serve a 2026-07-28 client | `stdio/modern/eraNegotiation.test.ts` ("a hand-wired server rejects…") |
| 2025-era clients are unaffected: the original suite (v1 SDK client, `2025-11-25`) runs through the shipped entry with its assertions unchanged. The only edit since 2.1.0 removes an unused `_server` variable. | `stdio/{approvalFlow,prompts,server,tools}.test.ts` via `helpers.ts` → `serveDoitStdio` |
| A 2026-07-28 client opens with `server/discover`, never sends `initialize`, negotiates `2026-07-28`, and receives the instructions, capabilities and server info | `stdio/modern/handshake.test.ts` |
| `auto` and pinned v2 clients get the modern era, and a default (`legacy`-mode) v2 client still gets `initialize` | `stdio/modern/eraNegotiation.test.ts` |
| One era per connection (`-32022`), and unsupported versions are rejected | `stdio/modern/eraNegotiation.test.ts` |
| Tools, approval flow, prompts and resources work for 2026-07-28 clients and return **identical** results to the v1 client | `stdio/modern/{tools,approvalFlow,promptsResources}.test.ts` (the "parity" blocks) |
| The DoiT API receives the correct `mcpClient` and `mcpProtocolVersion` for each era | `stdio/modern/tracking.test.ts` |
| Progress notifications reach clients of both eras | `stdio/modern/progress.test.ts` |
| Request-level failures are answered to the client and never reach the stderr `onerror` log, in either era. A control case shows connection-level events do reach it | `stdio/modern/errorReporting.test.ts` |
| A failed stdio transport start still rejects `main()`, which exits with code 1 | `src/__tests__/index.test.ts` |
| The **built binary** over real stdio pipes serves a v1 client, a pinned v2 client and an `auto` v2 client | `process/stdioBinary.test.ts` (needs `yarn build`) |

Useful commands:

```sh
cd test/integration
yarn test                                   # everything
yarn test --exclude "stdio/modern/**" --exclude "process/**"   # the original 2025-era suite only
yarn test stdio/modern/                     # the 2026-07-28 suite
yarn test process/                          # the built-binary smoke test
git diff v2.1.0 -- stdio/ ":!stdio/modern" # only removes the unused `_server` variable; no assertion changed
```

## Checking it by hand

After `yarn build`, send one opening message to the binary and read the first line it prints.
In each command, the `sleep` keeps stdin open long enough for the response, because the
transport closes when stdin ends.

```sh
# 2026-07-28: expect a DiscoverResult with "supportedVersions":["2026-07-28"]
(echo '{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}'; sleep 1) | node dist/index.js 2>/dev/null

# 2025 era: expect an InitializeResult with "protocolVersion":"2025-06-18"
(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"manual","version":"0"}}}'; sleep 1) | node dist/index.js 2>/dev/null
```

In fish, replace `( …; sleep 1)` with `begin; …; sleep 1; end`.

Against a build of 2.1.0 or earlier, the first command returns
`{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}`.
