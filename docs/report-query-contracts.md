# Report and query contracts

The report tools share Zod schemas; stdio input schemas are derived from them, and the core
export supplies the same argument schemas to hosted consumers.

- Custom queries and new reports use `config.timeRange: {"mode":"custom"}` and sibling
  `config.customTimeRange: {"from":"…","to":"…"}`. A custom range cannot have a unit.
  Dates are RFC3339 timestamps, including offsets; the API queries inclusive UTC calendar days.
- Relative `last` ranges require amount and unit; `current` requires unit and covers the
  calendar period through its end. For `last`, `includeCurrent: true` counts the partial
  current period within amount. One month with `false` is the previous full month.
- Omitted filter mode uses the API's `is` default. Exact values can be provider IDs or service
  names, depending on the dimension. `get_dimension` returns the available values.
- Group limits select dimension values per parent group across the range, not result rows.
  Time columns can produce several rows per group. The convenience tools cap top-N at 25;
  `run_query` does not impose that cap.
- `compare_spend` returns two independent top-10 group selections with monthly rows. Period 1
  includes the partial current month; period 2 uses the requested dates. It does not compute a diff.
- `get_dimension` forwards customer context and accepts the dimension-type enum including
  `allocation` and `allocation_rule`. `list_dimensions` returns metadata only, 200/page,
  sorted by ID, without GKE dimensions. Its `type` and `label` filters are exact and
  case-sensitive; repeated keys are rejected. The upstream `key` filter currently matches
  no dimensions and is not repaired here.
- Saved report results use the stored range. Name lookup searches only the first 200 newest
  reports, errors on ambiguity, and gives an explicit ID precedence. `list_reports` returns
  up to 40 reports per page, newest first; rowCount is the current page count.
- Creation is additive, applies API defaults, and rejects system labels. Updates replace
  supplied filters/groups/dimensions/splits arrays; empty arrays clear them. Non-empty metrics
  replaces metrics, while empty metrics leaves them unchanged. Labels replaces non-system
  labels. A supplied config without dataSource resolves to the customer's billing or
  billing-datahub default; timeInterval with dimensions omitted resets time columns.
  Date-only patches preserve the saved timeRange, and the effective mode must be custom.
- Overview costs span 30 days including today with daily rows, top 5 services/projects per
  cloud, and at most 5 anomalies and 5 AWS/Google Cloud provider incidents. Failed sections
  become empty arrays, so an empty section does not prove that no data exists.

## Regression checks

Tests cover request bodies and context propagation, invalid mode/date/unit combinations,
RFC3339 offsets and date order, layouts, optional filter mode, helper ranges and grouping,
partial updates, bounded/ambiguous lookup, overview partial failures, and schema parity.
The existing schema parity coverage remains intact, with additional report contract assertions.
Shared request-error handling is unchanged.

## Opt-in live validation

Install with pinned Yarn 1 in the root and `test/integration`, then build from the root:

```sh
yarn install --frozen-lockfile
yarn --cwd test/integration install --frozen-lockfile
yarn build
# DOIT_OWN_CUSTOMER_API_KEY must already be set in the environment.
DOIT_LIVE_REPORT_CONTRACTS=1 yarn node test/integration/live/reportContracts.mjs
# Also authorize one uniquely named disposable report and its cleanup:
DOIT_LIVE_REPORT_CONTRACTS=1 yarn node test/integration/live/reportContracts.mjs --disposable-report
```

The harness is outside the default Vitest include patterns. It launches this checkout's
built stdio server with the key passed only through the child environment as `DOIT_API_KEY`.
It limits calls to 24 and does not use the integration helper's automatic confirmation.
Only deletion of the report created by this run is explicitly confirmed. It records a local
mode-0600 cleanup journal in the system temporary directory before creation; uncertain writes
are not replayed. Raw customer rows, costs, tokens, names, and IDs are not printed as evidence.
Numeric aggregates use relative/absolute tolerance `1e-9` for floating-point summation, while
dates, grouping, and schema must match exactly. Live data changes can still cause a failure.
The account must have data for the selected provider in the tested dates; empty results cannot
establish date semantics.

## Recorded validation — 2026-10-05

Redacted inputs and semantic checks against the built local server:

| Call | Input | Verified outcome |
| --- | --- | --- |
| `run_query` | billing cost, daily, custom September 1–2, provider filter with mode omitted | Two rows dated September 1 and 2; only the selected provider |
| `run_query` | Same config with mode `is` | Same dates and results |
| `compare_spend` | period1Months 2, period2 September 1–2, groupBy cloud, provider filter | Period 1 matched explicit September 1–October 5 monthly query; period 2 matched explicit September 1–2 monthly query |
| Daily reference query | September 1–October 5 | First returned day September 1; current-month rows present; latest available day October 4 |
| `create_report` + `get_report_config` | Uniquely named disposable report with custom dates and omitted filter mode | Dates, custom mode without unit, and filter persisted |
| `update_report` + `get_report_config` | Changed dates, empty filters/group, daily interval, omitted source | Dates persisted, arrays cleared, time columns reset, billing default applied |
| `update_report` + `get_report_config` | Only customTimeRange and an explicit source | Saved custom mode preserved; new dates persisted |
| `get_report_results` | Session-created report ID | Returned dates matched its updated saved range |
| `delete_report` + `confirm_action` + `list_reports` | Only the session-created report, then exact-name lookup | Deletion completed; no matching report remained |

An initial cleanup assertion expected tool-name fields absent from the approval envelope.
The resource was subsequently read back, deleted through `delete_report`/`confirm_action`,
and its absence verified by an exact-name lookup. A later comparison exposed only machine-
precision cost differences (relative differences below `4e-16`); the numeric tolerance above
addresses that without weakening date or grouping assertions.

Final live run: **17 MCP calls passed**, including disposable creation, read-back, both
update forms, saved results, and confirmed cleanup. The omitted-source update changed
`billing` to `billing-datahub`, matching the customer default. Both reports created during
validation were deleted and absence-checked; no resources remain from these runs.

Local checks passed using Yarn 1.22.22:

- Node 20.20.2 and Node 22.23.2: 1,186 unit tests and 253 integration tests on each.
- Schema parity: 109 tests, including all 106 baseline checks.
- `yarn check:dev`, `yarn check:ci`, builds on both Node versions, and `git diff --check`.
- Live harness syntax checked with `node --check`; it is deliberately excluded from default tests.

Live validation with a personal key does not prove hosted OAuth or live switched-customer
isolation. Switched-customer forwarding is covered deterministically. New layout admission
and allocation dimension types are schema/mock verified, not exercised across all live
configurations. The upstream dimension key-filter issue remains outside this change.
