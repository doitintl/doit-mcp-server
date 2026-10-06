# Diagram, DataHub, and AWS contract validation

## Real development API comparison — 2026-10-06

PR: https://github.com/doitintl/doit-mcp-server/pull/331

- Branch: `fix/diagram-datahub-aws-contracts`.
- Feature snapshot: `d1847b7c9dd7d32b52f56df73739201ad3fbfd02`.
- Pre-change baseline / merge base: `15b6b1cb058751858d8792d631f59f8d97577c23`.
- Additional pre-review baseline: `456507a3554fa1fa976247feb6dd348caadc451a`.
  This isolates the component-limit and access-check changes made during review.
- Backend: `https://api-dev.doit.com`, using the repository's API-testing
  credential helper and development persona credentials. Secrets stayed in
  process memory/environments; none were printed, saved, or committed.

All three snapshots were exported into separate temporary directories, installed
with frozen Yarn 1.22.22 lockfiles, and built with Node 22.23.2. Existing checkouts
were not reset or rebuilt. Each comparison launched the actual built
`dist/index.js` as a child process and called it through an MCP SDK stdio client.
No fixture server, mocked fetch response, or in-memory MCP server was used.
A fetch wrapper recorded only redacted endpoint/status metadata and forwarded
requests to the real backend. Separate direct HTTP reads checked the API body
and cursor header against what the MCP caller received.

Equivalent inputs used the same persona, backend, IDs, time window, and page
size in each before/after pair. Resource identifiers, dataset names, cursors,
records, and cost values were retained only in memory. Counts below are redacted
aggregates. Export reads used `maxResults=1` and a 365-day window; component
comparisons loaded at most six layers, without broad unbounded component reads.

| Case | Before | Feature MCP result | What this establishes |
| --- | --- | --- | --- |
| One existing diagram selector | Original baseline returned all 119 accessible diagrams. | Returned exactly the selected diagram. | Filter defect reproduced and fixed in real calls. |
| One existing layer; components omitted/false/true | Original baseline ignored the layer selector, returned 119 diagrams, and omitted the layer/component map even when true. | Returned one layer; omitted component maps by default/false; true returned one projected group, matching the direct API result. | Layer selection and component loading reproduced and fixed. |
| Selected diagram with two layers, components=true | Original baseline returned all diagrams and no component map. | Returned the selected diagram and both layer maps. | Diagram-to-layer resolution works live. |
| Unknown or mixed known/unknown diagram IDs | Original baseline silently ignored IDs and returned all diagrams as success. | MCP `isError=true`; only scoped discovery reached the API. | Invalid-selector failure path fixed. |
| Six explicit or resolved component layers | Pre-review baseline loaded six component maps with HTTP 200. | MCP batching error; zero component reads. Explicit selection made zero HTTP calls; resolved selection performed metadata reads only. | Five-layer guard works live; original baseline never loaded these components. |
| Another dev persona's diagram, alone or mixed with an owned diagram | Original baseline ignored selectors; pre-review baseline received API 403 and returned an MCP error. Neither leaked metadata. | Scoped discovery followed by an MCP access error, without a targeted read. | Defense verified; reported cross-customer leakage did **not** reproduce on this dev backend. |
| CSV and JSONL export page 1 | API supplied a cursor; original baseline returned only the raw body, losing the cursor. | `{data, pageToken}` preserved the exact API body and header cursor. | Cursor-loss defect reproduced and fixed in both formats. |
| Export page 2 | Baseline could advance only when the tester supplied the cursor obtained outside MCP. | Used the cursor from the feature MCP result; body/cursor matched the API, advanced, and JSONL event IDs differed. | Caller can paginate using MCP alone. Manual baseline cursor input is compatibility evidence. |
| Empty final export | API HTTP 200, empty body, no cursor; baseline returned empty text. | `{data: "", pageToken: null}`. | Final-page behavior verified live. |
| Invalid cursor / reversed export window / invalid credentials | API 400 / 400 / 401; baseline MCP errors. | API failures remained MCP `isError=true`, with no success envelope. | Error-path compatibility, not additional fixed defects. |
| displayName-only / logoName-only update, nonexistent target | Baseline rejected the new fields before an HTTP request. | Accepted the tool arguments, reached the API, and returned an MCP error for API 404. | Field routing and missing-target errors verified; successful updates are unverified. |
| Unsupported logo / 65-character display name, nonexistent target | Baseline rejected these new-field-only requests locally. | API 400 became MCP errors. Null/empty updates were rejected locally. | Live API validation/error coverage; no resource was updated. |
| Azure-shaped supported-feature ID | Baseline called the API, received 404, and returned an MCP error. | Local 12-digit AWS validation error; zero HTTP requests. | Advertised-input validation corrected. A valid-format unknown AWS ID produced 404/MCP errors in both builds. |
| `skip_empty=true` | Baseline retained 119 diagrams while layer metadata dropped from 238 to 97; 55 diagrams had no remaining layers. | Identical behavior. | Layer-only description verified; no runtime defect reproduced. |

