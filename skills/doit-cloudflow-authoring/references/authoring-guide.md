# CloudFlow authoring over MCP

CloudFlow tools build, inspect, repair, and test automation. Builds and imports save drafts;
publishing activates schedules. A draft can still execute real actions through a test run.

## The authoring loop

1. **Build or clone.** `build_cloud_flow` creates a new draft before planning and returns
   `flowId` even if planning stops early, plus `conversationId`, an answer, and any steps.
   `refine_cloudflow` targets an existing flow and normally returns no `flowId`; it can
   answer with a plan or clarification question without saving. Both stream progress.
   Reusing `conversationId` continues a conversation; another build still creates a new
   draft, whereas refine uses its supplied flow ID. A real export supplies the actual node
   parameter shapes and reference syntax for cloning.
2. **Export and inspect.** `export_cloudflow_flow` shows what was actually saved. Comparing
   exports establishes whether refinement changed the saved flow.
3. **Dry-run import.** `import_cloudflow_flow` with `dryRun` writes nothing and returns
   validation errors, requirement resolutions, and candidate IDs. Real import creates new
   draft IDs; it does not update the source flow.
4. **Validate and test.** `test_run_cloudflow_flow` with `dryRun` validates without starting
   a run (valid: true or 422 with invalid nodes). Without `dryRun`, it executes real actions
   with the bound connections and credentials, even for drafts. Approval-gated actions
   still wait for approval. A missing/unsupported trigger fails validation; an already-running
   flow fails with 409. Valid structure alone does not establish correct behavior.
5. **Read the run.** `list_cloudflow_flow_runs` and `get_cloudflow_flow_run` expose test runs
   and per-node output as nodes reach terminal status. Only action nodes record `input`;
   code, transform, branch, switch, datastore, subflow, and trigger nodes have null input.
   Output is recorded by every finished node. Payloads are capped at 64KB with truncation
   metadata and schema-sensitive values redacted. Completed outputs show actual behavior.

## Triggering published flows

`trigger_cloud_flow` accepts a flow ID or webhook trigger URL and a webhook JSON payload
(default {}). It requires a published flow with a webhook trigger: draft 403, no webhook
400, already running 409. It returns executionLink. The generated `trigger_cloudflow_flow`
starts published flows with webhook, manual, or scheduled triggers; drafts fail with 422
and running flows with 409. Neither trigger endpoint requires an Idempotency-Key.
The generated trigger/test-run schemas currently expose no arbitrary trigger payload field;
their omitted payload defaults to {}. The hand-written webhook tool accepts a JSON payload.

## Idempotency-key retry semantics

Resource-creating requests (connection create, import, test-run) require an
`Idempotency-Key`, including dry-runs. The key is scoped to the caller, tenant, method,
and path. Within the 24-hour retention window:

- Same key and matching request replay the saved response without repeating side effects.
- Same key with a different body or other fingerprinted inputs fails with 422
  (idempotency_key_reused); a matching request still in progress fails with 409.
- Dry-runs validate fingerprints against existing keys but do not reserve a key or store
  a replay response. dryRun itself is excluded from the fingerprint, so an identical
  dry-run and real request can share a key.
- `create_cloudflow_connection` takes a caller-supplied `idempotencyKey`; it never
  regenerates the key. A new key represents a separate create attempt. A lost response
  or 5xx may follow real side effects; retries must retain the key and full request context.
  Test-run history (mode test) can also show whether a run started. A replayed failure may require
  a new attempt after its cause is resolved.
- The current API fingerprints query parameters, including MCP tracking parameters.
  Changing the client/server version or other tracking context can cause a same-key
  conflict despite an identical body. Do not rotate the key to bypass such a conflict;
  verify the original outcome first.
- HTTP failures can return generic MCP error text. Without an explicit status, callers
  cannot distinguish 409, 412, or 422 from that text. Do not infer a status or retry
  automatically; verify the saved state before another write.

## The `codeNode` runtime contract

JavaScript is the default language. The code body executes inside an async wrapper;
an uncalled function is not an entry point.

- **Upstream data.** JavaScript uses `$nodes["<node name>"][0].results[0]`; Python uses
  `nodes["<node name>"][0]["results"][0]`. Maps are keyed by node name and values are lists
  of result envelopes. Results are not objects with an output attribute.
- **Variables.** JavaScript uses `$variables`, Python `variables`. Each has
  `globalVariables` and `localVariables` from the trigger result.
- **Return values.** Top-level `return` records `{message: value}`. Defining an uncalled
  function or assigning output without returning yields `{}` in JavaScript or
  `{message: null}` in Python. Neither establishes useful work.
- **Bare input.** No upstream `input` is injected. JavaScript raises ReferenceError;
  Python's input is a builtin function, and treating it as upstream data fails the node.
- **Schema.** A `schema` JSON Schema string describes the output and is required.

## Connections and pagination

`update_cloudflow_connection` requires the connection's last observed `etag` as
`ifMatch`, including quotes. A stale version fails with 412; the MCP tool rejects wildcard
ETags. The API currently checks the version before writing rather than atomically with
its write, so simultaneous updates can still race. Serialize updates and read the result
before another change. Supplied gcpConfig/awsConfig and collaborators replace stored values
wholesale, not field by field. Omitted values stay unchanged; a replacement collaborator
list must retain exactly one owner. An empty list is invalid.
CloudFlow list page tokens expire after five minutes. A missing, null, or empty pageToken
marks the last page.

## Things a bundle cannot carry

Credentials, tenant IDs, schedule activation, execution state, and Slack-channel/policy
references never travel in an exported bundle. The last two appear as unsupportedReferences
and leave nodes incomplete. Schedule configuration travels, but remains inactive until
publication in the destination tenant.

## Tenant scoping caveat

CloudFlow resolves the authenticated customer tenant. An employee key scoped with a
customer ID via `customerContext` and X-Tenant-Id targets that customer's tenant.
A domain is not a tenant ID and can fail with tenant_id_mismatch. A tenant-scoped token
also rejects a conflicting X-Tenant-Id. Direct customer keys normally need no explicit
customerContext. Personal-key validation does not establish hosted OAuth coverage.
