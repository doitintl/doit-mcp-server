export const gcp_global_resource_id = `
global_resource_id: In GCP, a resource_id uniquely identifies resources (VMs, buckets, datasets, etc.) 
and typically includes the project, resource type, and location.

Examples:
• Compute Engine (VM Instances): VM name
• Cloud Storage (Buckets): Bucket name
• BigQuery (Datasets): Dataset name
• Cloud Pub/Sub (Topics): Topic name
• Cloud Functions: Function name
• Cloud SQL (Instances): Instance name
• IAM Policies (Custom Roles): Role name
• Kubernetes Engine (Clusters): Cluster name
• Cloud Spanner (Instances): Instance name
• Cloud Run (Services): Service name
• Cloud DNS (Managed Zones): Zone name
• Cloud Logging (Logs): Log name

Always use global_resource_id to precisely identify, locate, and manage GCP resources.
`;

export const aws_global_resource_id = `
global_resource_id: In AWS, a resource_id typically takes the form of an Amazon Resource Name (ARN), 
which uniquely identifies resources across all AWS services.


Examples:
• EC2 Instances: arn:aws:ec2:us-west-2:123456789012:instance/i-0abcd1234efgh5678
• S3 Buckets: arn:aws:s3:::my-bucket-name
• Lambda Functions: arn:aws:lambda:us-east-1:123456789012:function:my-function
• DynamoDB Tables: arn:aws:dynamodb:us-east-1:123456789012:table/MyTable
• IAM Roles: arn:aws:iam::123456789012:role/MyRole
• RDS Instances: arn:aws:rds:us-east-1:123456789012:db:mydb
• EKS Clusters: arn:aws:eks:us-west-2:123456789012:cluster/my-cluster
• SQS Queues: arn:aws:sqs:us-east-1:123456789012:my-queue

Always use the global_resource_id (ARN) to precisely identify, locate, and manage AWS resources.
`;
