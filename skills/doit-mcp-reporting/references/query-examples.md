# Common Query Patterns

Use these as starting points for `run_query`. Adapt dimensions, filters, and time ranges to the user's request.

## Monthly Cost by Service

The most common report shape — total cost grouped by service over time.

```
rows: ["fixed:service_description"]
cols: ["datetime:month"]
metric: 0 (COST)
aggregator: "total"
dataSource: "billing"
```

## Daily Cost by Cloud Provider

Useful for comparing AWS vs GCP spend trends.

```
rows: ["fixed:cloud_provider"]
cols: ["datetime:day"]
metric: 0 (COST)
filters: [] (or narrow to specific providers)
```

## Top SKUs by Cost (Last 30 Days)

Drill into the most expensive SKUs.

```
rows: ["fixed:sku_description"]
cols: ["datetime:month"]
metric: 0 (COST)
rowOrder: "desc"
```

Tip: pair with a filter on `fixed:service_description` to narrow to one service.

## Cost by Project and Region

Useful for spotting regional cost concentration.

```
rows: ["fixed:project_name", "fixed:region"]
cols: ["datetime:month"]
metric: 0 (COST)
```

## Kubernetes Cluster Cost

Requires the kubernetes-utilization data source.

```
rows: ["fixed:kubernetes_cluster_name", "fixed:kubernetes_namespace"]
cols: ["datetime:day"]
metric: 0 (COST)
dataSource: "kubernetes-utilization"
```

## BigQuery Cost via BQ Lens

Use the bqlens data source for BQ-specific cost and usage detail.

```
rows: ["fixed:project_name"]
cols: ["datetime:day"]
metric: 0 (COST)
dataSource: "bqlens"
```

## Cost Comparison — This Month vs Last Month

Use `comparative` options if the MCP supports it, or run two queries with different time ranges and compare the results.

## Filtering Examples

**Single cloud provider:**
```
filters: [{ id: "fixed:cloud_provider", values: ["google-cloud"], inverse: false }]
```

**Exclude marketplace:**
```
filters: [{ id: "fixed:is_marketplace", values: ["true"], inverse: true }]
```

**Specific service:**
```
filters: [{ id: "fixed:service_description", values: ["Compute Engine"], inverse: false }]
```

## Query Building Tips

1. Start narrow — one or two rows, one time column, metric 0 (COST).
2. Add filters before adding more row dimensions.
3. Use `rowOrder: "desc"` for top-N queries.
4. If the result set is too large, add a metric filter (e.g., cost > 100).
5. Only switch `dataSource` from `"billing"` when the user specifically asks for BQ Lens, Kubernetes, or DataHub data.
