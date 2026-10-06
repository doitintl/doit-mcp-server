# CloudFlow contract validation

Initially validated on 2026-10-05; review fixes revalidated on 2026-10-06 with Yarn 1.22.22 and Node 22.23.2. The implementation starts from
public main at `15b6b1c`. Parameter descriptions remain inline in Zod; input schemas are
derived with `zodToMcpInputSchema`. The existing schema parity suite is unchanged.

## Changes and reviewed contracts

- Connection creates require `idempotencyKey`, forward it as `Idempotency-Key`, exclude it
  from the JSON body, and retain the caller's exact key across retries. A different key
  represents a separate create attempt.
- Connection updates require `ifMatch`, forward the observed quoted `etag` as `If-Match`,
  and exclude it from the JSON body. Wildcards and malformed headers are rejected locally.
  The API compares the current connection ETag, supports weak ETags, and rejects stale
  versions with 412. Missing preconditions fail with 428 at the API.
- Ava error envelopes, including HTTP 200, return MCP errors. Detail is bounded to 1,024
  characters, limited to string/code/message/detail fields, and redacts the caller token,
  Bearer credentials, labelled secrets, URLs, and control characters. Arbitrary error
  objects, request bodies, and stacks are not serialized.
- CloudFlow guidance distinguishes JavaScript's default `$nodes`/`$variables` and Python's
  `nodes`/`variables`; both use lists of upstream result envelopes. Missing returns yield
  `{}` in JavaScript or `{message: null}` in Python. Bare upstream `input` access fails.
- Draft test runs execute real actions; dry-runs validate without dispatch. Build creates
  a draft before planning and returns its ID; refine normally returns answer/conversation
  without an ID and may save nothing. Conversation continuation does not turn build into
  an update operation.
- Webhook versus manual/scheduled triggers, failure statuses, connection config and
  collaborator replacement, five-minute page tokens, idempotency replay/conflict/dry-run
  semantics, tenant IDs, and action-node-only run inputs are described accurately.
  Existing builder warning delivery and generated null/empty pagination wording remain.
- `validate_user` already described the scoped customer's primary domain correctly; a
  regression test now distinguishes it from the caller's email domain. Customer search
  describes exact case-insensitive fields, short/empty continuation pages, the 5,000 scan
  cap, and invoice filters' two-month requirement. Confirmation describes generated DELETE
  staging, caller ownership, five-minute expiry, and single use even on mismatch/failure.
- Connection-list types and fixtures now match the API's `items`, nullable `pageToken`,
  and `rowCount` fields. Historical delivery examples point to the authoritative guidance.

## Deterministic verification

The built binary is exercised through actual MCP `tools/call` over stdio against a disposable
local HTTP fixture. This fixture models the reviewed API contract; it is not a live test of
the production API's idempotency store or concurrency implementation.

| Case | Assertion |
| --- | --- |
| Matching create retries | Same caller key and body reach HTTP; identical response replays; exactly one fixture resource is created |
| Different create body | Same key produces fixture HTTP 422 and an MCP error; no second resource |
| In-progress retry | Fixture HTTP 409 becomes an MCP error; later same-key retry replays |
| Update version | Observed ETag succeeds; stale version produces HTTP 412/MCP error without another change; weak ETag succeeds |
| Missing/wildcard/header injection | Rejected before HTTP; no wildcard bypass |
| Config/collaborator replacement | Full supplied config and owner-preserving collaborators replace fixture state; invalid owner lists are rejected locally |
| Generated dry-run | Key required, repeated validation creates no run; a real request with the same key starts one fixture run; retries replay; later matching dry-run returns validation |
| Customer context | Environment context and an explicit overriding customer ID propagate through query and X-Tenant-Id on creates/updates |
| Ava HTTP 200 failure | MCP `isError: true`, useful code/message retained, credentials and stacks absent |
| Search/confirmation | Empty continuation pages and scan-cap flags preserved; wrong-caller and failed-execution tokens cannot be reused |

Commands run successfully:

- `yarn install --frozen-lockfile` at the root and in `test/integration`.
- Affected tool/guidance/generated tests plus schema parity; all 106 parity tests pass.
- `yarn check:dev`, `yarn check:ci`, `yarn test`, and `yarn build`.
- `yarn test` in `test/integration`, including the built-binary fixture tests and both
  protocol eras.
