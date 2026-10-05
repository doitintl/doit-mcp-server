# API request failures

`makeDoitRequest` keeps its existing arguments and `Promise<T | null>` return type,
but rejects on HTTP, transport, and malformed nonempty JSON responses. Callers
must no longer interpret `null` as an HTTP or network failure. The rejection is an
`Error` containing safe user-facing text, including `HTTP <status>` when known.
No new error type is exported through the core entry point.

The existing tool handlers already catch errors and pass them to
`handleGeneralError`, which returns MCP `isError: true`. HTTP 401 responses retain
the OAuth challenge in `_meta`. The shared dispatcher bypasses success-response
adapters for errors, so a hosted widget formatter cannot discard `isError` or the
challenge. Success responses still use the configured adapter.

Success semantics are unchanged:

- JSON `null`, empty JSON-mode bodies, and whitespace-only JSON-mode bodies return
  `null`; existing caller-specific no-data handling remains in place.
- `parseAs: "text"` returns the body unchanged, including an empty string.
- `parseResponse: false` returns `{}` after checking the HTTP status.
- Demo fixtures and HTTP-200 application error envelopes retain their existing
  behavior. Application-specific envelope handling belongs in its caller.
- Timeouts still throw a `DOMException` named `TimeoutError`, with safe text.

Report/query handlers append their existing remediation guidance to HTTP 400/422
errors; authentication and availability errors retain their own guidance. The
Reports API's `errors: [{field, message}]` envelope is supported, alongside the
other recognized message shapes. `get_cloud_overview`
uses `Promise.allSettled` and intentionally returns empty sections for failures,
including when all sections fail. It continues to return its other successful
sections. Query comparisons require both results and now surface the failing
request's API reason. Generated operations use text mode and retain empty-body
success. Status updates that ignore response bodies retain their no-parse mode.
External callers that deliberately tolerated failures by testing for `null` must
catch rejections explicitly; aggregate callers should use `Promise.allSettled`.

Only recognized client-error message fields and field-validation entries are
included. Messages are bounded and redact credentials, known request-header
values, URLs, and email addresses. Public media types stay readable, and
non-credential header values are matched as whole values rather than substrings.
Unknown objects, HTML, multiline diagnostics,
and all server-error bodies are excluded; safe status-based guidance is used
instead. Original exceptions, response objects, headers, and request bodies are
not attached to request errors or logged. The console and SSE request helpers
retain their separate existing behavior. Failures emit only fixed method, HTTP
status (when known), and failure-category metadata at INFO debug level.

Transport failures, timeouts, server errors, rate limits, and unreadable/malformed
success responses for POST/PUT/PATCH/DELETE advise checking the operation's state
before retrying. A response failure does not establish that a write was rolled
back. HTTP methods alone cannot identify read-only POST endpoints, so this guidance
is deliberately conservative; the helper never retries automatically. Error
results also bypass success adapters when approval validation or storage throws
before a tool handler runs.

## Validation

The deterministic unit and integration suites cover HTTP JSON/plain-text/HTML
failures, transport failures, malformed and empty successes, OAuth metadata,
customer context and headers, success adapters, partial overview results, and
handwritten/generated callers through both MCP protocol eras.

For an explicitly opt-in live check, build the local server, install the
integration dependencies with Yarn 1, and run `yarn test:live:request-errors` from
`test/integration`. Supply `DOIT_OWN_CUSTOMER_API_KEY` in the environment. The
script passes it as `DOIT_API_KEY` to the built stdio server and performs only two
bounded `list_labels` reads: one with an invalid filter and one successful read.
It records the synthetic input and error reason, checks `isError` and the success
shape, checks stderr for credential/customer-data leakage, and omits customer
results. It is excluded from the default test suite and never confirms writes.
This personal-key check does not verify hosted OAuth or live customer switching.
