# Support and account tool contracts

Validation performed on 2026-10-05 using the local build and Yarn 1.22.22 on Node 22.23.2.

## Changes and contract decisions

| Tools | Result |
| --- | --- |
| `list_tickets` | `pageSize` is an integer from 1 to 100 and is sent as `maxResults`. Omission preserves the tool's previous effective default of 40. Invalid values fail before HTTP. Responses describe severity and organization sharing visibility. |
| `create_ticket` | `created` remains optional for compatibility and is omitted from HTTP requests because the server owns creation time. Platform uses the support catalog ID; product uses the catalog displayName, forwarded unchanged for API routing. Existing platform IDs were retained; `finance___billing` and `credits___request` were added after source and live catalog verification. |
| `list_tickets`, `list_assets` | Subject/name substring matching is explicitly limited to the returned page. The API has no corresponding server-side substring filters: tickets support severity/status, assets support type. Cursors and server row counts remain available even when no local matches exist. No automatic page scanning was added. |
| `list_assets`, `get_asset` | Descriptions identify type as the sole server filter key, exact case-sensitive values without brackets, and repeated type keys as OR. Asset name lookup searches the first 249 entries, errors on multiple matches, and gives ID precedence. |
| `list_platforms`, `list_products` | Descriptions identify support-ticket catalogs, fixed platform IDs, and customer exclusion of private products. |
| `list_users`, `invite_user` | Descriptions include pending invitations, roleId resolution via `list_roles`, the Support User invite default, customer domain policy, and existing-user/pending-invite duplicate restrictions. |
| `list_commitments`, `get_commitment` | Descriptions cover spend commitments across Google Cloud, AWS and Azure. Provider filters use unbracketed exact values; `cloudProvider` aliases `provider`. Repeated keys or aliases are rejected. `maxResults` accepts 1–500; the API falls back to 50 for out-of-range integers and rejects non-integers. |

The already accurate ticket detail/comment, invoice, role, organization, user update and account-team implementations were left unchanged. Parameter text remains inline in the exported Zod schemas; stdio schemas remain derived with `zodToMcpInputSchema`.

## Deterministic validation

- Affected tools plus the existing schema parity suite: **250 tests passed**. The parity file was preserved unchanged, including its 106 tests.
- Full root suite: **1,148 tests passed** across 53 files.
- Full integration suite: **265 tests passed** across 14 files, including built CLI protocol checks and the new MCP request-contract tests.
- `yarn check:dev`, `yarn check:ci`, `yarn build` and `git diff --check`: passed. No npm lockfiles were introduced.
- Regression coverage verifies page-size boundaries/defaults, page-local matching with preserved cursors, asset lookup bounds/ambiguity/ID priority, optional ignored ticket timestamps, all nine support platform IDs, pending-user role IDs, invite omission/validation/API rejection handling, and concurrent explicit customer scopes through shared dispatch into both the query and `X-Tenant-Id` header.

Write-contract integration tests use `rawClient` against an intercepted synthetic API; no auto-confirming live client helper was used. Invite domain and duplicate checks remain server-authoritative. Rejections are exposed as tool errors; detailed API errors remain limited by the existing shared HTTP helper, outside this change's scope.

## Redacted live evidence

The key was available as `DOIT_OWN_CUSTOMER_API_KEY` in the environment and passed only as `DOIT_API_KEY` in the child environment. The harness connected to the newly built `dist/index.js` via stdio and issued **27 read-only MCP `tools/call` requests with zero failures**. Two preliminary catalog reads identified the missing platform enum values. No raw HTTP calls or published package were used as validation evidence.

