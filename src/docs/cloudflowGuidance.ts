/**
 * CloudFlow authoring guidance, delivered to the model rather than to a human reading the repo.
 *
 * This module — not `docs/cloudflow-authoring.md` — is the source of truth for the CloudFlow
 * runtime contract. Two hand-maintained copies of a contract drift, and this is the one that must
 * not: the failures it describes pass every validation gate and surface only as a wrong result.
 *
 * The text ships as TypeScript constants, never read from disk at runtime, because:
 *   - `package.json` has `files: ["dist"]`, so `docs/` is absent from an npx-installed server;
 *   - the build copies exactly one non-TS asset explicitly, so a new one ships broken if that
 *     step is ever forgotten;
 *   - the remote consumer is a bundled Cloudflare Worker with no filesystem, where a runtime
 *     `readFile` cannot work at all.
 *
 * Three tiers, sized to their delivery channel. Tool descriptions ride in every `tools/list`
 * response and are the only channel that reaches the remote Worker transport from this repo
 * alone (`src/core.ts` exports tools but no server construction), so the per-tool tier carries
 * the load-bearing minimum and must stay short. Server instructions are global and shared.
 * Resources are pull-only — most clients never read one unprompted — so no rule lives there alone.
 */

/** Compact runtime contract included in generated import/export descriptions. */
export const CLOUDFLOW_CODENODE_HINT =
    'codeNode: JavaScript (default) uses $nodes["<node name>"] and $variables; Python uses nodes and variables. ' +
    "Upstream values are lists. A top-level return produces {message: value}; no return gives JS {} / Python {message: null}. " +
    "Bare input is not injected; accessing it as upstream data fails the node. A schema (JSON Schema string) is required.";

/** A saved draft and a completed test run establish different facts. */
export const CLOUDFLOW_BUILDER_HINT =
    "Generated codeNode code can pass validation and fail silently or error at run time, so a successful build shows only that a draft was saved. " +
    "export_cloudflow_flow returns the saved code; a completed test run's per-node output shows whether it works. Test runs execute real actions, including on drafts.";

/** Shared server instructions, kept within the global instruction budget. */
export const CLOUDFLOW_INSTRUCTIONS = `CloudFlow builds and imports save drafts; publishing activates schedules. Test runs execute real
cloud actions even on drafts; dryRun validates without dispatching. Approval-gated actions still
wait for approval. The authoring loop is build or clone -> export and inspect -> dry-run import ->
validate -> test-run when authorized -> read per-node output. A real export supplies node shapes.

codeNode defaults to JavaScript: $nodes["<node name>"] contains lists of upstream results;
$variables holds globalVariables/localVariables. Python uses nodes["<node name>"] and variables.
The code body ends in a top-level return; output is {message: value}. An uncalled function or
assignment without return produces {} in JavaScript or {message: null} in Python. Bare input
is not injected; accessing it as upstream data fails the node. A schema (JSON Schema string) is required.

Validation/import establish structure, not correct behavior. A completed test run's per-node
output shows behavior; input is recorded only for action nodes. Build returns flowId and
conversationId; refine normally returns answer/conversationId and may save nothing.`;

