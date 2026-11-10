# Customer scope

DoiT employee tokens are not tied to one customer, so each request names the customer it acts for.
Direct customer tokens are already scoped and normally need no selection.

## Selecting a customer

- **`customerContext` tool argument.** Every generated tool and the hand-written tools that support
  scoping accept it. It wins over the environment setting for that call only.
- **`CUSTOMER_CONTEXT` environment setting.** The stdio server's default customer, used when a call
  passes no `customerContext`.

Both remain the public interface. They are MCP-level settings, not DoiT API fields.

## What goes on the wire

The selected customer is sent only as the `X-Tenant-Id` request header. The shared request helpers
in `src/utils/util.ts` add it for every API call: `makeDoitRequest` for hand-written and generated
tools, and `makeDoitSSERequest` for the CloudFlow build/refine streams.

- No `customerContext` query parameter is added to any request. Endpoints that validate their query
  strictly reject keys they do not declare, so an extra key turned valid calls into HTTP 400.
- Generated operations never place `customerContext` in a JSON or multipart body.
- A header already set by the caller, such as an operation's declared `X-Tenant-Id` parameter, is
  kept as is, and only one tenant header is sent.
- Each call resolves its own customer. Concurrent calls for different customers do not share scope.
- Pagination parameters and MCP tracking parameters (`mcp`, `mcpVersion`, `mcpTool`, `mcpClient`,
  `mcpClientVersion`, `mcpProtocolVersion`, and `sse` when no `CUSTOMER_CONTEXT` is set) are
  unchanged. An endpoint that rejects undeclared query keys must also accept these tracking keys.
  Removing `customerContext` alone does not make such an endpoint succeed: `list_service_quotas`
  currently rejects the tracking keys too.
- For the CloudFlow streams only, the standalone `TENANT_ID` environment variable remains a
  last fallback when no customer is selected.

## Rollout

The DoiT API must accept header-only customer selection for every key type before this package is
released. That includes legacy employee API keys, which previously relied on the query parameter.
Released first, this package would make those keys' customer-scoped calls fail authentication.

1. Deploy the API change that reads the customer from `X-Tenant-Id` for legacy employee keys.
   Strictly validated endpoints such as service quotas must also accept the MCP tracking keys
   above; otherwise they keep returning HTTP 400.
2. Release this package.
3. Bump the hosted Worker's `@doitintl/doit-mcp-server` dependency and redeploy it. Publishing to npm
   does not update the hosted connector (see [release.md](release.md#cloudflare-worker-mcpdoitcom)).
4. Recheck employee and direct-customer calls on the hosted connector, including a strictly validated
   endpoint such as `list_service_quotas`.
