# ChatGPT Query Test Questions

Test these questions against the MCP server to verify ChatGPT can answer them reliably.

## Results Summary

| # | Question | Tools Used | Status |
|---|----------|-----------|--------|
| 1 | Top cost drivers + 30-day change | `cost_breakdown` + `cost_trend` | ✅ PASS |
| 2 | Active cost anomalies | `get_anomalies` | ✅ PASS |
| 3 | Forecasted spend vs budget | `list_budgets` | ⚠️ PASS (0 budgets on test account) |
| 4 | Expiring commitments | `list_commitments` | ✅ PASS |
| 5 | Idle/underutilized resources | — | ❌ NO TOOL |
| 6 | Spend by workload/team/product | `cost_breakdown(groupBy=project)` + `list_allocations` | ✅ PASS |
| 7 | Rightsizing impact | — | ❌ NO TOOL |
| 8 | Commitment coverage & utilization | `list_commitments` + `get_commitment` | ✅ PASS |
| 9 | Actual vs forecast delta | `compare_spend` | ✅ PASS |
| 10 | Unacted optimization recommendations | — | ❌ NO TOOL |

## Detailed Questions

### 1. What are my top cost drivers right now, and how have they changed over the last 30 days?
**Tools:** `cost_breakdown(groupBy="service", months=1, topN=10)` + `cost_trend(months=2, groupBy="service", topN=5)`
**Tested:** ✅ Returns top services by cost with monthly aggregation.

### 2. Are there any active cost anomalies I should know about?
**Tools:** `get_anomalies`
**Tested:** ✅ Returns anomalies with severity, service, scope, cost impact.

### 3. What's my forecasted spend for this month and this quarter, and how does it compare to budget?
**Tools:** `list_budgets` (has currentSpend, forecastedSpend, amount fields)
**Tested:** ⚠️ Works but test account has no budgets configured. Tool returns correct structure.

### 4. Which commitments (RIs, Savings Plans, CUDs) are expiring soon, and what's the renewal recommendation?
**Tools:** `list_commitments` + `get_commitment(id=...)`
**Tested:** ✅ Returns commitment contracts with periods, spend attainment.
**Note:** Renewal recommendations not available — ChatGPT can analyze expiry dates and suggest but no dedicated recommendation API.

### 5. Where do I have idle or underutilized resources right now?
**Tools:** None available
**Gap:** No idle resource detection tool. Would require:
- A new tool wrapping DoiT's optimization recommendations API, or
- CloudFlow-based idle resource detection

### 6. How much am I spending on a specific workload, team, or product?
**Tools:** `cost_breakdown(groupBy="project")` + `list_allocations` + `run_query` with label filters
**Tested:** ✅ Returns cost by project/account. Allocations provide team-level groupings.

### 7. What would happen to my bill if I rightsized the top 10 over-provisioned resources?
**Tools:** None available
**Gap:** No rightsizing or scenario modeling tool. Would require DoiT Flexsave or optimization recommendations API.

### 8. How does my commitment coverage and utilization look across compute, database, and storage?
**Tools:** `list_commitments` + `get_commitment(id=...)`
**Tested:** ✅ Returns commitment details with per-period contracted values and spend attainment.

### 9. What's driving the delta between last month's actual spend and the forecast?
**Tools:** `compare_spend(period1Months=1, period2={from: "last-month-start", to: "last-month-end"}, groupBy="service")`
**Tested:** ✅ Returns two periods with service breakdown for variance analysis.

### 10. Are there any cost optimization recommendations I haven't acted on yet, ranked by savings impact?
**Tools:** None available
**Gap:** No optimization recommendations API tool. This is a common request that would benefit from a dedicated tool.

## Tool Gaps

Three questions (5, 7, 10) cannot be answered with current tools. These require:
- **Optimization recommendations API** — idle resources, rightsizing, savings plans recommendations
- **Scenario modeling** — "what if" analysis for rightsizing impact
- **Recommendation backlog** — accumulated suggestions with staleness tracking
