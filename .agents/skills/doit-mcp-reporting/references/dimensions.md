# Dimension Reference

Dimensions available for `run_query` grouping and filtering. Use `list_dimensions` to confirm availability for the current customer — not all dimensions are available for all platforms.

## Datetime Dimensions

Use these in `cols` for time-series output:

| Dimension ID | Granularity |
|-------------|-------------|
| `datetime:year` | Yearly |
| `datetime:quarter` | Quarterly |
| `datetime:month` | Monthly |
| `datetime:week` | Weekly |
| `datetime:day` | Daily |
| `datetime:hour` | Hourly |

## Fixed Dimensions

Standard fields available across most platforms:

| Dimension ID | Description |
|-------------|-------------|
| `fixed:billing_account_id` | Billing account |
| `fixed:cloud_provider` | Cloud/platform (google-cloud, amazon-web-services, etc.) |
| `fixed:project_id` | Project ID (GCP) or Account ID (AWS) |
| `fixed:project_name` | Project display name |
| `fixed:project_number` | Project/Account number |
| `fixed:region` | Cloud region |
| `fixed:service_description` | Service name |
| `fixed:sku_description` | SKU name |
| `fixed:operation` | Operation type |
| `fixed:resource_id` | Resource identifier |
| `fixed:resource_global_id` | Global resource identifier |
| `fixed:cost_type` | Cost type |
| `fixed:country` | Country |
| `fixed:credit` | Credit type |
| `fixed:feature` | Feature |
| `fixed:invoice_month` | Invoice month |
| `fixed:is_marketplace` | Whether it is a marketplace purchase |
| `fixed:pricing_unit` | Pricing unit |
| `fixed:savings_description` | Savings plan/commitment description |

## Kubernetes Dimensions

| Dimension ID | Description |
|-------------|-------------|
| `fixed:kubernetes_cluster_name` | K8s cluster name |
| `fixed:kubernetes_namespace` | K8s namespace |
| `gke:{field}` | GKE-specific fields |
| `gke_label:{label_key}` | GKE labels |
| `eks:cluster-name` | EKS cluster name |
| `eks:nodegroup-name` | EKS node group name |

## Label Dimensions

Labels use base64-encoded keys:

| Pattern | Description |
|---------|-------------|
| `label:{base64_key}` | Custom resource labels |
| `system_label:{base64_key}` | System labels (GCP) |
| `project_label:{base64_key}` | Project-level labels |

## Attribution Dimensions

| Pattern | Description |
|---------|-------------|
| `attribution:attribution` | Custom attribution rules |
| `attribution_group:{group_id}` | Attribution groups |