## Compatibility and coverage limits

- Cost snapshots succeeded through both built MCP servers and matched the direct
  API's `trendingPct=null`. Top-resource/service and trend arrays respected their
  advertised bounds. No non-null percentage was observed, so the numeric
  percentage-unit example remains source/fixture coverage. The upstream total
  calculation is unchanged and was not qualified as a fixed defect.
- Search with an owned or unknown layer ID left the scheme category unchanged;
  per-category `size=1` held in both builds. Activity and node-activity reads
  succeeded identically. Resource relationships returned an identical empty,
  untruncated result; this does not exercise the 200-relation truncation boundary.
- Dataset lookup by name succeeded in both builds and returned metadata without
  a full column schema. These are compatibility checks, not fixed payload bugs.
- Built `tools/list` showed `find_cloud_diagrams.readOnlyHint` changing from true
  to false and the revised export/event descriptions. An attempted synthetic
  unmatched find lookup reached the API: this tool has no server-side dry-run
  gate. Independent read-only search then returned zero matches in all three
  categories; the backend exits before creating filters/images when no nodes
  match. This is not evidence for matched-resource rendering. No matched find,
  image rendering, or workflow execution was performed.
- No connected AWS account ID was available from the bounded discovery. Successful
  AWS/standalone supported-feature lookup, permission flags, and real-time bucket
  semantics remain unverified; fixtures cover the changed schema.
- Valid dataset set/clear operations were not attempted. Current API-testing
  instructions flag dataset deletion timeouts; the deletion API's 202 response
  also does not confirm cleanup. A nonexistent-name DELETE returned 404, which
  establishes routing/authentication but not reliable deletion of a created
  dataset. Consequently, no dataset or event was created for this validation.
- Event acceptance, duplicate-ID atomicity, fixed-dimension/boolean restrictions,
  timestamp bounds, and the 255-metric limit were not exercised through successful
  ingestion or authenticated semantic-negative writes. Description/schema and
  fixture coverage must not be counted as live verification of those behaviors.
- Exactly-five-layer loading, special/empty cursor headers, changing CSV columns,
  hosted OAuth, hosted response-size behavior, and switched-customer OAuth remain
  fixture-only or unverified live. The layer cap does not bound an individual
  layer's size.

## Cleanup

Remote resource ledger: **no created resources, no successful updates, no
remaining resource IDs**. Only existing resources were read. Negative PATCH
requests used a fresh nonexistent name, independently verified as HTTP 404
before and after. No event ingestion, dataset creation, deployment, publication,
or merge was performed. The synthetic find input independently had no matches,
so no filter/image cleanup was required. Temporary snapshot/build/auth dependency
and redacted trace directories were removed after recording this evidence.

No feature runtime defect was found in the initial development comparisons.

## Final synchronization and recheck

Before CI could start for the evidence commit, main advanced to
`e5845c45c13e4c48ea63c4873e044e7aecfc4444` and the PR conflicted in a diagram
request expectation. The branch was synchronized with main while retaining the
corrected selector DTO. Component discovery/loading requests use the new safe
read retry advice; `find_cloud_diagrams` retains the mutation warning because a
matched lookup creates filters and queues rendering. A simulated 503 regression
check covers that warning; no live rendering was forced to fail.

Latest main was built as a new isolated baseline, alongside the synchronized
feature source. Actual development MCP calls reproduced the same selector and
CSV/JSONL cursor defects and confirmed their fixes again. Component defaults,
six-layer rejection, unknown/mixed selectors, empty exports, invalid cursors,
new-field 404 routing, invalid-logo 400, Azure-shaped ID rejection, and 401 MCP
errors were rechecked. HTTP status details from main's new error handling were
preserved. Negative PATCH targets remained 404 before and after, with no resource
creation or successful update. The second set of temporary build/auth/trace
directories was also removed. No dependency pins were changed relative to main.

## Repository checks (separate from live validation)

The synchronized feature passed on Node 20.20.2 and 22.23.2: 1,213 unit tests,
289 integration tests, and builds, retaining all 106 schema-parity cases. The
original feature snapshot passed 1,137 unit and 267 integration tests on both
versions. `yarn check:dev`, `yarn check:ci`, and diff checks passed. These tests include
mocked header handling and legacy/modern transport coverage and are not counted
as real API validation above. The three live snapshots were built independently
on Node 22.23.2. Required CI is checked on the final synchronized head after pushing.

## Earlier live evidence — 2026-10-05

An earlier built local MCP read used a customer credential against the default
API. DataHub export advanced across two one-row JSONL pages; diagram discovery
returned 401, and no filtered diagram coverage was possible. The development
comparison above supersedes that limitation. The existing opt-in
`test/integration/live/datahubDiagrams.mjs` is a bounded single-build smoke
harness; its earlier run is not the before/after development comparison.
