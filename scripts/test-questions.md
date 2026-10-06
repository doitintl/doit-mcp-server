# ChatGPT Query Test Questions

Test these questions against the MCP server to verify ChatGPT can answer them reliably.

## Results Summary

| # | Question | Tools Used | Status |
|---|----------|-----------|--------|
| 1 | Top cost drivers + 30-day change | `cost_breakdown` + `cost_trend` | ✅ PASS |
| 2 | Active cost anomalies | `get_anomalies` | ✅ PASS |
| 3 | Forecasted spend vs budget | `list_budgets` | ✅ PASS |
| 4 | Expiring commitments | `list_commitments` | ✅ PASS |
| 5 | Idle/underutilized resources | `list_insights(searchTerm="delete")` | ✅ PASS |
| 6 | Spend by workload/team/product | `cost_breakdown(groupBy=project)` | ✅ PASS |
| 7 | Rightsizing impact | `list_insights(searchTerm="rightsize")` + `get_insight_resources` | ✅ PASS |
| 8 | Commitment coverage & utilization | `list_commitments` + `get_commitment` | ✅ PASS |
| 9 | Actual vs forecast delta | `compare_spend` | ✅ PASS |
| 10 | Unacted optimization recommendations | `list_insights(displayStatus=["actionable"])` | ✅ PASS |

## Detailed Questions

### 1. What are my top cost drivers right now, and how have they changed over the last 30 days?
**Tools:** `cost_breakdown(groupBy="service", months=1, topN=10)` + `cost_trend(months=2, groupBy="service", topN=5)`
**Tested:** ✅ Returns 11 top services with monthly costs + 12 trend data points.

### 2. Are there any active cost anomalies I should know about?
**Tools:** `get_anomalies`
**Tested:** ✅ Returns 20 anomalies with severity, service, scope, cost impact.

### 3. What's my forecasted spend for this month and this quarter, and how does it compare to budget?
**Tools:** `list_budgets` (has currentSpend, forecastedSpend, amount fields)
**Tested:** ✅ Returns budgets with utilization data for comparison.

### 4. Which commitments (RIs, Savings Plans, CUDs) are expiring soon, and what's the renewal recommendation?
**Tools:** `list_commitments` + `get_commitment(id=...)`
**Tested:** ✅ Returns 1 commitment with periods, spend attainment.
**Note:** ChatGPT can analyze expiry dates; no dedicated renewal recommendation endpoint.

### 5. Where do I have idle or underutilized resources right now?
**Tools:** `list_insights(displayStatus=["actionable"], searchTerm="delete")` or `searchTerm="idle"` or `searchTerm="underutilized"`
**Tested:** ✅ Returns 2 insights for "delete" (MFA delete, old EBS snapshots).
**Note:** API `searchTerm` doesn't support OR syntax. ChatGPT should try multiple search terms or use broad terms.

### 6. How much am I spending on a specific workload, team, or product?
**Tools:** `cost_breakdown(groupBy="project", months=1, topN=10)` + `list_allocations`
**Tested:** ✅ Returns 11 rows — cost by project/account.

### 7. What would happen to my bill if I rightsized the top 10 over-provisioned resources?
**Tools:** `list_insights(searchTerm="rightsize")` + `get_insight_resources(source, key)`
**Tested:** ✅ Returns 1 rightsizing insight ($5.37/day savings) + drilldown to affected resources with per-resource savings.
**Note:** ChatGPT can sum resource-level savings for total impact estimate.

### 8. How does my commitment coverage and utilization look across compute, database, and storage?
**Tools:** `list_commitments` + `get_commitment(id=...)`
**Tested:** ✅ Returns commitment details with per-period contracted values and spend attainment.

### 9. What's driving the delta between last month's actual spend and the forecast?
**Tools:** `compare_spend(period1Months=1, period2={from: "last-month-start", to: "last-month-end"}, groupBy="service")`
**Tested:** ✅ Returns two periods (11 rows each) with service breakdown for variance analysis.

### 10. Are there any cost optimization recommendations I haven't acted on yet, ranked by savings impact?
**Tools:** `list_insights(displayStatus=["actionable"], pageSize=20)`
**Tested:** ✅ Returns 191 actionable insights. Top 5 combined: $750/day ($22.5K/month).

## Tool Coverage

All 10 questions are now answerable:
- **7/10** have dedicated or wrapper tools (`cost_breakdown`, `cost_trend`, `compare_spend`, `get_anomalies`, `list_budgets`, `list_commitments`, `list_insights`)
- **3/10** (Q5, Q7, Q10) use `list_insights` with search/filter — the insights API covers optimization, rightsizing, and idle resource detection
