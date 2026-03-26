---
name: doit-mcp-reporting
description: Generate DoiT Cloud Intelligence reports through MCP with the correct tool order and minimal query surface. Use when the agent needs to retrieve saved report results, run ad hoc Cloud Analytics queries, summarize invoices, list dimensions before building a query, or produce report-style output from the DoiT MCP server.
---

# DoiT MCP Reporting

Generate report answers through DoiT MCP in the smallest reliable sequence. Prefer existing reports when they already answer the request.

## Reference Files

Read these as needed when building queries:

- `references/dimensions.md` — all dimension IDs (datetime, fixed, label, kubernetes, attribution). Read this when choosing `rows`, `cols`, or `filters` for a query.
- `references/metrics-and-options.md` — metric types, aggregators, time intervals, data sources, filter operators. Read this when configuring query options.
- `references/query-examples.md` — common query patterns with ready-to-use field combinations. Read this before building an ad hoc query to see if a pattern already fits.
- `templates/report-output.md` — output template for presenting results. Copy and fill in when formatting the final report.

## Core Tool Order

Use these DoiT MCP tools in this order when applicable:

1. `validate_user`
2. `list_reports` or `list_dimensions`
3. `get_report_results` or `run_query`

Skip only the steps that are clearly unnecessary.

## Session Start

- Call `validate_user` first when the request depends on account access, tenant identity, or you need to confirm the MCP session is scoped correctly.
- If the user already provided enough context and the session is clearly valid, you may skip `validate_user`.

## Existing Report Workflow

Use this when the user mentions a saved report, dashboard-style output, or a named report such as monthly cost overview.

1. Call `list_reports`.
2. Match by exact name first, then by obvious close match.
3. If multiple reports are plausible, ask one short clarifying question instead of choosing arbitrarily.
4. Call `get_report_results` only after you identify the target report.

Prefer this path over `run_query` when a saved report already exists.

## Ad Hoc Query Workflow

Use this when the user wants a slice that is unlikely to map to a saved report.

1. Call `list_dimensions` if the requested grouping or filter fields are unclear.
2. Build the narrowest possible query — see `references/query-examples.md` for starting patterns.
3. Call `run_query`.
4. If the first query is too broad, refine and rerun instead of returning a noisy dump.

Do not call `list_dimensions` for dimensions you already know from the request.

## Output Rules

- Format results using the template in `templates/report-output.md`.
- Include the time window, grouping, and metric assumptions you used.
- Call out when the answer comes from a saved report versus an ad hoc query.
- If the user asks for top-N output, sort and trim before presenting it.
- If the MCP result is incomplete or ambiguous, say what is missing and ask one focused follow-up.

## Gotchas

- **Saved reports first**: Always check `list_reports` before building an ad hoc query. Many common requests already have saved reports — running a fresh query wastes time and may produce slightly different numbers due to config differences.
- **Dimension IDs are prefixed**: Use `fixed:service_description`, not `service_description`. The prefix is required. See `references/dimensions.md` for the full list.
- **Label dimensions are base64-encoded**: Custom labels use the format `label:{base64_key}`. Call `list_dimensions` to discover the actual encoded IDs rather than guessing.
- **Data source matters**: The default is `billing`. Switching to `bqlens`, `kubernetes-utilization`, or `billing-datahub` changes the available dimensions and the numbers. Only switch when the user specifically asks for BQ Lens, K8s, or DataHub data.
- **Metric 0 is cost**: The metric field is a numeric enum, not a string. `0` = cost, `1` = usage, `2` = savings. Using the wrong number silently returns different data.
- **Time interval vs. time range**: `timeInterval` controls the column granularity (day, month, etc.). The time *range* (last 30 days, last quarter) is a separate field. Setting daily interval on a year-long range produces a massive result set.
- **Credits can change totals**: `includeCredits` defaults may vary. If the user's numbers don't match expectations, check whether credits are included or excluded.
- **Currency context**: Results are in the customer's configured currency. If comparing across customers or quoting absolute numbers, note the currency.
- **Empty results are valid**: A query that returns zero rows may mean the filter is too narrow or the dimension doesn't apply to the selected platform — not that something is broken.

## Anti-Patterns

- Do not call `run_query` before deciding whether a saved report already exists.
- Do not enumerate every available report when the user asked for one report.
- Do not use anomaly tools for generic reporting unless the user explicitly asked about anomalies.
- Do not expose raw JSON unless the user asked for raw output.
- Do not build queries with more than 3 row dimensions — the result set becomes unreadable. Narrow with filters instead.
- Do not guess dimension IDs for labels or attributions — always call `list_dimensions` to discover them.
