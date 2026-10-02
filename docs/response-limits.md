# Tool response size and observability

The shared dispatcher checks the final serialized MCP tool result after any
transport-specific `convertResponse` callback. The default budget is 140,000
JavaScript string characters (UTF-16 code units). It includes all content blocks,
`structuredContent`, and `_meta`, leaving headroom below Claude's documented
approximate 150,000-character hosted-client limit for the JSON-RPC envelope.
This is a conservative server policy, not an exact reproduction of Claude's
undocumented counting rules. It applies to all clients. Claude Code's separate
token budget can still be exceeded; characters are not tokens.

Source: https://claude.com/docs/connectors/building/index#design-within-the-size-and-timeout-limits

## Behavior

- Results within budget retain their existing shape and content.
- Oversized reads return `isError: true` with `RESPONSE_TOO_LARGE` and recovery
  guidance. No result rows are returned or silently dropped.
- A completed write returns a small successful receipt with `status: completed`,
  `responseOmitted: true`, and bounded resource identifiers when present at the
  top level of the original response. Clients must not repeat the write merely
  to obtain its output. Use a read tool or DoiT Console instead.
- Errors remain errors, including when a formatter accidentally loses `isError`.
  An oversized error omits the body and tells the caller to verify state before
  retrying. It does not claim that a failed write succeeded.
- Approval envelopes are classified as not executed. Confirmed calls use the
  underlying tool's classification and outcome, not the `confirm_action` name.
- Serialization failures use the same bounded fallback with the reason
  `RESPONSE_SERIALIZATION_FAILED`.

The guard never retries API calls or generically truncates JSON. Pagination and
summarization must be implemented by the tool that understands its output. If a
tool reduces an upstream page, it must preserve a way to retrieve every omitted
item; the upstream next-page token alone can otherwise skip data. Financial
results must distinguish partial rows from complete aggregates.

Read/write classification uses the server's tool registry (`readOnlyHint`), not
client input. Unclassified executed tools are conservatively treated as writes.
Maintain that annotation when adding tools. Any transport-specific handler that
bypasses `executeToolHandler` must call exported `finalizeToolResponse` itself.

## Metrics

Each dispatched call emits one JSON `mcp_tool_response` event. Default output is
stderr so stdio protocol messages on stdout remain intact. Hosts may provide
`onResponseMetrics` to route the same event to their logging system.

Fields include tool name, bounded client name, duration, budget, `isError`,
`disposition`, `exceededLimit`, and `serializationFailed`. `original` measures
the final formatted response before the guard; `returned` measures what actually
goes to the client. Both contain:

- `textChars`: combined text-block lengths;
- `serializedChars`: length of the entire serialized tool result;
- `serializedBytes`: UTF-8 size of that result.

`original` is null when serialization fails. The events contain no arguments,
response bodies, credentials, customer identifiers, or approval tokens. Logging
failures do not fail tool execution. Existing unrelated logs are unchanged.

Aggregate events over a representative period by tool/client: call count,
p50/p95/p99/max `original.serializedChars`, over-budget count and percentage,
and `disposition` counts. Do not calculate the original-size distribution from
`returned` because large responses have already been replaced. Server-side
events show oversized responses prevented by this policy; they do not prove a
Claude client previously rejected the same request.

This guard does not bound upstream download size, peak memory, execution time,
or token usage. Tool-specific pagination and API timeouts remain separate work.
