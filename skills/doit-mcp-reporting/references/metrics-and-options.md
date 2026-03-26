# Metrics and Query Options

## Metric Types

| Value | Name | Use For |
|-------|------|---------|
| `0` (COST) | Cost | Standard cloud cost — the default for most reports |
| `1` (USAGE) | Usage | Usage-based metrics (requests, bytes, etc.) |
| `2` (SAVINGS) | Savings | Commitment/reservation savings |
| `3` (MARGIN) | Margin | Margin calculations |
| `4` (CALCULATED) | Calculated | Custom calculated metrics |
| `5` (EXTENDED) | Extended | DataHub metrics, amortized cost |

Extended metric values: `"amortized_cost"` for commitment amortization, or DataHub-specific keys.

## Aggregators

| Value | Description |
|-------|-------------|
| `total` | Sum all values (default) |
| `total_over_total` | Ratio of totals |
| `percent_total` | Percentage of grand total |
| `percent_row` | Percentage of row total |
| `percent_col` | Percentage of column total |
| `count` | Count distinct items |

## Time Intervals

| Value | Use When |
|-------|----------|
| `hour` | Last 24-48 hours, real-time investigation |
| `day` | Last 7-45 days, daily trends |
| `week` | Last 3-6 months, weekly patterns |
| `month` | Last 6-12 months, monthly trends |
| `quarter` | Year-over-year, quarterly reviews |
| `year` | Multi-year trends |

## Data Sources

| Value | Description |
|-------|-------------|
| `billing` | Standard billing data (default) |
| `bqlens` | BigQuery Lens — BQ-specific cost/usage |
| `billing-datahub` | DataHub billing (alternative source) |
| `kubernetes-utilization` | Kubernetes usage data |
| `customer_features` | Customer feature flags |
| `genai-collection` | GenAI collection data |

## Filter Operators (for metric filters)

`>`, `<`, `>=`, `<=`, `between`, `not_between`, `=`, `!=`

## Filter Modes (for dimension filters)

`is`, `starts_with`, `ends_with`, `contains`, `regexp`

## Sort Options

| Value | Description |
|-------|-------------|
| `a_to_z` | Alphabetical |
| `asc` | Ascending numeric |
| `desc` | Descending numeric |
