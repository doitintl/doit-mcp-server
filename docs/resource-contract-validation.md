# Resource tool contract validation

Validated on 2026-10-05 using Yarn 1.22.22, the built local stdio server and MCP `tools/call`. The opt-in harness is `test/integration/manual/resource-contracts.mjs`; it requires `RUN_RESOURCE_LIVE=1` and `DOIT_OWN_CUSTOMER_API_KEY`, passed to the child as `DOIT_API_KEY`. It is outside both default test suites. No credentials, customer data, resource IDs or owner addresses are recorded here.

## Live semantic checks

All writes used uniquely named, disposable resources created by the session. Angle-bracket values below represent those fixtures.

| Tools and redacted input | Readback assertion | Result |
| --- | --- | --- |
| `update_allocation {id:<single>, description:""}` | Name and rule unchanged; description remains unchanged because the API ignores empty descriptions | Confirmed API limitation; documented, not claimed as clearing |
| `create_allocation` with an `allocation_rule` component referencing `<single>` | Creation succeeds with the nested-rule component type | Passed |
| `update_allocation {id:<single>, rule:{components:[{key:"project_id",type:"fixed",mode:"regexp",values:["<unique-pattern>"]}],formula:"A"}}` | Saved component retains `regexp` | Passed |
| `create_allocation` with three `{action:"select",id:<single>}` rules; `get_allocation` | All three group rules and `unallocatedCosts` survive tool output mapping | Passed |
| `update_allocation {id:<group>,unallocatedCosts:"Remaining"}` | Label changes without name/rules; omitted name, description and rules remain unchanged | Passed |
| `update_allocation {id:<group>,rules:[<second>,<first>]}` | Full membership replacement removes the third rule, preserves order and omitted unmatched-cost label | Passed |
| Group rule `action:"update"` followed by `get_allocation` for the member | Saved member name changes | Passed |
| `update_allocation {id:<group>,unallocatedCosts:null}` | Stored unmatched-cost label remains unchanged | Passed |
| `update_label {id:<label>,name:null,color:"teal"}` | Name preserved, color updated | Passed |
| `create_annotation` with timestamp `2026-10-05T12:00:00+01:00` | Saved timestamp represents `2026-10-05T11:00:00Z` | Passed |
| Content-only annotation update | Timestamp, labels and reports preserved | Passed |
| Annotation update with required content and `timestamp:null,labels:null,reports:null` | All three omitted-equivalent fields preserved | Passed |
| Annotation update with required content and `labels:[],reports:[]` | Lists cleared | Passed |
| `assign_objects_to_label` add/remove of `<annotation>` | `get_label_assignments` reflects both changes | Passed |
| `list_annotations` with `maxResults:"1"`, exact content and each supported sort | `id`, `content`, `timestamp` return the fixture; uppercased content does not match | Passed |
| Folder description null, then empty string | Null preserves description; empty string clears; omitted name/parent preserved | Passed |
| Move disposable child folder to `root` | Parent changes, name preserved | Passed |
| Rename a newly created, unused theme, then change colors | Rename preserves colors; color update preserves name; 3/6/8-digit hex accepted | Passed |
| `update_resource_permissions` on a new private report, first `public:null`, then omitted public | PUT succeeds; identical sole-owner list and private visibility read back after both calls | Passed |
| `get_active_theme` before and after all theme checks | Active theme unchanged; no `set_active_theme` call | Passed |

An initial allocation clearing assertion failed because the API intentionally skips empty descriptions. The harness and tool description were corrected after checking the service implementation. The remaining allocation scenarios were then run on fresh fixtures. The two runs created 12 resources in total; all 12 were deleted through MCP with explicit confirmation only for the session's IDs, followed by failed retrieval readbacks.

## Read-only diagnostics and audit discrepancies

- `list_allocations {}` returned 40 rows and a next-page token. The shared request helper supplies `maxResults=40`; the old claim that the tool returns the entire list was incorrect. Name filtering remains local to the returned page.
- Annotation `createTime`/`updateTime` sorts fail through the built MCP tools. Bounded HTTP diagnostics returned 500 (`invalid field to sort by: timeCreated/timeModified`); `timeCreated`/`timeModified` returned 400. Only `id`, `content`, and `timestamp` are advertised. The API sort mapping needs an upstream correction.
- Annotation timestamps bind to RFC 3339 `time.Time` in the API. Offset support is grounded in that contract and confirmed live; local dates, missing timezones and missing seconds remain invalid.
- Theme listing is unpaginated, so theme name lookup searches all returned custom themes. Allocation, annotation, label and folder lookups request only the first 200 items. All use case-insensitive substring matching, error on ambiguity, and prefer an explicit ID.
- Folder listing has no filter input. Allocation listing exposes a page-local `name` input rather than the API's shared exact-match filter. Inline repeated-key/exact-match guidance applies to the label and annotation tools that actually expose that parser.

## Coverage boundaries

Deterministic tests cover malformed group rules, required permission lists/content, schema parity, timestamp/color/palette validation, lookup ambiguity and ID precedence, and explicit customer-context forwarding (including both requests in name lookups). Existing protocol integration tests exercise both SDK generations.

No live hosted OAuth or switched-customer session was available; personal-key validation does not establish that coverage. No live ownership transfer, public sharing, access grant, active-theme switch, preset mutation or modification of another user's theme was attempted. Group `create` actions inside a group are covered deterministically; live group checks use explicitly tracked member allocations. Annotation report-list clearing used an already empty reports list; nonempty report associations, folder collision/self/descendant failures and permission-denial fixtures were not live-tested. Permission testing retained the sole owner and private visibility; it cannot establish a public-to-private transition without violating the test constraints.

The existing shared request helper suppresses upstream HTTP errors. That infrastructure behavior is outside this change; raw HTTP was used only to diagnose annotation sort failures, not as evidence that a tool works.
