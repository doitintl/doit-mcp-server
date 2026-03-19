# Service Name Abbreviations

DoiT anomalies use abbreviated service names that may differ from the full cloud-native names. Use this mapping when searching cloud MCP tools by service.

## AWS Services

| DoiT / Anomaly Name | Full Cloud Name |
|---------------------|-----------------|
| Amazon EC2 | Amazon Elastic Compute Cloud |
| Amazon EMR | Amazon Elastic MapReduce |
| Amazon RDS | Amazon Relational Database Service |
| Amazon S3 | Amazon Simple Storage Service |
| Amazon CloudWatch | AmazonCloudWatch |
| Amazon ACM | AWS Certificate Manager |
| Amazon SES | Amazon Simple Email Service |

## GCP Services

| DoiT / Anomaly Name | Full Cloud Name |
|---------------------|-----------------|
| Google BigQuery | BigQuery |
| Google BigQuery BI Engine | BigQuery BI Engine |
| Google BigQuery Reservations | BigQuery Reservation API |
| Google Cloud Composer | Cloud Composer |
| Google Dataflow | Cloud Dataflow |
| Google Cloud Functions | Cloud Functions |
| Google Cloud Logging | Cloud Logging |
| Google Pub/Sub | Cloud Pub/Sub |
| Google Cloud Run | Cloud Run |
| Google Cloud Run Functions | Cloud Run Functions |
| Google Cloud Storage | Cloud Storage |
| Google Compute Engine | Compute Engine |
| Google Container Registry Scanning | Container Registry Vulnerability Scanning |
| Google Vertex AI | Vertex AI |

## Usage Notes

- When filtering in cloud MCP tools, try the full cloud-native name first.
- If the anomaly `serviceName` does not match a cloud API filter, check this table for the mapping.
- GCP `@google-cloud/*` SDK packages use the full cloud name (e.g., `@google-cloud/bigquery`).
