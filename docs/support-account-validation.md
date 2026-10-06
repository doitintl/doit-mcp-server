# Support and account tool validation

## Real development API comparison — 2026-10-06

PR [#330](https://github.com/doitintl/doit-mcp-server/pull/330), branch
`fix/support-account-contracts`, was compared at feature commit
`dbf486226221f892d552ded8faacfdd841a7736d` against pre-change base
`15b6b1cb058751858d8792d631f59f8d97577c23`.

Both exact Git snapshots were extracted into separate disposable directories, independently
installed with Yarn 1.22.22 using frozen lockfiles, and built on Node 22.23.2. Existing
checkouts were not switched or rebuilt. SDK stdio clients called each snapshot's actual
`dist/index.js` against **https://api-dev.doit.com**, using the repository API-testing
credential helper's DEV personas. Credentials were supplied only through process environments.

**142 MCP tools/call requests produced 131 real API GET requests.** Eight create-tool dry runs
were included: three failed local validation and five reached a hard write guard before the
network. They are **not live write validation**. Additional tools/list and prompts/get calls
checked metadata. No fixtures, published package, or synthetic API successes were used for
live reads.

A transparent fetch observer returned genuine API responses unchanged, recorded only limits,
statuses, counts and boolean assertions, and blocked every non-GET request. API responses and
MCP results were inspected separately. Customer text, emails, resource IDs, cursor values and
credentials stayed in memory and were not recorded in this evidence.

| Case | Baseline | Feature | Evidence |
| --- | --- | --- | --- |
| `list_tickets {pageSize:1/3/100}` | HTTP 200; `pageSize` plus default `maxResults=40`; API and MCP return 40. | HTTP 200; `maxResults=1/3/100`; API and MCP return exactly 1/3/100. | **Paging defect reproduced and fixed live.** |
| Ticket sizes 0, 101, 1.5 | HTTP 200 and 40 tickets despite invalid input. | MCP validation errors; no HTTP. | Correct failure paths. Omitted size still returns 40 in both. |
| Same ticket cursor and requested size | Returns 40. | Sizes 1/100 remain 1/100 on page two; IDs disjoint. | Live continuation. Prompt explicitly retains size 100; five-page bound preserved. |
| Ticket subject / asset name substring | Matching already works. | Same implementation. | Uppercase and absent substrings verified. Raw API retains items; MCP filters them and preserves exact API cursor and unfiltered rowCount, including empty matches. |
| Asset type filters | Bracketed type returns zero despite matching unbracketed results. | Corrected guidance uses unbracketed values; repeated g-suite/office-365 types return eight assets with both types present. | Documentation correction; **both builds behave identically for equivalent inputs**. Unsupported name server filter gives API 400 / MCP error in both. |
| Asset lookup | Existing behavior. | Identical. | Disjoint pages, ID precedence, uppercase resolution, ambiguity and absent-name errors verified. Lookup requests 249 entries; only 70 available. |
| Support catalogs | Nine platforms / 870 products; live finance/credits IDs fail create schema. | Same catalogs; finance/credits pass guarded create validation. | Live catalog compatibility plus local schema fix, **not successful creation**. Product filters return 193/18/3/56; invalid platform gives API 400 / MCP error; no private products returned. |
| Created timestamp / product displayName | Missing timestamp fails locally; supplied timestamp forwarded. | Omission reaches guard; supplied timestamp stripped; Invoice Management displayName forwarded unchanged. | Built MCP dry-run evidence only. Live catalog confirms displayName differs from ID; routing and successful creation unverified. |
| Users / roles | 158 users; 56 roles. | Identical; every user roleId resolves. | Compatibility only. No pending invitations present; invite behavior not exercised. |
| Commitment filters / reads | Documented bracketed AWS provider returns zero; unbracketed provider returns three. | Corrected guidance uses unbracketed provider; provider/cloudProvider aliases return the same three AWS commitments. | Documentation correction; identical runtime for equivalent inputs. Detail ID, disjoint pages of two then one, duplicate-key/alias API 400 / MCP errors verified. |
| API rejection vs MCP error | Bad cursor 400, invalid token 401, no-permission persona 403, missing commitment 404. | Same statuses and generic MCP `isError:true` responses. | Regression coverage. Shared HTTP helper swallows API details/status; neither build provides an MCP auth challenge for 401. |
| Unchanged account reads | Four organizations, five account-team entries, 40 invoices with cursor. | Identical counts. | Compatibility only; no account resources changed. |

Counts come from existing dev data, not fixtures. Identical-input pairs distinguish runtime
fixes from corrected guidance: filter descriptions change what callers are instructed to
send, not filter execution. No additional feature-code defect was found.

## Remaining coverage gaps

- No live ticket/comment creation: no deletion endpoint; auto-closing probe tickets leaves
  permanent resources. No invitations/user mutations: invitations send email immediately.
  Successful writes, product routing, invite defaults, domain rules and duplicate/pending-invite
  restrictions remain deterministic-test/source evidence.
- Pending-user examples, organization ticket-sharing visibility and exhaustive account-specific
  catalog availability were not established live.
- Positive Google Cloud/Azure commitments were unavailable. Integer limits 0/501 returned all
  three commitments; 1.5 gave API 400 / MCP error. This dataset cannot establish the exact
  fallback page size of 50.
- Lookup beyond 249 assets remains fixture coverage because dev had only 70. Hosted OAuth and
  switched-customer authorization remain unverified; concurrent scope query/header forwarding
  is deterministic coverage.
- Upstream related-user lookup truncates combined requester/assignee IDs to 100. A live feature
  page of 100 tickets had zero missing requester fields: the defect was **not reproduced**
  in this sample. A separate API batching fix remains necessary.

## Cleanup and repository checks

**Zero remote writes, zero created resources, remaining resource IDs: none.** MCP processes
were closed in finally blocks; temporary encrypted credential caches were removed and absence
independently verified. Disposable build directories were removed after recording redacted
evidence; existing checkouts and lockfiles were preserved.

Both isolated builds passed. Feature code previously passed 1,148 root tests, 266 integration
tests, all 106 existing schema-parity tests, `yarn check:dev`, `yarn check:ci` and `yarn build`.
Deterministic write tests use intercepted synthetic APIs and are not live evidence. This
documentation update also passed `yarn check:dev`, `yarn check:ci` and `git diff --check`.

Required CI is verified against the current head after publishing evidence; status is reported
on the PR, not inferred from earlier commits.

## Earlier validation

Earlier 27 reads on 2026-10-05 and two review follow-up reads on 2026-10-06 used the
own-customer production backend. They are separate compatibility evidence, not counted above.
The existing opt-in `test/integration/live/supportAccountReads.mjs` performs bounded
production reads. This dev comparison used isolated builds, an explicit dev API base and a
GET-only network guard.