/** The full guide, served as an MCP resource for depth on request. */
export const CLOUDFLOW_AUTHORING_GUIDE = `# CloudFlow authoring over MCP

CloudFlow tools build, inspect, repair, and test automation. Builds and imports save drafts;
publishing activates schedules. A draft can still execute real actions through a test run.

## The authoring loop

1. **Build or clone.** \`build_cloud_flow\` creates a new draft before planning and returns
   \`flowId\` even if planning stops early, plus \`conversationId\`, an answer, and any steps.
   \`refine_cloudflow\` targets an existing flow and normally returns no \`flowId\`; it can
   answer with a plan or clarification question without saving. Both stream progress.
   Reusing \`conversationId\` continues a conversation; another build still creates a new
   draft, whereas refine uses its supplied flow ID. A real export supplies the actual node
   parameter shapes and reference syntax for cloning.
2. **Export and inspect.** \`export_cloudflow_flow\` shows what was actually saved. Comparing
   exports establishes whether refinement changed the saved flow.
3. **Dry-run import.** \`import_cloudflow_flow\` with \`dryRun\` writes nothing and returns
   validation errors, requirement resolutions, and candidate IDs. Real import creates new
   draft IDs; it does not update the source flow.
4. **Validate and test.** \`test_run_cloudflow_flow\` with \`dryRun\` validates without starting
   a run (valid: true or 422 with invalid nodes). Without \`dryRun\`, it executes real actions
   with the bound connections and credentials, even for drafts. Approval-gated actions
   still wait for approval. A missing/unsupported trigger fails validation; an already-running
   flow fails with 409. Valid structure alone does not establish correct behavior.
5. **Read the run.** \`list_cloudflow_flow_runs\` and \`get_cloudflow_flow_run\` expose test runs
   and per-node output as nodes reach terminal status. Only action nodes record \`input\`;
   code, transform, branch, switch, datastore, subflow, and trigger nodes have null input.
   Output is recorded by every finished node. Payloads are capped at 64KB with truncation
   metadata and schema-sensitive values redacted. Completed outputs show actual behavior.

## Triggering published flows

\`trigger_cloud_flow\` accepts a flow ID or webhook trigger URL and a webhook JSON payload
(default {}). It requires a published flow with a webhook trigger: draft 403, no webhook
400, already running 409. It returns executionLink. The generated \`trigger_cloudflow_flow\`
starts published flows with webhook, manual, or scheduled triggers; drafts fail with 422
and running flows with 409. Neither trigger endpoint requires an Idempotency-Key.
The generated trigger/test-run schemas currently expose no arbitrary trigger payload field;
their omitted payload defaults to {}. The hand-written webhook tool accepts a JSON payload.

## Idempotency-key retry semantics

Resource-creating requests (connection create, import, test-run) require an
\`Idempotency-Key\`, including dry-runs. The key is scoped to the caller, tenant, method,
and path. Within the 24-hour retention window:

- Same key and matching request replay the saved response without repeating side effects.
- Same key with a different body or other fingerprinted inputs fails with 422
  (idempotency_key_reused); a matching request still in progress fails with 409.
- Dry-runs validate fingerprints against existing keys but do not reserve a key or store
  a replay response. dryRun itself is excluded from the fingerprint, so an identical
  dry-run and real request can share a key.
- \`create_cloudflow_connection\` takes a caller-supplied \`idempotencyKey\`; it never
  regenerates the key. A new key represents a separate create attempt. A lost response
  or 5xx may follow real side effects; retaining the key allows a safe retry. Test-run
  history (mode test) can also show whether a run started. A replayed failure may require
  a new attempt after its cause is resolved.

## The \`codeNode\` runtime contract

JavaScript is the default language. The code body executes inside an async wrapper;
an uncalled function is not an entry point.

- **Upstream data.** JavaScript uses \`$nodes["<node name>"][0].results[0]\`; Python uses
  \`nodes["<node name>"][0]["results"][0]\`. Maps are keyed by node name and values are lists
  of result envelopes. Results are not objects with an output attribute.
- **Variables.** JavaScript uses \`$variables\`, Python \`variables\`. Each has
  \`globalVariables\` and \`localVariables\` from the trigger result.
- **Return values.** Top-level \`return\` records \`{message: value}\`. Defining an uncalled
  function or assigning output without returning yields \`{}\` in JavaScript or
  \`{message: null}\` in Python. Neither establishes useful work.
- **Bare input.** No upstream \`input\` is injected. JavaScript raises ReferenceError;
  Python's input is a builtin function, and treating it as upstream data fails the node.
- **Schema.** A \`schema\` JSON Schema string describes the output and is required.

## Connections and pagination

\`update_cloudflow_connection\` requires the connection's last observed \`etag\` as
\`ifMatch\`, including quotes. A stale version fails with 412; the MCP tool rejects wildcard
ETags. Supplied gcpConfig/awsConfig and collaborators replace stored values wholesale,
not field by field. Omitted values stay unchanged; an empty collaborator list clears it.
CloudFlow list page tokens expire after five minutes. A missing, null, or empty pageToken
marks the last page.

## Things a bundle cannot carry

Credentials, tenant IDs, schedule activation, execution state, and Slack-channel/policy
references never travel in an exported bundle. The last two appear as unsupportedReferences
and leave nodes incomplete. Schedule configuration travels, but remains inactive until
publication in the destination tenant.

## Tenant scoping caveat

CloudFlow resolves the authenticated customer tenant. An employee key scoped with a
customer ID via \`customerContext\` and X-Tenant-Id targets that customer's tenant.
A domain is not a tenant ID and can fail with tenant_id_mismatch. A tenant-scoped token
also rejects a conflicting X-Tenant-Id. Direct customer keys normally need no explicit
customerContext. Personal-key validation does not establish hosted OAuth coverage.
`;
