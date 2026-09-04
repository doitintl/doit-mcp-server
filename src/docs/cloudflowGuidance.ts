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

/**
 * Appended to the CloudFlow tool descriptions where the rule is actionable at call time:
 * the tools that read, write or run a flow bundle containing code nodes.
 */
export const CLOUDFLOW_CODENODE_HINT =
    'codeNode contract: upstream data comes only from `nodes["<node name>"]` (a dict of lists); ' +
    "the code body must end in a top-level `return`; `schema` is required. Code that defines an " +
    "uncalled function, reads a bare `input`, or assigns `output` completes with `{message: null}` " +
    "— no error, no result.";

/**
 * Appended to the two builder tools. Their generated code is wrong often enough that "it built"
 * is not evidence of anything, and every validation gate passes on the broken shapes.
 */
export const CLOUDFLOW_BUILDER_HINT =
    "Generated codeNode code is frequently broken in ways that pass validation and fail silently " +
    "at run time. Always export_cloudflow_flow and test-run the result, and check the per-node " +
    "output, before reporting success.";

/** The ~12-line tier: server `instructions`. Kept to what changes behavior. */
export const CLOUDFLOW_INSTRUCTIONS = `CloudFlow authoring: nothing runs or publishes until a human publishes, so a draft never has to
be perfect. Build or clone -> export and inspect -> dry-run import -> test-run -> read the
per-node output. Prefer cloning an existing flow over generating from scratch: a real export is
the only ground truth for node parameter shapes and in-node reference syntax.

codeNode is where generated flows break, and it breaks silently. Upstream data comes only from
\`nodes["<node name>"]\`, a dict of lists — there is no injected \`input\` variable. The code body is
executed directly: end it with a top-level \`return\`. A \`schema\` (JSON Schema string) is required.
Code that defines an uncalled function, reads a bare \`input\`, or assigns \`output\` instead of
returning completes with \`{message: null}\` — no error, no result, and every validation gate passes.

Only claim a flow works after a test run completed and the per-node output matched intent. Before
that, say it validated and imported.`;

/** The full guide, served as an MCP resource for depth on request. */
export const CLOUDFLOW_AUTHORING_GUIDE = `# CloudFlow authoring over MCP

The CloudFlow tools let an assistant build, inspect, repair, and test-run automation flows.
The API enforces a few runtime contracts that aren't visible in the tool schemas — get them
wrong and a flow imports cleanly yet does nothing at run time. This note captures the ones
that bite. (The \`dci\` CLI ships a fuller version of this guidance; MCP clients get none of it
otherwise.)

## The authoring loop

Nothing runs or publishes until a human publishes in the builder, so a draft never has to be
perfect to be useful. The reliable loop is:

1. **Build or clone.** \`build_cloud_flow\` creates a new draft from a natural-language
   \`question\`; \`refine_cloudflow\` modifies an existing flow (same \`conversationId\` to continue
   a session). Both stream progress and return the created/updated \`flowId\`, the builder's
   \`answer\`, and the \`steps\` that ran. Prefer cloning the closest existing flow
   (\`list_cloudflows\` → \`export_cloudflow_flow\`) over generating from scratch — a real export
   is the only ground truth for node parameter shapes and in-node reference syntax.
2. **Export and inspect.** Always \`export_cloudflow_flow\` the result and read it before
   trusting it. A \`refine_cloudflow\` round can answer with a plan yet save nothing — re-export
   and diff rather than believing the change happened.
3. **Dry-run import.** \`import_cloudflow_flow\` with \`dryRun\` writes nothing and returns every
   validation error at once, plus each requirement's resolution and candidate IDs. Fix and
   repeat until the plan is clean.
4. **Deep-validate, then test-run.** \`test_run_cloudflow_flow\` with \`dryRun\` runs the
   server-side validator (accepts drafts, returns \`valid: true\` or a 422 listing every invalid
   node). The same call without \`dryRun\` starts one test run.
5. **Read the run.** \`list_cloudflow_flow_runs\` lists a flow's runs; \`get_cloudflow_flow_run\`
   returns per-node \`input\`/\`output\` once each node reaches a terminal status. Only claim "the
   flow works" after a test run completed and the per-node outputs matched intent. Before that,
   say it validated and imported.

## Idempotency-key retry semantics

Mutating CloudFlow requests (real import, \`test_run_cloudflow_flow\`) require an
\`Idempotency-Key\` — they are rejected (\`idempotency_key_required\`) without one. The key is a
safety line, not a formality:

- Retrying with the **same** key can never start a second run. On a 5xx, the run may have
  started even though the response failed — check \`list_cloudflow_flow_runs\` (mode \`test\`)
  before minting a new key.
- A genuine infrastructure failure inside a run (e.g. a transient BigQuery error) is retryable
  with a **new** key. A flow bug is not — fix the flow first.

## The \`codeNode\` runtime contract

\`codeNode\` is where generated flows most often break. The builder's generated code varies run
to run and has shipped broken conventions, so **expect to repair code nodes** via
export → edit → import.

- **Upstream data comes only from \`nodes\`.** \`nodes\` is a dict keyed by node **name**, whose
  values are **lists** at run time, e.g. \`nodes["getDailyUsage"][0]["results"][0]["data"]\`.
  There is no injected \`input\` variable — a bare \`input\` in code is Python's builtin, not
  upstream data. Node values are never objects with an \`.output\` attribute.
- **Return, don't assign.** The platform executes the code *body* directly: write top-level
  statements ending in a top-level \`return {...}\`. Defining a function nothing calls (e.g.
  \`def handler(input)\`), or assigning to a variable named \`output\` instead of returning, both
  leave the node completing with \`{message: null}\` — no error, no result.
- **\`schema\` is required.** \`codeNode\` needs a \`schema\` (a JSON Schema *string* describing the
  node's output); test-run validation rejects a codeNode without one.

## Things a bundle cannot carry

Credentials, tenant IDs, schedule *activation*, execution state, and Slack-channel/policy
references never travel in an exported bundle (the last two export as \`unsupportedReferences\`
and leave nodes flagged incomplete). A schedule trigger's *configuration* (frequency, run
times, time zone) does travel — it just stays inert until the imported draft is published.

## Tenant scoping caveat

CloudFlow endpoints currently reject customer-context impersonation (\`tenant_id_mismatch\` —
the tenant must match the bearer token). A DoiT-employee token still passes \`customerContext\`
to scope the request, but flows land in the token's own tenant; direct-customer tokens need no
\`customerContext\`.
`;
