---
name: doit-api-assistant
description: This skill should be used when the user asks to "call the DoiT API", "query cloud costs", "build a cost analysis query", "list DoiT reports", "filter costs by service", "get spending data", "analyze cloud spending", or needs help with DoiT Platform Analytics API integration.
version: 1.1.0
---

# DoiT API Code Generator

Generate correct DoiT Platform API calls for cost analytics. Use this skill to produce production-ready code when developers need to integrate DoiT cost analytics into their applications.

## When to Use

Activate this skill when a developer:

- Asks how to call the DoiT API
- Needs to build a cost analysis query
- Wants to list, filter, or retrieve reports
- Needs to query dimensions, anomalies, or incidents
- Is debugging a DoiT API call
- Wants code examples in any language

---

## Quick Reference

### Dimension Mappings

Map natural language to dimension IDs:

| Natural Language | Dimension ID | Type |
| --------------- | ------------ | ---- |
| "by service" | `service_description` | fixed |
| "by project" | `project_id` | fixed |
| "by project name" | `project_name` | fixed |
| "by region" | `region` | fixed |
| "by cloud provider" | `cloud_provider` | fixed |
| "by resource" | `resource_id` | fixed |
| "by SKU" | `sku_description` | fixed |
| "by unit" | `pricing_unit` | fixed |
| "by billing account" | `billing_account_id` | fixed |
| "by cost type" | `cost_type` | fixed |
| "by team" | Use `attribution_group` type with UUID ID from `list_dimensions` | attribution_group |
| "by invoice" | `invoice_month` | fixed |

### Cloud Provider Filter Values

| Natural Language | Filter Value |
| --------------- | ------------ |
| "AWS", "Amazon" | `amazon-web-services` |
| "GCP", "Google Cloud" | `google-cloud` |
| "Azure", "Microsoft" | `microsoft-azure` |

---

### Time Range Mappings

| Developer Says | Generated timeRange |
| ------------- | ------------------- |
| "last 30 days" | `{ mode: 'last', amount: 30, unit: 'day', includeCurrent: false }` |
| "last 7 days" | `{ mode: 'last', amount: 7, unit: 'day', includeCurrent: false }` |
| "last month" | `{ mode: 'last', amount: 1, unit: 'month', includeCurrent: false }` |
| "this month" | `{ mode: 'last', amount: 1, unit: 'month', includeCurrent: true }` |
| "last quarter" | `{ mode: 'last', amount: 1, unit: 'quarter', includeCurrent: false }` |
| "last year" | `{ mode: 'last', amount: 1, unit: 'year', includeCurrent: false }` |
| "Q1 2024" | Use `customTimeRange` with calculated dates |

---

### Metric Types

| Developer Says | Metric Config |
| ------------- | ------------- |
| "cost", "costs", "spend" | `{ type: 'basic', value: 'cost' }` |
| "usage", "consumption" | `{ type: 'basic', value: 'usage' }` |
| "savings" | `{ type: 'basic', value: 'savings' }` |
| "credits" | `{ type: 'basic', value: 'credit' }` |
| "discounts" | `{ type: 'basic', value: 'discount' }` |

---

### Time Interval Mappings

Control data aggregation granularity:

| User Intent | timeInterval | Typical Rows | Use Case |
| ----------- | ------------ | ------------ | -------- |
| "hourly breakdown" | `'hour'` | 24-720 rows | Real-time monitoring |
| "daily breakdown" | `'day'` or omit | 7-365 rows | Default behavior |
| "weekly totals" | `'week'` | 4-52 rows | Weekly reports |
| "monthly totals" | `'month'` | 1-12 rows | Monthly analysis (recommended) |
| "quarterly totals" | `'quarter'` | 1-4 rows | Quarterly reviews |
| "yearly totals" | `'year'` | 1-5 rows | Annual reports |

> **Note:** Omitting `timeInterval` defaults to daily breakdown. For time ranges > 7 days, specify `timeInterval` to avoid hundreds of rows.

---

### Parameter Reference

Common optional parameters:

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `customerId` | string | All accessible | Specific customer ID for multi-customer environments |
| `timeInterval` | string | `'day'` | Aggregation level: hour, day, week, month, quarter, year |
| `filters` | array | `[]` | Filter results by dimension values |
| `group` | array | `[]` | Dimensions to group results by |

**customerId Usage:**

- **Omit:** Query returns data for all accessible customers
- **Include:** Query returns data for specific customer only (e.g., `'KzDE3pXU4KeQ3b53ciDN'`)

---

### Filter Combination Logic

Understanding how filters combine:

| Pattern | Syntax | Logic | Example |
| ------- | ------ | ----- | ------- |
| **OR within filter** | `values: ['A', 'B']` | Matches A OR B | `values: ['aws', 'gcp']` matches AWS or GCP |
| **AND between filters** | Multiple filter objects | All must match | Filter 1 AND Filter 2 AND Filter 3 |
| **NOT (exclusion)** | `inverse: true` | Excludes values | `inverse: true, values: ['test']` excludes test |
| **Complex** | Combine patterns | Nested logic | `(A OR B) AND (C OR D) AND NOT (E OR F)` |