- Companion consumer `check:dev` and `check:ci`. Its guidance, schema wiring, input shape,
  and registration tests pass against this local core using an external test-config alias.
  The consumer fixture adds the create key and an update ETag sample in a separate isolated
  checkout. No consumer dependency pin is changed.
- `git diff --check` and the repository's committed npm-lockfile guard.

Final counts: 1,117 unit tests, 258 integration tests, and 74 targeted consumer tests.
Checks ran on Node 22; the Node 20 CI matrix leg was not reproduced locally.

## Redacted live MCP evidence

The configured `DOIT_OWN_CUSTOMER_API_KEY` was passed as `DOIT_API_KEY` only in the built
server's child environment. The session was fresh, used a temporary working directory,
and had no selected customer context. The published package was not used.

| MCP call | Redacted input | Outcome and semantic assertion |
| --- | --- | --- |
| tools/list | none | New required create/update headers appear in schemas; real draft execution warning delivered |
| validate_user | `{}` | Success; non-empty authenticated email and scoped customer-domain fields, values withheld |
| list_cloudflow_connections | `maxResults: "1"` | Success; empty `items`, null final cursor; no connection detail/write checks possible |
| list_cloudflow_templates | `maxResults: "1"` | Success; one item and a continuation cursor |
| get_cloudflow_template | ID from first page, withheld | Success; returned ID equals requested ID |
| list_cloudflow_templates | `maxResults: "1"`, cursor withheld | Success; cursor accepted and at most one item returned |
| list_cloudflows | `maxResults: "1"` | Success; one item and a continuation cursor |
| list_cloudflows | `maxResults: "1"`, cursor withheld | Success; cursor accepted and at most one item returned |

The repeatable harness is explicitly opt-in:
`node test/integration/live/cloudflowReadOnly.mjs` after building. It prints only redacted
inputs, counts, and semantic assertions. It is outside the default Vitest test patterns.

## Cleanup and limitations

Production writes: **zero**. No flows were built, refined, published, draft-executed, or triggered;
no external actions or existing-session customer switches occurred. All fixture HTTP servers
and MCP child processes were closed; fixture resources existed only in memory. No production
resource cleanup was needed. Later dev writes and their cleanup are recorded below.

Production writes, token expiry, and forced Ava error envelopes were not exercised live.
Development connection writes and ETag/replay checks are recorded in the follow-up below. Personal-key calls do not establish hosted OAuth or
employee impersonation coverage; context propagation and consumer schema delivery were
checked deterministically.

Remaining dependencies:

- Shared HTTP-error propagation belongs to a separate change. On this baseline, CloudFlow
  HTTP errors still have generic text; these tests assert the MCP error flag and separately
  observe fixture HTTP status codes. No shared request utility was modified here. Hosted
  error-flag preservation also depends on that change; this baseline's success adapter can otherwise hide `isError`.
- The shared generator flattens named request-body properties and drops unknown arguments.
  Generated CloudFlow trigger/test-run schemas consequently expose no arbitrary trigger
  payload, despite the API supporting one. This was verified against the built core and
  documented in the guidance/overrides; a shared-generator fix is separate. The handwritten
  webhook tool already accepts payloads.
- The companion consumer needs a released core version and dependency bump before adopting
  the new fixture contract in its normal suite. No package was published or deployed.
- The API version check precedes the write; atomic compare-and-write is a backend dependency.
  The MCP tool requires an observed ETag but cannot prevent simultaneous updates from racing.
- The API fingerprints MCP tracking query parameters. Retries after client/server version or
  tracking-context changes can conflict even with the same key/body. Excluding telemetry from
  replay identity requires a backend change; callers should verify the original outcome.
- DataHub response-header pagination remains outside this change.


## Live development API validation (2026-10-06)

The built core at `44b64d3` was exercised through actual MCP `tools/call`, using locally
loaded development credentials only in the child environment. A loopback forwarding relay
sent requests to the real development API and recorded status/code assertions; it supplied
no fixture responses. Credentials, authenticated identity values, and resource IDs were
omitted from the evidence.