| Calls and redacted inputs | Outcome and semantic assertions |
| --- | --- |
| `list_tickets {pageSize:1}`, then `{pageSize:1,pageToken:<previous response>}` | One ticket per page, cursors present, distinct ticket IDs. |
| `list_tickets {pageSize:3}` | Three tickets returned, confirming the requested size changes the API page. |
| `list_tickets {pageSize:1,subject:<uppercase subject from page>}` and a synthetic absent subject | One and zero matches respectively; server rowCount remained 1 and the original cursor was preserved. |
| `list_assets {maxResults:"2"}`, then `{maxResults:"2",pageToken:<previous response>}` | Two assets per page, distinct IDs, cursors present. |
| `list_assets {maxResults:"2",name:<uppercase name from page>}` and a synthetic absent name | One and zero matches respectively; server rowCount remained 2 and the original cursor was preserved. |
| `get_asset {id:<previous response>}` | Returned ID matched the requested ID. |
| `list_assets {maxResults:"2",filter:"type:amazon-web-services"}` and repeated types including g-suite/office-365 | Both accepted, at most two results, all returned types within the exact requested set. This sample did not demonstrate nonempty results from multiple types. |
| `list_platforms {}` | Nine IDs returned; every ID was accepted by the local create-ticket schema without `created`. No creation occurred. |
| `list_products {}` and platform filters `google_cloud_platform`, `finance___billing`, `credits___request` | 817, 193, 18 and 3 products respectively. No private products; filtered products had the requested platform. |
| `list_users {}`, `list_roles {}` | 42 users and 18 roles; every returned user roleId resolved to the role catalog. No pending invites were present. |
| `list_organizations {}`, `list_account_team {}`, `list_invoices {}` | Five organizations; no account-team entries or invoices. |
| `list_commitments {maxResults:"2"}` and provider filters for all three providers plus `cloudProvider:google-cloud` | All accepted with empty lists. No commitment cursor or ID was available. |

Customer text, emails, IDs, cursor values and credentials were neither logged nor saved. Only redacted inputs, counts, outcomes and semantic assertions were recorded.

## Reproducing the optional live reads

Install both projects with the pinned Yarn 1, build at the repository root, and supply the own-customer key through the environment or your configured secret source. Then run from the repository root:

```sh
DOIT_LIVE_READS=1 node test/integration/live/supportAccountReads.mjs
```

The harness is excluded from the default test suites, allows only a fixed list of read tools, makes at most 30 calls, follows at most one additional page for tickets/assets/commitments, and suppresses child stderr to avoid leaking HTTP error content. Credentials and raw responses are never printed.

## Coverage limits and cleanup

- Live ticket creation, comments, invitations and user changes were **not exercised**. Their request contracts and validation use deterministic tests.
- Empty account data prevented live commitment detail/pagination/positive provider matching, invoice detail/pagination, account-team content and pending-invitation examples.
- Hosted OAuth and live switched-customer behavior were **not exercised**. Deterministic scope forwarding passed, but a personal API key does not establish those hosted behaviors. The hosted consumer must adopt a release containing these shared-core changes before deployment validation.
- No resources were created or changed by the harness, so no resource cleanup was required. Child MCP processes were closed.
- The initial PR revision passed the repository's Node 20/22 CI matrix. Local validation used Node 22.

## Review follow-up

- On 2026-10-06, the updated branch passed 1,148 root tests, 266 integration tests, schema parity, `yarn check:dev`, `yarn check:ci`, and `yarn build`.
- Corrected product guidance to use `list_products.displayName`, while platform remains `list_platforms.id`. The API forwards product unchanged, and routing exemptions such as Invoice Management compare display names. A deterministic catalog-to-create test verifies the exact display name in the request; no live ticket creation is used.
- The bounded ticket-search prompt preserves `pageSize=100` on each subsequent `pageToken` call, retaining its five-page limit.
- Two read-only checks through the rebuilt stdio server passed: `list_products {platform:"cloud_management_platform"}` contained Invoice Management with distinct id/displayName values and its displayName passed the create schema; `prompts/get search_expert_inquiries` retained both pageSize and the five-page bound. No live creation was attempted.
- Confirmed an upstream API dependency: the related-user lookup combines requester and assignee IDs, then truncates that set to 100. A ticket page with more than 100 distinct related users can therefore have incomplete requester fields. The API needs deduplicated lookup batches of at most 100 IDs and a combined result. This cannot be repaired in the MCP response formatter; it remains a separate API change outside this PR.