**Example:**

```typescript
// Get costs for (AWS OR GCP) AND us-east-1 AND NOT test environment
filters: [
  {
    id: 'cloud_provider',
    type: 'fixed',
    inverse: false,
    values: ['amazon-web-services', 'google-cloud']  // AWS OR GCP
  },
  {
    id: 'region',
    type: 'fixed',
    inverse: false,
    values: ['us-east-1']  // AND us-east-1
  },
  {
    id: 'attribution_group',
    type: 'attribution',
    inverse: true,
    values: ['test']  // AND NOT test
  }
]
```

---

## MCP Tool Mapping

When using the DoiT MCP server instead of direct HTTP calls:

| Operation | MCP Tool | HTTP Endpoint | Usage Notes |
| --------- | -------- | ------------- | ----------- |
| Run ad-hoc query | `run_query` | `POST /reports/query` | Pass `config` object directly in arguments |
| List reports | `list_reports` | `GET /reports` | No arguments required |
| Get report results | `get_report_results` | `GET /reports/{id}/results` | Requires `reportId` argument |
| List dimensions | `list_dimensions` | `GET /dimensions` | Optional `filter` argument |
| Get dimension | `get_dimension` | `GET /dimensions/{id}` | Requires `dimensionId` argument |
| Get anomalies | `get_anomalies` | `GET /anomalies` | Optional `startDate`, `endDate` arguments |
| Get incidents | `get_cloud_incidents` | `GET /cloud-incidents` | Optional filtering arguments |
| Validate user | `validate_user` | `GET /user` | No arguments required |

### Generic MCP Client Usage

```typescript
// Generic MCP client interface (works with any MCP implementation)
interface MCPClient {
  callTool(request: { name: string; arguments: Record<string, any> }): Promise<any>;
}

// Example: Run query via MCP
const result = await mcpClient.callTool({
  name: 'run_query',
  arguments: {
    config: {
      dataSource: 'billing',
      metric: { type: 'basic', value: 'cost' },
      timeRange: { mode: 'last', amount: 1, unit: 'month', includeCurrent: false },
      timeInterval: 'month'
    }
  }
});
```

---

## Basic Query Structure

### Response Schema

Query results automatically include these columns alongside your grouped dimensions:

| Column | Type | Description |
| ------ | ---- | ----------- |
| *(grouped dim)* | string | Each `group` dimension becomes a column |
| `year` | string | Year of the data point |
| `month` | string | Month of the data point |
| `cost` | float | The metric value (named by metric type) |
| `timestamp` | timestamp | Unix timestamp of the period |

> **Note:** Results include a `∑ Other` aggregated row when the `limit` value is exceeded.

```typescript
// Example 1: Monthly aggregation (recommended for cost analysis)
const monthlyQuery = {
  config: {
    dataSource: 'billing',
    metric: { type: 'basic', value: 'cost' },
    timeRange: { mode: 'last', amount: 1, unit: 'month', includeCurrent: false },
    timeInterval: 'month',  // Aggregate by month (returns ~6 rows per service)
    group: [{
      id: 'service_description',
      type: 'fixed',
      limit: { metric: { type: 'basic', value: 'cost' }, sort: 'desc', value: 25 }
    }]
  }
};

// Example 2: Daily breakdown (default behavior)
const dailyQuery = {
  config: {
    dataSource: 'billing',
    metric: { type: 'basic', value: 'cost' },
    timeRange: { mode: 'last', amount: 30, unit: 'day', includeCurrent: false },
    // No timeInterval = daily rows (returns ~750 rows for 30 days)
    group: [{
      id: 'service_description',
      type: 'fixed',
      limit: { metric: { type: 'basic', value: 'cost' }, sort: 'desc', value: 25 }
    }]
  }
};
```

> [!IMPORTANT]
> Always verify dimension IDs with `list_dimensions` before using them in queries to prevent 400 Bad Request errors.

<!-- -->

> [!WARNING]
> Omitting `timeInterval` returns daily data by default, which can produce hundreds of rows. For cost analysis over weeks or months, always specify `timeInterval: 'month'` or `'week'` to aggregate results.

---

## Additional Resources

### Reference Files

For detailed specifications and patterns, consult:

- **`references/api-reference.md`** — Full endpoint specifications, request/response schemas, validation rules
- **`references/code-examples.md`** — Complete TypeScript, Python, Go, and cURL examples
- **`references/troubleshooting.md`** — Error handling, HTTP status codes, common scenarios
  - **Report Comparison Workflow** — Step-by-step guide for matching query results with saved reports

### Example Files

Working examples in `examples/` that can be copied and adapted:

- **`examples/query-costs-by-service.ts`** — TypeScript example
- **`examples/query-costs-by-service.py`** — Python example
- **`examples/query-costs-by-service.sh`** — Bash/cURL example
