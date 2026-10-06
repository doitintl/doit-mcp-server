# API-key bearer auth on the remote Streamable HTTP endpoint

**Status:** Shipped to `https://mcp.doit.com` on 2026-09-03.
**Origin:** customer request "MCP streamable http auth with api token" (UserVoice, 2026-09-03). A customer runs HolmesGPT on EKS and wanted to connect it to `https://mcp.doit.com/mcp` with a bearer token instead of the browser-based OAuth flow.

This document records the problem, the decisions, and the shipped design. The implementation lives in the remote Worker (a separate private repo that consumes this package's `/core` export); nothing in this repo's code changed for it.

## Problem

Headless agents (HolmesGPT, CI jobs, cron workers, internal bots) cannot complete an interactive OAuth consent flow. Before this change the only headless option was the local stdio server with `DOIT_API_KEY`, which many agent runtimes cannot host. HolmesGPT, for example, only speaks Streamable HTTP or SSE to remote MCP servers and configures auth as a static `Authorization` header.

## Behaviour

| Endpoint | Bearer accepted |
| --- | --- |
| `https://mcp.doit.com/mcp` (and `/sse`, `/sse/message`) | An OAuth MCP access token issued by the DoiT authorization server (interactive clients), **or** a customer personal DoiT API token (headless clients). |
| stdio (`npx @doitintl/doit-mcp-server`) | Personal DoiT API token via `DOIT_API_KEY`, unchanged. |

```
Authorization: Bearer <DoiT personal API token>
```

Rules for the API-key path:

- **Customer keys only.** A key scoped to the DoiT internal customer, or one the DoiT API reports as belonging to the `doit.com` domain, is rejected with 401. DoiT employees keep using OAuth or the stdio server. An employee-created key that is scoped to a specific customer validates as that customer's domain and is accepted.
- **Same identity and permissions as stdio.** The key is validated against `GET /auth/v1/validate`; the validated email must equal the key's `sub` claim; the customer context is the validated domain. Every tool call carries the caller's own key, so the DoiT API enforces the same permissions as on stdio.
- **Not a fallback for bad OAuth tokens.** A bearer that is an MCP access token (`kid: mcp-access`) and fails verification is rejected. It is never retried as an API key.
- **Cached for 5 minutes.** A validated key is trusted for 5 minutes before being re-validated, so a revoked key stops working within 5 minutes. Failures are not cached.
- **Fail closed.** The upstream validate call has a 5-second timeout; a timeout is a 401.
- **No `change_customer`.** API-key sessions never see the employee-only customer-switching tool, and the `customerContext` URL parameter is ignored, exactly as for OAuth sessions.
- **Discovery unchanged.** Rejected bearers get the same 401 with `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource"`, so OAuth-capable clients still auto-discover the authorization server.
- **Key hygiene.** The raw key is never logged and never used as a storage name. Logs carry an 8-character hash prefix.
- **Kill switch.** A Worker variable disables the API-key path without a code change. It is on in every environment.

## Design notes

### Why not just "uncomment the old code"

An API-key bearer path existed in the Worker in June 2026 but was disabled before launch. Two things changed after that, and a plain re-enable would have shipped broken:

1. The Worker refreshes the session credential on every message by decoding the bearer as an OAuth token and rewriting the session as `authMethod: "oauth"`. A DoiT API key is itself a JWT with a `sub` claim, so decoding succeeds. Without a guard, the first message after `initialize` flips an API-key session to OAuth and every tool call goes into token exchange and fails. The same happens on Durable Object cold start. The fix: the refresh skips any bearer that is not an MCP access token.
2. Real DoiT API keys carry `CustomerID`, `TokenID`, `TokenKind`, `UserID`, `aud`, `sub`, `iss` and no employee flag. The June code keyed employee detection on a claim that live keys do not have. Employee detection now uses the `CustomerID` claim (rejected before any network call) and the validated domain (rejected after).

### Why decoded JWT claims are safe here

The Worker cannot verify the signature of a DoiT API key: it is signed with a secret only the DoiT API holds. Decoded claims are therefore never used to grant anything. Acceptance depends solely on the upstream validate call, where the signature is checked. Claims are used in two fail-closed ways: `CustomerID` can only cause an early rejection (a forged or stripped claim just defers the rejection to the validated-domain check), and `sub` must match the validated email, so tampering causes a rejection rather than a bypass.

### Why customer keys only

An employee key scoped to the DoiT internal customer can act on any customer. That blast radius does not belong in a static header on a customer-side cluster. Customer-scoped keys can only reach their own customer, which is the same exposure the stdio server already has.

### Verification

Unit tests in the Worker repo cover: customer key accepted; employee key rejected by claim without a network call, by validated domain after one call, and via the legacy flag; customer-scoped employee key accepted; email/sub mismatch rejected; upstream rejection; opaque token; validate timeout; cache hit, per-key isolation, TTL expiry and no negative caching; kill switch off is a no-op; OAuth tokens never retried as keys; storage names are hashes; no log line contains the raw key.

Live tests on the deployed Worker: an OAuth session (via Claude Code) completes `validate_user` and `list_reports`; a customer key completes `initialize`, `tools/list`, `validate_user` and two more calls on the same session; an employee key gets 401.

## Client configuration

HolmesGPT:

```yaml
mcp_servers:
  doit:
    description: "DoiT Cloud Intelligence"
    config:
      url: "https://mcp.doit.com/mcp"
      mode: streamable-http
      headers:
        Authorization: "Bearer {{ env.DOIT_API_KEY }}"
      health_check_tool: "validate_user"
    llm_instructions: "Use for DoiT cost, anomaly, budget and cloud incident questions."
```

Any other client that can send a static `Authorization` header to a Streamable HTTP MCP server works the same way. Guidance: create a dedicated API token for the agent, keep it in a secret store, rotate it on a schedule, and prefer OAuth for interactive clients.

## Follow-ups

- Rate limiting of repeated 401s per client IP at the edge, to blunt key guessing against the validate endpoint.
- help.doit.com Connections page: a "Headless / server-to-server" section with the snippet above.
- Setup templates in the skills repository.