| Case | Actual development result |
| --- | --- |
| Account and bounded lists | Account validation, connection list, and template list returned 200 through built MCP |
| Connection create | One disabled disposable AWS connection returned 201; no cloud permissions were provisioned and no workflow ran |
| Identical retry | Same caller key, body, and client/server context returned 201 and the identical resource/response |
| Different body | Same key with a changed body returned 422 (`idempotency_key_reused`) and MCP `isError: true` |
| Observed ETag | Read returned a quoted ETag; owner-preserving collaborator replacement returned 200 and a new ETag |
| Stale ETag | Reusing the old ETag returned 412 (`precondition_failed`) and MCP `isError: true` |
| Invalid owner replacements | Empty, ownerless, and multiple-owner lists returned local MCP errors without HTTP requests |
| Weak ETag | The current observed ETag with a weak prefix was accepted with 200 |
| Ava | A request with ephemeral enabled returned 200 and MCP success |
| Cleanup | Direct authenticated DELETE with the freshly read ETag returned 204; a subsequent GET returned 404 |

Cleanup completed in a `finally` block, with **zero remaining test connections**. The direct
DELETE was used for cleanup because this baseline's generated deletion schema does not
expose the required If-Match header. All MCP child processes and the forwarding relay were
closed. The temporary encrypted credential cache was removed after validation.

This run does not establish atomicity of simultaneous ETag updates, cross-version retry
identity, or forced in-progress conflicts. Ava's forced HTTP-200 failure envelope remains
covered by fixtures. No flows were built, refined, published, triggered, or executed, and
no hosted OAuth session or employee customer switch was exercised.


## Pre-change comparison (2026-10-06)

A second run compared the isolated pre-change build at `15b6b1c` (the PR merge base)
with the feature build at `30b213b`. Their package manifests and dependency locks were
identical; the baseline compiled against the same installed dependency versions. Both
builds were called over MCP stdio, with equivalent business inputs and the same real
development backend. The forwarding relay recorded whether headers were present and the
backend status/code, without exposing credentials, request data, or resource IDs.

| Case | Pre-change build | Feature build | Evidence classification |
| --- | --- | --- | --- |
| Create a disabled disposable connection | HTTP 400, `idempotency_key_required`, MCP error; no Idempotency-Key header sent | HTTP 201, MCP success; caller key sent in header and excluded from body | Original defect reproduced and fixed against real dev |
| Update the same connection with the same business changes | HTTP 428, `precondition_required`, MCP error; no If-Match header sent | HTTP 200, MCP success; observed ETag sent in header and excluded from body | Original defect reproduced and fixed against real dev |
| Read back the update | No successful baseline update | Description persisted, collaborator list replaced with exactly one owner, ETag changed | Real dev state verification |
| Reuse the stale ETag | Not applicable to baseline's missing-header failure | HTTP 412, MCP error | Real dev regression/protection check |
| Empty collaborator replacement | Not isolated from baseline's earlier missing-header failure | Local MCP error with no HTTP request | Feature validation check |
| Ephemeral Ava request | HTTP 200, MCP success | HTTP 200, MCP success | Live compatibility check; no live failure envelope reproduced |
| Controlled HTTP-200 Ava error envelope | MCP success; envelope including simulated credential/stack data serialized | MCP error; useful error code retained, credential and stack excluded | Controlled before/after regression proof, not a dev-origin failure |

The controlled Ava envelope was generated only by the relay. Connection calls and the
successful Ava calls were forwarded unchanged to the real development API. This proves
that the connection header fixes repair reproducible failures, rather than merely avoiding
regressions. It also proves the Ava error classification/redaction change for the supplied
failure contract, while retaining the live-failure coverage limitation.

Cleanup reconciled the unique test prefix against connection lists, deleted the single
disposable connection with a fresh ETag (204), and verified GET 404. **Zero test resources
remain.** Both MCP processes and the relay closed; the baseline build and temporary encrypted
credential cache were removed. Existing resources were not modified. There were no workflow
executions, production writes, or deployments.

Execution-guidance changes, simultaneous ETag writes, and cross-version replay are not
established by this live before/after comparison. Description changes remain supported by
the reviewed backend contracts and deterministic tests.
